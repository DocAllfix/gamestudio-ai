/**
 * Pack segmenter — cut a multi-object pack into individual sprites via
 * connected components + nearby-part merge. Pure synthetic RGBA.
 */
import { describe, it, expect } from "vitest";

import { segmentPack, cropRegion } from "../segment.js";

function blank(w: number, h: number) {
    return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
}
function rect(img: { data: Uint8ClampedArray; width: number }, x0: number, y0: number, w: number, h: number, rgba = [200, 80, 80, 255]) {
    for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
            const i = (y * img.width + x) * 4;
            img.data[i] = rgba[0]; img.data[i + 1] = rgba[1]; img.data[i + 2] = rgba[2]; img.data[i + 3] = rgba[3];
        }
    }
}

describe("segmentPack", () => {
    it("splits three transparency-separated objects, in reading order", () => {
        const img = blank(72, 24);
        rect(img, 2, 4, 14, 14);
        rect(img, 30, 4, 14, 14);
        rect(img, 56, 4, 14, 14);
        const regs = segmentPack(img);
        expect(regs.length).toBe(3);
        expect(regs.map((r) => r.x)).toEqual([2, 30, 56]); // left→right
        expect(regs.every((r) => r.w === 14 && r.h === 14)).toBe(true);
    });

    it("merges disconnected PARTS of one object (small gap)", () => {
        const img = blank(40, 24);
        rect(img, 2, 4, 10, 14);   // body
        rect(img, 13, 6, 6, 8);    // 1px gap → same object (a held item)
        const regs = segmentPack(img);
        expect(regs.length).toBe(1);
        expect(regs[0].x).toBe(2);
        expect(regs[0].w).toBe(17); // 2..18
    });

    it("drops noise specks below the area floor", () => {
        const img = blank(60, 30);
        rect(img, 2, 2, 22, 22);   // real object
        rect(img, 50, 2, 2, 2);    // 4px speck → noise
        const regs = segmentPack(img);
        expect(regs.length).toBe(1);
        expect(regs[0].w).toBe(22);
    });

    it("orders rows top→bottom then left→right (grid pack)", () => {
        const img = blank(60, 60);
        rect(img, 4, 4, 14, 14);   // row 0
        rect(img, 34, 4, 14, 14);
        rect(img, 4, 36, 14, 14);  // row 1
        rect(img, 34, 36, 14, 14);
        const regs = segmentPack(img);
        expect(regs.length).toBe(4);
        expect(regs.map((r) => [r.x, r.y])).toEqual([[4, 4], [34, 4], [4, 36], [34, 36]]);
    });

    it("crops a region out of the pack", () => {
        const img = blank(40, 20);
        rect(img, 5, 3, 10, 10, [10, 220, 30, 255]);
        const reg = segmentPack(img)[0];
        const crop = cropRegion(img, reg);
        expect([crop.width, crop.height]).toEqual([10, 10]);
        expect([crop.data[0], crop.data[1], crop.data[2], crop.data[3]]).toEqual([10, 220, 30, 255]);
    });

    it("returns nothing for a fully transparent image", () => {
        expect(segmentPack(blank(20, 20))).toEqual([]);
    });
});
