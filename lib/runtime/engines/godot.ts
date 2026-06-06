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
export const GODOT_SMOKE_RUNNER = "/project/godot-smoke-runner.mjs";

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
        const result = await sandbox.runCommand(
            `node ${GODOT_SMOKE_RUNNER} ${GODOT_EXPORT_DIR}/index.wasm`,
            SMOKE_DURATION_MS + 5_000,
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
