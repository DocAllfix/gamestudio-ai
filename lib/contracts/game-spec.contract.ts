/**
 * GameSpec Contract — the DATA the scene composer consumes (FASE 0).
 *
 * The architecture pivot (docs/IMPLEMENTATION_PLAN.md, memory
 * project_architecture_pivot): the LLM emits DATA, not rendering code. A
 * deterministic composer + per-engine adapters turn this spec into a real
 * scene. GameSpec is a discriminated union on `archetype` (6 archetypes cover
 * the 14 genres) and WRAPS the engine-agnostic Tiled `.tmj` (the 2D level-data
 * transport produced by tilemap_populate) — adding what the .tmj does not
 * cover: camera, parallax, physics, mechanics flags, asset-slot binding, goal.
 *
 * GameSpec is COMPOSED deterministically (from GamePlan + AbstractLayout +
 * resolved assets + the archetype recipe), not free-form LLM output. The LLM's
 * variance stays in D.1/D.2 (intent+design) and the optional mechanics_delta.
 *
 * Design notes (mirror game-plan.contract.ts):
 *   - Coordinates in `*_tile` fields are GRID cells; the composer multiplies by
 *     `tile_px`. `*_px` fields (hitbox, deadzone) are already pixels. Both Godot
 *     and Phaser are Y-down / pixel, so no coordinate-system conversion.
 *   - Asset slots carry the ENRICHED metadata (tile_size, frame, palette) the
 *     Studio (FASE 1) produces and the composer consumes. See
 *     docs/FASE0_GAMESPEC_DESIGN.md §4.
 *   - Only `side_scroller_platform` is fully specified in FASE 0. The other five
 *     archetypes are skeletons (discriminator + meta + draft body) fleshed out
 *     when FASE 2 expands horizontally.
 */
import { z } from "zod";

import { EngineEnum, GenreEnum, AssetBindingSchema } from "./game-plan.contract.js";

// ---- Archetypes -----------------------------------------------------------

/** The 6 scene archetypes. Strato A of the architecture: each is an
 * engine-agnostic recipe over the EngineComposer primitives. */
export const ArchetypeEnum = z.enum([
    "side_scroller_platform",
    "top_down_grid",
    "arena_2d",
    "puzzle_grid",
    "scene_3d",
    "non_spatial_ui",
]);
export type Archetype = z.infer<typeof ArchetypeEnum>;

/** Deterministic genre → archetype map (docs/FASE0_GAMESPEC_DESIGN.md §1).
 * `design.ts` (FASE 2) uses this to pick the archetype from the GamePlan genre
 * and to reject impossible engine×archetype combos (e.g. threejs + platformer). */
export const GENRE_TO_ARCHETYPE: Record<z.infer<typeof GenreEnum>, Archetype> = {
    hardcore_platformer: "side_scroller_platform",
    metroidvania: "side_scroller_platform",
    jrpg: "top_down_grid",
    roguelike: "top_down_grid",
    retro_8bit: "top_down_grid",
    social_sim: "top_down_grid",
    bullet_hell: "arena_2d",
    browser_arcade: "arena_2d",
    multiplayer_arena: "arena_2d",
    mobile_puzzle: "puzzle_grid",
    threejs_showcase: "scene_3d",
    stride_action: "scene_3d",
    visual_novel: "non_spatial_ui",
    card_game: "non_spatial_ui",
};

// ---- Shared primitives ----------------------------------------------------

/** A grid cell coordinate. The composer multiplies by `world.tile_px`. */
export const TileCoordSchema = z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
});
export type TileCoord = z.infer<typeof TileCoordSchema>;

/** A 2D scalar pair in pixels (hitbox, deadzone). */
export const PixelSizeSchema = z.object({
    w: z.number().min(0),
    h: z.number().min(0),
});

/** A 2D scroll/scale factor (parallax, zoom helpers). */
export const Vec2Schema = z.object({ x: z.number(), y: z.number() });

// ---- Asset slot (asset ⟷ GameSpec co-design — §4 of the design doc) -------

export const AssetSlotRoleEnum = z.enum([
    "tileset",
    "character",
    "prop",
    "background",
    "ui",
    "audio",
]);
export type AssetSlotRole = z.infer<typeof AssetSlotRoleEnum>;

/** Sprite-sheet animation metadata produced by the Studio frame analyzer
 * (FASE 1). The composer turns this into Godot SpriteFrames / Phaser anims. */
export const FrameMetaSchema = z.object({
    w: z.number().int().min(1),
    h: z.number().int().min(1),
    count: z.number().int().min(1),
    /** Frames per animation row (a grid sheet's width). The composer cycles
     * frames 0..cols-1 as the walk loop; absent → cycle all `count` (a strip). */
    cols: z.number().int().min(1).optional(),
    fps: z.number().min(1).max(60).default(8),
    /** Anchor as a 0-1 fraction of the frame (feet = {0.5, 1.0}). */
    anchor: Vec2Schema.default({ x: 0.5, y: 1.0 }),
});
export type FrameMeta = z.infer<typeof FrameMetaSchema>;

/** One logical asset slot. `binding` reuses the existing AssetBindingSchema
 * (catalog | generative | user_prepared); `binding=null` = placeholder (the
 * composer renders a coherent placeholder, never a hole). The enriched fields
 * (tile_size, frame, palette_hex, pixel_art) are what the composer needs and
 * the Studio populates — see docs/FASE0_GAMESPEC_DESIGN.md §4. */
export const AssetSlotSchema = z.object({
    /** Logical id referenced by blocks: "player", "tileset", "bg_far", ... */
    slot: z.string().min(1),
    role: AssetSlotRoleEnum,
    binding: AssetBindingSchema.nullable(),
    /** Tileset grid size in px (null for non-tilesets). */
    tile_size: z.number().int().min(8).max(256).nullable().default(null),
    /** Animation metadata (null for static sprites/props). */
    frame: FrameMetaSchema.nullable().default(null),
    /** Dominant palette (coherence + recolor). */
    palette_hex: z.array(z.string()).default([]),
    /** Nearest-neighbor filtering hint. */
    pixel_art: z.boolean().default(true),
});
export type AssetSlot = z.infer<typeof AssetSlotSchema>;

// ---- Blocks (each maps 1:1 to an EngineComposer primitive) ----------------

export const GameSpecMetaSchema = z.object({
    project_id: z.string().uuid(),
    plan_version: z.number().int().min(1),
    engine: EngineEnum,
    style_pack_id: z.string().min(1),
    title: z.string().min(1).max(120),
});
export type GameSpecMeta = z.infer<typeof GameSpecMetaSchema>;

/** Geometry + pointer to the concrete .tmj produced by tilemap_populate. */
export const WorldSpecSchema = z.object({
    width_tiles: z.number().int().min(1),
    height_tiles: z.number().int().min(1),
    tile_px: z.number().int().min(1).default(16),
    /** Sandbox path of the .tmj file (tool_outputs file). */
    tmj_path: z.string().min(1),
    /** Asset slot id of the tileset image. */
    tileset_slot: z.string().min(1),
    /** The level geometry, interpreted for THIS archetype. For a platformer
     * (side_scroller) the .tmj's top-down floor/wall semantics don't apply —
     * what matters is solid vs air: 1 = a solid tile the player stands on,
     * 0 = air the player falls through. Row-major: solid_tiles[y][x]. When
     * present the composer renders a real tiled level; absent → a flat floor.
     * (A platformer-aware generator produces this with jumpReachCells spacing;
     * the composer is agnostic to where it came from.) */
    solid_tiles: z.array(z.array(z.number().int().min(0).max(1))).optional(),
});
export type WorldSpec = z.infer<typeof WorldSpecSchema>;

/** Platformer physics = the PhysicsProfile single source of truth
 * (lib/tools/level/_platformer-physics.ts). The same numbers drive the level
 * generator AND the player controller, so "what the level assumes" equals
 * "what the code does". */
export const PhysicsSpecSchema = z.object({
    gravity: z.number().min(0).default(1200),
    jump_velocity: z.number().min(0).default(450),
    move_speed: z.number().min(0).default(300),
});
export type PhysicsSpec = z.infer<typeof PhysicsSpecSchema>;

export const PlayerSpecSchema = z.object({
    spawn_tile: TileCoordSchema,
    asset_slot: z.string().min(1),
    hitbox_px: PixelSizeSchema,
    facing: z.enum(["left", "right"]).default("right"),
});
export type PlayerSpec = z.infer<typeof PlayerSpecSchema>;

export const EntityKindEnum = z.enum([
    "enemy",
    "pickup",
    "hazard",
    "npc",
    "checkpoint",
]);
export type EntityKind = z.infer<typeof EntityKindEnum>;

export const EntitySpecSchema = z.object({
    id: z.string().min(1),
    kind: EntityKindEnum,
    tile: TileCoordSchema,
    asset_slot: z.string().min(1),
    /** Optional patrol waypoints (enemies). Empty = stationary. */
    patrol_tiles: z.array(TileCoordSchema).default([]),
    /** Items this entity grants on pickup/interact (mirrors GameGraph grants). */
    grants: z.array(z.string()).default([]),
});
export type EntitySpec = z.infer<typeof EntitySpecSchema>;

export const CameraSpecSchema = z.object({
    zoom: z.number().min(0.1).max(8).default(1),
    deadzone_px: PixelSizeSchema.default({ w: 80, h: 60 }),
    follow: z.enum(["player", "fixed"]).default("player"),
    clamp_to_world: z.boolean().default(true),
});
export type CameraSpec = z.infer<typeof CameraSpecSchema>;

export const ParallaxLayerSchema = z.object({
    asset_slot: z.string().min(1),
    /** <1 = farther/slower; the composer scrolls at this fraction of the camera. */
    scroll_scale: Vec2Schema.default({ x: 0.5, y: 1 }),
    z: z.number().int().default(-10),
});
export type ParallaxLayer = z.infer<typeof ParallaxLayerSchema>;

export const BackgroundSpecSchema = z.object({
    asset_slot: z.string().nullable().default(null),
    /** How to fill the viewport. `gradient_fallback` is used when asset_slot is
     * null — never a flat dark void. */
    fill_mode: z
        .enum(["stretch_cover", "tile", "gradient_fallback"])
        .default("gradient_fallback"),
});
export type BackgroundSpec = z.infer<typeof BackgroundSpecSchema>;

export const HudElementSchema = z.object({
    type: z.enum(["score", "health", "timer", "coins", "label"]),
    /** Optional rules/state key this element reads (e.g. "player_hp"). */
    binds_to: z.string().optional(),
    text: z.string().optional(),
});
export type HudElement = z.infer<typeof HudElementSchema>;

export const HudSpecSchema = z.object({
    elements: z.array(HudElementSchema).default([]),
});
export type HudSpec = z.infer<typeof HudSpecSchema>;

export const GoalSpecSchema = z.object({
    type: z.enum(["reach_exit", "collect_all", "survive_time", "defeat_all"]),
    exit_tile: TileCoordSchema.optional(),
    target_count: z.number().int().min(1).optional(),
    seconds: z.number().int().min(1).optional(),
});
export type GoalSpec = z.infer<typeof GoalSpecSchema>;

export const MechanicFlagEnum = z.enum([
    "double_jump",
    "dash",
    "wall_jump",
    "crouch",
]);

export const MechanicsSpecSchema = z.object({
    flags: z.array(MechanicFlagEnum).default([]),
    /** Path to an optional LLM-generated mechanics-delta script (the only place
     * the LLM writes runtime code in the new architecture). null = standard. */
    delta_script_path: z.string().nullable().default(null),
});
export type MechanicsSpec = z.infer<typeof MechanicsSpecSchema>;

// ---- side_scroller_platform (full spec) -----------------------------------

export const SideScrollerSpecSchema = z.object({
    archetype: z.literal("side_scroller_platform"),
    meta: GameSpecMetaSchema,
    world: WorldSpecSchema,
    physics: PhysicsSpecSchema,
    player: PlayerSpecSchema,
    entities: z.array(EntitySpecSchema).default([]),
    camera: CameraSpecSchema,
    parallax: z.array(ParallaxLayerSchema).default([]),
    background: BackgroundSpecSchema,
    hud: HudSpecSchema,
    goal: GoalSpecSchema,
    mechanics: MechanicsSpecSchema,
    /** The asset binding table; every `*_slot` reference resolves here. */
    asset_slots: z.array(AssetSlotSchema).min(1),
});
export type SideScrollerSpec = z.infer<typeof SideScrollerSpecSchema>;

// ---- Skeletons (FASE 2 fleshes these out) ---------------------------------

/** A skeleton archetype: discriminator + meta + a draft body. Enough to keep
 * the discriminated union total and let `design.ts`/GENRE_TO_ARCHETYPE compile
 * today, without committing to a shape that horizontal expansion will refine. */
function skeleton<L extends Archetype>(archetype: L) {
    return z.object({
        archetype: z.literal(archetype),
        meta: GameSpecMetaSchema,
        /** Draft body — replaced by a typed spec when this archetype lands. */
        draft: z.record(z.unknown()).default({}),
    });
}

export const TopDownGridSpecSchema = skeleton("top_down_grid");
export const Arena2DSpecSchema = skeleton("arena_2d");
export const PuzzleGridSpecSchema = skeleton("puzzle_grid");
export const Scene3DSpecSchema = skeleton("scene_3d");
export const NonSpatialUiSpecSchema = skeleton("non_spatial_ui");

// ---- GameSpec union -------------------------------------------------------

export const GameSpecSchema = z.discriminatedUnion("archetype", [
    SideScrollerSpecSchema,
    TopDownGridSpecSchema,
    Arena2DSpecSchema,
    PuzzleGridSpecSchema,
    Scene3DSpecSchema,
    NonSpatialUiSpecSchema,
]);
export type GameSpec = z.infer<typeof GameSpecSchema>;
