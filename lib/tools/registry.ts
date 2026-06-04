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
 * Batch dispatch — drop-in replacement for the merge-time `invokeToolBatch`
 * that W1's ExecutionOrchestrator consumed from `lib/_mocks/tools.mock`.
 * Same shape as the mock (Promise.all over the real `dispatch`).
 */
export async function invokeToolBatch(
    invocations: readonly ToolInvocation[],
): Promise<ToolExecutionResult[]> {
    return Promise.all(invocations.map((inv) => dispatch(inv)));
}
