/**
 * Sample platformer level (FASE 2 tracer bullet). Produces a `solid_tiles` grid
 * with PLATFORMER semantics — a solid floor + a staircase of platforms spaced
 * within reach — using jumpReachCells so every gap/rise is clearable by the
 * shared PhysicsProfile (the level assumes exactly what the controller does).
 *
 * This stands in for a platformer-aware level generator (the .tmj from
 * tilemap_populate is top-down semantics — floor-walkable/wall-blocking — which
 * is WRONG here: a platformer needs solid-to-stand-on vs air-to-fall-through).
 * The composer is agnostic to where solid_tiles came from.
 */
import { jumpReachCells, type PhysicsProfile } from "../../tools/level/_platformer-physics.js";

export interface SampleLevelArgs {
    width: number;
    height: number;
    tilePx: number;
    physics: PhysicsProfile;
}

export function buildPlatformerLevel(args: SampleLevelArgs): number[][] {
    const { width, height, tilePx, physics } = args;
    const { maxGapX, maxRiseY } = jumpReachCells(physics, tilePx);
    const grid: number[][] = Array.from({ length: height }, () => new Array<number>(width).fill(0));

    // Solid floor: the bottom two rows.
    for (let y = Math.max(0, height - 2); y < height; y++) {
        for (let x = 0; x < width; x++) grid[y][x] = 1;
    }

    // Ascending platforms, each a short solid run within jump reach of the last.
    const rise = Math.max(1, Math.min(maxRiseY, 3));
    const gap = Math.max(2, Math.min(maxGapX, 5));
    const platW = 4;
    let y = height - 2 - rise;
    let x = 6;
    while (y >= 3 && x + platW < width) {
        for (let i = 0; i < platW; i++) grid[y][x + i] = 1;
        y -= rise;
        x += platW + gap;
    }
    return grid;
}
