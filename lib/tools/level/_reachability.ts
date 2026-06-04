/**
 * Reachability — the anti-break moat for generated maps.
 *
 * Pure, synchronous, zero-dependency BFS over a walkable grid. Every map-gen
 * tool (level_layout_2d, tilemap_populate, entity_placement, level_layout_3d)
 * runs `isReachable(grid, entry, [exit, ...requiredSlots])` and records the
 * result as a qa_log check. A failed check makes `makeResult` derive
 * `rejected_by_qa`, which drives the verify-and-regenerate loop.
 *
 * Why BFS and not A*: for a boolean "can you get from A to every goal" check on
 * an unweighted grid, BFS is optimal, simpler, and impossible to get subtly
 * wrong (no heuristic). We keep it dependency-free on purpose — this is the
 * moat's critical path, it must be rock-solid and trivially unit-testable.
 * (easystar.js was rejected: stale 2020 + callback/async, awkward in a sync QA.)
 */

/** Row-major boolean grid: grid[y][x] === true means the cell is walkable. */
export type WalkableGrid = boolean[][];

export interface Point {
    x: number;
    y: number;
}

function inBounds(grid: WalkableGrid, x: number, y: number): boolean {
    return y >= 0 && y < grid.length && x >= 0 && x < (grid[y]?.length ?? 0);
}

function isWalkable(grid: WalkableGrid, x: number, y: number): boolean {
    return inBounds(grid, x, y) && grid[y]![x] === true;
}

const KEY = (x: number, y: number): string => `${x},${y}`;

/**
 * Returns the set of grid cells reachable from `start` via 4-directional
 * movement over walkable cells. Cells are encoded as "x,y" strings.
 */
export function reachableCells(grid: WalkableGrid, start: Point): Set<string> {
    const visited = new Set<string>();
    if (!isWalkable(grid, start.x, start.y)) {
        return visited;
    }
    const queue: Point[] = [start];
    visited.add(KEY(start.x, start.y));

    while (queue.length > 0) {
        const { x, y } = queue.shift()!;
        // 4-neighbourhood (orthogonal). Diagonal movement is intentionally
        // excluded: most tile games block diagonal squeezes, and excluding it
        // means a "reachable" verdict never over-promises.
        const neighbours: Point[] = [
            { x: x + 1, y },
            { x: x - 1, y },
            { x, y: y + 1 },
            { x, y: y - 1 },
        ];
        for (const n of neighbours) {
            const k = KEY(n.x, n.y);
            if (!visited.has(k) && isWalkable(grid, n.x, n.y)) {
                visited.add(k);
                queue.push(n);
            }
        }
    }
    return visited;
}

/**
 * The moat check: is EVERY goal reachable from `start` over walkable cells?
 * Used as a qa_log assertion. Returns false if start or any goal is on a
 * non-walkable cell, or if any goal is in a disconnected region.
 */
export function isReachable(grid: WalkableGrid, start: Point, goals: readonly Point[]): boolean {
    if (goals.length === 0) {
        return isWalkable(grid, start.x, start.y);
    }
    const reached = reachableCells(grid, start);
    return goals.every((g) => isWalkable(grid, g.x, g.y) && reached.has(KEY(g.x, g.y)));
}

/**
 * Diagnostic variant: returns which goals are unreachable, for qa_log detail
 * and for the regenerate loop to log what failed.
 */
export function unreachableGoals(
    grid: WalkableGrid,
    start: Point,
    goals: readonly Point[],
): Point[] {
    const reached = reachableCells(grid, start);
    return goals.filter((g) => !isWalkable(grid, g.x, g.y) || !reached.has(KEY(g.x, g.y)));
}
