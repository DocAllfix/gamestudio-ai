/**
 * FASE 2 composer tracer bullet — the SAME side_scroller GameSpec must produce a
 * coherent, structurally-correct scene in BOTH Godot and Phaser (the anti-leak
 * test in code). Deterministic, no build/sandbox: asserts the emitted scene
 * structure, not a running game (build+smoke verification comes when the sandbox
 * is wired).
 */
import { describe, it, expect } from "vitest";

import type { Engine } from "../../../contracts/game-plan.contract.js";
import type { GameSpec, SideScrollerSpec } from "../../../contracts/game-spec.contract.js";
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

describe("Godot real level (solid_tiles)", () => {
    const s = spec("godot");
    s.world.solid_tiles = [[0, 0, 0], [1, 1, 1], [1, 1, 1]];
    const scene = composeScene(s, makeGodotComposer());
    const gd = scene.files.find((f) => f.path.endsWith("main.gd"))!.content;
    const tscn = scene.files.find((f) => f.path.endsWith("main.tscn"))!.content;

    it("renders the grid as procedural collision + _draw, not a flat floor", () => {
        expect(gd).toContain("const SOLID := [[0,0,0],[1,1,1],[1,1,1]]");
        expect(gd).toContain("func _build_level()");
        expect(gd).toContain("func _draw()");
        expect(gd).toContain("StaticBody2D.new()"); // procedural collision body
        expect(gd).toContain("_build_level()"); // called from _ready
        expect(tscn).not.toContain('name="Ground"'); // flat-floor node replaced
    });
});

describe("Godot frame-aware player (sheet → one frame + walk anim)", () => {
    const s = spec("godot");
    s.asset_slots.find((a) => a.slot === "player")!.frame = { w: 64, h: 64, count: 55, cols: 11, fps: 8, anchor: { x: 0.5, y: 1 } };
    const gd = composeScene(s, makeGodotComposer()).files.find((f) => f.path.endsWith("main.gd"))!.content;

    it("shows ONE frame via a region rect, not the whole scrambled sheet", () => {
        expect(gd).toContain("region_enabled = true");
        expect(gd).toContain("region_rect = Rect2(0, 0, 64, 64)");
    });

    it("animates the walk cycle over the first row when moving", () => {
        expect(gd).toContain("const ANIM_COLS := 11");
        expect(gd).toContain("var _anim_t");
        expect(gd).toContain("int(_anim_t * ANIM_FPS) % ANIM_COLS");
        expect(gd).toContain("aps.flip_h = player.velocity.x < 0.0");
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

describe("real level + asset binding (Phaser)", () => {
    const phaserJs = (s: SideScrollerSpec) => composeFor(s).files.find((f) => f.path.endsWith("main.js"))!.content;

    it("renders a tile layer from solid_tiles", () => {
        const s = spec("phaser");
        s.world.solid_tiles = [[1, 1, 1], [0, 0, 0]];
        const js = phaserJs(s);
        expect(js).toContain("make.tilemap");
        expect(js).toContain("setCollisionByExclusion([-1])");
        expect(js).toContain("const SOLID =");
    });

    it("loads a real sprite when the player slot is bound", () => {
        const s = spec("phaser");
        const ps = s.asset_slots.find((a) => a.slot === "player")!;
        ps.binding = {
            source: "catalog", slot: "player", asset_library_id: "00000000-0000-4000-8000-000000000002",
            download_url: "https://x/p.png", license: "CC0-1.0", attribution_required: false, creator_name: null,
        };
        const js = phaserJs(s);
        expect(js).toContain('this.load.image("player"');
        expect(js).toContain("physics.add.sprite");
    });

    it("animates a sheet player (walk anim over frames 0..cols-1)", () => {
        const s = spec("phaser");
        const ps = s.asset_slots.find((a) => a.slot === "player")!;
        ps.binding = {
            source: "catalog", slot: "player", asset_library_id: "00000000-0000-4000-8000-000000000003",
            download_url: "https://x/p.png", license: "CC0-1.0", attribution_required: false, creator_name: null,
        };
        ps.frame = { w: 64, h: 64, count: 55, cols: 11, fps: 8, anchor: { x: 0.5, y: 1 } };
        const js = phaserJs(s);
        expect(js).toContain('this.load.spritesheet("player"');
        expect(js).toContain('this.anims.create({ key: "walk"');
        expect(js).toContain("generateFrameNumbers");
        expect(js).toContain('this.player.anims.play("walk"');
        expect(js).toContain("setFlipX");
    });

    it("falls back to a flat floor + rectangle player with no tilemap/binding", () => {
        const js = phaserJs(spec("phaser"));
        expect(js).toContain("this.add.rectangle(WORLD_W / 2"); // flat floor
        expect(js).toContain("this.player = this.add.rectangle"); // placeholder player
    });
});

describe("real tileset (both engines)", () => {
    function withTileset(engine: Engine): SideScrollerSpec {
        const s = spec(engine);
        s.world.solid_tiles = [[1, 1, 1], [0, 0, 0]];
        s.asset_slots.find((a) => a.slot === "tileset")!.binding = {
            source: "catalog", slot: "tileset", asset_library_id: "00000000-0000-4000-8000-000000000010",
            download_url: "https://x/tiles.png", license: "CC0-1.0", attribution_required: false, creator_name: null,
        };
        return s;
    }

    it("Phaser loads the tileset image + uses it in the tilemap (not the placeholder)", () => {
        const js = composeFor(withTileset("phaser")).files.find((f) => f.path.endsWith("main.js"))!.content;
        expect(js).toContain('this.load.spritesheet("tiles"');
        expect(js).toContain('map.addTilesetImage("tiles")');
        expect(js).not.toContain('generateTexture("tile"');
    });

    it("Godot draws the tileset texture per solid tile (region 0)", () => {
        const gd = composeScene(withTileset("godot"), makeGodotComposer()).files.find((f) => f.path.endsWith("main.gd"))!.content;
        expect(gd).toContain('_tile_tex = load("res://assets/sprites/tileset.png")');
        expect(gd).toContain("draw_texture_rect_region(_tile_tex, r, Rect2(0, 0, TILE, TILE))");
    });
});

describe("real background (both engines)", () => {
    function withBg(engine: Engine): SideScrollerSpec {
        const s = spec(engine);
        s.asset_slots.push({
            slot: "sky", role: "background", tile_size: null, frame: null, palette_hex: [], pixel_art: false,
            binding: {
                source: "catalog", slot: "sky", asset_library_id: "00000000-0000-4000-8000-000000000020",
                download_url: "https://x/sky.png", license: "CC0-1.0", attribution_required: false, creator_name: null,
            },
        });
        return s; // spec()'s background.asset_slot is already "sky"
    }

    it("Phaser loads + displays the bound background, fixed behind everything", () => {
        const js = composeFor(withBg("phaser")).files.find((f) => f.path.endsWith("main.js"))!.content;
        expect(js).toContain('this.load.image("bg"');
        expect(js).toContain('this.add.image(0, 0, "bg")');
        expect(js).toContain("setScrollFactor(0)");
    });

    it("Godot loads the background sprite from the slot", () => {
        const gd = composeScene(withBg("godot"), makeGodotComposer()).files.find((f) => f.path.endsWith("main.gd"))!.content;
        expect(gd).toContain('_tex("res://assets/sprites/sky.png"');
    });
});

describe("top_down_grid archetype (the axis collapses, both engines)", () => {
    function tdSpec(engine: Engine): GameSpec {
        const s = spec(engine);
        return { ...s, archetype: "top_down_grid", physics: { ...s.physics, gravity: 0 } } as unknown as GameSpec;
    }

    it("Phaser: 4-directional movement + zero gravity (no jump/pit-fall)", () => {
        const js = composeFor(tdSpec("phaser")).files.find((f) => f.path.endsWith("main.js"))!.content;
        expect(js).toContain("setVelocityY(((down ? 1 : 0) - (up ? 1 : 0)) * MOVE_SPEED)");
        expect(js).toContain("gravity: { y: 0 }");
        expect(js).not.toContain("b.blocked.down"); // no platformer jump
    });

    it("Godot: 4-directional movement + no gravity", () => {
        const gd = composeScene(tdSpec("godot"), makeGodotComposer()).files.find((f) => f.path.endsWith("main.gd"))!.content;
        expect(gd).toContain("v.y -= 1.0");
        expect(gd).toContain("player.velocity = v.normalized() * MOVE_SPEED");
        expect(gd).not.toContain("player.velocity.y += GRAVITY"); // no gravity
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
        const skeleton = { archetype: "arena_2d", meta: spec("godot").meta, draft: {} } as never;
        expect(() => composeScene(skeleton, makeGodotComposer())).toThrow();
    });
});
