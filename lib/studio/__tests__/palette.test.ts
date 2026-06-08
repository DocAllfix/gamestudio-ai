/**
 * Palette extractor — median-cut over non-transparent pixels → dominant colours
 * as #rrggbb, ranked by population. Pure logic on synthetic RGBA.
 */
import { describe, it, expect } from "vitest";

import { extractPalette } from "../palette.js";

/** Build an image from a colour map function (x,y) → [r,g,b,a]. */
function make(w: number, h: number, fn: (x: number, y: number) => [number, number, number, number]) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const [r, g, b, a] = fn(x, y);
            const i = (y * w + x) * 4;
            data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
        }
    }
    return { data, width: w, height: h };
}

describe("extractPalette", () => {
    it("extracts the two dominant colours, majority first", () => {
        // 60% red, 40% blue (10px wide → 6 red cols, 4 blue cols).
        const img = make(10, 4, (x) => (x < 6 ? [255, 0, 0, 255] : [0, 0, 255, 255]));
        const pal = extractPalette(img, { colors: 2 });
        expect(pal).toEqual(["#ff0000", "#0000ff"]);
    });

    it("ignores fully transparent pixels", () => {
        // left half opaque red, right half transparent green.
        const img = make(8, 4, (x) => (x < 4 ? [255, 0, 0, 255] : [0, 255, 0, 0]));
        const pal = extractPalette(img, { colors: 4 });
        expect(pal).toEqual(["#ff0000"]);
    });

    it("returns only the distinct colours that exist (no padding)", () => {
        const img = make(4, 4, () => [18, 52, 86, 255]); // solid #123456
        const pal = extractPalette(img, { colors: 8 });
        expect(pal).toEqual(["#123456"]);
    });

    it("returns an empty palette for a fully transparent image", () => {
        const img = make(4, 4, () => [10, 20, 30, 0]);
        expect(extractPalette(img, { colors: 8 })).toEqual([]);
    });

    it("returns up to `colors` swatches for a multi-colour image", () => {
        const colours: [number, number, number][] = [
            [200, 0, 0], [0, 200, 0], [0, 0, 200], [200, 200, 0], [0, 200, 200],
        ];
        const img = make(10, 10, (x, y) => {
            const c = colours[(x + y) % colours.length];
            return [c[0], c[1], c[2], 255];
        });
        const pal = extractPalette(img, { colors: 4 });
        expect(pal.length).toBe(4);
        expect(pal.every((h) => /^#[0-9a-f]{6}$/.test(h))).toBe(true);
    });
});
