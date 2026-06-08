/**
 * Background remover — make a sprite's solid background transparent (Studio
 * tool, the deterministic 🟢 "Background Remover/Chroma" from the Sorceress set).
 *
 * Deterministic, zero-dependency, pure on RGBA (same contract as the detectors):
 * the caller decodes the PNG; this owns the math. Runs at INGESTION on the
 * catalog (amortized — clean once, every game gets the transparent asset free)
 * and on-demand for user uploads.
 *
 * Method (validated against Sprite Buff / Aseprite / Sprite-AI): FLOOD-FILL FROM
 * THE BORDER, not global colour removal. Only background pixels CONNECTED to the
 * edge become transparent, so same-coloured pixels INSIDE the sprite (white eyes
 * on a white-bg character) are preserved — the precision that doesn't ruin the
 * sprite. Conservative: only applies when the border is clearly uniform; a
 * subject that bleeds to the edge or a non-uniform background is left untouched
 * (`applied:false`).
 */

import type { ImageRGBA } from "./tile-size.js";

export interface BgRemoveOptions {
    /** Max per-channel colour distance (Chebyshev) to count as background. Low =
     * precise. Default 24 (conservative; handles minor pixel-art dithering). */
    tolerance?: number;
    /** 4- or 8-connectivity for the flood fill. Default 8. */
    connectivity?: 4 | 8;
    /** Pixels already below this alpha count as background (already-clean assets
     * stay clean). Default 16. */
    alphaThreshold?: number;
    /** Min fraction of border pixels that must match the bg colour to treat the
     * background as uniform and apply removal. Default 0.6. */
    minBorderUniformity?: number;
}

export interface BgRemoveResult {
    /** New RGBA (background alpha set to 0). Equals the input when not applied
     * OR when `risky` (the caller should keep the original). */
    data: Uint8ClampedArray;
    /** False when the background wasn't uniform enough — input returned unchanged. */
    applied: boolean;
    /** The detected background colour. */
    bgColor: [number, number, number];
    /** Pixels turned transparent. */
    removed: number;
    /** Fraction of border pixels matching the bg colour (the uniformity signal). */
    borderUniformity: number;
    /** Removed pixels ENCLOSED by the subject (a hole punched in the sprite —
     * e.g. a white shirt on a white bg the flood leaked into). */
    interiorRemoved: number;
    /** True when the removal likely ate part of the subject (subject shares the
     * bg colour). The caller MUST NOT use `data`: keep the original and route
     * the asset to the manual Studio tool. Precision over ruining the sprite. */
    risky: boolean;
}

/** Chebyshev (max per-channel) colour distance — predictable + cheap. */
function colorDist(d: Uint8ClampedArray | number[], i: number, r: number, g: number, b: number): number {
    return Math.max(Math.abs(d[i] - r), Math.abs(d[i + 1] - g), Math.abs(d[i + 2] - b));
}

/** Iterate the indices of every border pixel (top/bottom rows + left/right cols). */
function* borderPixels(width: number, height: number): Generator<number> {
    for (let x = 0; x < width; x++) {
        yield x; // top row
        yield (height - 1) * width + x; // bottom row
    }
    for (let y = 1; y < height - 1; y++) {
        yield y * width; // left col
        yield y * width + (width - 1); // right col
    }
}

export function removeBackground(img: ImageRGBA, options: BgRemoveOptions = {}): BgRemoveResult {
    const tolerance = options.tolerance ?? 24;
    const conn8 = (options.connectivity ?? 8) === 8;
    const alphaThreshold = options.alphaThreshold ?? 16;
    const minUniformity = options.minBorderUniformity ?? 0.6;
    const { width, height } = img;
    const src = img.data;
    const out = new Uint8ClampedArray(src.length);
    out.set(src);

    // Background colour = top-left corner (the canonical bg sample).
    const bgR = src[0], bgG = src[1], bgB = src[2];
    const bgColor: [number, number, number] = [bgR, bgG, bgB];

    // Border uniformity gate: how much of the frame edge matches the bg colour
    // (or is already transparent). Low → the subject bleeds to the edge / the bg
    // isn't uniform → don't touch it.
    let borderTotal = 0;
    let borderMatch = 0;
    for (const idx of borderPixels(width, height)) {
        borderTotal++;
        const o = idx * 4;
        if (src[o + 3] < alphaThreshold || colorDist(src, o, bgR, bgG, bgB) <= tolerance) borderMatch++;
    }
    const borderUniformity = borderTotal > 0 ? borderMatch / borderTotal : 0;
    if (borderUniformity < minUniformity) {
        return { data: out, applied: false, bgColor, removed: 0, borderUniformity, interiorRemoved: 0, risky: false };
    }

    // Flood fill from every matching border pixel; only edge-connected bg pixels
    // are cleared, so interior same-colour pixels survive.
    const visited = new Uint8Array(width * height);
    const stack: number[] = [];
    const isBg = (idx: number): boolean => {
        const o = idx * 4;
        return src[o + 3] < alphaThreshold || colorDist(src, o, bgR, bgG, bgB) <= tolerance;
    };
    for (const idx of borderPixels(width, height)) {
        if (!visited[idx] && isBg(idx)) {
            visited[idx] = 1;
            stack.push(idx);
        }
    }
    const removedIdx: number[] = [];
    while (stack.length > 0) {
        const idx = stack.pop()!;
        out[idx * 4 + 3] = 0; // transparent
        removedIdx.push(idx);
        const x = idx % width;
        const y = (idx - x) / width;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                if (!conn8 && dx !== 0 && dy !== 0) continue;
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                const ni = ny * width + nx;
                if (!visited[ni] && isBg(ni)) {
                    visited[ni] = 1;
                    stack.push(ni);
                }
            }
        }
    }

    // Safety: a removed pixel is "interior" (a hole punched in the sprite) when
    // a kept-opaque subject pixel blocks it in >=3 of the 4 cardinal rays. Rays
    // pass through other removed pixels (alpha 0), so the whole leaked region
    // (e.g. a white shirt) reads as enclosed by the subject.
    const kept = (xx: number, yy: number): boolean => out[(yy * width + xx) * 4 + 3] >= 128;
    let interiorRemoved = 0;
    for (const idx of removedIdx) {
        const x = idx % width;
        const y = (idx - x) / width;
        let blocked = 0;
        for (let yy = y - 1; yy >= 0; yy--) if (kept(x, yy)) { blocked++; break; }
        for (let yy = y + 1; yy < height; yy++) if (kept(x, yy)) { blocked++; break; }
        for (let xx = x - 1; xx >= 0; xx--) if (kept(xx, y)) { blocked++; break; }
        for (let xx = x + 1; xx < width; xx++) if (kept(xx, y)) { blocked++; break; }
        if (blocked >= 3) interiorRemoved++;
    }
    // Err toward keeping the original: a meaningful enclosed removal = the
    // subject shares the bg colour → don't ship a holed sprite.
    const risky = interiorRemoved >= 6;
    if (risky) out.set(src); // revert — caller keeps the original

    return { data: out, applied: !risky, bgColor, removed: removedIdx.length, borderUniformity, interiorRemoved, risky };
}
