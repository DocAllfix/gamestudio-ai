/**
 * level_layout_3d — expands a world-graph node into a 3D terrain layout.
 *
 * Generates a heightmap (via the same simplex-noise core as heightmap_gen),
 * derives a walkable land mask, places spawn/exit + required-grant slots on
 * walkable cells, and verifies reachability with the SAME 2D A* moat projected
 * onto the terrain's walkable mask. Emits the layout as a JSON file the 3D
 * code_gen tools (Three/Babylon/Godot) turn into mesh + nav.
 */
import type { ToolInvocation } from "../../../contracts/tool-registry.contract.js";
import type { GameGraphNode } from "../../../contracts/game-graph.contract.js";
import { makeResult, type QaLog, type Tool } from "../../_shared.js";
import { generateHeightmap, walkableFromHeightmap } from "../_noise.js";
import { isReachable, reachableCells, type Point } from "../_reachability.js";
import { LevelLayout3dInputSchema, Layout3dSchema } from "./schema.js";
import type { Layout3d, LevelLayout3dOutput } from "./schema.js";

const MAX_REGEN = 3;
const layoutPath = (nodeId: string) => `/project/assets/terrain/${nodeId}.layout3d.json`;

function dims(size: "s" | "m" | "l"): { width: number; height: number } {
    return size === "s" ? { width: 32, height: 32 } : size === "l" ? { width: 96, height: 96 } : { width: 64, height: 64 };
}

function hashStr(s: string): number {
    let h = 0;
    for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return Math.abs(h);
}

/** First walkable cell scanning from a corner — a stable spawn/exit anchor. */
function firstWalkable(mask: boolean[][], fromEnd = false): Point {
    const ys = fromEnd ? [...mask.keys()].reverse() : [...mask.keys()];
    for (const y of ys) {
        const row = mask[y]!;
        const xs = fromEnd ? [...row.keys()].reverse() : [...row.keys()];
        for (const x of xs) if (row[x]) return { x, y };
    }
    return { x: 0, y: 0 };
}

async function handler(invocation: ToolInvocation) {
    const start = Date.now();
    const input = LevelLayout3dInputSchema.parse({
        ...invocation.input,
        project_id: invocation.project_id,
        plan_version: invocation.plan_version,
        trace_id: invocation.trace_id,
    });
    const tool = { tool_id: "level_layout_3d" as const, node_id: invocation.node_id, trace_id: invocation.trace_id };
    const node = input.node as GameGraphNode;
    const { width, height } = dims(input.size);
    const baseSeed = input.seed ?? hashStr(node.id);
    const qa_log: QaLog = [];

    let layout: Layout3d | null = null;
    for (let attempt = 1; attempt <= MAX_REGEN; attempt++) {
        const seed = baseSeed + attempt;
        const heightmap = generateHeightmap({ width, height, seed, octaves: 4, scale: 24, persistence: 0.5 });
        const walkable = walkableFromHeightmap(heightmap);
        const spawn = firstWalkable(walkable, false);
        const exit = firstWalkable(walkable, true);

        // required slots on reachable walkable cells (spread across the terrain)
        const reached = reachableCells(walkable, spawn);
        const reachedList = [...reached].map((k) => { const [x, y] = k.split(",").map(Number); return { x: x!, y: y! }; });
        const entity_slots = node.grants.map((grant, i) => {
            const p = reachedList[Math.floor(((i + 1) / (node.grants.length + 1)) * reachedList.length)] ?? spawn;
            return { id: `pickup_${grant}`, kind: "pickup" as const, x: p.x, y: p.y, required: true, grants: [grant] };
        });

        layout = {
            node_id: node.id, width, height, heightmap, walkable, entity_slots, spawn, exit,
            meta: { genre: input.genre, biome: input.biome, seed },
        };

        const goals: Point[] = [exit, ...entity_slots.map((s) => ({ x: s.x, y: s.y }))];
        const reachable = isReachable(walkable, spawn, goals);
        qa_log.push({ check: `terrain_reachable_attempt_${attempt}`, passed: reachable, detail: reachable ? null : "spawn cannot reach exit/required slots" });
        if (reachable) break;
    }

    const ok = qa_log[qa_log.length - 1]?.passed ?? false;
    const files = layout ? [{ path: layoutPath(node.id), content: JSON.stringify(layout), encoding: "utf-8" as const }] : [];
    const output: LevelLayout3dOutput = {
        trace_id: invocation.trace_id, cost_usd: 0, latency_ms: Date.now() - start,
        qa_log: [], layout: Layout3dSchema.parse(layout), files,
    };
    return makeResult({
        invocation: tool,
        output: ok ? output : null,
        qa_log,
        latency_ms: Date.now() - start,
    });
}

const descriptor: Tool = {
    id: "level_layout_3d",
    name: "3D Level Layout",
    description: "Expands a node into a 3D terrain layout (heightmap + walkable nav + slots), reachability-verified.",
    category: "level",
    inputSchema: LevelLayout3dInputSchema,
    outputSchema: Layout3dSchema,
    estimatedCostUsd: 0,
    estimatedDurationSeconds: 3,
    handler,
};
export default descriptor;
