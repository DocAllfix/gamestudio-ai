/**
 * Heightmap noise — simplex-noise (v4) wrapped for seeded, multi-octave terrain.
 *
 * createNoise2D(random) takes a [0,1) RNG; we feed it a seeded mulberry32 so the
 * same seed always yields the same terrain (deterministic regen, like the 2D
 * tools). Pure compute, in-process — no Python, no subprocess.
 */
import { createNoise2D } from "simplex-noise";

/** Seeded PRNG (mulberry32): tiny, deterministic, good enough for terrain. */
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export interface HeightmapSpec {
    width: number;
    height: number;
    seed: number;
    /** Number of noise layers summed; more = more detail. */
    octaves: number;
    /** Base feature size; larger = smoother, broader features. */
    scale: number;
    /** Per-octave amplitude falloff (0..1). */
    persistence: number;
}

/**
 * Generate a normalized [0,1] heightmap (row-major, height[y][x]) via summed
 * octaves of 2D simplex noise.
 */
export function generateHeightmap(spec: HeightmapSpec): number[][] {
    const noise2D = createNoise2D(mulberry32(spec.seed));
    const { width, height } = spec;
    const octaves = Math.max(1, Math.min(spec.octaves, 8));
    const scale = Math.max(1, spec.scale);
    const persistence = Math.min(Math.max(spec.persistence, 0), 1);

    const out: number[][] = [];
    let min = Infinity;
    let max = -Infinity;

    for (let y = 0; y < height; y++) {
        const row: number[] = [];
        for (let x = 0; x < width; x++) {
            let amplitude = 1;
            let frequency = 1 / scale;
            let value = 0;
            for (let o = 0; o < octaves; o++) {
                value += noise2D(x * frequency, y * frequency) * amplitude;
                amplitude *= persistence;
                frequency *= 2;
            }
            row.push(value);
            if (value < min) min = value;
            if (value > max) max = value;
        }
        out.push(row);
    }

    // Normalize to [0,1].
    const range = max - min || 1;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            out[y]![x] = (out[y]![x]! - min) / range;
        }
    }
    return out;
}

/**
 * Derive a walkable mask from a heightmap: cells with height in [waterLevel,
 * peakLevel] are traversable land (below = water, above = impassable peaks).
 * This is what the 3D reachability check projects onto.
 */
export function walkableFromHeightmap(
    heightmap: number[][],
    waterLevel = 0.3,
    peakLevel = 0.85,
): boolean[][] {
    return heightmap.map((row) => row.map((h) => h >= waterLevel && h <= peakLevel));
}
