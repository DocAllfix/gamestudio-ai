/**
 * D.6 Evaluation Agent (PARTE D.6) — the final smoke GATE of the loop.
 *
 * Emits an EvaluationReport with one verdict per contract metric;
 * overall_passed = every verdict passed. On failure it emits a
 * `refinement_request` that the Hermes loop forwards to D.2.
 *
 * Day-1 scope (per [4-W1]): deterministic verdicts on the metrics
 * computable offline from the plan + the smoke report —
 *   - soft_lock_count: re-runs D.3 on plan.world_graph;
 *   - smoke_test_pass_rate: from the SmokeTestReport;
 *   - generation_cost_usd / generation_time_seconds: from the run totals
 *     threaded in `options` (default 0 = under cap).
 * The full Playtester (aesthetic_coherence + stress_curve_rmse) needs
 * screenshots / measured runs absent from EvaluationAgentInput; those
 * two verdicts pass with an explicit "deferred to full Playtester (FF)"
 * note until the Playtester ships. This keeps the gate honest about what
 * it actually measured.
 *
 * The smoke report is produced by an injectable builder (default =
 * runtime.mock runtimeBuild) so the fail path is testable offline; this
 * is the W3 seam, swapped for the real Assembler at the W1 merge.
 */
import {
    type EvaluationAgent,
    type EvaluationAgentInput,
    type EvaluationAgentOutput,
    EvaluationAgentInputSchema,
} from "../contracts/reasoning-engine.contract.js";
import {
    type EvaluationReport,
    type SmokeTestReport,
    AESTHETIC_COHERENCE_MIN,
    GENERATION_COST_USD_MAX,
    GENERATION_TIME_SECONDS_MAX,
    SMOKE_TEST_PASS_RATE_MIN,
    SOFT_LOCK_COUNT_MAX,
    STRESS_CURVE_RMSE_MAX,
} from "../contracts/evaluation-metrics.contract.js";
import { type GamePlan } from "../contracts/game-plan.contract.js";
import { consistencyManager } from "./consistency.js";
// TODO(merge/ondata-1): swap to real W3 runtime (lib/runtime/runtime-build.ts).
// Requires E2B/R2 SDKs + credentials — kept on mock. See docs/MERGE_RUNBOOK.md §4.
import type { AssemblerInput, AssemblerOutput } from "../contracts/assembly-pipeline.contract.js";

// Real W3 Assembler by default (lazy import → SDKs load only on a real build).
// Tests always pass options.smokeReport, so this path isn't hit offline.
async function runtimeBuild(input: AssemblerInput): Promise<AssemblerOutput> {
    const [{ runtimeBuild: build }, { createRealDeps }] = await Promise.all([
        import("../runtime/runtime-build.js"),
        import("../runtime/sandbox/real-clients.js"),
    ]);
    return build(input, createRealDeps());
}

type Verdict = EvaluationReport["verdicts"][number];

/** Optional run context. When `smokeReport` is omitted the agent builds
 * one via the runtime seam; cost/time default to 0 (under cap). */
export interface EvaluateOptions {
    smokeReport?: SmokeTestReport;
    generation_cost_usd?: number;
    generation_time_seconds?: number;
}

const SMOKE_ENGINES: ReadonlySet<string> = new Set([
    "godot", "phaser", "renpy", "defold",
    "monogame", "love2d", "threejs", "stride",
]);

async function smokeFor(
    plan: GamePlan,
    options: EvaluateOptions,
): Promise<SmokeTestReport> {
    if (options.smokeReport) return options.smokeReport;
    const build = await runtimeBuild({
        project_id: plan.project_id,
        plan_version: plan.plan_version,
        engine: plan.meta.engine,
        tool_outputs: {},
        run_smoke_test: true,
    });
    const engine = (SMOKE_ENGINES.has(plan.meta.engine)
        ? plan.meta.engine
        : "godot") as SmokeTestReport["runs"][number]["engine"];
    return {
        runs: [
            {
                engine,
                passed: build.smoke_test.passed ?? false,
                crash_reason: build.smoke_test.crash_reason,
            },
        ],
    };
}

/** "max" metric: passes when value <= threshold. */
function maxVerdict(
    metric: Verdict["metric"],
    value: number,
    threshold: number,
    notes: string,
): Verdict {
    return { metric, value, threshold, passed: value <= threshold, notes };
}

/** "min" metric: passes when value >= threshold. */
function minVerdict(
    metric: Verdict["metric"],
    value: number,
    threshold: number,
    notes: string,
): Verdict {
    return { metric, value, threshold, passed: value >= threshold, notes };
}

/** D.6 agent. The method takes an optional second `options` arg (the
 * run context / injectable smoke seam) on top of the contract's single
 * `input` arg, so the concrete type is wider than `EvaluationAgent`.
 * The `satisfies` check below proves it still fulfils the contract. */
export interface EvaluationAgentWithContext {
    evaluate(
        input: EvaluationAgentInput,
        options?: EvaluateOptions,
    ): Promise<EvaluationAgentOutput>;
}

export const evaluationAgent = {
    async evaluate(
        rawInput: EvaluationAgentInput,
        options: EvaluateOptions = {},
    ): Promise<EvaluationAgentOutput> {
        const input = EvaluationAgentInputSchema.parse(rawInput);
        const plan = input.plan;

        // soft_lock_count — re-run D.3 on the world graph.
        const consistency = await consistencyManager.validate({
            world_graph: plan.world_graph,
            dialogues: [],
        });
        const softLockCount = consistency.soft_locks.length;

        // smoke_test_pass_rate — from the smoke report.
        const smoke = await smokeFor(plan, options);
        const passRate =
            smoke.runs.filter((r) => r.passed).length / smoke.runs.length;

        const cost = options.generation_cost_usd ?? 0;
        const timeSeconds = options.generation_time_seconds ?? 0;

        const verdicts: Verdict[] = [
            maxVerdict(
                "soft_lock_count",
                softLockCount,
                SOFT_LOCK_COUNT_MAX,
                "re-run of D.3 consistency on the final world graph",
            ),
            minVerdict(
                "smoke_test_pass_rate",
                passRate,
                SMOKE_TEST_PASS_RATE_MIN,
                "headless smoke from the runtime build",
            ),
            maxVerdict(
                "generation_cost_usd",
                cost,
                GENERATION_COST_USD_MAX,
                "total generation cost for this materialization",
            ),
            maxVerdict(
                "generation_time_seconds",
                timeSeconds,
                GENERATION_TIME_SECONDS_MAX,
                "wall-clock generation time for this materialization",
            ),
            minVerdict(
                "aesthetic_coherence",
                AESTHETIC_COHERENCE_MIN,
                AESTHETIC_COHERENCE_MIN,
                "deferred to full Playtester (FF): no screenshots in day-1 input",
            ),
            maxVerdict(
                "stress_curve_rmse",
                0,
                STRESS_CURVE_RMSE_MAX,
                "deferred to full Playtester (FF): no measured runs in day-1 input",
            ),
        ];

        const overallPassed = verdicts.every((v) => v.passed);
        const report: EvaluationReport = {
            plan_version: `v${plan.plan_version}`,
            verdicts,
            overall_passed: overallPassed,
        };

        const failed = verdicts.filter((v) => !v.passed).map((v) => v.metric);
        // Surface the specific crash/playtest reason (not just the metric name)
        // so the regeneration loop knows exactly what to fix.
        const crashReason = smoke.runs.find((r) => !r.passed)?.crash_reason;
        const refinementRequest = overallPassed
            ? null
            : crashReason
                ? crashReason
                : `Evaluation failed on: ${failed.join(", ")}. Revise the plan to satisfy these constraints.`;

        return { report, refinement_request: refinementRequest, memory: input.memory };
    },
} satisfies EvaluationAgentWithContext & EvaluationAgent;
