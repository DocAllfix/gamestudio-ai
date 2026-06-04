/**
 * Caveat fixes — autotiling (1 base tileset → full set) and palette swap
 * (consistent look across mixed CC0 tiles). Pure unit tests, zero-dep.
 */
import { describe, expect, it } from "vitest";

import { BLOB_TILE_COUNT, autotileGid, autotileLayer, blobMask } from "../_autotile.js";
import { Palette, hexToRgb, rgbToHex } from "../_palette.js";

function mask(rows: string[]): boolean[][] {
    return rows.map((r) => [...r].map((c) => c === "X"));
}

describe("autotile (caveat 1)", () => {
    it("the canonical blob set is 47 tiles", () => {
        expect(BLOB_TILE_COUNT).toBe(47);
    });

    it("empty cell → gid 0 (no tile)", () => {
        const m = mask(["X.X", "...", "X.X"]);
        expect(autotileGid(m, 1, 1, 100)).toBe(0); // center is empty
    });

    it("filled cell → gid in [firstgid, firstgid+46]", () => {
        const m = mask(["XXX", "XXX", "XXX"]);
        const gid = autotileGid(m, 1, 1, 100);
        expect(gid).toBeGreaterThanOrEqual(100);
        expect(gid).toBeLessThanOrEqual(146);
    });

    it("isolated tile and fully-surrounded tile pick different variants", () => {
        const isolated = mask([".....", "..X..", "....."]);
        const surrounded = mask(["XXX", "XXX", "XXX"]);
        expect(blobMask(isolated, 2, 1)).not.toBe(blobMask(surrounded, 1, 1));
    });

    it("autotileLayer produces a row-major gid array of length w*h", () => {
        const m = mask(["XX", "XX"]);
        const data = autotileLayer(m, 1);
        expect(data).toHaveLength(4);
        expect(data.every((g) => g >= 1 && g <= 47)).toBe(true);
    });
});

describe("palette swap (caveat 2)", () => {
    it("parses and round-trips hex", () => {
        expect(hexToRgb("#ff6a1a")).toEqual({ r: 255, g: 106, b: 26 });
        expect(rgbToHex({ r: 255, g: 106, b: 26 })).toBe("#ff6a1a");
        expect(hexToRgb("#abc")).toEqual({ r: 170, g: 187, b: 204 });
        expect(hexToRgb("nope")).toBeNull();
    });

    it("snaps a color to the nearest palette entry", () => {
        const pal = new Palette(["#000000", "#ffffff", "#ff0000"]);
        expect(pal.nearestHex("#fe0202")).toBe("#ff0000"); // near red
        expect(pal.nearestHex("#101010")).toBe("#000000"); // near black
    });

    it("empty palette is identity (no crash)", () => {
        const pal = new Palette([]);
        expect(pal.size).toBe(0);
        expect(pal.nearestHex("#123456")).toBe("#123456");
    });

    it("buildLut maps every source color into the target palette", () => {
        const pal = new Palette(["#222222", "#dddddd"]);
        const lut = pal.buildLut(["#202020", "#e0e0e0"]);
        expect(lut.get("#202020")).toBe("#222222");
        expect(lut.get("#e0e0e0")).toBe("#dddddd");
    });
});
