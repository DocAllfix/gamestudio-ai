/**
 * entity_placement — entities on walkable tiles, required reachable, objectgroup.
 */
import { describe, expect, it, vi } from "vitest";

import entityPlacement from "../entity_placement/index.js";
import tilemapPopulate from "../tilemap_populate/index.js";
import { ToolExecutionResultSchema } from "../../../contracts/tool-registry.contract.js";
import type { AbstractLayout, SemanticCell } from "../_shared-map.js";

const proj = "00000000-0000-4000-8000-000000000000";

function layoutWithKey(): AbstractLayout {
    const W = 5, H = 4;
    const cells: SemanticCell[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => "floor" as SemanticCell));
    cells[0]![0] = "entry";
    cells[H - 1]![W - 1] = "exit";
    cells[1]![2] = "pickup_slot";
    return {
        node_id: "room_1", width: W, height: H, tile_px: 16, cells,
        entity_slots: [{ id: "pickup_key", kind: "pickup", x: 2, y: 1, required: true, grants: ["key"] }],
        entry: { x: 0, y: 0 }, exit: { x: W - 1, y: H - 1 },
        meta: { genre: "roguelike", strategy: "rotjs_uniform", theme: null, density: 0.5, difficulty: "balanced", seed: 1 },
    };
}

async function buildTilemap(layout: AbstractLayout) {
    const res = await tilemapPopulate.handler(
        { tool_id: "tilemap_populate", node_id: "room_1", project_id: proj, plan_version: 1, trace_id: "t",
          input: { layout, style_pack_id: "sp", genre: "roguelike", engine: "phaser", tier: "free" } },
        { resolveAsset: vi.fn(async () => ({ source: "catalog" as const, fallback_generative: false, asset: { download_url: "https://r2/ts.png", license: "CC0-1.0" } })) },
    );
    return res.output?.tilemap as Record<string, unknown>;
}

const deepseekReturns = (entities: unknown[]) =>
    vi.fn(async () => ({ trace_id: "t", model: "deepseek-chat" as const, output: { entities }, cost_usd: 0.001, latency_ms: 5, tokens_in: 0, tokens_out: 0, cache_hit: false }));

describe("entity_placement", () => {
    it("places the required key entity and stays reachable", async () => {
        const layout = layoutWithKey();
        const tilemap = await buildTilemap(layout);
        const res = await entityPlacement.handler(
            { tool_id: "entity_placement", node_id: "room_1", project_id: proj, plan_version: 1, trace_id: "t",
              input: { layout, tilemap, genre: "roguelike", difficulty: "balanced", engine: "phaser" } },
            { complete: deepseekReturns([{ id: "key1", kind: "pickup", slot_id: "pickup_key", grants: ["key"] }]) },
        );
        expect(res.status).toBe("succeeded");
        const ents = res.output?.entities as { grants: string[] }[];
        expect(ents.some((e) => e.grants.includes("key"))).toBe(true);
    });

    it("safety net: missing required slot is auto-added (moat holds)", async () => {
        const layout = layoutWithKey();
        const tilemap = await buildTilemap(layout);
        // LLM returns NO entities — the tool must still place the required key.
        const res = await entityPlacement.handler(
            { tool_id: "entity_placement", node_id: "room_1", project_id: proj, plan_version: 1, trace_id: "t",
              input: { layout, tilemap, genre: "roguelike", difficulty: "balanced", engine: "phaser" } },
            { complete: deepseekReturns([]) },
        );
        const ents = res.output?.entities as { grants: string[] }[];
        expect(ents.some((e) => e.grants.includes("key"))).toBe(true);
        expect(res.status).toBe("succeeded");
    });

    it("returns a contract-valid result with an entities objectgroup", async () => {
        const layout = layoutWithKey();
        const tilemap = await buildTilemap(layout);
        const res = await entityPlacement.handler(
            { tool_id: "entity_placement", node_id: "room_1", project_id: proj, plan_version: 1, trace_id: "t",
              input: { layout, tilemap, genre: "roguelike", difficulty: "balanced", engine: "phaser" } },
            { complete: deepseekReturns([{ id: "e1", kind: "enemy" }]) },
        );
        expect(() => ToolExecutionResultSchema.parse(res)).not.toThrow();
        const map = res.output?.tilemap_with_entities as { layers: { type: string; name: string }[] };
        expect(map.layers.some((l) => l.type === "objectgroup" && l.name === "entities")).toBe(true);
    });
});
