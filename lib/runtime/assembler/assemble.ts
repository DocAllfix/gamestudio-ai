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

/** LLM judge for the Playtester: given the design goal + the sampled state
 * trajectory, decide if the game is playable/completable. Universal — it reads
 * the abstract GameState, not genre rules. Best-effort (null on failure → the
 * deterministic guards stand). */
function makeLlmJudge() {
    return async (args: { goal: string; states: unknown[]; errors: string[] }): Promise<{ playable: boolean; reason: string } | null> => {
        try {
            const { complete } = await import("../../llm/router.js");
            const { z } = await import("zod");
            const schema = z.object({ playable: z.boolean(), reason: z.string().min(1), confidence: z.number().int().min(0).max(100) });
            const res = await complete({
                model: "gpt-4.1-mini",
                system:
                    "You are a QA playtester. Given a game's DESIGN GOAL and a time-ordered " +
                    "trajectory of its state (player_alive, player_on_screen, player_x/y, score, " +
                    "goal_reached, game_over, elapsed_seconds), judge if the game is actually " +
                    "playable and can progress toward the goal. Fail it if the player dies/leaves " +
                    "the screen and never recovers, never moves, makes no progress, or the state is " +
                    "frozen. Return JSON {playable, reason, confidence}.",
                user: `GOAL: ${args.goal}\nSTATES: ${JSON.stringify(args.states).slice(0, 4000)}\nERRORS: ${args.errors.join("; ").slice(0, 500)}`,
                response_schema: schema,
                max_tokens: 400,
                temperature: 0.1,
                trace_id: "playtest-judge",
            });
            const j = schema.safeParse(res.output);
            return j.success ? { playable: j.data.playable, reason: j.data.reason } : null;
        } catch (e) {
            console.error("playtest judge failed: " + (e instanceof Error ? e.message : String(e)));
            return null;
        }
    };
}

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
            if (file.encoding === "url-ref") {
                // The asset's content is a URL (FLUX sprite, R2 audio). Fetch the
                // real bytes and write them into the project so the game can load
                // the asset from res:// — a Godot WASM build can't fetch an
                // external URL at runtime. Best-effort: on a failed fetch, skip
                // the asset (the code falls back to a placeholder).
                try {
                    const r = await fetch(file.content);
                    if (!r.ok) throw new Error(`asset fetch ${r.status}`);
                    const buf = Buffer.from(await r.arrayBuffer());
                    await adapter.writeFile(sandbox, file.path, buf);
                    logParts.push(`[asset fetched ${file.path} ${buf.length}B]`);
                } catch (e) {
                    logParts.push(`[asset skipped ${file.path}: ${(e as Error).message}]`);
                }
            } else {
                await adapter.writeFile(sandbox, file.path, file.content);
            }
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

        // 4b. Playtest (Fetta 5): actually play the build headlessly and judge
        // if it's playable (renders + reacts to input), not just that it booted.
        // Best-effort: a flaky playtest must not block a sound game.
        let playtestResult: { ran: boolean; playable: boolean; reason: string } | null = null;
        if (parsed.run_smoke_test) {
            try {
                const { playtest, webDirForEngine } = await import("../playtest-runner/playtest.js");
                const target = webDirForEngine(parsed.engine);
                if (target) {
                    const v = await playtest(sandbox as never, target, {
                        goal: parsed.playtest_goal,
                        judge: parsed.playtest_goal ? makeLlmJudge() : undefined,
                    });
                    playtestResult = { ran: true, playable: v.playable, reason: v.reason };
                    logParts.push(`[playtest playable=${v.playable}] ${v.reason}`);
                }
            } catch (ptErr) {
                console.error("assemble playtest skipped: " + (ptErr instanceof Error ? ptErr.message : String(ptErr)));
            }
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
            playtest: playtestResult,
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
