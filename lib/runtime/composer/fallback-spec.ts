/**
 * Fallback GameSpec (FASE 3, Part 1). When code_gen produces no usable code (LLM
 * 402/credits, an exception, every self-heal failing), the assembler used to ship
 * a hand-written GDScript platformer (lib/runtime/assembler/_godot-fallback.ts) →
 * grey screens on engines without one. This is the COMPOSER's equivalent: a
 * known-good side_scroller GameSpec the scaffold composes instead, so every
 * fallback run comes out as a real, composed scene — "the new runtime minus the
 * LLM enrichment" (docs/IMPLEMENTATION_PLAN.md §FASE 3).
 *
 * The slot names match the res:// paths the resolver/sprite tools write
 * (sprite_gen / tileset / background), so the Godot composer's res:// loading
 * picks up any resolved CC0/FLUX assets for free; a missing asset falls back to a
 * placeholder texture in the composer's guarded _tex (never a crash).
 */
import type { Engine } from "../../contracts/game-plan.contract.js";
import type { GameSpec } from "../../contracts/game-spec.contract.js";
import { DEFAULT_PLATFORMER_PHYSICS } from "../../tools/level/_platformer-physics.js";
import { buildPlatformerLevel } from "./sample-level.js";

const W = 48, H = 24, TILE = 16;

export function buildFallbackSpec(engine: Engine): GameSpec {
    const solid = buildPlatformerLevel({ width: W, height: H, tilePx: TILE, physics: DEFAULT_PLATFORMER_PHYSICS });
    return {
        archetype: "side_scroller_platform",
        meta: { project_id: "00000000-0000-4000-8000-000000000000", plan_version: 1, engine, style_pack_id: "pixel-art-dark", title: "GameSmith Game" },
        world: { width_tiles: W, height_tiles: H, tile_px: TILE, tmj_path: "/project/assets/maps/level.tmj", tileset_slot: "tileset", solid_tiles: solid },
        physics: { gravity: DEFAULT_PLATFORMER_PHYSICS.gravity, jump_velocity: DEFAULT_PLATFORMER_PHYSICS.jump_velocity, move_speed: DEFAULT_PLATFORMER_PHYSICS.move_speed },
        player: { spawn_tile: { x: 3, y: H - 4 }, asset_slot: "sprite_gen", hitbox_px: { w: 28, h: 38 }, facing: "right" },
        entities: [],
        camera: { zoom: 1, deadzone_px: { w: 80, h: 60 }, follow: "player", clamp_to_world: true },
        parallax: [],
        background: { asset_slot: "background", fill_mode: "stretch_cover" },
        hud: { elements: [{ type: "label", text: "Arrow keys / WASD to move, Space to jump. Reach the goal!" }] },
        goal: { type: "reach_exit", exit_tile: { x: W - 4, y: H - 4 } },
        mechanics: { flags: [], delta_script_path: null },
        asset_slots: [
            { slot: "background", role: "background", binding: null, tile_size: null, frame: null, palette_hex: [], pixel_art: true },
            { slot: "tileset", role: "tileset", binding: null, tile_size: TILE, frame: null, palette_hex: [], pixel_art: true },
            { slot: "sprite_gen", role: "character", binding: null, tile_size: null, frame: null, palette_hex: [], pixel_art: true },
        ],
    };
}
