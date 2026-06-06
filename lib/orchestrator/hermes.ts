/**
 * Hermes Orchestrator — the outer reasoning loop (Pietra v5 §F).
 *
 * Wires the six D-modules in order: D.1 Intent → D.2 Design → D.3
 * Consistency (GATE) → D.4 Balance → D.5 Execution → D.6 Evaluation,
 * threading the 3-level HermesMemory through each. This function is the
 * real replacement for `lib/_mocks/orchestrator.mock.ts` (`runHermesPlan`)
 * and is swapped in at the W1 merge.
 *
 * D.6 is built in [4-W1]; until then this loop uses an inline stub that
 * derives a contract-valid EvaluationReport from the D.5 smoke result.
 * The seam is marked below.
 *
 * Gate behavior: if D.3 reports the plan invalid (a soft-lock), the loop
 * stops before D.5 — there is no point building a soft-locked game — and
 * returns a valid response with overall_passed=false.
 */
import { randomUUID } from "node:crypto";

import {
    type HermesOrchestrator,
    type HermesPlanRequest,
    type HermesPlanResponse,
    type HermesMemory,
    HermesPlanRequestSchema,
    HermesMemorySchema,
} from "../contracts/reasoning-engine.contract.js";
import {
    type EvaluationReport,
} from "../contracts/evaluation-metrics.contract.js";
import { type GamePlan } from "../contracts/game-plan.contract.js";
import { intentInterpreter } from "../reasoning/intent.js";
import { designPlanner } from "../reasoning/design.js";
import { consistencyManager } from "../reasoning/consistency.js";
import { balanceController } from "../reasoning/balance.js";
import { executionOrchestrator } from "../reasoning/execution.js";
import { evaluationAgent } from "../reasoning/evaluation.js";
import { Tracer } from "../observability/tracer.js";
import { withTracer } from "../observability/context.js";
import { flushLangfuse } from "../observability/langfuse.js";

type Iteration = HermesPlanResponse["iterations"][number];

function failedReport(plan: GamePlan, softLockCount: number): EvaluationReport {
    return {
        plan_version: `v${plan.plan_version}`,
        verdicts: [
            {
                metric: "soft_lock_count",
                value: softLockCount,
                threshold: 0,
                passed: false,
                notes: "D.3 gate failed: plan has soft-locks; build skipped",
            },
        ],
        overall_passed: false,
    };
}

export const hermesOrchestrator: HermesOrchestrator = {
    async run(rawRequest: HermesPlanRequest): Promise<HermesPlanResponse> {
        const req = HermesPlanRequestSchema.parse(rawRequest);
        const projectId = req.project_id ?? randomUUID();
        // Audit every step of this run into run_traces (+ Langfuse for LLM
        // calls). The whole run executes inside withTracer so deep code (the
        // LLM router) can find the tracer ambiently.
        const tracer = new Tracer(req.run_id ?? null, projectId);
        return withTracer(tracer, () => runInner(req, projectId, tracer));
    },
};

async function runInner(
    req: HermesPlanRequest,
    projectId: string,
    tracer: Tracer,
): Promise<HermesPlanResponse> {
    {

        let memory: HermesMemory = HermesMemorySchema.parse({});
        const iterations: Iteration[] = [];
        const push = (phase: Iteration["phase"], summary: string) =>
            iterations.push({ phase, summary, iteration: iterations.length, cost_usd: 0, latency_ms: 0 });

        // D.1 Intent — draft plan from the brief.
        const intent = await intentInterpreter.propose({
            user_prompt: req.user_prompt,
            moodboard_image_urls:
                req.moodboard_image_urls.length > 0 ? req.moodboard_image_urls : undefined,
            reference_game_ids:
                req.reference_game_ids.length > 0 ? req.reference_game_ids : undefined,
            forced_engine: req.forced_engine,
            memory,
        });
        memory = intent.memory;
        // Reconcile the plan's project_id with the request/response id.
        let plan: GamePlan = { ...intent.draft_plan, project_id: projectId };
        push("intent", intent.rationale.slice(0, 500));

        // D.2 Design — initial structural pass (full_plan).
        const design = await designPlanner.refine({ plan, memory });
        memory = design.memory;
        if (design.result.kind === "full_plan") {
            plan = design.result.plan;
        }
        push("design", "initial design pass");

        // D.3 Consistency — the GATE.
        const consistency = await consistencyManager.validate({
            world_graph: plan.world_graph,
            dialogues: [],
        });
        const softLockCount = consistency.soft_locks.length;
        push("consistency", `valid=${consistency.valid}, soft_locks=${softLockCount}`);

        if (!consistency.valid) {
            const report = failedReport(plan, softLockCount);
            return {
                project_id: projectId,
                final_plan: plan,
                final_report: report,
                iterations,
                overall_passed: false,
                total_cost_usd: 0,
                total_latency_ms: 0,
            };
        }

        // D.4 Balance — clamp rules (no ranges supplied day-1 → no-op).
        const balance = await balanceController.balance({
            plan,
            rules_ranges: {},
            memory,
        });
        memory = balance.memory;
        plan = balance.balanced_plan;
        push("balance", `adjustments=${balance.adjustments.length}`);

        // D.5 Execution — run the DAG + build.
        const execution = await executionOrchestrator.materialize({
            plan,
            incremental: false,
            memory,
        });
        memory = execution.memory;
        push("execution", `nodes=${execution.node_results.length}`);
        // Per-tool traces (incl. generated code) are written inside execution
        // itself, which has each tool's full output. Here we record the
        // execution summary (build artifact + playable url).
        await tracer.record({
            phase: "execution",
            status: "succeeded",
            engine: plan.meta.engine,
            output: { build_artifact_id: execution.build_artifact_id, iframe_url: execution.iframe_url ?? null },
            cost_usd: execution.total_cost_usd,
            latency_ms: execution.total_latency_ms,
        });

        // D.6 Evaluation — the final smoke gate. Cost/time totals from
        // D.5 feed the cost/time verdicts; the smoke report is threaded
        // through so D.6 measures the same build D.5 produced.
        const evaluation = await evaluationAgent.evaluate(
            {
                plan,
                build_artifact_id: execution.build_artifact_id,
                num_playtests: 10,
                memory,
            },
            {
                smokeReport: execution.smoke_test_report,
                generation_cost_usd: execution.total_cost_usd,
                generation_time_seconds: execution.total_latency_ms / 1000,
            },
        );
        memory = evaluation.memory;
        const report = evaluation.report;
        push("evaluation", `overall_passed=${report.overall_passed}`);
        if (evaluation.refinement_request !== null) {
            push("refinement", evaluation.refinement_request.slice(0, 500));
        }

        await flushLangfuse();
        return {
            project_id: projectId,
            final_plan: plan,
            final_report: report,
            iterations,
            overall_passed: report.overall_passed,
            total_cost_usd: execution.total_cost_usd,
            total_latency_ms: execution.total_latency_ms,
            build_artifact_id: execution.build_artifact_id,
            iframe_url: execution.iframe_url ?? null,
            node_results: execution.node_results,
        };
    }
}

/** Compatibility entrypoint matching `orchestrator.mock.runHermesPlan`,
 * so the W4 import site swaps to this module with no call-site change. */
export async function runHermesPlan(
    request: HermesPlanRequest,
): Promise<HermesPlanResponse> {
    return hermesOrchestrator.run(request);
}
