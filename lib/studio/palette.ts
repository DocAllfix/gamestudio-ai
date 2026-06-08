/**
 * Palette extractor — dominant colours of an asset via median cut (Studio
 * enrichment, FASE 1). Produces the `palette_hex` the GameSpec asset slot
 * carries (docs/FASE0_GAMESPEC_DESIGN.md §4): coherence checks + recolour.
 *
 * Deterministic, zero-dependency, pure on RGBA (same contract as slicer/
 * pixel-snap). Median cut: put every non-transparent pixel in one box, then
 * repeatedly split the box with the widest colour range along that channel at
 * its median, until we have `colors` boxes; each box's mean colour is a swatch.
 * Swatches are ranked by population (most common first) and de-duplicated, so
 * an image with k<colors distinct colours returns exactly k (no padding).
 */

import type { ImageRGBA } from "./tile-size.js";

export interface PaletteOptions {
    /** Target number of swatches. */
    colors?: number;
    /** Pixels with alpha below this are treated as transparent and ignored. */
    alphaThreshold?: number;
}

type RGB = [number, number, number];

interface Box {
    pixels: RGB[];
}

function channelRange(box: Box): { channel: number; range: number } {
    const min: RGB = [255, 255, 255];
    const max: RGB = [0, 0, 0];
    for (const p of box.pixels) {
        for (let c = 0; c < 3; c++) {
            if (p[c] < min[c]) min[c] = p[c];
            if (p[c] > max[c]) max[c] = p[c];
        }
    }
    let channel = 0;
    let range = -1;
    for (let c = 0; c < 3; c++) {
        const r = max[c] - min[c];
        if (r > range) {
            range = r;
            channel = c;
        }
    }
    return { channel, range };
}

/** Split along the widest channel at its LARGEST gap (not the count median):
 * this separates distinct colour clusters cleanly for flat-colour art, where a
 * median split would smear a dominant colour across both boxes. */
function splitBox(box: Box): [Box, Box] {
    const { channel } = channelRange(box);
    const sorted = [...box.pixels].sort((a, b) => a[channel] - b[channel]);
    let splitAt = sorted.length >> 1;
    let maxGap = -1;
    for (let i = 1; i < sorted.length; i++) {
        const gap = sorted[i][channel] - sorted[i - 1][channel];
        if (gap > maxGap) {
            maxGap = gap;
            splitAt = i;
        }
    }
    return [{ pixels: sorted.slice(0, splitAt) }, { pixels: sorted.slice(splitAt) }];
}

function meanColor(box: Box): RGB {
    let r = 0, g = 0, b = 0;
    for (const p of box.pixels) {
        r += p[0]; g += p[1]; b += p[2];
    }
    const n = box.pixels.length;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function toHex([r, g, b]: RGB): string {
    const h = (v: number) => v.toString(16).padStart(2, "0");
    return `#${h(r)}${h(g)}${h(b)}`;
}

export function extractPalette(img: ImageRGBA, options: PaletteOptions = {}): string[] {
    const colors = Math.max(1, options.colors ?? 8);
    const alphaThreshold = options.alphaThreshold ?? 128;
    const { data, width, height } = img;

    const pixels: RGB[] = [];
    for (let i = 0; i < width * height; i++) {
        const o = i * 4;
        if (data[o + 3] >= alphaThreshold) pixels.push([data[o], data[o + 1], data[o + 2]]);
    }
    if (pixels.length === 0) return [];

    let boxes: Box[] = [{ pixels }];
    // Split the widest box until we hit the target or nothing is splittable.
    while (boxes.length < colors) {
        let bestIdx = -1;
        let bestRange = 0;
        for (let i = 0; i < boxes.length; i++) {
            if (boxes[i].pixels.length < 2) continue;
            const { range } = channelRange(boxes[i]);
            if (range > bestRange) {
                bestRange = range;
                bestIdx = i;
            }
        }
        if (bestIdx === -1) break; // every box is a single colour
        const [a, b] = splitBox(boxes[bestIdx]);
        boxes = [...boxes.slice(0, bestIdx), a, b, ...boxes.slice(bestIdx + 1)];
    }

    // Rank by population, then collapse boxes that average to the same swatch.
    boxes.sort((a, b) => b.pixels.length - a.pixels.length);
    const seen = new Set<string>();
    const palette: string[] = [];
    for (const box of boxes) {
        const hex = toHex(meanColor(box));
        if (!seen.has(hex)) {
            seen.add(hex);
            palette.push(hex);
        }
    }
    return palette;
}
