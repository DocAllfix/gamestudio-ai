/**
 * Babylon EngineAdapter — Workstream W3.
 *
 * Babylon's unique advantage is server-side verification with no GPU:
 *   build()     = esbuild TS bundle (browser-playable output).
 *   smokeTest() = run the scene in BABYLON.NullEngine in Node inside the
 *                 sandbox, advance N frames, and report any
 *                 exception/crash as one JSON line {passed, crash_reason}.
 *                 Unlike Phaser/Three.js this needs no headless browser —
 *                 NullEngine has no canvas/GPU, so the render loop runs in
 *                 plain Node.
 *   package()   = zip the bundle dir + upload to R2.
 *
 * Required E2B template bits are documented in
 * lib/runtime/sandbox/E2B_TEMPLATE.md.
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

/** TS entry + bundle output inside the sandbox. */
export const BABYLON_ENTRY = "/project/src/main.ts";
export const BABYLON_BUNDLE = "/project/dist/bundle.js";
/** NullEngine headless smoke runner dropped into the sandbox. */
export const BABYLON_SMOKE_RUNNER = "/project/babylon-smoke-runner.mjs";
/** Frames the NullEngine render loop advances before declaring the scene
 * healthy — enough to exercise scene setup + a few update ticks. */
export const BABYLON_SMOKE_FRAMES = 60;

export class BabylonAdapter implements EngineAdapter {
    readonly engine: Engine = "babylon";

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

    /** esbuild bundle of the TS entry. Non-zero exit (compile/bundle
     * error) propagates verbatim. */
    async build(sandbox: SandboxSession): Promise<CommandResult> {
        return sandbox.runCommand(
            `esbuild ${BABYLON_ENTRY} --bundle --outfile=${BABYLON_BUNDLE}`,
        );
    }

    /** Run the scene in NullEngine for N frames and crash-detect. */
    async smokeTest(sandbox: SandboxSession): Promise<SmokeTestResult> {
        const start = Date.now();
        const result = await sandbox.runCommand(
            `node ${BABYLON_SMOKE_RUNNER} ${BABYLON_BUNDLE} ${BABYLON_SMOKE_FRAMES}`,
            SMOKE_DURATION_MS + 5_000,
        );
        return parseSmokeOutput(result, Date.now() - start);
    }

    async package(sandbox: SandboxSession): Promise<BuildArtifact> {
        return packageArtifact(sandbox, this.deps, this.engine, {
            sourceDir: "dist",
        });
    }

    /** Browser-native output: the bundle is the embeddable artifact. */
    async webExport(sandbox: SandboxSession): Promise<WebBuildArtifact> {
        return webExportBundle(sandbox, this.deps, this.engine, {
            webDir: "/project/dist",
            entry: "index.html",
            target: "browser",
        });
    }
}
