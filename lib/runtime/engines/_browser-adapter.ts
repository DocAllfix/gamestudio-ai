/**
 * Shared base for browser-native EngineAdapters (Phaser, Three.js).
 *
 * Both engines are plain JS/TS that run in a browser, so their runtime
 * shape is identical:
 *   build()     = esbuild bundle of the entry into dist/bundle.js
 *   smokeTest() = headless Chromium runner loads the bundle for ~10s and
 *                 prints one JSON line {passed, crash_reason} we parse
 *   package()   = zip dist/ in the sandbox + upload to R2
 *
 * Babylon ([4-W3]) reuses build/package but overrides smokeTest with
 * NullEngine. The smoke-output parsing and zip→R2 packaging are shared
 * with Godot/Defold via _runtime-helpers.ts.
 *
 * All sandbox work goes through the injected SandboxSession ([1-W3]); R2
 * goes through the injected R2Client. Tests drive both with fakes (no
 * network), matching the [1-W3] pattern.
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

export { SMOKE_DURATION_MS } from "./_runtime-helpers.js";

/** Sandbox-conventional paths shared by the browser engines. */
export const ENTRY_PATH = "/project/src/main.js";
export const BUNDLE_PATH = "/project/dist/bundle.js";
/** The headless smoke runner we drop into the sandbox. `.cjs` so a global
 * `require("playwright")` resolves via NODE_PATH (ESM import ignores it). */
export const SMOKE_RUNNER_PATH = "/project/smoke-runner.cjs";

/**
 * Source of the headless smoke runner, written into the sandbox before it runs
 * (nothing else creates it). Loads the built bundle in a Chromium page for a
 * few seconds and prints ONE JSON line `{passed, crash_reason}` as its last
 * output: passed=false on any console error / uncaught throw / page error.
 * Uses Playwright (installed globally in the E2B template); CommonJS so
 * NODE_PATH (set at the call site) makes the global package resolvable.
 */
const SMOKE_RUNNER_SOURCE = `
const { chromium } = require("playwright");
const fs = require("fs");

const bundlePath = process.argv[2];
const DURATION_MS = ${SMOKE_DURATION_MS};

(async () => {
  let crash = null;
  let browser;
  try {
    // --disable-dev-shm-usage: the container's /dev/shm is ~64MB; WASM games
    // exceed it and Chromium kills the tab ("Target crashed"). Route shm to /tmp.
    browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
    const page = await browser.newPage();
    page.on("console", (m) => { if (m.type() === "error" && !crash) crash = "console.error: " + m.text().slice(0, 200); });
    page.on("pageerror", (e) => { if (!crash) crash = "pageerror: " + String(e.message).slice(0, 200); });
    const code = fs.readFileSync(bundlePath, "utf-8");
    await page.setContent("<!doctype html><html><body><div id=game></div></body></html>");
    await page.addScriptTag({ content: code });
    await page.waitForTimeout(DURATION_MS);
  } catch (e) {
    crash = "runner: " + String(e && e.message ? e.message : e).slice(0, 200);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  console.log(JSON.stringify({ passed: crash === null, crash_reason: crash }));
})();
`;

/** @deprecated use RuntimeAdapterDeps from _runtime-helpers. Kept for the
 * existing [2-W3] adapter construction signature. */
export type BrowserAdapterDeps = RuntimeAdapterDeps;

export abstract class BrowserEngineAdapter implements EngineAdapter {
    abstract readonly engine: Engine;

    constructor(protected readonly deps: RuntimeAdapterDeps) {}

    /** Boot an E2B sandbox preconfigured with this engine's toolchain. */
    bootSandbox(): Promise<SandboxHandle> {
        return bootEngineSandbox(this.deps);
    }

    writeFile(sandbox: SandboxHandle, path: string, content: string | Buffer): Promise<void> {
        return writeFileVia(sandbox, path, content);
    }

    runCommand(sandbox: SandboxHandle, command: string, timeoutMs?: number): Promise<CommandResult> {
        return runCommandVia(sandbox, command, timeoutMs);
    }

    /** esbuild bundle. Returns the bundler's CommandResult verbatim so a
     * non-zero exit (broken project) propagates to the caller. */
    async build(sandbox: SandboxSession): Promise<CommandResult> {
        return sandbox.runCommand(
            `esbuild ${ENTRY_PATH} --bundle --outfile=${BUNDLE_PATH}`,
        );
    }

    /** Headless Chromium runner loads the bundle for ~10s and reports
     * console errors / uncaught throws as one JSON line. */
    async smokeTest(sandbox: SandboxSession): Promise<SmokeTestResult> {
        const start = Date.now();
        // Drop the runner into the sandbox (nothing else creates it), then run
        // it against the built bundle.
        await sandbox.writeFile(SMOKE_RUNNER_PATH, SMOKE_RUNNER_SOURCE);
        // playwright is installed globally (npm i -g) in the template; a plain
        // `node /project/runner.mjs` won't resolve global packages, so point
        // NODE_PATH at the global modules dir.
        const result = await sandbox.runCommand(
            `NODE_PATH="$(npm root -g)" node ${SMOKE_RUNNER_PATH} ${BUNDLE_PATH}`,
            SMOKE_DURATION_MS + 15_000,
        );
        return parseSmokeOutput(result, Date.now() - start);
    }

    /** Zip dist/ in the sandbox and upload to R2. */
    async package(sandbox: SandboxSession): Promise<BuildArtifact> {
        return packageArtifact(sandbox, this.deps, this.engine, {
            sourceDir: "dist",
        });
    }

    /** Browser-native: the bundle IS the embeddable artifact, so webExport
     * ≈ serving dist/ from R2 (no extra export step). */
    async webExport(sandbox: SandboxSession): Promise<WebBuildArtifact> {
        return webExportBundle(sandbox, this.deps, this.engine, {
            webDir: "/project/dist",
            entry: "index.html",
            target: "browser",
        });
    }
}
