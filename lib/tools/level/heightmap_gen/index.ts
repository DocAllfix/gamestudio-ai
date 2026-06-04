/**
 * heightmap_gen — procedural 3D terrain via seeded multi-octave simplex noise.
 *
 * In-process (simplex-noise, no Python/subprocess). Emits the heightmap as a
 * JSON file in tool_outputs for the 3D code_gen tools (Three/Babylon/Godot turn
 * it into a mesh/terrain). QA: assert the terrain has SOME walkable land (not
 * all water / all peaks) so a 3D level built on it is traversable.
 */
import type { ToolInvocation } from "../../../contracts/tool-registry.contract.js";
import { makeResult, type Tool } from "../../_shared.js";
import { generateHeightmap, walkableFromHeightmap } from "../_noise.js";
import { HeightmapGenInputSchema, type HeightmapGenOutput } from "./schema.js";

const heightmapPath = (nodeId: string) => `/project/assets/terrain/${nodeId}.heightmap.json`;

async function handler(invocation: ToolInvocation) {
    const start = Date.now();
    const input = HeightmapGenInputSchema.parse({
        ...invocation.input,
        project_id: invocation.project_id,
        plan_version: invocation.plan_version,
        trace_id: invocation.trace_id,
    });
    const tool = { tool_id: "heightmap_gen" as const, node_id: invocation.node_id, trace_id: invocation.trace_id };

    const seed = input.seed ?? Math.abs(hashStr(invocation.node_id));
    const heightmap = generateHeightmap({
        width: input.width, height: input.height, seed,
        octaves: input.octaves, scale: input.scale, persistence: input.persistence,
    });

    // QA: terrain must have a meaningful amount of walkable land.
    const walkable = walkableFromHeightmap(heightmap);
    const total = input.width * input.height;
    const land = walkable.reduce((acc, row) => acc + row.filter(Boolean).length, 0);
    const ratio = land / total;
    const hasLand = ratio >= 0.15; // at least 15% traversable

    const files = [{ path: heightmapPath(invocation.node_id), content: JSON.stringify({ width: input.width, height: input.height, heightmap }), encoding: "utf-8" as const }];
    const output: HeightmapGenOutput = {
        trace_id: invocation.trace_id, cost_usd: 0, latency_ms: Date.now() - start,
        qa_log: [], width: input.width, height: input.height, heightmap, files,
    };
    return makeResult({
        invocation: tool,
        output: hasLand ? output : null,
        qa_log: [{ check: "has_walkable_land", passed: hasLand, detail: `land ratio ${ratio.toFixed(2)}` }],
        latency_ms: Date.now() - start,
    });
}

function hashStr(s: string): number {
    let h = 0;
    for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return h;
}

const descriptor: Tool = {
    id: "heightmap_gen",
    name: "Heightmap Generator",
    description: "Procedural 3D terrain heightmap (seeded multi-octave simplex noise), in-process.",
    category: "level",
    inputSchema: HeightmapGenInputSchema,
    outputSchema: HeightmapGenInputSchema, // metadata only; real output schema in schema.ts
    estimatedCostUsd: 0,
    estimatedDurationSeconds: 2,
    handler,
};
export default descriptor;
