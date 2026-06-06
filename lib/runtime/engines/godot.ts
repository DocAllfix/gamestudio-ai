/**
 * Godot EngineAdapter — Workstream W3.
 *
 * Godot ships to the web as a headless WASM export:
 *   build()     = `godot --headless --export-release "Web" <out>` then
 *                 inject coi-serviceworker.js (cross-origin isolation is
 *                 required for SharedArrayBuffer / threaded WASM), then
 *                 verify every expected Web-export file exists. A missing
 *                 file is surfaced as a non-zero CommandResult.
 *   smokeTest() = headless WASM load + crash detection via a JSON-line
 *                 runner (shared parse helper).
 *   package()   = zip the export dir + upload to R2.
 *
 * Required E2B template binaries are documented in
 * lib/runtime/sandbox/E2B_TEMPLATE.md (W3 owns the template).
 */
import type {
    BuildArtifact,
    CommandResult,
    EngineAdapter,
    SandboxHandle,
    SmokeTestResult,
    WebBuildArtifact,
} from "../../contracts/assembly-pipeline.contract.js";
import type { Engine } from "../../contracts/game-plan.contract.js";
import type { SandboxSession } from "../sandbox/e2b.js";
import {
    bootEngineSandbox,
    packageArtifact,
    parseSmokeOutput,
    runCommandVia,
    type RuntimeAdapterDeps,
    SMOKE_DURATION_MS,
    webExportBundle,
    writeFileVia,
} from "./_runtime-helpers.js";

/** Web-export output dir inside the sandbox. */
export const GODOT_EXPORT_DIR = "/project/build/web";
/** Headless WASM smoke runner dropped into the sandbox. */
export const GODOT_SMOKE_RUNNER = "/project/godot-smoke-runner.cjs";

/** Headless smoke for a Godot Web export: serve the export dir, load
 * index.html, and report {passed, crash_reason}. passed=false on a Godot
 * USER/SCRIPT ERROR or page error — catching "boots but broken" (e.g. the
 * empty-scene RefCounted bug). CommonJS so a global require resolves via
 * NODE_PATH. */
const GODOT_SMOKE_RUNNER_SOURCE = `
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const dir = process.argv[2];
const PORT = 8731;
const MIME = { ".html":"text/html", ".js":"text/javascript", ".wasm":"application/wasm", ".pck":"application/octet-stream", ".png":"image/png" };

const server = http.createServer((req, res) => {
  const f = path.join(dir, req.url === "/" ? "index.html" : req.url.split("?")[0]);
  fs.readFile(f, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    // Godot wasm needs cross-origin isolation for SharedArrayBuffer.
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(f)] || "application/octet-stream",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    });
    res.end(data);
  });
});

(async () => {
  let crash = null, browser;
  await new Promise((r) => server.listen(PORT, r));
  try {
    browser = await chromium.launch({ args: ["--no-sandbox"] });
    const page = await browser.newPage();
    const fail = (t) => { if (!crash && /USER ERROR|SCRIPT ERROR|can't be assigned|instance_create|Failed to instantiate/i.test(t)) crash = t.slice(0, 200); };
    page.on("console", (m) => fail(m.text()));
    page.on("pageerror", (e) => { if (!crash) crash = "pageerror: " + String(e.message).slice(0, 200); });
    await page.goto("http://localhost:" + PORT + "/index.html", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(${SMOKE_DURATION_MS});
    // Require the engine to have actually booted.
    const booted = await page.evaluate(() => /Godot Engine|WebGL/i.test(document.documentElement.outerHTML) || !!window.WebGL2RenderingContext);
    if (!crash && !booted) crash = "engine did not boot";
  } catch (e) {
    crash = "runner: " + String(e && e.message ? e.message : e).slice(0, 200);
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.close();
  }
  console.log(JSON.stringify({ passed: crash === null, crash_reason: crash }));
})();
`;

/** Files a Godot 4 Web (WASM) export must produce, plus the injected
 * coi-serviceworker. Verified post-export to catch a silent export
 * failure (Godot can exit 0 yet emit nothing if templates are missing). */
export const GODOT_EXPECTED_FILES = [
    "index.html",
    "index.js",
    "index.wasm",
    "index.pck",
    "coi-serviceworker.js",
] as const;

export class GodotAdapter implements EngineAdapter {
    readonly engine: Engine = "godot";

    constructor(private readonly deps: RuntimeAdapterDeps) {}

    bootSandbox(): Promise<SandboxHandle> {
        return bootEngineSandbox(this.deps);
    }

    writeFile(sandbox: SandboxHandle, path: string, content: string | Buffer): Promise<void> {
        return writeFileVia(sandbox, path, content);
    }

    runCommand(sandbox: SandboxHandle, command: string, timeoutMs?: number): Promise<CommandResult> {
        return runCommandVia(sandbox, command, timeoutMs);
    }

    async build(sandbox: SandboxSession): Promise<CommandResult> {
        const start = Date.now();
        // First import the project so Godot generates its .godot/ cache (a
        // fresh project has none, which otherwise errors during export). The
        // import exits non-zero by design (it has no main loop) — that's fine.
        await sandbox.runCommand(
            `mkdir -p ${GODOT_EXPORT_DIR} && cd /project && ` +
            `GODOT_SILENCE_ROOT_WARNING=1 timeout 60 godot --headless --path /project --import || true`,
        );
        // Then export. Run inside the project dir with --path so Godot resolves
        // project.godot + export_presets.cfg from there (not the cwd).
        const exportCmd = await sandbox.runCommand(
            `cd /project && GODOT_SILENCE_ROOT_WARNING=1 godot --headless --path /project ` +
            `--export-release "Web" ${GODOT_EXPORT_DIR}/index.html`,
        );
        if (exportCmd.exit_code !== 0) {
            return exportCmd;
        }

        // Cross-origin isolation: SharedArrayBuffer needs COOP/COEP, which
        // R2/itch static hosting can't set. coi-serviceworker injects them
        // client-side. (See E2B_TEMPLATE.md.)
        await sandbox.runCommand(
            `cp /opt/coi-serviceworker.js ${GODOT_EXPORT_DIR}/coi-serviceworker.js`,
        );

        const missing: string[] = [];
        for (const file of GODOT_EXPECTED_FILES) {
            const check = await sandbox.runCommand(
                `test -f ${GODOT_EXPORT_DIR}/${file}`,
            );
            if (check.exit_code !== 0) missing.push(file);
        }
        if (missing.length > 0) {
            console.error("godot.build missing export files", { missing });
            return {
                exit_code: 1,
                stdout: exportCmd.stdout,
                stderr: `Godot Web export missing files: ${missing.join(", ")}`,
                duration_ms: Date.now() - start,
            };
        }

        return { ...exportCmd, duration_ms: Date.now() - start };
    }

    async smokeTest(sandbox: SandboxSession): Promise<SmokeTestResult> {
        const start = Date.now();
        // Nothing else creates the runner — write it, then run it. The runner
        // serves the export dir over http (Godot's wasm fetches sibling files,
        // which file:// blocks), loads index.html in headless Chromium, and
        // fails on a Godot USER/SCRIPT ERROR (e.g. the RefCounted-vs-Node2D
        // mismatch that loads an empty scene). A plain wasm-load check missed
        // exactly that class of "boots but the game is broken" failure.
        await sandbox.writeFile(GODOT_SMOKE_RUNNER, GODOT_SMOKE_RUNNER_SOURCE);
        const result = await sandbox.runCommand(
            `NODE_PATH="$(npm root -g)" node ${GODOT_SMOKE_RUNNER} ${GODOT_EXPORT_DIR}`,
            SMOKE_DURATION_MS + 20_000,
        );
        return parseSmokeOutput(result, Date.now() - start);
    }

    async package(sandbox: SandboxSession): Promise<BuildArtifact> {
        return packageArtifact(sandbox, this.deps, this.engine, {
            sourceDir: "build/web",
        });
    }

    /** WASM Web export served from R2 as the embeddable bundle. No native
     * .apk day-1 (godot .apk is feature-flagged, out of scope). */
    async webExport(sandbox: SandboxSession): Promise<WebBuildArtifact> {
        return webExportBundle(sandbox, this.deps, this.engine, {
            webDir: GODOT_EXPORT_DIR,
            entry: "index.html",
            target: "browser",
        });
    }
}
