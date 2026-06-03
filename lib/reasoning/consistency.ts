/**
 * D.3 Consistency Manager (PARTE D.3) — the soft-lock GATE.
 *
 * A soft-lock is a world state the player cannot escape or a node they
 * can never legally enter. The gate is SOFT_LOCK_COUNT_MAX (= 0): any
 * soft-lock fails validation.
 *
 * Two detectors run, cheapest first:
 *   1. findDirectedGatingCycle — a directed, no-requires gating cycle is
 *      a guaranteed soft-lock loop (the contract helper). Fast pre-filter.
 *   2. Item-aware reachability — a fixed-point BFS from entry_node_id
 *      with starting_inventory, accumulating `grants` as nodes are
 *      reached, respecting node `requires` and edge `requires`. Any node
 *      never reached is a soft-lock; its `missing_items` are the gate
 *      items it lacked.
 *
 * The ASP/clingo solve named in the blueprint is a later upgrade; this
 * reachability fixed point catches the day-1 soft-lock classes the gate
 * must reject (unreachable item gates + directed cycles).
 */
import {
    type ConsistencyManager,
    type ConsistencyManagerInput,
    type ConsistencyManagerOutput,
    ConsistencyManagerInputSchema,
} from "../contracts/reasoning-engine.contract.js";
import {
    type GameGraph,
    findDirectedGatingCycle,
} from "../contracts/game-graph.contract.js";
import { SOFT_LOCK_COUNT_MAX } from "../contracts/evaluation-metrics.contract.js";

type SoftLock = ConsistencyManagerOutput["soft_locks"][number];

/** Items satisfiable from a given inventory. */
function satisfied(requires: readonly string[], inventory: Set<string>): boolean {
    return requires.every((item) => inventory.has(item));
}

/** Fixed-point reachability: returns the set of reachable node ids given
 * inventory growth from `grants`. Re-runs until no new node is added,
 * because picking up an item can unlock a previously blocked gate. */
function reachableNodes(graph: GameGraph): Set<string> {
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    const inventory = new Set<string>(graph.starting_inventory);
    const reached = new Set<string>();

    const entry = nodeById.get(graph.entry_node_id);
    if (entry && satisfied(entry.requires, inventory)) {
        reached.add(entry.id);
        for (const item of entry.grants) inventory.add(item);
    }

    let changed = true;
    while (changed) {
        changed = false;
        for (const edge of graph.edges) {
            const directions: Array<[string, string]> = edge.bidirectional
                ? [[edge.from, edge.to], [edge.to, edge.from]]
                : [[edge.from, edge.to]];
            for (const [from, to] of directions) {
                if (!reached.has(from)) continue;
                if (reached.has(to)) continue;
                const target = nodeById.get(to);
                if (!target) continue;
                if (!satisfied(edge.requires, inventory)) continue;
                if (!satisfied(target.requires, inventory)) continue;
                reached.add(to);
                for (const item of target.grants) inventory.add(item);
                changed = true;
            }
        }
    }
    return reached;
}

export const consistencyManager: ConsistencyManager = {
    async validate(
        rawInput: ConsistencyManagerInput,
    ): Promise<ConsistencyManagerOutput> {
        const input = ConsistencyManagerInputSchema.parse(rawInput);
        const graph = input.world_graph;

        const softLocks: SoftLock[] = [];

        // 1. Directed gating cycle — a guaranteed soft-lock loop.
        const cycle = findDirectedGatingCycle(graph);
        if (cycle.length > 0) {
            softLocks.push({ from_node_id: cycle[0]!, missing_items: [] });
        }

        // 2. Unreachable nodes — report the gate items they lacked.
        const reached = reachableNodes(graph);
        for (const node of graph.nodes) {
            if (reached.has(node.id)) continue;
            softLocks.push({
                from_node_id: node.id,
                missing_items: node.requires,
            });
        }

        return {
            valid: softLocks.length <= SOFT_LOCK_COUNT_MAX,
            soft_locks: softLocks,
            corrections: [],
        };
    },
};
