/**
 * Per-engine atlas builder — frame-analyzer output → Godot SpriteFrames (.tres)
 * + Phaser JSON Hash atlas. Pure string/JSON generation, no canvas.
 */
import { describe, it, expect } from "vitest";

import { buildEngineAtlas, type AtlasInput } from "../atlas.js";

const base: AtlasInput = {
    texture_path: "res://assets/sprites/player.png",
    image_name: "player.png",
    sheet_w: 128,
    sheet_h: 32,
    frames: [
        { x: 0, y: 0, w: 32, h: 32 },
        { x: 32, y: 0, w: 32, h: 32 },
        { x: 64, y: 0, w: 32, h: 32 },
        { x: 96, y: 0, w: 32, h: 32 },
    ],
    fps: 10,
    anchor: { x: 0.5, y: 1 },
    animation_name: "walk",
};

describe("buildEngineAtlas — Godot SpriteFrames", () => {
    it("emits a valid SpriteFrames resource header with correct load_steps", () => {
        const atlas = buildEngineAtlas(base);
        // 1 ext_resource (texture) + 4 sub_resources (AtlasTexture) + 1 = 6
        expect(atlas.godot_tres).toContain('[gd_resource type="SpriteFrames" load_steps=6 format=3]');
        expect(atlas.godot_tres).toContain('[ext_resource type="Texture2D" path="res://assets/sprites/player.png" id="1"]');
    });

    it("emits one AtlasTexture per frame with the right region", () => {
        const atlas = buildEngineAtlas(base);
        expect((atlas.godot_tres.match(/\[sub_resource type="AtlasTexture"/g) ?? []).length).toBe(4);
        expect(atlas.godot_tres).toContain("region = Rect2(0, 0, 32, 32)");
        expect(atlas.godot_tres).toContain("region = Rect2(96, 0, 32, 32)");
    });

    it("sets the animation name, fps as speed, and loop", () => {
        const atlas = buildEngineAtlas(base);
        expect(atlas.godot_tres).toContain('"name": &"walk"');
        expect(atlas.godot_tres).toContain('"speed": 10.0');
        expect(atlas.godot_tres).toContain('"loop": true');
    });
});

describe("buildEngineAtlas — Phaser JSON Hash atlas", () => {
    it("emits one frame entry per frame with rects, named <anim>_<i>", () => {
        const atlas = buildEngineAtlas(base);
        const names = Object.keys(atlas.phaser_atlas.frames);
        expect(names).toEqual(["walk_0", "walk_1", "walk_2", "walk_3"]);
        expect(atlas.phaser_atlas.frames["walk_1"].frame).toEqual({ x: 32, y: 0, w: 32, h: 32 });
    });

    it("carries the sheet image + size in meta", () => {
        const atlas = buildEngineAtlas(base);
        expect(atlas.phaser_atlas.meta.image).toBe("player.png");
        expect(atlas.phaser_atlas.meta.size).toEqual({ w: 128, h: 32 });
    });
});

describe("buildEngineAtlas — metadata + edges", () => {
    it("returns frame_count, fps, anchor and resolved animation name", () => {
        const atlas = buildEngineAtlas(base);
        expect(atlas.frame_count).toBe(4);
        expect(atlas.fps).toBe(10);
        expect(atlas.anchor).toEqual({ x: 0.5, y: 1 });
        expect(atlas.animation_name).toBe("walk");
    });

    it("defaults animation name to 'default' and loop to true", () => {
        const atlas = buildEngineAtlas({ ...base, animation_name: undefined });
        expect(atlas.animation_name).toBe("default");
        expect(atlas.phaser_atlas.frames["default_0"]).toBeDefined();
        expect(atlas.godot_tres).toContain('"loop": true');
    });

    it("respects loop=false", () => {
        const atlas = buildEngineAtlas({ ...base, loop: false });
        expect(atlas.godot_tres).toContain('"loop": false');
    });

    it("handles a single static frame", () => {
        const atlas = buildEngineAtlas({ ...base, frames: [{ x: 0, y: 0, w: 32, h: 32 }] });
        expect(atlas.frame_count).toBe(1);
        expect(atlas.godot_tres).toContain("load_steps=3"); // 1 ext + 1 sub + 1
        expect(Object.keys(atlas.phaser_atlas.frames)).toEqual(["walk_0"]);
    });

    it("rejects an empty frame list", () => {
        expect(() => buildEngineAtlas({ ...base, frames: [] })).toThrow();
    });
});
