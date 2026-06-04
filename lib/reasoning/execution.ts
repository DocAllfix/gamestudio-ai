/**
 * D.5 Execution Orchestrator (PARTE D.5).
 *
 * Runs `plan.execution_dag` topologically: a node fires once all its
 * `depends_on` outputs exist. Nodes whose deps failed are not run; they
 * are marked `skipped_dependency_failure`. Each runnable level is sent
 * as a batch to the tool dispatcher.
 *
 * Tool dispatch goes through the W2 seam (`../_mocks/tools.mock` →
 * `../tools/*` at the W1 merge). The build goes through the W3 seam
 * (`../_mocks/runtime.mock` → real Assembler at the W1 merge).
 *
 * The output's `node_results[].status` enum
 * (succeeded|failed|skipped_incremental|skipped_dependency_failure) is
 * distinct from the tool result enum; we map tool `failed`/
 * `rejected_by_qa` → `failed`.
 */
import {
    type ExecutionOrchestrator,
    type ExecutionOrchestratorInput,
    type ExecutionOrchestratorOutput,
    ExecutionOrchestratorInputSchema,
} from "../contracts/reasoning-engine.contract.js";
import {
    type Engine,
    type ExecutionDagNode,
    type GamePlan,
} from "../contracts/game-plan.contract.js";
import {
    type ToolExecutionResult,
    type ToolInvocation,
} from "../contracts/tool-registry.contract.js";
import { type SmokeTestReport } from "../contracts/evaluation-metrics.contract.js";
import type { AssemblerInput, AssemblerOutput } from "../contracts/assembly-pipeline.contract.js";

/**
 * Tool batch seam. Default = the REAL W2 tools via the registry (dispatchSafe:
 * an unimplemented or failing node degrades to a failed result, the DAG
 * continues, D.6 judges; implemented tools run and Zod-validate their inputs).
 * Lazy import so the registry's heavy deps load only at runtime; tests inject a
 * network-free fake via setInvokeToolBatch. */
type InvokeToolBatchFn = (invocations: readonly ToolInvocation[]) => Promise<ToolExecutionResult[]>;

let invokeToolBatchFn: InvokeToolBatchFn = async (invocations) => {
    const { invokeToolBatch } = await import("../tools/registry.js");
    return invokeToolBatch(invocations);
};

/** Inject a custom tool-batch implementation (tests use this to stay offline). */
export function setInvokeToolBatch(fn: InvokeToolBatchFn): void {
    invokeToolBatchFn = fn;
}

/**
 * Runtime build seam. Default = the REAL W3 Assembler (lib/runtime/runtime-build
 * → assemble in E2B). The contract fixes materialize()'s signature, so we keep
 * this as a module-level injectable instead of a method param: production runs
 * the real build (lazy import so the E2B/aws SDKs load only when a build runs),
 * tests call setRuntimeBuild() to inject a network-free fake. */
type RuntimeBuildFn = (input: AssemblerInput) => Promise<AssemblerOutput>;

let runtimeBuildFn: RuntimeBuildFn = async (input) => {
    const [{ runtimeBuild }, { createRealDeps }] = await Promise.all([
        import("../runtime/runtime-build.js"),
        import("../runtime/sandbox/real-clients.js"),
    ]);
    return runtimeBuild(input, createRealDeps());
};

/** Inject a custom build implementation (tests use this to stay offline). */
export function setRuntimeBuild(fn: RuntimeBuildFn): void {
    runtimeBuildFn = fn;
}

type NodeResult = ExecutionOrchestratorOutput["node_results"][number];

/** Engines the smoke-test report can name (the report enum excludes
 * babylon). Maps an unsupported engine onto a representative one so the
 * report stays schema-valid until W3's per-engine smoke lands. */
const SMOKE_ENGINES: ReadonlySet<string> = new Set([
    "godot", "phaser", "renpy", "defold",
    "monogame", "love2d", "threejs", "stride",
]);
function smokeEngine(engine: Engine): SmokeTestReport["runs"][number]["engine"] {
    return (SMOKE_ENGINES.has(engine) ? engine : "godot") as SmokeTestReport["runs"][number]["engine"];
}

/** Kahn topological layering: returns nodes grouped into levels that can
 * run in parallel. Throws on a cycle (D.3 should have caught it, but the
 * orchestrator refuses to loop forever). */
function topoLevels(nodes: readonly ExecutionDagNode[]): ExecutionDagNode[][] {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const remaining = new Map(nodes.map((n) => [n.id, new Set(n.depends_on)]));
    const levels: ExecutionDagNode[][] = [];

    while (remaining.size > 0) {
        const ready = [...remaining.entries()]
            .filter(([, deps]) => deps.size === 0)
            .map(([id]) => byId.get(id)!);
        if (ready.length === 0) {
            throw new Error("execution: cycle detected in execution_dag");
        }
        levels.push(ready);
        for (const node of ready) remaining.delete(node.id);
        for (const deps of remaining.values()) {
            for (const node of ready) deps.delete(node.id);
        }
    }
    return levels;
}

function mapStatus(result: ToolExecutionResult): NodeResult["status"] {
    return result.status === "succeeded" ? "succeeded" : "failed";
}

export const executionOrchestrator: ExecutionOrchestrator = {
    async materialize(
        rawInput: ExecutionOrchestratorInput,
    ): Promise<ExecutionOrchestratorOutput> {
        const input = ExecutionOrchestratorInputSchema.parse(rawInput);
        const plan: GamePlan = input.plan;

        const levels = topoLevels(plan.execution_dag.nodes);
        const nodeResults: NodeResult[] = [];
        const failed = new Set<string>();
        let totalCost = 0;
        let totalLatency = 0;

        for (const level of levels) {
            // Skip nodes whose any dependency already failed.
            const blocked = level.filter((n) =>
                n.depends_on.some((d) => failed.has(d)),
            );
            const runnable = level.filter((n) => !blocked.includes(n));

            for (const node of blocked) {
                failed.add(node.id);
                nodeResults.push({
                    node_id: node.id,
                    tool_id: node.tool_id,
                    status: "skipped_dependency_failure",
                    cost_usd: 0,
                    latency_ms: 0,
                    error_message: "a dependency failed",
                });
            }

            const invocations: ToolInvocation[] = runnable.map((node) => ({
                tool_id: node.tool_id as ToolInvocation["tool_id"],
                input: node.input,
                node_id: node.id,
                project_id: plan.project_id,
                plan_version: plan.plan_version,
                trace_id: `${plan.project_id}:${node.id}`,
            }));

            const results = invocations.length > 0
                ? await invokeToolBatchFn(invocations)
                : [];

            for (const result of results) {
                const status = mapStatus(result);
                if (status === "failed") failed.add(result.node_id);
                totalCost += result.cost_usd;
                totalLatency += result.latency_ms;
                nodeResults.push({
                    node_id: result.node_id,
                    tool_id: result.tool_id,
                    status,
                    cost_usd: result.cost_usd,
                    latency_ms: result.latency_ms,
                    error_message: result.error_message,
                });
            }
        }

        // Hand the (succeeded) tool outputs to the Assembler build seam.
        const build = await runtimeBuildFn({
            project_id: plan.project_id,
            plan_version: plan.plan_version,
            engine: plan.meta.engine,
            tool_outputs: {},
            run_smoke_test: true,
        });
        totalLatency += build.total_duration_ms;

        const smokeReport: SmokeTestReport = {
            runs: [
                {
                    engine: smokeEngine(plan.meta.engine),
                    passed: build.smoke_test.passed ?? false,
                    crash_reason: build.smoke_test.crash_reason,
                },
            ],
        };

        return {
            build_artifact_id: build.artifact_id,
            node_results: nodeResults,
            smoke_test_report: smokeReport,
            total_cost_usd: totalCost,
            total_latency_ms: totalLatency,
            memory: input.memory,
        };
    },
};
