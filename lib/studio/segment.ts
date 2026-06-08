/**
 * Pack segmenter — cut a multi-object pack (sprite_kind = object_pack) into its
 * individual sprites (Studio enrichment, FASE 1). The vision classifier flags an
 * image as a pack of DIFFERENT objects; this finds each object so it becomes a
 * usable single sprite (then re-classified on its own).
 *
 * Method: connected components (the shared frame-analyzer primitive) over the
 * alpha mask, then MERGE components whose bounding boxes sit within `mergeGap` on
 * both axes — a single object can be several disconnected parts (a sword + hilt,
 * a creature + a floating eye), and we must not split it; different objects keep
 * their transparent gutter so they stay separate. Noise specks are dropped.
 *
 * Assumes objects are separated by TRANSPARENCY (the CC0 norm). A pack on a SOLID
 * background must run the bg-remover first, else it reads as one blob.
 *
 * Deterministic, zero-dependency, pure on RGBA (same contract as the detectors).
 */
import { removeBackground } from "./bg-remove.js";
import { findComponents, type Component } from "./frame-analyzer.js";
import type { ImageRGBA } from "./tile-size.js";

export interface SpriteRegion {
    x: number;
    y: number;
    w: number;
    h: number;
    area: number;
}

export interface SegmentOptions {
    /** Pixels at/below this alpha are the transparent gutter between objects. */
    alphaThreshold?: number;
    /** Merged regions below this pixel area are dropped as noise. */
    minArea?: number;
    /** Merged regions thinner than this on either side are dropped. */
    minSide?: number;
    /** Bounding boxes within this gap (px, both axes) are the same object. */
    mergeGap?: number;
    /** Colour tolerance for the solid-background flood (Chebyshev). Default 24. */
    bgTolerance?: number;
}

/** Key out the dominant opaque colour (a solid background the corner flood
 * missed — e.g. a coloured fill behind a framed pack, where the corner is the
 * frame, not the fill). Coarse 5-bit/channel histogram picks the background. */
function keyDominantColor(data: Uint8ClampedArray, alphaThreshold: number, tolerance: number): Uint8ClampedArray {
    const out = new Uint8ClampedArray(data);
    const hist = new Map<number, number>();
    for (let i = 0; i < out.length; i += 4) {
        if (out[i + 3] < alphaThreshold) continue;
        const k = ((out[i] >> 3) << 10) | ((out[i + 1] >> 3) << 5) | (out[i + 2] >> 3);
        hist.set(k, (hist.get(k) ?? 0) + 1);
    }
    let bgK = -1, bgC = -1;
    for (const [k, c] of hist) if (c > bgC) { bgC = c; bgK = k; }
    if (bgK < 0) return out;
    const bgR = ((bgK >> 10) & 31) << 3, bgG = ((bgK >> 5) & 31) << 3, bgB = (bgK & 31) << 3;
    for (let i = 0; i < out.length; i += 4) {
        if (out[i + 3] >= alphaThreshold && Math.max(Math.abs(out[i] - bgR), Math.abs(out[i + 1] - bgG), Math.abs(out[i + 2] - bgB)) <= tolerance) out[i + 3] = 0;
    }
    return out;
}

export function segmentPack(img: ImageRGBA, options: SegmentOptions = {}): SpriteRegion[] {
    const alphaThreshold = options.alphaThreshold ?? 16;
    const minArea = options.minArea ?? 64;
    const minSide = options.minSide ?? 6;
    const mergeGap = options.mergeGap ?? 2;
    const tolerance = options.bgTolerance ?? 24;

    // Real packs sit on a SOLID background, not transparency. (1) flood the
    // border bg (removes a frame / corner-coloured bg); (2) if the result is
    // still mostly opaque, a solid fill remains → key out its dominant colour.
    // Both are no-ops on an already-transparent pack.
    let data = removeBackground(img, { tolerance }).data;
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] >= alphaThreshold) opaque++;
    if (opaque / (img.width * img.height) > 0.85) {
        data = keyDominantColor(data, alphaThreshold, tolerance);
    }
    const comps = findComponents({ data, width: img.width, height: img.height }, { alphaThreshold, minArea: 2 });
    if (comps.length === 0) return [];

    // Union-find merge: parts of one object are within mergeGap on both axes.
    const parent = comps.map((_, i) => i);
    const find = (i: number): number => {
        while (parent[i] !== i) {
            parent[i] = parent[parent[i]];
            i = parent[i];
        }
        return i;
    };
    const near = (a: Component, b: Component): boolean => {
        const xGap = Math.max(0, b.minX - a.maxX - 1, a.minX - b.maxX - 1);
        const yGap = Math.max(0, b.minY - a.maxY - 1, a.minY - b.maxY - 1);
        return xGap <= mergeGap && yGap <= mergeGap;
    };
    for (let i = 0; i < comps.length; i++) {
        for (let j = i + 1; j < comps.length; j++) {
            if (near(comps[i], comps[j])) parent[find(i)] = find(j);
        }
    }

    // Group merged components → combined bbox + total area.
    const groups = new Map<number, { minX: number; minY: number; maxX: number; maxY: number; area: number }>();
    for (let i = 0; i < comps.length; i++) {
        const r = find(i);
        const c = comps[i];
        const g = groups.get(r);
        if (!g) {
            groups.set(r, { minX: c.minX, minY: c.minY, maxX: c.maxX, maxY: c.maxY, area: c.area });
        } else {
            g.minX = Math.min(g.minX, c.minX);
            g.minY = Math.min(g.minY, c.minY);
            g.maxX = Math.max(g.maxX, c.maxX);
            g.maxY = Math.max(g.maxY, c.maxY);
            g.area += c.area;
        }
    }

    const regions: SpriteRegion[] = [];
    for (const g of groups.values()) {
        const w = g.maxX - g.minX + 1;
        const h = g.maxY - g.minY + 1;
        // Drop a region that spans almost the whole image — an unremoved
        // background or a frame, not an object.
        const spansAll = w >= img.width * 0.92 && h >= img.height * 0.92;
        if (!spansAll && g.area >= minArea && w >= minSide && h >= minSide) {
            regions.push({ x: g.minX, y: g.minY, w, h, area: g.area });
        }
    }
    if (regions.length === 0) return [];

    // Reading order: group into rows by a median-height band, then by x.
    const med = [...regions].sort((a, b) => a.h - b.h)[regions.length >> 1].h;
    const band = Math.max(1, med);
    regions.sort((a, b) =>
        (Math.floor((a.y + a.h / 2) / band) - Math.floor((b.y + b.h / 2) / band)) || (a.x - b.x),
    );
    return regions;
}

/** Crop one region out of the pack into its own RGBA image. */
export function cropRegion(img: ImageRGBA, r: SpriteRegion): ImageRGBA {
    const out = new Uint8ClampedArray(r.w * r.h * 4);
    for (let y = 0; y < r.h; y++) {
        for (let x = 0; x < r.w; x++) {
            const si = ((r.y + y) * img.width + (r.x + x)) * 4;
            const di = (y * r.w + x) * 4;
            out[di] = img.data[si];
            out[di + 1] = img.data[si + 1];
            out[di + 2] = img.data[si + 2];
            out[di + 3] = img.data[si + 3];
        }
    }
    return { data: out, width: r.w, height: r.h };
}
