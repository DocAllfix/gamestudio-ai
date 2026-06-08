/**
 * Per-engine atlas builder (Studio enrichment, FASE 1/2 — the 🟢 deterministic
 * half of "animation"). Turns the frame-analyzer output into the engine-native,
 * DECLARATIVE animation metadata the composer's addPlayer/addEntity primitives
 * consume (docs/FASE0_GAMESPEC_DESIGN.md §3 P5):
 *   - Godot: a SpriteFrames .tres (AtlasTexture region per frame + speed/loop)
 *   - Phaser: a JSON Hash texture atlas (load.atlas + anims.create)
 *
 * Pure string/JSON generation, zero-dependency. Same input the AutoSprite-style
 * pipeline would produce after generating coherent frames — building the atlas
 * side now means the moment the (paid) frame generation lands, animated
 * characters drop straight into the composer with no extra work.
 */

import type { FrameRect } from "./frame-analyzer.js";

export interface AtlasInput {
    /** Godot ext_resource path of the sheet (res://…). */
    texture_path: string;
    /** Phaser meta.image — the sheet's file name. */
    image_name: string;
    sheet_w: number;
    sheet_h: number;
    /** Frame rects in playback order (from the frame analyzer). */
    frames: FrameRect[];
    fps: number;
    /** Pivot as a 0-1 fraction of the frame; the composer applies it as offset. */
    anchor: { x: number; y: number };
    /** Animation name (default "default"). */
    animation_name?: string;
    /** Loop the animation (default true). */
    loop?: boolean;
}

export interface PhaserAtlasFrame {
    frame: { x: number; y: number; w: number; h: number };
    rotated: false;
    trimmed: false;
    spriteSourceSize: { x: number; y: number; w: number; h: number };
    sourceSize: { w: number; h: number };
}

export interface PhaserAtlas {
    frames: Record<string, PhaserAtlasFrame>;
    meta: { app: string; image: string; format: string; size: { w: number; h: number }; scale: string };
}

export interface EngineAtlas {
    animation_name: string;
    frame_count: number;
    fps: number;
    anchor: { x: number; y: number };
    /** Godot SpriteFrames resource (.tres) text. */
    godot_tres: string;
    /** Phaser JSON Hash atlas (load.atlas accepts this object). */
    phaser_atlas: PhaserAtlas;
}

function godotSpriteFrames(input: AtlasInput, name: string, loop: boolean): string {
    const n = input.frames.length;
    // load_steps = 1 ext_resource + n sub_resources + 1.
    const loadSteps = n + 2;
    const lines: string[] = [];
    lines.push(`[gd_resource type="SpriteFrames" load_steps=${loadSteps} format=3]`);
    lines.push("");
    lines.push(`[ext_resource type="Texture2D" path="${input.texture_path}" id="1"]`);
    lines.push("");

    input.frames.forEach((f, i) => {
        lines.push(`[sub_resource type="AtlasTexture" id="AtlasTexture_${i}"]`);
        lines.push('atlas = ExtResource("1")');
        lines.push(`region = Rect2(${f.x}, ${f.y}, ${f.w}, ${f.h})`);
        lines.push("");
    });

    const frameEntries = input.frames
        .map((_, i) => `{\n"duration": 1.0,\n"texture": SubResource("AtlasTexture_${i}")\n}`)
        .join(", ");
    lines.push("[resource]");
    lines.push(
        `animations = [{\n"frames": [${frameEntries}],\n"loop": ${loop},\n"name": &"${name}",\n"speed": ${input.fps.toFixed(1)}\n}]`,
    );
    return lines.join("\n") + "\n";
}

function phaserAtlas(input: AtlasInput, name: string): PhaserAtlas {
    const frames: Record<string, PhaserAtlasFrame> = {};
    input.frames.forEach((f, i) => {
        frames[`${name}_${i}`] = {
            frame: { x: f.x, y: f.y, w: f.w, h: f.h },
            rotated: false,
            trimmed: false,
            spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
            sourceSize: { w: f.w, h: f.h },
        };
    });
    return {
        frames,
        meta: {
            app: "gamesmith",
            image: input.image_name,
            format: "RGBA8888",
            size: { w: input.sheet_w, h: input.sheet_h },
            scale: "1",
        },
    };
}

export function buildEngineAtlas(input: AtlasInput): EngineAtlas {
    if (input.frames.length === 0) throw new Error("atlas: frames must not be empty");
    const name = input.animation_name ?? "default";
    const loop = input.loop ?? true;
    return {
        animation_name: name,
        frame_count: input.frames.length,
        fps: input.fps,
        anchor: input.anchor,
        godot_tres: godotSpriteFrames(input, name, loop),
        phaser_atlas: phaserAtlas(input, name),
    };
}
