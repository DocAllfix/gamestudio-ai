/**
 * D.6 Evaluation Agent — [4-W1] final smoke GATE.
 *
 * Produces an EvaluationReport with one MetricVerdict per metric;
 * overall_passed = every verdict passed. A smoke failure flips
 * overall_passed=false and emits a refinement_request for D.2. A clean
 * plan + passing smoke yields overall_passed=true and no refinement.
 *
 * The smoke report is produced by an injectable builder (default =
 * runtime.mock runtimeBuild) so the fail path is testable offline.
 */
import { describe, expect, it } from "vitest";

import {
    EvaluationReportSchema,
    type SmokeTestReport,
} from "../../contracts/evaluation-metrics.contract.js";
import {
    type EvaluationAgentInput,
    HermesMemorySchema,
} from "../../contracts/reasoning-engine.contract.js";
import { type GamePlan } from "../../contracts/game-plan.contract.js";
import { templateSkeleton } from "../baseline.js";
import { evaluationAgent } from "../evaluation.js";

const memory = HermesMemorySchema.parse({});
const PROJECT_ID = "33333333-3333-3333-3333-333333333333";
const ARTIFACT_ID = "44444444-4444-4444-4444-444444444444";

function cleanPlan(): GamePlan {
    return templateSkeleton(PROJECT_ID, "hardcore_platformer", "godot", "Eval");
}

/** A plan with an unreachable item-gated node (D.3 reports a soft-lock). */
function softLockedPlan(): GamePlan {
    const base = cleanPlan();
    return {
        ...base,
        world_graph: {
            ...base.world_graph,
            nodes: [
                ...base.world_graph.nodes,
                { id: "vault", display_name: "Vault", requires: ["gold_key"], grants: [], tags: [] },
            ],
            edges: [
                ...base.world_graph.edges,
                { from: "boss", to: "vault", requires: [], bidirectional: true },
            ],
        },
    };
}

function input(plan: GamePlan): EvaluationAgentInput {
    return { plan, build_artifact_id: ARTIFACT_ID, num_playtests: 10, memory };
}

const passingSmoke: SmokeTestReport = {
    runs: [{ engine: "godot", passed: true, crash_reason: null }],
};
const failingSmoke: SmokeTestReport = {
    runs: [{ engine: "godot", passed: false, crash_reason: "segfault on boot" }],
};

describe("D.6 EvaluationAgent.evaluate", () => {
    it("produces a report that EvaluationReportSchema.parse accepts", async () => {
        const out = await evaluationAgent.evaluate(input(cleanPlan()), {
            smokeReport: passingSmoke,
        });
        expect(() => EvaluationReportSchema.parse(out.report)).not.toThrow();
    });

    it("passes a clean plan with a passing smoke: overall_passed=true, no refinement", async () => {
        const out = await evaluationAgent.evaluate(input(cleanPlan()), {
            smokeReport: passingSmoke,
        });
        expect(out.report.overall_passed).toBe(true);
        expect(out.refinement_request).toBeNull();
    });

    it("fails on a smoke failure: overall_passed=false and emits a refinement_request", async () => {
        const out = await evaluationAgent.evaluate(input(cleanPlan()), {
            smokeReport: failingSmoke,
        });
        expect(out.report.overall_passed).toBe(false);
        expect(out.refinement_request).not.toBeNull();
    });

    it("fails on a soft-lock even when smoke passes (gate is conjunctive)", async () => {
        const out = await evaluationAgent.evaluate(input(softLockedPlan()), {
            smokeReport: passingSmoke,
        });
        const softLockVerdict = out.report.verdicts.find(
            (v) => v.metric === "soft_lock_count",
        );
        expect(softLockVerdict?.passed).toBe(false);
        expect(out.report.overall_passed).toBe(false);
    });

    it("includes a verdict for every contract metric", async () => {
        const out = await evaluationAgent.evaluate(input(cleanPlan()), {
            smokeReport: passingSmoke,
        });
        const metrics = out.report.verdicts.map((v) => v.metric).sort();
        expect(metrics).toEqual(
            [
                "aesthetic_coherence",
                "generation_cost_usd",
                "generation_time_seconds",
                "smoke_test_pass_rate",
                "soft_lock_count",
                "stress_curve_rmse",
            ].sort(),
        );
    });
});
