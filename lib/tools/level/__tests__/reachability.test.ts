/**
 * Reachability moat — unit tests on hand-built known grids.
 *
 * This is the anti-break guarantee's foundation: it must be infallible. No
 * mocks, no deps — pure boolean-grid assertions.
 */
import { describe, expect, it } from "vitest";

import {
    isReachable,
    reachableCells,
    unreachableGoals,
    type WalkableGrid,
} from "../_reachability.js";

/** Build a WalkableGrid from rows of chars: '.' walkable, '#' wall. */
function grid(rows: string[]): WalkableGrid {
    return rows.map((r) => [...r].map((c) => c === "."));
}

describe("reachability — isReachable", () => {
    it("true when an open path connects entry to exit", () => {
        const g = grid([
            ".....",
            ".###.",
            ".....",
        ]);
        // entry top-left, exit bottom-right — path around the wall block
        expect(isReachable(g, { x: 0, y: 0 }, [{ x: 4, y: 2 }])).toBe(true);
    });

    it("false when a wall fully separates entry from a required goal", () => {
        const g = grid([
            "..#..",
            "..#..",
            "..#..",
        ]);
        // left region (x<2) cannot reach right region (x>2)
        expect(isReachable(g, { x: 0, y: 0 }, [{ x: 4, y: 2 }])).toBe(false);
    });

    it("false when a goal sits on a non-walkable cell", () => {
        const g = grid([
            ".....",
            ".....",
        ]);
        expect(isReachable(g, { x: 0, y: 0 }, [{ x: 2, y: 0 }])).toBe(true);
        // place an impossible goal: wall it off
        const walled = grid([
            ".....",
            "..#..",
        ]);
        expect(isReachable(walled, { x: 0, y: 0 }, [{ x: 2, y: 1 }])).toBe(false);
    });

    it("false when the start itself is on a wall", () => {
        const g = grid([
            "#....",
            ".....",
        ]);
        expect(isReachable(g, { x: 0, y: 0 }, [{ x: 4, y: 1 }])).toBe(false);
    });

    it("requires ALL goals reachable (multi-goal)", () => {
        const g = grid([
            "....#.",
            ".####.",
            "......",
        ]);
        // both goals reachable via the bottom row
        expect(
            isReachable(g, { x: 0, y: 0 }, [
                { x: 5, y: 0 },
                { x: 2, y: 2 },
            ]),
        ).toBe(true);
    });

    it("no diagonal squeeze: a diagonal gap is NOT a path", () => {
        const g = grid([
            ".#",
            "#.",
        ]);
        // (0,0) and (1,1) touch only diagonally → not reachable
        expect(isReachable(g, { x: 0, y: 0 }, [{ x: 1, y: 1 }])).toBe(false);
    });

    it("empty goals → reachable iff start is walkable", () => {
        const g = grid(["...", "..."]);
        expect(isReachable(g, { x: 0, y: 0 }, [])).toBe(true);
        const w = grid(["#..", "..."]);
        expect(isReachable(w, { x: 0, y: 0 }, [])).toBe(false);
    });
});

describe("reachability — diagnostics", () => {
    it("reachableCells returns the connected component of the start", () => {
        const g = grid([
            "..#",
            "..#",
        ]);
        const reached = reachableCells(g, { x: 0, y: 0 });
        expect(reached.has("0,0")).toBe(true);
        expect(reached.has("1,1")).toBe(true);
        expect(reached.has("2,0")).toBe(false); // walled off
    });

    it("unreachableGoals lists exactly the blocked goals", () => {
        const g = grid([
            "..#..",
            "..#..",
        ]);
        const blocked = unreachableGoals(g, { x: 0, y: 0 }, [
            { x: 1, y: 1 }, // reachable
            { x: 4, y: 0 }, // walled off
        ]);
        expect(blocked).toEqual([{ x: 4, y: 0 }]);
    });
});
