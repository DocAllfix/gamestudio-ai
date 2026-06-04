/**
 * tilemap_populate — CC0/paywall, valid Tiled JSON, reachability moat.
 */
import { describe, expect, it, vi } from "vitest";

import tilemapPopulate from "../tilemap_populate/index.js";
import { ToolExecutionResultSchema } from "../../../contracts/tool-registry.contract.js";
import type { AbstractLayout, SemanticCell } from "../_shared-map.js";

const baseInvocation = {
    tool_id: "tilemap_populate" as const,
    node_id: "room_1",
    project_id: "00000000-0000-4000-8000-000000000000",
    plan_version: 1,
    trace_id: "trace_tp",
};

/** A small open layout with entry top-left, exit bottom-right, walls on a border. */
function openLayout(): AbstractLayout {
    const W = 5, H = 4;
    const cells: SemanticCell[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => "floor" as SemanticCell));
    cells[0]![0] = "entry";
    cells[H - 1]![W - 1] = "exit";
    return {
        node_id: "room_1", width: W, height: H, tile_px: 16, cells,
        entity_slots: [], entry: { x: 0, y: 0 }, exit: { x: W - 1, y: H - 1 },
        meta: { genre: "roguelike", strategy: "rotjs_uniform", theme: null, density: 0.5, difficulty: "balanced", seed: 1 },
    };
}

const catalogHit = () =>
    vi.fn(async () => ({ source: "catalog" as const, fallback_generative: false, asset: { download_url: "https://r2/ts.png", license: "CC0-1.0" } }));
const noHit = () =>
    vi.fn(async () => ({ source: "generative" as const, fallback_generative: true, asset: null }));
const fakePort = () => ({ generateSprite: vi.fn(), generateTileset: vi.fn(async () => ({ trace_id: "t", cost_usd: 0.02, latency_ms: 10, qa_log: [], image_url: "https://r2/gen.png", width: 128, height: 128 })) });

describe("tilemap_populate", () => {
    it("free tier with a CC0 hit → source catalog, FLUX never called", async () => {
        const port = fakePort();
        const res = await tilemapPopulate.handler(
            { ...baseInvocation, input: { layout: openLayout(), style_pack_id: "sp_pixel", genre: "roguelike", engine: "phaser", tier: "free" } },
            { resolveAsset: catalogHit(), imageGenPort: port },
        );
        expect(port.generateTileset).not.toHaveBeenCalled();
        expect(res.status).toBe("succeeded");
        expect((res.output?.tileset as { source: string }).source).toBe("catalog");
    });

    it("free tier with NO hit → default blob tileset, still no FLUX", async () => {
        const port = fakePort();
        const res = await tilemapPopulate.handler(
            { ...baseInvocation, input: { layout: openLayout(), style_pack_id: "sp_pixel", genre: "roguelike", engine: "phaser", tier: "free" } },
            { resolveAsset: noHit(), imageGenPort: port },
        );
        expect(port.generateTileset).not.toHaveBeenCalled();
        expect((res.output?.tileset as { source: string }).source).toBe("default");
    });

    it("paid tier with weak hit → generates via FLUX", async () => {
        const port = fakePort();
        const res = await tilemapPopulate.handler(
            { ...baseInvocation, input: { layout: openLayout(), style_pack_id: "sp_pixel", genre: "roguelike", engine: "phaser", tier: "creator" } },
            { resolveAsset: noHit(), imageGenPort: port },
        );
        expect(port.generateTileset).toHaveBeenCalledOnce();
        expect((res.output?.tileset as { source: string }).source).toBe("generated");
    });

    it("emits a valid Tiled JSON with data length width*height", async () => {
        const res = await tilemapPopulate.handler(
            { ...baseInvocation, input: { layout: openLayout(), style_pack_id: "sp_pixel", genre: "roguelike", engine: "phaser", tier: "free" } },
            { resolveAsset: catalogHit() },
        );
        const tm = res.output?.tilemap as { type: string; width: number; height: number; layers: { type: string; data?: number[] }[] };
        expect(tm.type).toBeDefined();
        const ground = tm.layers.find((l) => l.type === "tilelayer");
        expect(ground?.data).toHaveLength(tm.width * tm.height);
        expect(() => ToolExecutionResultSchema.parse(res)).not.toThrow();
        // a .tmj file is emitted
        const files = res.output?.files as { path: string; encoding: string }[];
        expect(files.some((f) => f.path.endsWith(".tmj") && f.encoding === "utf-8")).toBe(true);
    });
});
