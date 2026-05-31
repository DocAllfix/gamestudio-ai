/**
 * Game Graph Contract — the world state graph of a generated game.
 *
 * A Game Graph encodes WHERE the player can go, WHAT they can do at
 * each node, and WHAT prevents them from progressing. The Consistency
 * Manager (D.3, owned by W1) ASP-validates this structure before the
 * game ships; the Asset Resolver (D.5, owned by W2) uses it to pick
 * environment assets per node.
 *
 * The graph is intentionally minimal — Pietra v5 §1-BIS.2 documents
 * how downstream tools (level_layout_2d, tilemap_populate) expand each
 * node into the actual playable space.
 */
import { z } from "zod";

/** A discrete location, scene or "screen" in the game.
 *
 * `tags` carry the semantic affordances the Asset Resolver matches on
 * (e.g. ["crystal_cave", "underground", "blue_palette"]). They are NOT
 * a free-text dump — Asset Resolver throws on tags unknown to the
 * taxonomy, so prefer the shared taxonomy taxonomies from the KB. */
export const GameGraphNodeSchema = z.object({
    id: z.string().min(1).regex(/^[a-z0-9_]+$/, {
        message: "node id must be lowercase snake_case",
    }),
    display_name: z.string().min(1),
    /** Items the player must hold to ENTER this node. Empty array =
     * unconditionally reachable from any connected edge. */
    requires: z.array(z.string()).default([]),
    /** Items, lore fragments or abilities the player can OBTAIN here. */
    grants: z.array(z.string()).default([]),
    /** Semantic tags used by D.5 Asset Resolver + D.4 Balance Controller.
     * Keep concise — the LLM does not need 50 tags per node. */
    tags: z.array(z.string()).max(15).default([]),
    /** Optional 1-2 line description. The Intent Interpreter writes
     * this; surfaced verbatim in the Studio Mode UI. */
    description: z.string().max(500).optional(),
});
export type GameGraphNode = z.infer<typeof GameGraphNodeSchema>;

/** A directed transition between two nodes. The graph is a directed
 * multigraph (more than one edge between the same pair is allowed,
 * e.g. one-way drops vs two-way doors). */
export const GameGraphEdgeSchema = z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    /** Items required to traverse this edge. Empty = always traversable. */
    requires: z.array(z.string()).default([]),
    /** Whether the edge can be traversed in the reverse direction too.
     * Defaults to true; one-way drops set this to false. */
    bidirectional: z.boolean().default(true),
    /** Human-readable label for the Studio Mode UI ("ladder up",
     * "secret passage"). Optional. */
    label: z.string().max(60).optional(),
});
export type GameGraphEdge = z.infer<typeof GameGraphEdgeSchema>;

/** The full Game Graph: nodes + edges + the entry node + the starting
 * inventory. The entry node is the spawn point at game start. */
export const GameGraphSchema = z
    .object({
        nodes: z.array(GameGraphNodeSchema).min(1).max(200),
        edges: z.array(GameGraphEdgeSchema).max(800),
        entry_node_id: z.string().min(1),
        /** Items the player starts with. Usually empty. */
        starting_inventory: z.array(z.string()).default([]),
    })
    .superRefine((graph, ctx) => {
        // Validate node id uniqueness — duplicate ids would silently
        // collapse onto each other when the runtime serialises the
        // graph for D.3 ASP solving. Better to catch here.
        const ids = new Set<string>();
        for (const node of graph.nodes) {
            if (ids.has(node.id)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `duplicate node id "${node.id}"`,
                });
            }
            ids.add(node.id);
        }

        if (!ids.has(graph.entry_node_id)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `entry_node_id "${graph.entry_node_id}" not in nodes`,
            });
        }

        // Validate every edge references existing nodes.
        for (const edge of graph.edges) {
            if (!ids.has(edge.from)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `edge.from "${edge.from}" not in nodes`,
                });
            }
            if (!ids.has(edge.to)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: `edge.to "${edge.to}" not in nodes`,
                });
            }
        }
    });
export type GameGraph = z.infer<typeof GameGraphSchema>;

// ---- Helpers -------------------------------------------------------------

/** Pure cycle check on the DIRECTED gating subgraph — only one-way
 * edges with empty `requires` count. Used by D.3 Consistency Manager
 * as a fast pre-filter before the full ASP soft-lock solve runs.
 *
 * Bidirectional edges (doors, corridors) are deliberately ignored:
 * they form trivial 2-cycles by definition and are not a soft-lock
 * signal. The full ASP pass in D.3 considers inventory state across
 * traversals — that is where directional cycles need item-aware
 * analysis. This helper only catches the directed-no-requires case
 * which is a guaranteed soft-lock loop.
 *
 * Returns the IDs participating in a cycle, or empty list otherwise. */
export function findDirectedGatingCycle(graph: GameGraph): string[] {
    const adjacency = new Map<string, string[]>();
    for (const node of graph.nodes) {
        adjacency.set(node.id, []);
    }
    for (const edge of graph.edges) {
        if (edge.requires.length === 0 && !edge.bidirectional) {
            adjacency.get(edge.from)!.push(edge.to);
        }
    }

    const visited = new Set<string>();
    const onStack = new Set<string>();
    const cyclePath: string[] = [];

    function dfs(nodeId: string): boolean {
        if (onStack.has(nodeId)) {
            cyclePath.push(nodeId);
            return true;
        }
        if (visited.has(nodeId)) return false;
        visited.add(nodeId);
        onStack.add(nodeId);
        for (const next of adjacency.get(nodeId) ?? []) {
            if (dfs(next)) {
                cyclePath.push(nodeId);
                return true;
            }
        }
        onStack.delete(nodeId);
        return false;
    }

    for (const node of graph.nodes) {
        if (!visited.has(node.id) && dfs(node.id)) {
            return cyclePath.reverse();
        }
    }
    return [];
}
