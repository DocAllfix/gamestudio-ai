/**
 * Tool Registry Contract — the surface every W2 tool implements.
 *
 * The contract defines:
 *   - Base input/output Zod schemas every tool extends
 *   - The Tool descriptor each tool exports
 *   - The 48 day-1 tool IDs as a const-array union (Pietra v4 §1.4)
 *
 * Each tool ships a per-tool schema in
 * `lib/tools/<category>/<tool>/schema.ts` that EXTENDS the base shapes.
 * The Orchestrator (W1) imports those schemas to validate node inputs
 * before dispatching.
 */
import { z } from "zod";

// ---- Base shapes ---------------------------------------------------------

export const ToolInputBaseSchema = z.object({
    /** Reference to the parent project for telemetry and quota. */
    project_id: z.string().uuid(),
    /** Reference to the Game Plan version this call is rooted in. */
    plan_version: z.number().int().min(1),
    /** Trace id for cross-tool stitching in Helicone / PostHog. */
    trace_id: z.string().min(1),
    /** Optional cost cap override (default in registry entry). */
    cost_cap_usd: z.number().min(0).optional(),
});
export type ToolInputBase = z.infer<typeof ToolInputBaseSchema>;

export const ToolOutputBaseSchema = z.object({
    /** Echo of the request trace id. */
    trace_id: z.string().min(1),
    /** Actual cost incurred for this call. */
    cost_usd: z.number().min(0),
    /** Wall-clock latency, useful for cost-vs-time dashboards. */
    latency_ms: z.number().int().min(0),
    /** Per-call QA log: each item is an assertion the tool ran on its
     * own output before returning. Empty array = nothing failed. */
    qa_log: z.array(
        z.object({
            check: z.string().min(1),
            passed: z.boolean(),
            detail: z.string().nullable().default(null),
        }),
    ),
});
export type ToolOutputBase = z.infer<typeof ToolOutputBaseSchema>;

// ---- Tool descriptor + ID enum -------------------------------------------

/** Categories used to group the 48 day-1 tools in the UI and the
 * tool-registry index. Matches the directory structure of `lib/tools/`. */
export const ToolCategoryEnum = z.enum([
    "code",
    "sprite",
    "audio",
    "3d",
    "shader",
    "level",
    "qa",
    "publishers",
    "extras",
]);
export type ToolCategory = z.infer<typeof ToolCategoryEnum>;

/** The full list of day-1 tool ids. Adding a new id requires extending
 * this enum AND committing the per-tool schema + handler. The
 * Orchestrator refuses to dispatch a node whose `tool_id` is unknown. */
export const ToolIdEnum = z.enum([
    // code (8 engines x code_gen)
    "code_gen_godot_gdscript",
    "code_gen_phaser_js",
    "code_gen_renpy_python",
    "code_gen_defold_lua",
    "code_gen_monogame_csharp",
    "code_gen_love2d_lua",
    "code_gen_threejs_ts",
    "code_gen_stride_csharp",
    "code_gen_babylon_ts",
    // sprite (2D art)
    "sprite_gen",
    "tileset_gen",
    "ui_element_gen",
    "icon_gen",
    "concept_art_gen",
    // audio
    "bgm_gen",
    "sfx_gen",
    "voice_gen",
    // 3d
    "model_3d_gen",
    "animation_3d_gen",
    "texture_gen",
    "hdri_gen",
    // shader
    "shader_gen_glsl",
    "shader_gen_hlsl",
    "shader_gen_godot",
    // level
    "level_layout_2d",
    "level_layout_3d",
    "tilemap_populate",
    "entity_placement",
    "heightmap_gen",
    // qa
    "code_validator",
    "project_validator",
    "playtest_simulator",
    "smoke_test_runner",
    // publishers
    "godot_assembler",
    "phaser_assembler",
    "renpy_assembler",
    "defold_assembler",
    "monogame_assembler",
    "love2d_assembler",
    "threejs_assembler",
    "stride_assembler",
    "babylon_assembler",
    "itch_packager",
    "store_page_gen",
    // extras
    "stream_mode",
    "portfolio_gen",
    "jam_mode",
    "ai_coach",
    "npc_plugin",
    "byoa_analyzer",
    "asset_resolver",
]);
export type ToolId = z.infer<typeof ToolIdEnum>;

/** Registry entry describing one tool. Stored in
 * `lib/tools/<category>/<tool_id>/index.ts` as a default export. */
export interface ToolDescriptor<I extends ToolInputBase, O extends ToolOutputBase> {
    /** Stable id used in Game Plan execution_dag nodes. */
    id: ToolId;
    /** Human-readable name for UI surfaces. */
    name: string;
    /** One-paragraph description; shown in Studio Mode node inspector. */
    description: string;
    category: ToolCategory;
    /** Zod schema validating the EXACT input shape this tool accepts.
     * Always extends ToolInputBaseSchema. */
    inputSchema: z.ZodType<I>;
    /** Zod schema validating the EXACT output shape this tool returns.
     * Always extends ToolOutputBaseSchema. */
    outputSchema: z.ZodType<O>;
    /** Best-effort cost estimate in USD for one call at typical input
     * size. Used by the Orchestrator for budget pre-flight. */
    estimatedCostUsd: number;
    /** Best-effort wall-clock estimate in seconds. */
    estimatedDurationSeconds: number;
    /** The actual implementation. W1's mocks throw "Not implemented";
     * W2's real implementations replace these at merge time. */
    handler: (input: I) => Promise<O>;
}

/** Invocation envelope the Orchestrator emits onto Trigger.dev. */
export const ToolInvocationSchema = z.object({
    tool_id: ToolIdEnum,
    input: z.record(z.unknown()),
    node_id: z.string().min(1),
    project_id: z.string().uuid(),
    plan_version: z.number().int().min(1),
    trace_id: z.string().min(1),
});
export type ToolInvocation = z.infer<typeof ToolInvocationSchema>;

/** The envelope every tool returns. The Orchestrator persists this
 * exact shape in the `tool_executions` table for replay + UI inspector. */
export const ToolExecutionResultSchema = z.object({
    tool_id: ToolIdEnum,
    node_id: z.string().min(1),
    trace_id: z.string().min(1),
    status: z.enum(["succeeded", "failed", "rejected_by_qa"]),
    output: z.record(z.unknown()).nullable(),
    cost_usd: z.number().min(0),
    latency_ms: z.number().int().min(0),
    qa_log: z.array(
        z.object({
            check: z.string().min(1),
            passed: z.boolean(),
            detail: z.string().nullable().default(null),
        }),
    ),
    error_message: z.string().nullable().default(null),
    created_at: z.string().datetime(),
});
export type ToolExecutionResult = z.infer<typeof ToolExecutionResultSchema>;
