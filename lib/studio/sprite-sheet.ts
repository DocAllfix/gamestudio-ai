/**
 * Sprite-sheet detector — is a sprite a single image or a SHEET of frames, and
 * what's the frame size? (Studio enrichment, FASE 1.) The `frame_meta count`
 * from connected components does NOT tell them apart (a gutter-less sheet = one
 * blob; a single sprite with detached parts = many). This uses the right signal:
 * the CONTENT PROFILE (opaque-pixel count per column/row) is PERIODIC in a sheet
 * (one peak per frame, dips between) and a single bump for one sprite. The
 * dominant period of each axis is the frame size; >=2 frames on an axis ⇒ sheet.
 *
 * Deterministic, zero-dependency, pure on RGBA (same contract as the detectors).
 * A sheet is a GIFT — it carries the animation frames; we just need the size so
 * the composer can load.spritesheet + show/animate one frame (via the atlas
 * builder), instead of stretching the whole sheet into the scene.
 */

import type { ImageRGBA } from "./tile-size.js";

export interface SpriteSheetResult {
    is_sheet: boolean;
    frame_w: number;
    frame_h: number;
    frame_count: number;
    layout: "single" | "strip" | "grid";
    /** 0-100: the periodicity strength behind the decision. */
    confidence: number;
}

export interface SpriteSheetOptions {
    /** Smallest plausible frame dimension (px). */
    minFrame?: number;
    /** Pixels at/below this alpha are transparent (background). */
    alphaThreshold?: number;
}

/** Opaque-pixel count per column and per row. */
function contentProfiles(img: ImageRGBA, aT: number): { col: number[]; row: number[] } {
    const { data, width, height } = img;
    const col = new Array<number>(width).fill(0);
    const row = new Array<number>(height).fill(0);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (data[(y * width + x) * 4 + 3] > aT) {
                col[x]++;
                row[y]++;
            }
        }
    }
    return { col, row };
}

/** Count frames along one axis: islands of content (runs above 15% of the peak,
 * separated by transparent gaps) that are EVENLY spaced (real frames repeat at a
 * fixed pitch). Returns frames=1 for a single contiguous subject. `evenness` is
 * 1 for perfectly periodic, →0 for irregular (a single multi-part sprite). */
function countFrames(profile: number[], len: number, minFrame: number): { frames: number; frameSize: number; evenness: number } {
    let maxC = 0;
    for (const v of profile) if (v > maxC) maxC = v;
    if (maxC <= 0) return { frames: 1, frameSize: len, evenness: 1 };
    const thresh = maxC * 0.1;

    // Content runs [start,end].
    const runs: Array<[number, number]> = [];
    let s = -1;
    for (let i = 0; i < len; i++) {
        const on = profile[i] > thresh;
        if (on && s < 0) s = i;
        if (!on && s >= 0) { runs.push([s, i - 1]); s = -1; }
    }
    if (s >= 0) runs.push([s, len - 1]);

    // Merge runs separated by a NARROW gap: a real frame boundary is a
    // transparent gap several columns wide; a 1-2px dip is just the subject
    // pinching (e.g. an organic shape), not a frame break.
    const minGap = Math.max(2, Math.round(len * 0.03));
    const merged: Array<[number, number]> = [];
    for (const r of runs) {
        const last = merged[merged.length - 1];
        if (last && r[0] - last[1] - 1 < minGap) last[1] = r[1];
        else merged.push([r[0], r[1]]);
    }
    if (merged.length < 2) return { frames: 1, frameSize: len, evenness: 1 };
    const centers = merged.map(([a, b]) => (a + b) / 2);

    const gaps: number[] = [];
    for (let k = 1; k < centers.length; k++) gaps.push(centers[k] - centers[k - 1]);
    const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const dev = Math.sqrt(gaps.reduce((a, b) => a + (b - meanGap) ** 2, 0) / gaps.length);
    const evenness = meanGap > 0 ? Math.max(0, 1 - dev / meanGap) : 0;

    const frames = centers.length;
    const frameSize = Math.round(len / frames);
    // Irregular spacing or sub-min frames ⇒ one multi-part sprite, not a sheet.
    if (evenness < 0.7 || frameSize < minFrame) return { frames: 1, frameSize: len, evenness };
    return { frames, frameSize, evenness };
}

export function analyzeSprite(img: ImageRGBA, options: SpriteSheetOptions = {}): SpriteSheetResult {
    const minFrame = options.minFrame ?? 8;
    const aT = options.alphaThreshold ?? 16;
    const { width, height } = img;

    const { col, row } = contentProfiles(img, aT);
    const x = countFrames(col, width, minFrame);
    const y = countFrames(row, height, minFrame);

    // 2 runs on an axis is ambiguous (a single sprite can have two lobes / a
    // gap). Trust an axis only with >=3 evenly-spaced frames — UNLESS the other
    // axis is clearly framed (a real grid), where 2 rows/cols are genuine. The
    // safe bias: when unsure, treat as one frame (show the whole sprite, never
    // half of it).
    const framedX = x.frames >= 3 || (x.frames === 2 && y.frames >= 3);
    const framedY = y.frames >= 3 || (y.frames === 2 && x.frames >= 3);
    const framesX = framedX ? x.frames : 1;
    const framesY = framedY ? y.frames : 1;

    const frame_count = framesX * framesY;
    const is_sheet = frame_count >= 2;
    const layout: SpriteSheetResult["layout"] = framesX > 1 && framesY > 1 ? "grid" : frame_count > 1 ? "strip" : "single";

    const evenness = is_sheet ? Math.max(framedX ? x.evenness : 0, framedY ? y.evenness : 0) : 1;
    const confidence = Math.round(100 * evenness);

    return {
        is_sheet,
        frame_w: framedX ? x.frameSize : width,
        frame_h: framedY ? y.frameSize : height,
        frame_count,
        layout,
        confidence,
    };
}
