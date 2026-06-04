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
/** The headless smoke runner we drop into the sandbox. */
export const SMOKE_RUNNER_PATH = "/project/smoke-runner.mjs";

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
        const result = await sandbox.runCommand(
            `node ${SMOKE_RUNNER_PATH} ${BUNDLE_PATH}`,
            SMOKE_DURATION_MS + 5_000,
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
