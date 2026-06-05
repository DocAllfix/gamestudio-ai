/**
 * Tool registry — maps the implemented W2 tool ids to their descriptors.
 *
 * Only the [2-W2] FREE-vertical tools are wired here; the remaining day-1
 * tool ids are still served by the canned stub in
 * lib/_mocks/tools.mock.ts until their phases land. `dispatch()` runs a
 * tool by invocation envelope, using each tool's default (real) deps.
 */
import {
    type ToolExecutionResult,
    ToolExecutionResultSchema,
    type ToolId,
    type ToolInvocation,
} from "../contracts/tool-registry.contract.js";

import godot from "./code/godot/index.js";
import phaser from "./code/phaser/index.js";
import threejs from "./code/threejs/index.js";
import babylon from "./code/babylon/index.js";
import defold from "./code/defold/index.js";
import assetResolver from "./asset-resolver/index.js";
import spriteGen from "./sprite/index.js";
import byoaAnalyzer from "./extras/byoa-analyzer/index.js";
import codeValidator from "./qa/code-validator/index.js";
import projectValidator from "./qa/project-validator/index.js";
import levelLayout2d from "./level/level_layout_2d/index.js";
import tilemapPopulate from "./level/tilemap_populate/index.js";
import entityPlacement from "./level/entity_placement/index.js";
import levelLayout3d from "./level/level_layout_3d/index.js";
import heightmapGen from "./level/heightmap_gen/index.js";
import { bgmGenTool, sfxGenTool, voiceGenTool } from "./audio/tool.js";

type AnyHandler = (invocation: ToolInvocation) => Promise<ToolExecutionResult>;

/** Partial map: implemented tool ids only. */
export const REGISTRY: Partial<Record<ToolId, AnyHandler>> = {
    code_gen_godot_gdscript: godot.handler as AnyHandler,
    code_gen_phaser_js: phaser.handler as AnyHandler,
    code_gen_threejs_ts: threejs.handler as AnyHandler,
    code_gen_babylon_ts: babylon.handler as AnyHandler,
    code_gen_defold_lua: defold.handler as AnyHandler,
    asset_resolver: assetResolver.handler as AnyHandler,
    sprite_gen: spriteGen.handler as AnyHandler,
    byoa_analyzer: byoaAnalyzer.handler as AnyHandler,
    code_validator: codeValidator.handler as AnyHandler,
    project_validator: projectValidator.handler as AnyHandler,
    level_layout_2d: levelLayout2d.handler as AnyHandler,
    tilemap_populate: tilemapPopulate.handler as AnyHandler,
    entity_placement: entityPlacement.handler as AnyHandler,
    level_layout_3d: levelLayout3d.handler as AnyHandler,
    heightmap_gen: heightmapGen.handler as AnyHandler,
    bgm_gen: bgmGenTool.handler as AnyHandler,
    sfx_gen: sfxGenTool.handler as AnyHandler,
    voice_gen: voiceGenTool.handler as AnyHandler,
};

export function isImplemented(toolId: ToolId): boolean {
    return toolId in REGISTRY;
}

export async function dispatch(invocation: ToolInvocation): Promise<ToolExecutionResult> {
    const handler = REGISTRY[invocation.tool_id];
    if (!handler) {
        throw new Error(`Tool not implemented in registry: ${invocation.tool_id}`);
    }
    return handler(invocation);
}

/**
 * Graceful dispatch for the orchestrator: a node whose tool isn't implemented
 * yet (e.g. audio/assembler tools still pending) or whose handler throws does
 * NOT crash the whole plan — it returns a failed/rejected ToolExecutionResult so
 * the DAG can continue and D.6 can judge the outcome. Real, implemented tools
 * run and Zod-validate their inputs normally (the anti-slop guarantee stands).
 */
async function dispatchSafe(invocation: ToolInvocation): Promise<ToolExecutionResult> {
    const base = {
        tool_id: invocation.tool_id,
        node_id: invocation.node_id,
        trace_id: invocation.trace_id,
        cost_usd: 0,
        latency_ms: 0,
        created_at: new Date().toISOString(),
    };
    if (!isImplemented(invocation.tool_id)) {
        return ToolExecutionResultSchema.parse({
            ...base,
            status: "failed",
            output: null,
            qa_log: [{ check: "tool_implemented", passed: false, detail: `${invocation.tool_id} not yet implemented` }],
            error_message: `Tool not implemented: ${invocation.tool_id}`,
        });
    }
    try {
        return await dispatch(invocation);
    } catch (error) {
        console.error({ context: "registry.dispatchSafe", tool_id: invocation.tool_id, node_id: invocation.node_id, error });
        return ToolExecutionResultSchema.parse({
            ...base,
            status: "failed",
            output: null,
            qa_log: [{ check: "dispatch", passed: false, detail: String(error instanceof Error ? error.message : error) }],
            error_message: String(error instanceof Error ? error.message : error),
        });
    }
}

/**
 * Batch dispatch — the merge-time `invokeToolBatch` W1's ExecutionOrchestrator
 * consumed from `lib/_mocks/tools.mock`. Uses dispatchSafe so one unimplemented
 * or failing node degrades to a failed result instead of crashing the batch.
 */
export async function invokeToolBatch(
    invocations: readonly ToolInvocation[],
): Promise<ToolExecutionResult[]> {
    return Promise.all(invocations.map((inv) => dispatchSafe(inv)));
}
