/**
 * D.5 Execution Orchestrator — [3-W1].
 *
 * Executes plan.execution_dag topologically: one node_result per DAG
 * node, statuses in the contract enum, dependency order respected
 * (a node runs only after every depends_on has produced a result).
 */
import { describe, expect, it } from "vitest";

import {
    ExecutionOrchestratorOutputSchema,
    type ExecutionOrchestratorInput,
    HermesMemorySchema,
} from "../../contracts/reasoning-engine.contract.js";
import { type GamePlan } from "../../contracts/game-plan.contract.js";
import { templateSkeleton } from "../baseline.js";
import { executionOrchestrator } from "../execution.js";

const memory = HermesMemorySchema.parse({});
const PROJECT_ID = "22222222-2222-2222-2222-222222222222";

/** Plan with a diamond DAG: a -> {b,c} -> d. */
function diamondPlan(): GamePlan {
    const base = templateSkeleton(PROJECT_ID, "hardcore_platformer", "godot", "Diamond");
    return {
        ...base,
        execution_dag: {
            nodes: [
                { id: "a", tool_id: "code_gen_godot_gdscript", input: {}, depends_on: [] },
                { id: "b", tool_id: "sprite_gen", input: {}, depends_on: ["a"] },
                { id: "c", tool_id: "bgm_gen", input: {}, depends_on: ["a"] },
                { id: "d", tool_id: "godot_assembler", input: {}, depends_on: ["b", "c"] },
            ],
        },
    };
}

function input(plan: GamePlan): ExecutionOrchestratorInput {
    return { plan, incremental: false, memory };
}

describe("D.5 ExecutionOrchestrator.materialize", () => {
    it("round-trips its output through the contract", async () => {
        const out = await executionOrchestrator.materialize(input(diamondPlan()));
        expect(() =>
            ExecutionOrchestratorOutputSchema.parse(out),
        ).not.toThrow();
    });

    it("produces exactly one node_result per DAG node", async () => {
        const plan = diamondPlan();
        const out = await executionOrchestrator.materialize(input(plan));
        const resultIds = out.node_results.map((r) => r.node_id).sort();
        const dagIds = plan.execution_dag.nodes.map((n) => n.id).sort();
        expect(resultIds).toEqual(dagIds);
    });

    it("uses only contract-allowed statuses", async () => {
        const out = await executionOrchestrator.materialize(input(diamondPlan()));
        const allowed = new Set([
            "succeeded",
            "failed",
            "skipped_incremental",
            "skipped_dependency_failure",
        ]);
        for (const r of out.node_results) {
            expect(allowed.has(r.status)).toBe(true);
        }
    });

    it("respects depends_on: a node is never executed before its deps", async () => {
        const plan = diamondPlan();
        const out = await executionOrchestrator.materialize(input(plan));
        // The orchestrator stamps a monotonically increasing exec order
        // we can read back through the (deterministic) node_results order.
        const order = out.node_results.map((r) => r.node_id);
        const idx = (id: string) => order.indexOf(id);
        for (const node of plan.execution_dag.nodes) {
            for (const dep of node.depends_on) {
                expect(idx(dep)).toBeLessThan(idx(node.id));
            }
        }
    });

    it("returns a smoke_test_report and non-negative cost/latency totals", async () => {
        const out = await executionOrchestrator.materialize(input(diamondPlan()));
        expect(out.smoke_test_report.runs.length).toBeGreaterThan(0);
        expect(out.total_cost_usd).toBeGreaterThanOrEqual(0);
        expect(out.total_latency_ms).toBeGreaterThanOrEqual(0);
    });
});
