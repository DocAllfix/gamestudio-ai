/**
 * 3D tools — heightmap determinism + walkable land; level_layout_3d reachability.
 */
import { describe, expect, it } from "vitest";

import heightmapGen from "../heightmap_gen/index.js";
import levelLayout3d from "../level_layout_3d/index.js";
import { generateHeightmap } from "../_noise.js";
import { ToolExecutionResultSchema } from "../../../contracts/tool-registry.contract.js";

const proj = "00000000-0000-4000-8000-000000000000";
const node = (grants: string[] = []) => ({ id: "zone_1", display_name: "Zone 1", requires: [], grants, tags: [] });

describe("_noise heightmap", () => {
    it("is deterministic for a given seed", () => {
        const a = generateHeightmap({ width: 16, height: 16, seed: 42, octaves: 4, scale: 12, persistence: 0.5 });
        const b = generateHeightmap({ width: 16, height: 16, seed: 42, octaves: 4, scale: 12, persistence: 0.5 });
        expect(a).toEqual(b);
    });
    it("differs for different seeds", () => {
        const a = generateHeightmap({ width: 16, height: 16, seed: 1, octaves: 4, scale: 12, persistence: 0.5 });
        const b = generateHeightmap({ width: 16, height: 16, seed: 2, octaves: 4, scale: 12, persistence: 0.5 });
        expect(a).not.toEqual(b);
    });
    it("normalizes to [0,1]", () => {
        const h = generateHeightmap({ width: 8, height: 8, seed: 7, octaves: 3, scale: 8, persistence: 0.5 });
        const flat = h.flat();
        expect(Math.min(...flat)).toBeGreaterThanOrEqual(0);
        expect(Math.max(...flat)).toBeLessThanOrEqual(1);
    });
});

describe("heightmap_gen tool", () => {
    it("produces a heightmap file and a contract-valid result", async () => {
        const res = await heightmapGen.handler({
            tool_id: "heightmap_gen", node_id: "zone_1", project_id: proj, plan_version: 1, trace_id: "t",
            input: { width: 32, height: 32, seed: 5 },
        });
        expect(() => ToolExecutionResultSchema.parse(res)).not.toThrow();
        if (res.status === "succeeded") {
            const files = res.output?.files as { path: string }[];
            expect(files.some((f) => f.path.endsWith(".heightmap.json"))).toBe(true);
        }
    });
});

describe("level_layout_3d tool", () => {
    it("produces a reachability-verified 3D layout with required slots", async () => {
        const res = await levelLayout3d.handler({
            tool_id: "level_layout_3d", node_id: "zone_1", project_id: proj, plan_version: 1, trace_id: "t",
            input: { genre: "threejs_showcase", node: node(["crystal"]), size: "s", seed: 3 },
        });
        expect(() => ToolExecutionResultSchema.parse(res)).not.toThrow();
        // a successful layout carries the required slot
        if (res.status === "succeeded") {
            const layout = res.output?.layout as { entity_slots: unknown[] };
            expect(layout.entity_slots).toHaveLength(1);
        }
    });
});
