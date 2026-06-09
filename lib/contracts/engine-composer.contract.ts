/**
 * EngineComposer Contract — the hexagonal port the scene composer drives (FASE 0).
 *
 * Strato B of the architecture (docs/IMPLEMENTATION_PLAN.md, §0 of
 * docs/FASE0_GAMESPEC_DESIGN.md): ~10 primitives that EVERY engine implements
 * once. A per-archetype driver `composeScene(spec, composer)` dispatches on
 * `spec.archetype` and calls the primitives in order; each primitive translates
 * one GameSpec block into the engine's NATIVE declarative form (Godot `.tscn`,
 * Phaser `scene.js`) — never runtime node-building. Cost is N engines ×
 * P primitives + K archetypes, not N×M.
 *
 * The port is stateful: instantiate one composer per game, call the primitives,
 * then `finalize()` to serialize the accumulator into engine files. The
 * composer loads the asset-slot table in `beginScene`, so the other primitives
 * resolve slots internally (no resolver passed around).
 *
 * Each primitive's Godot ‖ Phaser pseudo-code is in docs/FASE0_GAMESPEC_DESIGN.md
 * §3 — the anti-leak filter that proved every field translates to both engines.
 * Implementations live in lib/runtime/composer/<engine>/ (FASE 2).
 */
import { z } from "zod";

import { EngineEnum } from "./game-plan.contract.js";
import type {
    AssetSlot,
    BackgroundSpec,
    CameraSpec,
    EntitySpec,
    GameSpec,
    GameSpecMeta,
    GoalSpec,
    HudSpec,
    MechanicsSpec,
    ParallaxLayer,
    PhysicsSpec,
    PlayerSpec,
    WorldSpec,
} from "./game-spec.contract.js";

// ---- Composed output ------------------------------------------------------

/** One file the composer emits (same shape as TileFile / assembler files). */
export const ComposedFileSchema = z.object({
    path: z.string().min(1),
    content: z.string(),
    encoding: z.enum(["utf-8", "base64", "url-ref"]),
});
export type ComposedFile = z.infer<typeof ComposedFileSchema>;

/** The result of `finalize()`: the native, declarative scene for one engine,
 * ready for the W3 assembler/build. */
export const ComposedSceneSchema = z.object({
    engine: EngineEnum,
    /** Engine entry point: "res://main.tscn" (Godot) | "index.html" (Phaser). */
    entry_scene: z.string().min(1),
    files: z.array(ComposedFileSchema).min(1),
    /** Non-fatal degradations (e.g. a slot fell back to a placeholder). */
    warnings: z.array(z.string()).default([]),
});
export type ComposedScene = z.infer<typeof ComposedSceneSchema>;

// ---- Scene init -----------------------------------------------------------

/** Engine-agnostic global config the composer needs up front. Derived by the
 * driver from the GameSpec (gravity from physics, pixel_art from the slots). */
export interface SceneInit {
    meta: GameSpecMeta;
    /** The full slot table; primitives resolve `*_slot` references against it. */
    assetSlots: AssetSlot[];
    /** Global gravity: Phaser arcade world gravity; Godot uses it in the
     * controller. Kept here so `beginScene` can set the engine's world config. */
    gravity: number;
    /** Nearest-neighbor filtering (Godot texture_filter / Phaser pixelArt). */
    pixelArt: boolean;
    viewport: { width: number; height: number };
    /** Movement model from the archetype: "platformer" (gravity + jump, solid
     * tiles = ground to stand on) or "top_down" (4-directional, no gravity, solid
     * tiles = walls). The one thing the gold controller differs by. */
    movement: "platformer" | "top_down";
}

// ---- The port (the ~10 primitives) ----------------------------------------

/** Implemented once per engine. Methods mutate the composer's internal scene
 * accumulator; `finalize()` serializes it. The 2D archetypes
 * (side_scroller_platform, top_down_grid, arena_2d, puzzle_grid) share this
 * port; scene_3d / non_spatial_ui get their own ports (separate trunks). */
export interface EngineComposer {
    /** P1 — root scene + global config (gravity, viewport, pixel filtering). */
    beginScene(init: SceneInit): void;
    /** P2 — screen-fixed background; gradient fallback when no asset (no void). */
    addBackground(bg: BackgroundSpec): void;
    /** P3 — parallax layers scrolling at a fraction of the camera. */
    addParallax(layers: ParallaxLayer[]): void;
    /** P4 — the .tmj level becomes the engine's native TileMap. */
    addTileMap(world: WorldSpec): void;
    /** P5 — player body + collider + animated sprite + the "gold" controller. */
    addPlayer(player: PlayerSpec, physics: PhysicsSpec, mechanics: MechanicsSpec): void;
    /** P6 — one entity (enemy/pickup/hazard/npc/checkpoint); called per entity. */
    addEntity(entity: EntitySpec): void;
    /** P7 — camera follow + zoom + deadzone + world clamp. */
    addCamera(camera: CameraSpec, world: WorldSpec): void;
    /** P8 — HUD overlay (score/health/timer/…). */
    addHud(hud: HudSpec): void;
    /** P9 — win-condition wiring (reach_exit/collect_all/survive_time/defeat_all). */
    addGoal(goal: GoalSpec): void;
    /** P10 — serialize the accumulator into native engine files. */
    finalize(): ComposedScene;
}

/** A factory yields a fresh composer per game (the accumulator is per-build).
 * lib/runtime/composer/godot/ and /phaser/ export one each (FASE 2). */
export type EngineComposerFactory = () => EngineComposer;

/** The per-archetype driver (FASE 2). Dispatches on `spec.archetype`, calls the
 * primitives in order, returns `composer.finalize()`. Declared here as the
 * contract surface; implemented in lib/runtime/composer/. */
export type ComposeScene = (spec: GameSpec, composer: EngineComposer) => ComposedScene;
