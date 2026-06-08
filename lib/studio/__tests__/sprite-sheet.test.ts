/**
 * Sprite-sheet detector — distinguishes a single sprite from a SHEET (strip /
 * grid) via content-profile periodicity, and recovers the frame size. Pure
 * synthetic RGBA.
 */
import { describe, it, expect } from "vitest";

import { analyzeSprite } from "../sprite-sheet.js";

/** Transparent canvas. */
function blank(w: number, h: number) {
    return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
}
/** Paint an opaque square centred in a cell, leaving a transparent margin. */
function blob(img: { data: Uint8ClampedArray; width: number }, cx: number, cy: number, size: number) {
    const h = Math.floor(size / 2);
    for (let y = cy - h; y < cy + h; y++) {
        for (let x = cx - h; x < cx + h; x++) {
            const i = (y * img.width + x) * 4;
            img.data[i] = 200; img.data[i + 1] = 80; img.data[i + 2] = 80; img.data[i + 3] = 255;
        }
    }
}

describe("analyzeSprite", () => {
    it("detects a SINGLE sprite (one centred blob, no periodicity)", () => {
        const img = blank(40, 40);
        blob(img, 20, 24, 20); // one character
        const r = analyzeSprite(img);
        expect(r.is_sheet).toBe(false);
        expect(r.frame_count).toBe(1);
        expect(r.layout).toBe("single");
    });

    it("detects a horizontal STRIP (4 evenly-spaced frames)", () => {
        const img = blank(128, 32); // 4 cells of 32px
        for (let f = 0; f < 4; f++) blob(img, f * 32 + 16, 18, 18);
        const r = analyzeSprite(img);
        expect(r.is_sheet).toBe(true);
        expect(r.layout).toBe("strip");
        expect(r.frame_count).toBe(4);
        expect(r.frame_w).toBe(32);
        expect(r.frame_h).toBe(32);
    });

    it("detects a 3x2 GRID", () => {
        const img = blank(96, 64); // 3 cols x 2 rows of 32px
        for (let cy = 0; cy < 2; cy++) for (let cx = 0; cx < 3; cx++) blob(img, cx * 32 + 16, cy * 32 + 16, 16);
        const r = analyzeSprite(img);
        expect(r.is_sheet).toBe(true);
        expect(r.layout).toBe("grid");
        expect(r.frame_count).toBe(6);
        expect(r.frame_w).toBe(32);
        expect(r.frame_h).toBe(32);
    });

    it("does NOT call a single off-centre blob in a wide image a sheet", () => {
        const img = blank(120, 40); // wide, but one blob → not periodic
        blob(img, 30, 24, 18);
        const r = analyzeSprite(img);
        expect(r.is_sheet).toBe(false);
        expect(r.layout).toBe("single");
    });
});
