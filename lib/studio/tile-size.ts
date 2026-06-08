/**
 * Tile-size detector — the INVERSE of the slicer (Studio enrichment, FASE 1).
 *
 * Given a tileset image it recovers the grid size (16/32/48…) the slicer/composer
 * needs (`tile_size` on the GameSpec asset slot — docs/FASE0_GAMESPEC_DESIGN.md §4).
 * Deterministic, zero-dependency, pure on RGBA (same contract as slicer/pixel-snap):
 * the caller decodes the PNG to {data,width,height}; this module owns the math.
 *
 * Method (no FFT dependency): pixel-art tile boundaries are strong colour
 * discontinuities at every multiple of the tile size. We build a per-column /
 * per-row EDGE profile (sum of neighbour colour deltas) and, for each candidate
 * size `s` that tiles the sheet cleanly, score how the boundary energy lines up
 * with multiples of `s`:
 *   coverage(s)  = fraction of total edge energy sitting on lines k·s   (favours small s)
 *   peakRatio(s) = how much stronger those lines are than the average   (favours large s)
 * Their product peaks at the FUNDAMENTAL period: a sub-multiple (s/2) keeps high
 * coverage but samples weak interior lines (low peakRatio); a super-multiple (2s)
 * keeps high peakRatio but misses half the boundaries (low coverage).
 *
 * Anti-hallucination: a non-grid image (a single sprite, a gradient) scores ~0
 * and yields `tile_size: null` with low `confidence`, plus the ranked candidates.
 */

export interface ImageRGBA {
    data: Uint8ClampedArray | number[];
    width: number;
    height: number;
}

export interface TileSizeOptions {
    /** Smallest tile size to consider (px). */
    minTile?: number;
    /** Largest tile size to consider (px). */
    maxTile?: number;
}

export interface TileSizeCandidate {
    size: number;
    /** coverage × peakRatio, combined over both axes (higher = better). */
    score: number;
}

export interface TileSizeResult {
    /** Best grid size, or null when no periodic grid is confidently detected. */
    tile_size: number | null;
    /** 0-100. >=50 means a grid was detected (tile_size non-null). */
    confidence: number;
    /** All tested sizes, ranked by score (descending). candidates[0] is the winner. */
    candidates: TileSizeCandidate[];
}

const EPS = 1e-9;
/** Confidence at/above which a detection is trusted (tile_size non-null). */
const CONFIDENCE_FLOOR = 50;

/** Sum of absolute RGBA channel deltas between two pixels at offsets i, j. */
function pixelDelta(d: Uint8ClampedArray | number[], i: number, j: number): number {
    return (
        Math.abs(d[i] - d[j]) +
        Math.abs(d[i + 1] - d[j + 1]) +
        Math.abs(d[i + 2] - d[j + 2]) +
        Math.abs(d[i + 3] - d[j + 3])
    );
}

/** Per-column edge profile: edges[x] = Σ_y delta(pixel(x,y), pixel(x-1,y)). */
function columnEdges(img: ImageRGBA): number[] {
    const { data, width, height } = img;
    const edges = new Array<number>(width).fill(0);
    for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 1; x < width; x++) {
            edges[x] += pixelDelta(data, (row + x) * 4, (row + x - 1) * 4);
        }
    }
    return edges;
}

/** Per-row edge profile: edges[y] = Σ_x delta(pixel(x,y), pixel(x,y-1)). */
function rowEdges(img: ImageRGBA): number[] {
    const { data, width, height } = img;
    const edges = new Array<number>(height).fill(0);
    for (let y = 1; y < height; y++) {
        const row = y * width;
        const prev = (y - 1) * width;
        for (let x = 0; x < width; x++) {
            edges[y] += pixelDelta(data, (row + x) * 4, (prev + x) * 4);
        }
    }
    return edges;
}

/** coverage + peakRatio of period `s` over an edge profile of length `len`
 * (lines 1..len-1 are interior; line 0 and `len` are the sheet border). */
function axisStats(edges: number[], len: number, s: number): { coverage: number; peakRatio: number } {
    let sumAll = 0;
    for (let x = 1; x < len; x++) sumAll += edges[x];
    if (sumAll <= EPS) return { coverage: 0, peakRatio: 0 };

    let sumSampled = 0;
    let nSampled = 0;
    for (let k = 1; k * s < len; k++) {
        sumSampled += edges[k * s];
        nSampled++;
    }
    if (nSampled === 0) return { coverage: 0, peakRatio: 0 };

    const meanAll = sumAll / (len - 1);
    const meanSampled = sumSampled / nSampled;
    return { coverage: sumSampled / sumAll, peakRatio: meanSampled / meanAll };
}

/** Candidate sizes that tile the sheet cleanly with at least 2 tiles per axis. */
function candidateSizes(width: number, height: number, minTile: number, maxTile: number): number[] {
    const sizes: number[] = [];
    const hi = Math.min(maxTile, Math.floor(width / 2), Math.floor(height / 2));
    for (let s = minTile; s <= hi; s++) {
        if (width % s === 0 && height % s === 0) sizes.push(s);
    }
    return sizes;
}

export function detectTileSize(img: ImageRGBA, options: TileSizeOptions = {}): TileSizeResult {
    const minTile = options.minTile ?? 8;
    const maxTile = options.maxTile ?? 128;
    const { width, height } = img;

    const sizes = candidateSizes(width, height, minTile, maxTile);
    if (sizes.length === 0) return { tile_size: null, confidence: 0, candidates: [] };

    const cols = columnEdges(img);
    const rows = rowEdges(img);

    const scored = sizes.map((size) => {
        const c = axisStats(cols, width, size);
        const r = axisStats(rows, height, size);
        const colScore = c.coverage * c.peakRatio;
        const rowScore = r.coverage * r.peakRatio;
        return {
            size,
            score: Math.min(colScore, rowScore),
            coverage: Math.min(c.coverage, r.coverage),
            peakRatio: Math.min(c.peakRatio, r.peakRatio),
        };
    });
    scored.sort((a, b) => b.score - a.score);

    const winner = scored[0];
    // peakRatio is normalized against a "clear grid" reference of ~10× the mean.
    const confidence = Math.round(
        100 *
            Math.max(0, Math.min(1, winner.coverage)) *
            Math.max(0, Math.min(1, (winner.peakRatio - 1) / 9)),
    );

    return {
        tile_size: confidence >= CONFIDENCE_FLOOR ? winner.size : null,
        confidence,
        candidates: scored.map(({ size, score }) => ({ size, score })),
    };
}
