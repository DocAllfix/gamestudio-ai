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

    // Platforms in a WAVE (up AND down), each a short solid run within jump reach
    // of the last — a balanced layout, not a one-way ascending staircase. Bounds
    // keep it between the top and just above the floor; direction flips at each.
    const rise = Math.max(1, Math.min(maxRiseY, 3));
    const gap = Math.max(2, Math.min(maxGapX, 5));
    const platW = 4;
    const top = 4;
    const bottomPlat = height - 4;
    let y = bottomPlat;
    let x = 6;
    let dir = -1; // start by going up
    while (x + platW < width - 4) {
        for (let i = 0; i < platW; i++) grid[y][x + i] = 1;
        let ny = y + dir * rise;
        if (ny < top) { ny = top; dir = 1; }
        if (ny > bottomPlat) { ny = bottomPlat; dir = -1; }
        y = ny;
        x += platW + gap;
    }
    return grid;
}

/** Sample top_down_grid level: a walled room (border walls + scattered interior
 * pillars). TOP-DOWN semantics — 1 = wall (blocks), 0 = walkable floor. The
 * player spawns on the floor and walks around the obstacles. */
export function buildTopDownRoom(args: { width: number; height: number }): number[][] {
    const { width, height } = args;
    const grid: number[][] = Array.from({ length: height }, () => new Array<number>(width).fill(0));
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
            const pillar = x % 9 === 5 && y % 6 === 4; // scattered interior obstacles
            if (border || pillar) grid[y][x] = 1;
        }
    }
    return grid;
}
