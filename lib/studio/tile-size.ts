/**
 * Tile-size detector — the INVERSE of the slicer (Studio enrichment, FASE 1).
 *
 * Given a tileset image it recovers the grid size (16/32/48…) the slicer/composer
 * needs (`tile_size` on the GameSpec asset slot — docs/FASE0_GAMESPEC_DESIGN.md §4).
 * Deterministic, zero-dependency, pure on RGBA (same contract as slicer/pixel-snap):
 * the caller decodes the PNG to {data,width,height}; this module owns the math.
 *
 * Method: AUTOCORRELATION of the edge profile. We build a per-column / per-row
 * EDGE profile (sum of neighbour colour deltas) and autocorrelate it; a tiled
 * sheet repeats its boundary pattern every `tile_size` pixels, so the normalized
 * autocorrelation has its first dominant peak at the tile size. Autocorrelation
 * is OFFSET-INVARIANT (the grid need not start at x=0, and a 1px gutter doesn't
 * break it) and robust to busy in-tile texture (interior detail is not periodic
 * at the tile scale), which a "boundary energy at multiples of s" heuristic is
 * not — real catalog tilesets are textured, not flat-colour blocks.
 *
 * A period is only scored on an axis that spans >=3 tiles (>=2 interior
 * boundaries), since autocorrelation needs repeats to mean anything; when both
 * axes are rich the square-tile period must agree on both (min), guarding
 * against 1-D stripes. Anti-hallucination: a non-grid image (single sprite,
 * gradient, textured illustration) has a weak peak → `tile_size: null` with low
 * `confidence`, plus the ranked candidates.
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
    /** Normalized autocorrelation at this period, combined over axes (0..1). */
    score: number;
}

export interface TileSizeResult {
    /** Best grid size, or null when no periodic grid is confidently detected. */
    tile_size: number | null;
    /** 0-100. >=CONFIDENCE_FLOOR means a grid was detected (tile_size non-null). */
    confidence: number;
    /** All tested sizes, ranked by score (descending). candidates[0] is the winner. */
    candidates: TileSizeCandidate[];
}

const EPS = 1e-9;
/** Confidence at/above which a detection is trusted. Calibrated against the real
 * catalog: clean synthetic grids score ~50-67, textured real tilesets ~30-50,
 * non-grid illustrations <25. */
const CONFIDENCE_FLOOR = 30;
/** Min tiles an axis must span for its autocorrelation to be meaningful. */
const MIN_TILES_RICH = 3;
/** A near-tie band: among periods within this fraction of the max score, prefer
 * the smallest (the fundamental, not a harmonic). */
const FUNDAMENTAL_BAND = 0.96;

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

/** Normalized autocorrelation of a profile for lags 0..maxLag (out[0]=1). */
function autocorrelation(e: number[], maxLag: number): Float64Array {
    const n = e.length;
    const out = new Float64Array(maxLag + 1);
    let mean = 0;
    for (let i = 0; i < n; i++) mean += e[i];
    mean /= n;
    const c = new Float64Array(n);
    let a0 = 0;
    for (let i = 0; i < n; i++) {
        c[i] = e[i] - mean;
        a0 += c[i] * c[i];
    }
    if (a0 <= EPS) return out; // flat signal — no structure
    for (let L = 0; L <= maxLag; L++) {
        let s = 0;
        for (let i = 0; i + L < n; i++) s += c[i] * c[i + L];
        out[L] = s / a0;
    }
    return out;
}

export function detectTileSize(img: ImageRGBA, options: TileSizeOptions = {}): TileSizeResult {
    const minTile = options.minTile ?? 8;
    const maxTile = options.maxTile ?? 128;
    const { width, height } = img;

    const hi = Math.min(maxTile, width - 1, height - 1);
    if (hi < minTile) return { tile_size: null, confidence: 0, candidates: [] };

    const aCol = autocorrelation(columnEdges(img), Math.min(maxTile, width - 1));
    const aRow = autocorrelation(rowEdges(img), Math.min(maxTile, height - 1));

    const scored: TileSizeCandidate[] = [];
    for (let L = minTile; L <= maxTile; L++) {
        const richCol = width / L >= MIN_TILES_RICH;
        const richRow = height / L >= MIN_TILES_RICH;
        const cv = L < aCol.length ? Math.max(0, aCol[L]) : -1;
        const rv = L < aRow.length ? Math.max(0, aRow[L]) : -1;

        let score: number;
        if (richCol && richRow) score = Math.min(cv, rv); // square tile: both axes agree
        else if (richCol) score = cv;
        else if (richRow) score = rv;
        else continue; // not enough tiles on either axis to trust a period
        scored.push({ size: L, score });
    }
    if (scored.length === 0) return { tile_size: null, confidence: 0, candidates: [] };

    scored.sort((a, b) => b.score - a.score);
    const maxScore = scored[0].score;
    // Among near-ties, prefer the fundamental (smallest period).
    const winner = scored
        .filter((c) => c.score >= maxScore * FUNDAMENTAL_BAND)
        .reduce((min, c) => (c.size < min.size ? c : min));

    const confidence = Math.round(100 * Math.max(0, Math.min(1, winner.score)));
    return {
        tile_size: confidence >= CONFIDENCE_FLOOR ? winner.size : null,
        confidence,
        candidates: scored,
    };
}
