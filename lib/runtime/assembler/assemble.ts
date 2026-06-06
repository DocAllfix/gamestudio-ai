/**
 * Assembler — Workstream W3 [5-W3].
 *
 * The real replacement for runtimeBuild in lib/_mocks/runtime.mock.ts.
 * Given an AssemblerInput and the EngineAdapter for its engine, it:
 *   1. boots the engine's E2B sandbox,
 *   2. writes every DAG tool_output file into the sandbox FS,
 *   3. builds (a non-zero build exit aborts — nothing to smoke/package),
 *   4. optionally runs the headless smoke test,
 *   5. packages the build to R2,
 * then returns a contract-valid AssemblerOutput. The sandbox is always
 * closed, even on failure.
 *
 * The Orchestrator (W1) dispatches this via the Trigger.dev entrypoint
 * (lib/runtime/sandbox/trigger.ts); see [1-W3].
 */
import {
    type AssemblerInput,
    AssemblerInputSchema,
    type AssemblerOutput,
    AssemblerOutputSchema,
    type EngineAdapter,
    type SandboxHandle,
    type SmokeTestResult,
} from "../../contracts/assembly-pipeline.contract.js";
import { scaffoldProject } from "./scaffold.js";

/** Smoke section when the test was skipped (run_smoke_test=false). */
const SKIPPED_SMOKE = {
    ran: false,
    passed: null,
    crash_reason: null,
    duration_ms: null,
} as const;

export async function assemble(
    input: AssemblerInput,
    adapter: EngineAdapter,
): Promise<AssemblerOutput> {
    const parsed = AssemblerInputSchema.parse(input);
    const started = Date.now();
    const logParts: string[] = [];

    const sandbox: SandboxHandle = await adapter.bootSandbox();
    try {
        // 2. Scaffold the engine project from the tool outputs, then write
        // it into the sandbox FS. The code_gen tools emit a single gameplay
        // file; scaffoldProject wraps it in the build-ready project tree
        // (project.godot + presets for Godot, index.html entry for the
        // browser engines, game.project for Defold) and carries asset files
        // through. The write order is irrelevant (the DAG ordering matters
        // for tool *execution*, which is W1's job, not assembly's).
        const projectFiles = scaffoldProject(parsed.engine, parsed.tool_outputs);
        for (const file of projectFiles) {
            await adapter.writeFile(sandbox, file.path, file.content);
        }

        // 3. Build.
        const build = await adapter.build(sandbox);
        logParts.push(`[build exit=${build.exit_code}]\n${build.stdout}\n${build.stderr}`);
        if (build.exit_code !== 0) {
            throw new Error(
                `build failed for engine ${parsed.engine} (exit ${build.exit_code}): ${build.stderr}`,
            );
        }

        // 4. Smoke test (optional).
        let smoke: SmokeTestResult | null = null;
        if (parsed.run_smoke_test) {
            smoke = await adapter.smokeTest(sandbox);
            logParts.push(`[smoke passed=${smoke.passed}]\n${smoke.logs}`);
        }

        // 5. Package to R2 (the .zip for export/ownership).
        const artifact = await adapter.package(sandbox);

        // 6. Web export: upload the playable bundle to R2's CDN and get the
        // iframe URL the /play page embeds. A failure here must not fail the
        // whole build — the user still has the exportable .zip — so it
        // degrades to a null iframe_url with the reason in the log.
        let iframeUrl: string | null = null;
        try {
            const web = await adapter.webExport(sandbox);
            iframeUrl = web.iframe_url;
            logParts.push(`[webExport iframe_url=${web.iframe_url} bytes=${web.bundle_size_bytes}]`);
        } catch (webError) {
            console.error("assemble webExport failed (game built, not playable in iframe)", {
                project_id: parsed.project_id,
                engine: parsed.engine,
                error: webError,
            });
            logParts.push(`[webExport FAILED: ${(webError as Error).message}]`);
        }

        return AssemblerOutputSchema.parse({
            artifact_id: artifact.artifact_id,
            download_url: artifact.download_url,
            iframe_url: iframeUrl,
            size_bytes: artifact.size_bytes,
            build_log: logParts.join("\n"),
            smoke_test: smoke
                ? {
                      ran: true,
                      passed: smoke.passed,
                      crash_reason: smoke.crash_reason,
                      duration_ms: smoke.duration_ms,
                  }
                : SKIPPED_SMOKE,
            total_duration_ms: Date.now() - started,
        });
    } catch (error) {
        console.error("assemble failed", {
            project_id: parsed.project_id,
            engine: parsed.engine,
            error,
        });
        throw error;
    } finally {
        await sandbox.close().catch((e) =>
            console.error("assemble: sandbox close failed", { error: e }),
        );
    }
}
