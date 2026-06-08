/**
 * Tile-size detector — the inverse of the slicer. Given a tileset image (RGBA +
 * dims) it recovers the grid size (16/32/48…). Pure logic on synthetic images,
 * no canvas needed. Anti-hallucination: a non-grid image yields tile_size=null.
 */
import { describe, it, expect } from "vitest";

import { detectTileSize } from "../tile-size.js";

/** Build a WxH RGBA image whose tiles of size `t` each get a distinct flat
 * colour, so tile boundaries are strong colour discontinuities every `t` px. */
function tiledImage(w: number, h: number, t: number) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const tx = Math.floor(x / t);
            const ty = Math.floor(y / t);
            // Distinct colour per tile (checkerboard-ish, deterministic).
            const r = (tx * 53 + ty * 17) % 256;
            const g = (tx * 97 + ty * 41) % 256;
            const b = (tx * 29 + ty * 71) % 256;
            const i = (y * w + x) * 4;
            data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
        }
    }
    return { data, width: w, height: h };
}

/** A smooth horizontal gradient — no periodic grid structure. */
function gradient(w: number, h: number) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const v = Math.floor((x / w) * 255);
            const i = (y * w + x) * 4;
            data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
        }
    }
    return { data, width: w, height: h };
}

describe("detectTileSize", () => {
    it("recovers a 16px grid from a 64x64 tiled image", () => {
        const res = detectTileSize(tiledImage(64, 64, 16));
        expect(res.tile_size).toBe(16);
        expect(res.confidence).toBeGreaterThan(60);
    });

    it("recovers a 32px grid from a 128x96 tiled image", () => {
        const res = detectTileSize(tiledImage(128, 96, 32));
        expect(res.tile_size).toBe(32);
    });

    it("prefers the fundamental period, not a multiple (24px not 48px)", () => {
        const res = detectTileSize(tiledImage(96, 48, 24));
        expect(res.tile_size).toBe(24);
    });

    it("returns null with low confidence for a non-grid gradient", () => {
        const res = detectTileSize(gradient(64, 64));
        expect(res.tile_size).toBeNull();
        expect(res.confidence).toBeLessThan(50);
    });

    it("ranks candidates and exposes scores", () => {
        const res = detectTileSize(tiledImage(64, 64, 16));
        expect(res.candidates.length).toBeGreaterThan(0);
        // The winner is the top-ranked candidate.
        expect(res.candidates[0].size).toBe(16);
        expect(res.candidates[0].score).toBeGreaterThanOrEqual(res.candidates[res.candidates.length - 1].score);
    });

    it("respects min/max tile bounds", () => {
        const res = detectTileSize(tiledImage(64, 64, 16), { minTile: 24, maxTile: 64 });
        // 16 is below the floor, so it cannot be chosen; result is null or >=24.
        expect(res.tile_size === null || res.tile_size >= 24).toBe(true);
    });
});
