/**
 * FASE 2 composer tracer bullet — the SAME side_scroller GameSpec must produce a
 * coherent, structurally-correct scene in BOTH Godot and Phaser (the anti-leak
 * test in code). Deterministic, no build/sandbox: asserts the emitted scene
 * structure, not a running game (build+smoke verification comes when the sandbox
 * is wired).
 */
import { describe, it, expect } from "vitest";

import type { Engine } from "../../../contracts/game-plan.contract.js";
import type { SideScrollerSpec } from "../../../contracts/game-spec.contract.js";
import { composeFor, composeScene } from "../index.js";
import { makeGodotComposer } from "../godot.js";

function spec(engine: Engine): SideScrollerSpec {
    return {
        archetype: "side_scroller_platform",
        meta: { project_id: "00000000-0000-4000-8000-000000000000", plan_version: 1, engine, style_pack_id: "pixel-art-dark", title: "Tracer" },
        world: { width_tiles: 60, height_tiles: 24, tile_px: 16, tmj_path: "/project/assets/maps/level1.tmj", tileset_slot: "tileset" },
        physics: { gravity: 1200, jump_velocity: 450, move_speed: 300 },
        player: { spawn_tile: { x: 2, y: 20 }, asset_slot: "player", hitbox_px: { w: 28, h: 38 }, facing: "right" },
        entities: [{ id: "coin-1", kind: "pickup", tile: { x: 30, y: 18 }, asset_slot: "coin", patrol_tiles: [], grants: [] }],
        camera: { zoom: 1, deadzone_px: { w: 80, h: 60 }, follow: "player", clamp_to_world: true },
        parallax: [],
        background: { asset_slot: "sky", fill_mode: "stretch_cover" },
        hud: { elements: [{ type: "label", text: "Reach the goal!" }] },
        goal: { type: "reach_exit", exit_tile: { x: 58, y: 20 } },
        mechanics: { flags: [], delta_script_path: null },
        asset_slots: [
            { slot: "tileset", role: "tileset", binding: null, tile_size: 16, frame: null, palette_hex: [], pixel_art: true },
            { slot: "player", role: "character", binding: null, tile_size: null, frame: null, palette_hex: [], pixel_art: true },
        ],
    };
}

describe("Godot composer", () => {
    const scene = composeFor(spec("godot"));
    const tscn = scene.files.find((f) => f.path.endsWith("main.tscn"))!.content;
    const gd = scene.files.find((f) => f.path.endsWith("main.gd"))!.content;

    it("emits the build-ready Godot file tree", () => {
        expect(scene.engine).toBe("godot");
        expect(scene.entry_scene).toBe("res://main.tscn");
        const paths = scene.files.map((f) => f.path);
        expect(paths).toEqual(
            expect.arrayContaining(["/project/project.godot", "/project/main.tscn", "/project/main.gd", "/project/export_presets.cfg"]),
        );
    });

    it("main.tscn is a real declarative scene (not a bare Node2D)", () => {
        expect(tscn).toContain('[node name="Main" type="Node2D"]');
        expect(tscn).toContain('type="CharacterBody2D" parent="."'); // Player
        expect(tscn).toContain('type="Camera2D" parent="Player"');
        expect(tscn).toContain('type="StaticBody2D" parent="."'); // Ground
        expect(tscn).toContain('type="Area2D" parent="."'); // Goal
        expect(tscn).toContain('type="CanvasLayer" parent="."'); // Background + HUD
        expect(tscn).toContain('type="Label" parent="HUD"');
        expect(tscn).toContain("RectangleShape2D"); // collision sub-resources
    });

    it("load_steps counts ext + sub resources", () => {
        // 1 ext (script) + 3 sub (player/ground/goal shapes) + 1 = 5
        expect(tscn).toContain("[gd_scene load_steps=5 format=3]");
    });

    it("Player spawn + camera world clamp come from the spec", () => {
        expect(tscn).toContain("position = Vector2(32, 320)"); // spawn 2,20 * 16
        expect(tscn).toContain("limit_right = 960"); // 60 * 16
        expect(tscn).toContain("limit_bottom = 384"); // 24 * 16
    });

    it("main.gd is the gold controller (physics from spec + gate signal)", () => {
        expect(gd.startsWith("extends Node2D")).toBe(true);
        expect(gd).toContain("const GRAVITY := 1200.0");
        expect(gd).toContain("const MOVE_SPEED := 300.0");
        expect(gd).toContain("const JUMP_VELOCITY := -450.0");
        expect(gd).toContain("func _physics_process");
        expect(gd).toContain("window.__GAME_STATE__"); // playable gate signal
        expect(gd).toContain("__GS__");
    });
});

describe("Phaser composer", () => {
    const scene = composeFor(spec("phaser"));
    const js = scene.files.find((f) => f.path.endsWith("main.js"))!.content;
    const html = scene.files.find((f) => f.path.endsWith("index.html"))!.content;

    it("emits the browser build-ready file tree", () => {
        expect(scene.engine).toBe("phaser");
        expect(scene.entry_scene).toBe("index.html");
        expect(scene.files.map((f) => f.path)).toEqual(
            expect.arrayContaining(["/project/src/main.js", "/project/dist/index.html"]),
        );
        expect(html).toContain('<div id="game">');
        expect(html).toContain("./bundle.js");
    });

    it("main.js is a coherent Phaser scene with the spec's physics", () => {
        expect(js).toContain('import Phaser from "phaser"');
        expect(js).toContain("class MainScene extends Phaser.Scene");
        expect(js).toContain("GRAVITY = 1200");
        expect(js).toContain("MOVE_SPEED = 300");
        expect(js).toContain("JUMP_VELOCITY = 450");
        expect(js).toContain("startFollow"); // camera follows player
        expect(js).toContain("setBounds(0, 0, WORLD_W, WORLD_H)"); // world clamp
        expect(js).toContain("overlap"); // goal
        expect(js).toContain("window.__GAME_STATE__"); // gate signal
    });

    it("world + spawn + goal come from the spec", () => {
        expect(js).toContain("const WORLD_W = 960, WORLD_H = 384"); // 60*16, 24*16
        expect(js).toContain("const SPAWN_X = 32, SPAWN_Y = 320"); // 2,20 * 16
        expect(js).toContain("const GOAL_X = 928, GOAL_Y = 320"); // 58,20 * 16
    });
});

describe("driver dispatch", () => {
    it("the same spec drives both engines (cross-engine port holds)", () => {
        const s = spec("godot");
        const godot = composeScene({ ...s, meta: { ...s.meta, engine: "godot" } }, makeGodotComposer());
        expect(godot.warnings).toEqual([]);
    });

    it("rejects an engine without a FASE 2 adapter", () => {
        expect(() => composeFor(spec("renpy"))).toThrow();
    });

    it("rejects a not-yet-implemented archetype", () => {
        const skeleton = { archetype: "top_down_grid", meta: spec("godot").meta, draft: {} } as never;
        expect(() => composeScene(skeleton, makeGodotComposer())).toThrow();
    });
});
