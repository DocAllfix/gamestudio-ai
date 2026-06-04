/**
 * D.3 Consistency Manager — [2-W1] GATE.
 *
 * The gate is SOFT_LOCK_COUNT_MAX = 0: any soft-lock makes the plan
 * invalid. Two soft-lock sources are covered:
 *   1. a directed gating cycle (caught by findDirectedGatingCycle), and
 *   2. an item-gated node the player can never satisfy (unreachable).
 * A fully reachable graph yields zero soft-locks and valid === true.
 */
import { describe, expect, it } from "vitest";

import {
    ConsistencyManagerOutputSchema,
    type ConsistencyManagerInput,
} from "../../contracts/reasoning-engine.contract.js";
import { type GameGraph } from "../../contracts/game-graph.contract.js";
import { consistencyManager } from "../consistency.js";

function input(world_graph: GameGraph): ConsistencyManagerInput {
    return { world_graph, dialogues: [] };
}

/** Reachable: start → mid → boss, all gates satisfiable. */
const validGraph: GameGraph = {
    nodes: [
        { id: "start", display_name: "Start", requires: [], grants: ["key"], tags: [] },
        { id: "mid", display_name: "Mid", requires: [], grants: [], tags: [] },
        { id: "boss", display_name: "Boss", requires: ["key"], grants: [], tags: [] },
    ],
    edges: [
        { from: "start", to: "mid", requires: [], bidirectional: true },
        { from: "mid", to: "boss", requires: [], bidirectional: true },
    ],
    entry_node_id: "start",
    starting_inventory: [],
};

/** Unreachable: "vault" needs "gold_key", which no node ever grants. */
const unreachableGraph: GameGraph = {
    nodes: [
        { id: "start", display_name: "Start", requires: [], grants: [], tags: [] },
        { id: "vault", display_name: "Vault", requires: ["gold_key"], grants: [], tags: [] },
    ],
    edges: [{ from: "start", to: "vault", requires: [], bidirectional: true }],
    entry_node_id: "start",
    starting_inventory: [],
};

/** Directed gating cycle: a → b → a via one-way no-requires edges. */
const cyclicGraph: GameGraph = {
    nodes: [
        { id: "start", display_name: "Start", requires: [], grants: [], tags: [] },
        { id: "a", display_name: "A", requires: [], grants: [], tags: [] },
        { id: "b", display_name: "B", requires: [], grants: [], tags: [] },
    ],
    edges: [
        { from: "start", to: "a", requires: [], bidirectional: true },
        { from: "a", to: "b", requires: [], bidirectional: false },
        { from: "b", to: "a", requires: [], bidirectional: false },
    ],
    entry_node_id: "start",
    starting_inventory: [],
};

describe("D.3 ConsistencyManager.validate", () => {
    it("flags an unreachable item-gated node as a soft-lock (valid=false)", async () => {
        const out = await consistencyManager.validate(input(unreachableGraph));
        expect(out.soft_locks.length).toBeGreaterThan(0);
        expect(out.valid).toBe(false);
    });

    it("flags a directed gating cycle as a soft-lock (valid=false)", async () => {
        const out = await consistencyManager.validate(input(cyclicGraph));
        expect(out.soft_locks.length).toBeGreaterThan(0);
        expect(out.valid).toBe(false);
    });

    it("passes a fully reachable graph: zero soft-locks, valid=true", async () => {
        const out = await consistencyManager.validate(input(validGraph));
        expect(out.soft_locks.length).toBe(0);
        expect(out.valid).toBe(true);
    });

    it("reports the missing items on a soft-locked node", async () => {
        const out = await consistencyManager.validate(input(unreachableGraph));
        const vault = out.soft_locks.find((s) => s.from_node_id === "vault");
        expect(vault?.missing_items).toContain("gold_key");
    });

    it("round-trips the output through its contract", async () => {
        const out = await consistencyManager.validate(input(validGraph));
        expect(() =>
            ConsistencyManagerOutputSchema.parse(out),
        ).not.toThrow();
    });
});
