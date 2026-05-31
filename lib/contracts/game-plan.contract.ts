/**
 * Game Plan Contract — the typed JSON the Reasoning Engine produces and
 * the Execution Orchestrator consumes.
 *
 * Shape is taken from `docs/PIETRA_v5_ADDENDUM.md` §E (the authoritative
 * source) plus `docs/GAME_REASONING_ENGINE_BLUEPRINT_v2.md` PARTE C/L
 * (RFC 6902 versioning). Every cross-workstream field MUST round-trip
 * through this schema — adding a new field requires a contract
 * proposal issue per §02.3 of the Manifesto.
 *
 * Two design rules:
 *   1. Enums (engine, genre, style_pack_id) come from the seeded
 *      catalog tables in migration 005, not from free-form strings.
 *      The runtime enforces this via foreign key + RLS; the contract
 *      uses `z.enum` only for the small fixed sets (engine, genre)
 *      and `z.string()` for the catalog references the DB validates.
 *   2. The `execution_dag` lives in the plan, not in the orchestrator.
 *      W1 emits it; W2 tools consume node-by-node; W3 builds from it.
 *      The Plan is the single source of truth for what to generate.
 */
import { z } from "zod";

import { GameGraphSchema } from "./game-graph.contract.js";

// ---- Enums constrained by Phase 1 taxonomy --------------------------------

export const EngineEnum = z.enum([
    "godot",
    "phaser",
    "renpy",
    "defold",
    "monogame",
    "love2d",
    "threejs",
    "stride",
]);
export type Engine = z.infer<typeof EngineEnum>;

/** The 14 day-1 genres seeded into `genre_templates` by migration 003
 * (already applied). Verified 2026-05-31 against the live Supabase
 * remote via `SELECT genre FROM genre_templates ORDER BY genre`.
 * Source of truth: the seeded DB rows. Migration 005 references these
 * by string FK, so this enum mirrors the DB exactly. */
export const GenreEnum = z.enum([
    "browser_arcade",
    "bullet_hell",
    "card_game",
    "hardcore_platformer",
    "jrpg",
    "metroidvania",
    "mobile_puzzle",
    "multiplayer_arena",
    "retro_8bit",
    "roguelike",
    "social_sim",
    "stride_action",
    "threejs_showcase",
    "visual_novel",
]);
export type Genre = z.infer<typeof GenreEnum>;

// ---- Sub-schemas ----------------------------------------------------------

/** A single node in the Execution DAG. The Orchestrator schedules nodes
 * topologically: a node fires when all its `depends_on` outputs exist. */
export const ExecutionDagNodeSchema = z.object({
    id: z.string().min(1).regex(/^[a-z0-9_-]+$/, {
        message: "dag node id must be kebab/snake case",
    }),
    tool_id: z.string().min(1),
    /** Free-form tool-specific input. Each tool validates its own
     * shape via `tool-registry.contract.ts`. */
    input: z.record(z.unknown()),
    depends_on: z.array(z.string()).default([]),
    /** Optional retry policy override. Defaults come from the tool
     * registry entry. */
    max_retries: z.number().int().min(0).max(5).optional(),
});
export type ExecutionDagNode = z.infer<typeof ExecutionDagNodeSchema>;

export const ExecutionDagSchema = z.object({
    nodes: z.array(ExecutionDagNodeSchema).min(1).max(100),
});
export type ExecutionDag = z.infer<typeof ExecutionDagSchema>;

/** Asset binding: maps a logical asset slot (e.g. "player_sprite") to
 * either a `match_assets` result row (CC0 from the catalog) OR a
 * generative result reference (Replicate output, TRELLIS.2 GLB, etc.).
 * The Asset Resolver picks one path per slot at materialization time. */
export const AssetBindingSchema = z.discriminatedUnion("source", [
    z.object({
        source: z.literal("catalog"),
        slot: z.string().min(1),
        asset_library_id: z.string().uuid(),
        download_url: z.string().url(),
        license: z.string().min(1),
        attribution_required: z.boolean(),
        creator_name: z.string().nullable(),
    }),
    z.object({
        source: z.literal("generative"),
        slot: z.string().min(1),
        tool_id: z.string().min(1),
        provider: z.enum([
            "replicate",
            "suno",
            "elevenlabs",
            "meshy",
            "trellis2",
        ]),
        prompt: z.string().min(1),
        output_url: z.string().url(),
        cost_usd: z.number().min(0),
    }),
]);
export type AssetBinding = z.infer<typeof AssetBindingSchema>;

/** Pacing curve sample: a 0-1 normalized stress value at a normalized
 * progress point (also 0-1). The Balance Controller (D.4) interpolates
 * and the Playtester (D.6) compares against measured runs. */
export const PacingCurveSchema = z
    .array(
        z.object({
            progress: z.number().min(0).max(1),
            stress: z.number().min(0).max(1),
        }),
    )
    .min(2);
export type PacingCurve = z.infer<typeof PacingCurveSchema>;

/** Aesthetic coherence metrics attached to the plan after D.6. The
 * Studio Mode UI surfaces these per plan version on the diff timeline. */
export const AestheticCoherenceMetricsSchema = z.object({
    mean_clip_similarity: z.number().min(0).max(1),
    passed: z.boolean(),
    measured_at: z.string().datetime(),
});
export type AestheticCoherenceMetrics = z.infer<
    typeof AestheticCoherenceMetricsSchema
>;

// ---- Game Plan top-level --------------------------------------------------

export const GamePlanMetaSchema = z.object({
    title: z.string().min(1).max(120),
    genre: GenreEnum,
    engine: EngineEnum,
    /** Style Pack id from the seeded catalog. */
    style_pack_id: z.string().min(1),
    /** Genre template id from the seeded catalog the plan was forked
     * from. Used for diff-based incremental materialization (L.4). */
    template_origin: z.string().min(1),
    target_duration_minutes: z.number().int().min(1).max(180),
    difficulty: z.enum(["chill", "balanced", "hard", "brutal"]),
});
export type GamePlanMeta = z.infer<typeof GamePlanMetaSchema>;

export const GamePlanSchema = z.object({
    /** Monotonically increasing across the version chain. v1 = freshly
     * created from the genre template; v2+ = after one or more diffs. */
    plan_version: z.number().int().min(1),
    /** Stable id across all versions of the same project. */
    project_id: z.string().uuid(),
    meta: GamePlanMetaSchema,
    /** The world graph (validated by `game-graph.contract.ts`). */
    world_graph: GameGraphSchema,
    pacing_curve: PacingCurveSchema,
    /** Free-form structured object holding rule values (player_hp,
     * enemy_dmg_range, score_per_kill, etc.). Validated by D.4 against
     * the genre template's `rules_ranges` constraint. */
    rules: z.record(z.union([z.number(), z.string(), z.boolean()])),
    /** Asset slots — populated by D.5 Asset Resolver. */
    asset_bindings: z.array(AssetBindingSchema),
    /** The DAG the Orchestrator runs. */
    execution_dag: ExecutionDagSchema,
    /** Set by D.6 Evaluation Agent on every materialization pass. */
    aesthetic_coherence_metrics: AestheticCoherenceMetricsSchema.optional(),
});
export type GamePlan = z.infer<typeof GamePlanSchema>;

// ---- RFC 6902 patch (Game Plan Diff) -------------------------------------

/** A single RFC 6902 JSON Patch operation. The full type from the spec
 * is broader than what we use; we restrict to add/remove/replace which
 * is what the Reasoning Engine emits during refinement (D.2-Refine). */
export const GamePlanPatchOpSchema = z.discriminatedUnion("op", [
    z.object({
        op: z.literal("add"),
        path: z.string().regex(/^\//, { message: "path must start with /" }),
        value: z.unknown(),
    }),
    z.object({
        op: z.literal("remove"),
        path: z.string().regex(/^\//),
    }),
    z.object({
        op: z.literal("replace"),
        path: z.string().regex(/^\//),
        value: z.unknown(),
    }),
]);
export type GamePlanPatchOp = z.infer<typeof GamePlanPatchOpSchema>;

export const GamePlanPatchSchema = z.object({
    project_id: z.string().uuid(),
    /** The version the patch was computed against. The DB rejects the
     * patch if the current head isn't this version (optimistic CC). */
    parent_version: z.number().int().min(1),
    ops: z.array(GamePlanPatchOpSchema).min(1).max(200),
    /** Short human-readable summary surfaced in the Studio diff
     * timeline UI: "Rendi il boss piu facile" / "Aggiungi un secret". */
    summary: z.string().min(1).max(280),
});
export type GamePlanPatch = z.infer<typeof GamePlanPatchSchema>;
