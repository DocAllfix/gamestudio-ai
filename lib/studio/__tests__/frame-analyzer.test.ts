/**
 * Frame analyzer — connected-components over the alpha mask of a sprite sheet →
 * frame bounding boxes, count, uniform cell size, and a centre-of-mass anchor.
 * Pure logic on synthetic RGBA.
 */
import { describe, it, expect } from "vitest";

import { analyzeFrames } from "../frame-analyzer.js";

function blank(w: number, h: number) {
    return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
}
/** Paint a solid opaque rect (white) into an image. */
function rect(img: { data: Uint8ClampedArray; width: number }, x0: number, y0: number, w: number, h: number) {
    for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
            const i = (y * img.width + x) * 4;
            img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = 255;
        }
    }
}

describe("analyzeFrames", () => {
    it("finds 4 frames in a gutter-separated row, left-to-right", () => {
        const img = blank(64, 16);
        for (let k = 0; k < 4; k++) rect(img, k * 16, 4, 8, 8);
        const res = analyzeFrames(img);
        expect(res.count).toBe(4);
        expect(res.frame_w).toBe(8);
        expect(res.frame_h).toBe(8);
        expect(res.frames.map((f) => f.x)).toEqual([0, 16, 32, 48]);
    });

    it("reads a 2x2 grid in reading order (rows top→bottom, cols left→right)", () => {
        const img = blank(32, 32);
        rect(img, 4, 4, 8, 8);
        rect(img, 20, 4, 8, 8);
        rect(img, 4, 20, 8, 8);
        rect(img, 20, 20, 8, 8);
        const res = analyzeFrames(img);
        expect(res.count).toBe(4);
        expect(res.frames.map((f) => [f.x, f.y])).toEqual([
            [4, 4], [20, 4], [4, 20], [20, 20],
        ]);
    });

    it("filters out sub-minArea noise specks", () => {
        const img = blank(32, 16);
        rect(img, 2, 2, 10, 10); // real sprite
        rect(img, 30, 14, 1, 1); // stray pixel
        const res = analyzeFrames(img, { minArea: 4 });
        expect(res.count).toBe(1);
    });

    it("returns no frames for a fully transparent sheet", () => {
        const res = analyzeFrames(blank(16, 16));
        expect(res.count).toBe(0);
        expect(res.frames).toEqual([]);
    });

    it("anchor centre-of-mass sits low for a bottom-heavy sprite", () => {
        // Triangle: row r is solid from x=0..r, so mass concentrates low/left.
        const img = blank(8, 8);
        for (let r = 0; r < 8; r++) rect(img, 0, r, r + 1, 1);
        const res = analyzeFrames(img);
        expect(res.count).toBe(1);
        expect(res.anchor.y).toBeGreaterThan(0.5);
        expect(res.anchor.x).toBeLessThan(0.5);
    });
});
