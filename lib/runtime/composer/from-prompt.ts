/**
 * Prompt → GameSpec (FASE 3, Part 2 tracer bullet). The LLM produces DATA, not
 * rendering code: a COMPACT design brief (genre / title / theme / difficulty),
 * which a DETERMINISTIC step expands into a full, renderable GameSpec. The
 * composer renders it. This is "the LLM produces the GameSpec" half of FASE 3 —
 * proven end-to-end (prompt → composed game) without the LLM ever writing a line
 * of engine code.
 *
 * The expensive/fragile work (scene composition, asset wiring, the huge
 * solid_tiles grid) stays deterministic; the LLM only chooses WHAT the game is.
 */
import { randomUUID } from "node:crypto";

import { z } from "zod";

import { GenreEnum } from "../../contracts/game-plan.contract.js";
import type { Engine } from "../../contracts/game-plan.contract.js";
import { GENRE_TO_ARCHETYPE } from "../../contracts/game-spec.contract.js";
import type { SideScrollerSpec, TopDownGridSpec } from "../../contracts/game-spec.contract.js";
import { complete } from "../../llm/router.js";
import { DEFAULT_PLATFORMER_PHYSICS } from "../../tools/level/_platformer-physics.js";
import { buildPlatformerLevel, buildTopDownRoom } from "./sample-level.js";

/** The compact design the LLM emits — WHAT the game is, not how to render it. */
export const DesignBriefSchema = z.object({
    genre: GenreEnum,
    title: z.string().min(1).max(60),
    theme: z.string().min(1).max(40),
    difficulty: z.enum(["easy", "normal", "hard"]),
});
export type DesignBrief = z.infer<typeof DesignBriefSchema>;

const SYSTEM =
    "You are a game designer. From the user's idea pick the single best fit and return JSON only:\n" +
    '{ "genre": one of [GENRES], "title": a short catchy title, "theme": one or two words ' +
    '(e.g. forest, dungeon, space, ruins), "difficulty": "easy" | "normal" | "hard" }.\n' +
    "Choose the genre that matches the idea; if unsure use hardcore_platformer.";

/** Call the LLM (gpt-4.1-mini via the OpenAI router path) → a validated brief. */
export async function proposeDesign(prompt: string): Promise<DesignBrief> {
    const res = await complete({
        model: "gpt-4.1-mini",
        system: SYSTEM.replace("GENRES", GenreEnum.options.join(", ")),
        user: prompt,
        response_schema: DesignBriefSchema,
        max_tokens: 200,
        temperature: 0.3,
        trace_id: `design_${randomUUID()}`,
    });
    return DesignBriefSchema.parse(res.output);
}

/** Deterministic expansion: a compact brief → a full, renderable GameSpec. The
 * composer-only archetypes (side_scroller / top_down) are built directly; any
 * other genre falls back to a platformer so it still renders. */
export function designToGameSpec(brief: DesignBrief, engine: Engine): SideScrollerSpec | TopDownGridSpec {
    const topDown = GENRE_TO_ARCHETYPE[brief.genre] === "top_down_grid";
    const W = 48, H = topDown ? 22 : 24, TILE = 16;
    const speed = brief.difficulty === "hard" ? 1.15 : brief.difficulty === "easy" ? 0.85 : 1;
    const solid = topDown
        ? buildTopDownRoom({ width: W, height: H })
        : buildPlatformerLevel({ width: W, height: H, tilePx: TILE, physics: DEFAULT_PLATFORMER_PHYSICS });

    const common = {
        meta: { project_id: "00000000-0000-4000-8000-000000000000", plan_version: 1, engine, style_pack_id: "pixel-art-dark", title: brief.title },
        world: { width_tiles: W, height_tiles: H, tile_px: TILE, tmj_path: "/p/level.tmj", tileset_slot: "tileset", solid_tiles: solid },
        player: { spawn_tile: { x: topDown ? 8 : 3, y: topDown ? 8 : H - 4 }, asset_slot: "sprite_gen", hitbox_px: { w: 24, h: 30 }, facing: "right" as const },
        entities: [],
        camera: { zoom: 1, deadzone_px: { w: 80, h: 60 }, follow: "player" as const, clamp_to_world: true },
        parallax: [],
        background: { asset_slot: "background", fill_mode: "stretch_cover" as const },
        hud: { elements: [{ type: "label" as const, text: brief.title }] },
        goal: { type: "reach_exit" as const, exit_tile: { x: W - 4, y: H - 4 } },
        mechanics: { flags: [], delta_script_path: null },
        asset_slots: [
            { slot: "background", role: "background" as const, binding: null, tile_size: null, frame: null, palette_hex: [], pixel_art: true },
            { slot: "tileset", role: "tileset" as const, binding: null, tile_size: TILE, frame: null, palette_hex: [], pixel_art: true },
            { slot: "sprite_gen", role: "character" as const, binding: null, tile_size: null, frame: null, palette_hex: [], pixel_art: true },
        ],
    };

    if (topDown) {
        return { archetype: "top_down_grid", ...common, physics: { gravity: 0, jump_velocity: 0, move_speed: Math.round(200 * speed) } } as TopDownGridSpec;
    }
    return {
        archetype: "side_scroller_platform", ...common,
        physics: { gravity: DEFAULT_PLATFORMER_PHYSICS.gravity, jump_velocity: DEFAULT_PLATFORMER_PHYSICS.jump_velocity, move_speed: Math.round(DEFAULT_PLATFORMER_PHYSICS.move_speed * speed) },
    } as SideScrollerSpec;
}
