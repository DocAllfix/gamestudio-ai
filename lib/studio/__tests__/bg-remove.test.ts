/**
 * Background remover — flood-fill from the border. The critical guarantee:
 * interior same-coloured pixels are PRESERVED (only edge-connected background is
 * cleared), and a non-uniform border is left untouched. Pure logic, synthetic.
 */
import { describe, it, expect } from "vitest";

import { removeBackground } from "../bg-remove.js";

const WHITE: [number, number, number] = [255, 255, 255];
const RED: [number, number, number] = [220, 40, 40];

function img(w: number, h: number, fill: [number, number, number]) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
        data[i * 4] = fill[0]; data[i * 4 + 1] = fill[1]; data[i * 4 + 2] = fill[2]; data[i * 4 + 3] = 255;
    }
    return { data, width: w, height: h };
}
function set(im: { data: Uint8ClampedArray; width: number }, x: number, y: number, c: [number, number, number]) {
    const i = (y * im.width + x) * 4;
    im.data[i] = c[0]; im.data[i + 1] = c[1]; im.data[i + 2] = c[2]; im.data[i + 3] = 255;
}
const alpha = (d: Uint8ClampedArray, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3];

describe("removeBackground", () => {
    it("clears a uniform white background, keeps the subject", () => {
        const im = img(8, 8, WHITE);
        for (let y = 2; y <= 5; y++) for (let x = 2; x <= 5; x++) set(im, x, y, RED); // red block
        const res = removeBackground(im);
        expect(res.applied).toBe(true);
        expect(alpha(res.data, 8, 0, 0)).toBe(0); // corner bg → transparent
        expect(alpha(res.data, 8, 3, 3)).toBe(255); // subject preserved
        expect(res.removed).toBeGreaterThan(0);
    });

    it("PRESERVES an interior same-colour pixel (not connected to the border)", () => {
        const im = img(8, 8, WHITE);
        // Red ring at rows/cols 2..5; inner 3..4 stays white (enclosed by red).
        for (let k = 2; k <= 5; k++) {
            set(im, k, 2, RED); set(im, k, 5, RED); set(im, 2, k, RED); set(im, 5, k, RED);
        }
        const res = removeBackground(im);
        expect(res.applied).toBe(true);
        expect(alpha(res.data, 8, 0, 0)).toBe(0); // outer (border-connected) white → cleared
        expect(alpha(res.data, 8, 3, 3)).toBe(255); // INTERIOR white → PRESERVED
        expect(alpha(res.data, 8, 4, 4)).toBe(255);
        expect(alpha(res.data, 8, 2, 2)).toBe(255); // red ring untouched
    });

    it("conservatively SKIPS a non-uniform border (subject bleeds to the edge)", () => {
        const im = img(8, 8, WHITE);
        // Make the whole left half red → border is ~half red, half white (< 60%).
        for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) set(im, x, y, RED);
        const res = removeBackground(im);
        expect(res.applied).toBe(false);
        // Unchanged: everything stays opaque.
        expect(alpha(res.data, 8, 0, 0)).toBe(255);
        expect(res.removed).toBe(0);
    });

    it("treats an already-transparent border as background (alpha-aware)", () => {
        const im = img(8, 8, WHITE);
        for (const idx of [0, 7, 56, 63]) { im.data[idx * 4 + 3] = 0; } // transparent corners
        for (let y = 3; y <= 4; y++) for (let x = 3; x <= 4; x++) set(im, x, y, RED);
        const res = removeBackground(im);
        expect(res.applied).toBe(true);
        expect(alpha(res.data, 8, 3, 3)).toBe(255); // subject kept
    });

    it("flags RISKY + keeps the original when the flood leaks into the subject", () => {
        // Red ring (rows/cols 2..7) with white interior 3..6, but a GAP at the
        // bottom (cols 4-5, row 7 left white) connects the interior white to the
        // bg → the flood eats the interior (the 'white shirt on white bg' case).
        const im = img(10, 10, WHITE);
        for (let k = 2; k <= 7; k++) {
            set(im, k, 2, RED); set(im, 2, k, RED); set(im, 7, k, RED);
            if (k !== 4 && k !== 5) set(im, k, 7, RED); // bottom ring minus the gap
        }
        const res = removeBackground(im);
        expect(res.interiorRemoved).toBeGreaterThanOrEqual(6);
        expect(res.risky).toBe(true);
        expect(res.applied).toBe(false);
        // Reverted: the interior the flood ate is restored to opaque.
        expect(alpha(res.data, 10, 4, 4)).toBe(255);
        expect(alpha(res.data, 10, 0, 0)).toBe(255); // original untouched
    });

    it("respects a tight tolerance (near-bg colours stay if outside tolerance)", () => {
        const im = img(8, 8, WHITE);
        set(im, 4, 4, [225, 225, 225]); // 30 off white — outside tolerance 24
        const res = removeBackground(im, { tolerance: 24 });
        expect(alpha(res.data, 8, 4, 4)).toBe(255); // kept (not background)
    });
});
