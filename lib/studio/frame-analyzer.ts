/**
 * Frame analyzer — recover the individual frames of a sprite sheet (Studio
 * enrichment, FASE 1). Produces the `frame` metadata the GameSpec asset slot
 * carries (docs/FASE0_GAMESPEC_DESIGN.md §4): the composer turns it into Godot
 * SpriteFrames / Phaser anims. Static sprite → 1 frame; animated → N frames.
 *
 * Deterministic, zero-dependency, pure on RGBA (same contract as slicer/
 * pixel-snap). Method: connected components (8-connectivity) over the alpha
 * mask. Each component (above a min-area noise floor) is one frame; its bounding
 * box gives the rect, the per-frame max gives the uniform cell size, and the
 * solid-pixel centroid gives a centre-of-mass anchor (the composer may snap it
 * to feet {0.5,1.0} for platformer characters). Frames are returned in reading
 * order (rows top→bottom, columns left→right).
 *
 * `fps` is NOT pixel-derivable (a sheet has no temporal info); it defaults to a
 * sane 8 and is meant to be overridden by the slot/Studio per move.
 */

import type { ImageRGBA } from "./tile-size.js";

export interface FrameRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface FrameAnalysis {
    frames: FrameRect[];
    count: number;
    /** Uniform cell size large enough for the biggest frame. */
    frame_w: number;
    frame_h: number;
    /** Centre-of-mass of the representative (first) frame, 0-1 of its bbox. */
    anchor: { x: number; y: number };
    /** Default playback rate (not derivable from a static sheet). */
    fps: number;
}

export interface FrameAnalyzerOptions {
    /** Pixels with alpha below this are treated as transparent (background). */
    alphaThreshold?: number;
    /** Connected components smaller than this (px) are dropped as noise. */
    minArea?: number;
    /** Default fps stamped on the result. */
    fps?: number;
}

interface Component {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    area: number;
    /** Solid-pixel coordinate sums, for the centroid. */
    sumX: number;
    sumY: number;
}

const EMPTY: FrameAnalysis = {
    frames: [],
    count: 0,
    frame_w: 0,
    frame_h: 0,
    anchor: { x: 0.5, y: 0.5 },
    fps: 8,
};

/** Flood-fill the solid component containing (sx,sy); marks visited in place. */
function floodFill(
    solid: Uint8Array,
    visited: Uint8Array,
    width: number,
    height: number,
    sx: number,
    sy: number,
): Component {
    const comp: Component = { minX: sx, minY: sy, maxX: sx, maxY: sy, area: 0, sumX: 0, sumY: 0 };
    const stack: number[] = [sy * width + sx];
    visited[sy * width + sx] = 1;
    while (stack.length > 0) {
        const idx = stack.pop()!;
        const x = idx % width;
        const y = (idx - x) / width;
        comp.area++;
        comp.sumX += x;
        comp.sumY += y;
        if (x < comp.minX) comp.minX = x;
        if (x > comp.maxX) comp.maxX = x;
        if (y < comp.minY) comp.minY = y;
        if (y > comp.maxY) comp.maxY = y;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                const ni = ny * width + nx;
                if (solid[ni] && !visited[ni]) {
                    visited[ni] = 1;
                    stack.push(ni);
                }
            }
        }
    }
    return comp;
}

export function analyzeFrames(img: ImageRGBA, options: FrameAnalyzerOptions = {}): FrameAnalysis {
    const alphaThreshold = options.alphaThreshold ?? 128;
    const minArea = options.minArea ?? 4;
    const fps = options.fps ?? 8;
    const { data, width, height } = img;
    if (width === 0 || height === 0) return { ...EMPTY, fps };

    const solid = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
        if (data[i * 4 + 3] >= alphaThreshold) solid[i] = 1;
    }

    const visited = new Uint8Array(width * height);
    const comps: Component[] = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            if (solid[i] && !visited[i]) {
                const comp = floodFill(solid, visited, width, height, x, y);
                if (comp.area >= minArea) comps.push(comp);
            }
        }
    }
    if (comps.length === 0) return { ...EMPTY, fps };

    const frames: FrameRect[] = comps.map((c) => ({
        x: c.minX,
        y: c.minY,
        w: c.maxX - c.minX + 1,
        h: c.maxY - c.minY + 1,
    }));
    const frame_w = Math.max(...frames.map((f) => f.w));
    const frame_h = Math.max(...frames.map((f) => f.h));

    // Reading order: group into rows by a band of one cell height, then by x.
    const band = Math.max(1, frame_h);
    const order = comps
        .map((c, i) => ({ i, row: Math.floor((c.minY + (c.maxY - c.minY) / 2) / band), x: c.minX }))
        .sort((a, b) => (a.row - b.row) || (a.x - b.x));
    const orderedFrames = order.map((o) => frames[o.i]);

    // Anchor = centroid of the first frame in reading order, within its bbox.
    const first = comps[order[0].i];
    const fw = first.maxX - first.minX + 1;
    const fh = first.maxY - first.minY + 1;
    const cx = first.sumX / first.area;
    const cy = first.sumY / first.area;
    const anchor = {
        x: Math.min(1, Math.max(0, (cx - first.minX + 0.5) / fw)),
        y: Math.min(1, Math.max(0, (cy - first.minY + 0.5) / fh)),
    };

    return { frames: orderedFrames, count: comps.length, frame_w, frame_h, anchor, fps };
}
