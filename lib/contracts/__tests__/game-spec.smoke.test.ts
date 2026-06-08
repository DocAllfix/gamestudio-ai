/**
 * Smoke tests for the FASE 0 contracts: GameSpec (discriminated union on
 * archetype) + EngineComposer output (ComposedScene). Same intent as
 * contracts.smoke.test.ts: each schema rejects an empty object and accepts a
 * hand-built valid example. Also pins the genre→archetype map total.
 */
import { describe, expect, it } from "vitest";

import { GenreEnum } from "../game-plan.contract.js";
import {
    ArchetypeEnum,
    GameSpecSchema,
    GENRE_TO_ARCHETYPE,
    SideScrollerSpecSchema,
    type SideScrollerSpec,
} from "../game-spec.contract.js";
import { ComposedSceneSchema } from "../engine-composer.contract.js";

const project_id = "00000000-0000-4000-8000-000000000000";

const meta = {
    project_id,
    plan_version: 1,
    engine: "godot" as const,
    style_pack_id: "pixel-art-dark",
    title: "Tracer Bullet Platformer",
};

/** A minimal but valid side_scroller GameSpec — every block populated so the
 * composer has a translation for each (the FASE 0 verification surface). */
const validSideScroller: SideScrollerSpec = {
    archetype: "side_scroller_platform",
    meta,
    world: {
        width_tiles: 60,
        height_tiles: 24,
        tile_px: 16,
        tmj_path: "/project/assets/maps/level1.tmj",
        tileset_slot: "tileset",
    },
    physics: { gravity: 1200, jump_velocity: 450, move_speed: 300 },
    player: {
        spawn_tile: { x: 2, y: 20 },
        asset_slot: "player",
        hitbox_px: { w: 28, h: 38 },
        facing: "right",
    },
    entities: [
        {
            id: "goomba_1",
            kind: "enemy",
            tile: { x: 20, y: 20 },
            asset_slot: "enemy",
            patrol_tiles: [{ x: 18, y: 20 }, { x: 24, y: 20 }],
            grants: [],
        },
    ],
    camera: { zoom: 1, deadzone_px: { w: 80, h: 60 }, follow: "player", clamp_to_world: true },
    parallax: [{ asset_slot: "bg_far", scroll_scale: { x: 0.4, y: 1 }, z: -10 }],
    background: { asset_slot: "sky", fill_mode: "stretch_cover" },
    hud: { elements: [{ type: "coins", binds_to: "coins" }] },
    goal: { type: "reach_exit", exit_tile: { x: 58, y: 20 } },
    mechanics: { flags: ["double_jump"], delta_script_path: null },
    asset_slots: [
        { slot: "tileset", role: "tileset", binding: null, tile_size: 16, frame: null, palette_hex: [], pixel_art: true },
        {
            slot: "player",
            role: "character",
            binding: null,
            tile_size: null,
            frame: { w: 32, h: 32, count: 6, fps: 10, anchor: { x: 0.5, y: 1 } },
            palette_hex: [],
            pixel_art: true,
        },
    ],
};

describe("GameSpec — archetype union", () => {
    it("rejects an empty object", () => {
        expect(() => GameSpecSchema.parse({})).toThrow();
    });

    it("accepts a full side_scroller_platform spec", () => {
        expect(() => GameSpecSchema.parse(validSideScroller)).not.toThrow();
    });

    it("rejects a side_scroller with no asset_slots", () => {
        expect(() =>
            SideScrollerSpecSchema.parse({ ...validSideScroller, asset_slots: [] }),
        ).toThrow();
    });

    it("accepts a skeleton archetype (top_down_grid)", () => {
        expect(() =>
            GameSpecSchema.parse({ archetype: "top_down_grid", meta, draft: {} }),
        ).not.toThrow();
    });

    it("rejects an unknown archetype", () => {
        expect(() =>
            GameSpecSchema.parse({ archetype: "not_an_archetype", meta }),
        ).toThrow();
    });
});

describe("GENRE_TO_ARCHETYPE", () => {
    it("maps every GenreEnum value to a valid archetype", () => {
        for (const genre of GenreEnum.options) {
            const archetype = GENRE_TO_ARCHETYPE[genre];
            expect(() => ArchetypeEnum.parse(archetype)).not.toThrow();
        }
    });
});

describe("ComposedScene — composer output", () => {
    it("rejects an empty object", () => {
        expect(() => ComposedSceneSchema.parse({})).toThrow();
    });

    it("accepts a valid Godot composed scene", () => {
        expect(() =>
            ComposedSceneSchema.parse({
                engine: "godot",
                entry_scene: "res://main.tscn",
                files: [{ path: "main.tscn", content: "[gd_scene format=3]", encoding: "utf-8" }],
                warnings: [],
            }),
        ).not.toThrow();
    });
});
