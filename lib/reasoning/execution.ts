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
import { currentTracer } from "../observability/context.js";

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

/**
 * Build a node's tool input, injecting data the spatial tools need from their
 * parents (the DAG edges carry data, not just ordering):
 *   - level_layout_2d/3d need the world-graph `node` to expand.
 *   - tilemap_populate needs the `layout` produced by its level parent.
 *   - entity_placement needs the `tilemap` produced by its tilemap parent.
 *   - level_layout_3d needs the `heightmap` from its heightmap parent.
 * Falls back to the node's static input when a parent output is absent.
 */
function wireInputs(
    node: ExecutionDagNode,
    nodeOutputs: Record<string, Record<string, unknown>>,
    entryNode: { id: string; display_name: string; requires: string[]; grants: string[]; tags: string[] },
    playtestFeedback?: string,
): Record<string, unknown> {
    const input: Record<string, unknown> = { ...node.input };
    const parents = node.depends_on.map((id) => nodeOutputs[id]).filter(Boolean);
    // Some fields come from an ancestor, not the direct parent (entity needs
    // the level's `layout`, two hops up), so search all produced outputs too.
    const allOutputs = Object.values(nodeOutputs);
    const fromAny = (key: string): unknown =>
        allOutputs.find((o) => key in o)?.[key];

    if (node.tool_id === "level_layout_2d" || node.tool_id === "level_layout_3d") {
        input.node = entryNode;
        const hm = parents.find((p) => "heightmap" in p);
        if (hm) input.heightmap = hm.heightmap;
    }
    if (node.tool_id === "tilemap_populate") {
        const layout = fromAny("layout");
        if (layout) input.layout = layout;
    }
    if (node.tool_id === "entity_placement") {
        const layout = fromAny("layout");
        const tilemap = fromAny("tilemap");
        if (layout) input.layout = layout;
        if (tilemap) input.tilemap = tilemap;
    }
    // code_gen is the consumer of the whole pipeline: give it the generated
    // LEVEL (reachable layout: cells/entry/exit/size), the placed ENTITIES
    // (enemies/pickups with coords), and the resolved ASSET urls — so the LLM
    // builds the game ON the real generated content instead of inventing a tiny
    // broken level. This is the wiring that was missing (level/entity outputs
    // died unused). Each is optional; absent → the LLM falls back.
    if (node.tool_id.startsWith("code_gen")) {
        const layout = fromAny("layout");
        const entities = fromAny("entities");
        if (layout) input.level_layout = layout;
        if (entities) input.entities = entities;
        // Asset urls produced upstream (sprite/audio), keyed for the prompt.
        const assets: Record<string, unknown> = {};
        for (const o of allOutputs) {
            if (typeof o.image_url === "string") assets.sprite = o.image_url;
            if (typeof o.audio_url === "string") assets.audio = o.audio_url;
        }
        if (Object.keys(assets).length > 0) input.assets = assets;
        // Regeneration feedback: the Playtester's reason from the previous
        // failed pass, so the LLM fixes the specific playability problem.
        if (playtestFeedback) input.playtest_feedback = playtestFeedback;
    }
    return input;
}

type ToolFile = AssemblerInput["tool_outputs"][string]["files"][number];

/**
 * Normalize a tool's output into the files the Assembler scaffolds into the
 * engine project. Three shapes cover the day-1 DAG:
 *   - code_gen  → {code, filename}: the gameplay source (scaffold wraps it).
 *   - asset     → {image_url|audio_url|model_url}: a url-ref the build fetches.
 *   - structured→ level/entity data: written as inline JSON the code can read.
 * Returns [] for outputs with nothing to materialize (the node still counts
 * as succeeded for D.6; it just contributes no file).
 */
function outputToFiles(
    toolId: string,
    output: Record<string, unknown> | null,
): ToolFile[] {
    if (!output) return [];

    if (typeof output.code === "string" && output.code.length > 0) {
        const filename =
            typeof output.filename === "string" && output.filename.length > 0
                ? output.filename
                : "main";
        return [{ path: filename, content: output.code, encoding: "utf-8" }];
    }

    const assetUrl =
        (typeof output.image_url === "string" && output.image_url) ||
        (typeof output.audio_url === "string" && output.audio_url) ||
        (typeof output.model_url === "string" && output.model_url) ||
        (typeof output.download_url === "string" && output.download_url);
    if (assetUrl) {
        return [{ path: assetPath(toolId, assetUrl), content: assetUrl, encoding: "url-ref" }];
    }

    return [];
}

/** A sandbox-relative path for a fetched asset, by tool family. DETERMINISTIC:
 * fixed dir + extension per family (the source URL's extension is unreliable —
 * e.g. freesound's .../download/ has none), and the SAME path describeLevel
 * tells the LLM to load. Toolid normalized to the family stem so the code's
 * res:// path matches regardless of the concrete tool variant. */
function assetPath(toolId: string, _url: string): string {
    const isAudio = toolId.includes("audio") || toolId.includes("bgm") || toolId.includes("sfx") || toolId.includes("voice");
    const is3d = toolId.includes("3d") || toolId.includes("model");
    if (isAudio) {
        const stem = toolId.includes("sfx") ? "sfx_gen" : "bgm_gen";
        return `/project/assets/audio/${stem}.mp3`;
    }
    if (is3d) return `/project/assets/models/model_3d_gen.glb`;
    return `/project/assets/sprites/sprite_gen.png`;
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
        const tracer = currentTracer();
        // Accumulates each succeeded tool's files, keyed by DAG node id, to
        // hand to the build (the Assembler scaffolds these into the engine
        // project). Was previously `{}` — the build received no game files.
        const toolOutputs: AssemblerInput["tool_outputs"] = {};
        // Raw output object per node id, so a child node can read a parent's
        // result (level→tilemap→entity data-flow), keyed by node id.
        const nodeOutputs: Record<string, Record<string, unknown>> = {};
        const entryNode = plan.world_graph.nodes.find(
            (n) => n.id === plan.world_graph.entry_node_id,
        ) ?? plan.world_graph.nodes[0];
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

            const playtestFeedback = typeof input.memory.short_term?.playtest_feedback === "string"
                ? (input.memory.short_term.playtest_feedback as string)
                : undefined;
            const invocations: ToolInvocation[] = runnable.map((node) => ({
                tool_id: node.tool_id as ToolInvocation["tool_id"],
                input: wireInputs(node, nodeOutputs, entryNode, playtestFeedback),
                node_id: node.id,
                project_id: plan.project_id,
                plan_version: plan.plan_version,
                trace_id: `${plan.project_id}:${node.id}`,
            }));

            const results = invocations.length > 0
                ? await invokeToolBatchFn(invocations)
                : [];

            // node_id → the exact input the tool ran with, so the trace records
            // the (input → generated_code) pair needed for the fine-tune dataset.
            const inputByNode = new Map(invocations.map((inv) => [inv.node_id, inv.input]));

            for (const result of results) {
                const status = mapStatus(result);
                if (status === "failed") failed.add(result.node_id);
                else {
                    if (result.output) nodeOutputs[result.node_id] = result.output;
                    const files = outputToFiles(result.tool_id, result.output);
                    if (files.length > 0) {
                        toolOutputs[result.node_id] = {
                            tool_id: result.tool_id,
                            files,
                        };
                    }
                }
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
                // Audit each tool with its full output + the generated code, so a
                // run can be inspected node-by-node (what each tool produced).
                const out = result.output as { code?: string } | null;
                await tracer?.record({
                    phase: "tool",
                    tool_id: result.tool_id,
                    node_id: result.node_id,
                    status: status === "succeeded" ? "succeeded" : "failed",
                    // The tool input = the prompt context; paired with
                    // generated_code + qa_log (attempts/errors) it's a training
                    // sample for the Godot fine-tune (see docs/FINE_TUNE_DATASET.md).
                    input: inputByNode.get(result.node_id),
                    output: result.output,
                    generated_code: typeof out?.code === "string" ? out.code : undefined,
                    cost_usd: result.cost_usd,
                    latency_ms: result.latency_ms,
                    error: result.error_message ?? undefined,
                });
            }
        }

        // The design's win condition, for the Playtester's LLM judge to assess
        // completability against (universal, genre-agnostic).
        const designDoc = input.memory.short_term?.design_doc as { win_condition?: string; pitch?: string } | undefined;
        const playtestGoal = designDoc?.win_condition ?? designDoc?.pitch ?? undefined;

        // Hand the (succeeded) tool outputs to the Assembler build seam.
        const build = await runtimeBuildFn({
            project_id: plan.project_id,
            plan_version: plan.plan_version,
            engine: plan.meta.engine,
            tool_outputs: toolOutputs,
            run_smoke_test: true,
            playtest_goal: playtestGoal,
        });
        totalLatency += build.total_duration_ms;
        // Audit the build with its FULL log + smoke result — the exact stderr
        // and smoke crash_reason, so a failed/grey build is debuggable from the DB.
        await tracer?.record({
            phase: "build",
            engine: plan.meta.engine,
            status: build.smoke_test.passed === false ? "degraded" : "succeeded",
            output: { artifact_id: build.artifact_id, iframe_url: build.iframe_url ?? null, smoke_passed: build.smoke_test.passed },
            build_log: build.build_log,
            smoke_log: build.smoke_test.crash_reason ?? undefined,
            latency_ms: build.total_duration_ms,
        });
        if (build.playtest?.ran) {
            await tracer?.record({
                phase: "playtest",
                engine: plan.meta.engine,
                status: build.playtest.playable ? "succeeded" : "failed",
                smoke_log: build.playtest.reason,
            });
        }

        // Hard gate: a game is "passed" only if it has gameplay code AND boots
        // (smoke) AND is actually playable (playtest: renders + reacts to
        // input). Each failing layer contributes the reason that D.6 surfaces
        // and the loop feeds back to regeneration.
        const hasCode = nodeResults.some(
            (n) => n.tool_id.startsWith("code_gen") && n.status === "succeeded",
        );
        const playtestFailed = build.playtest?.ran === true && build.playtest.playable === false;
        const smokePassed = hasCode && (build.smoke_test.passed ?? false) && !playtestFailed;
        const crashReason = !hasCode
            ? "no gameplay code generated (code_gen did not succeed)"
            : playtestFailed
                ? `not playable: ${build.playtest?.reason}`
                : build.smoke_test.crash_reason;

        const smokeReport: SmokeTestReport = {
            runs: [
                {
                    engine: smokeEngine(plan.meta.engine),
                    passed: smokePassed,
                    crash_reason: crashReason,
                },
            ],
        };

        return {
            build_artifact_id: build.artifact_id,
            iframe_url: build.iframe_url ?? null,
            node_results: nodeResults,
            smoke_test_report: smokeReport,
            total_cost_usd: totalCost,
            total_latency_ms: totalLatency,
            memory: input.memory,
        };
    },
};
