/**
 * tilemap_populate — turns an AbstractLayout into a concrete, engine-agnostic
 * Tiled JSON (.tmj) tilemap.
 *
 * Pipeline: resolve a tileset (CC0-first via asset-resolver; FLUX on paid tier,
 * paywall-guarded like sprite_gen) → autotile the walls/floor (caveat-1 fix:
 * one blob tileset → full seam-correct set) → build the .tmj → re-verify
 * reachability on the CONCRETE map (walls are now real gids) as the moat check →
 * emit the .tmj + tileset as tool_outputs files. Palette swap (caveat-2) is
 * applied to the tileset color table at the asset stage; here we pass the
 * style-pack palette through so the LUT is built deterministically.
 */
import type { ToolInvocation } from "../../../contracts/tool-registry.contract.js";
import type { ImageGenPort } from "../../../contracts/generative.contract.js";
import { makeResult, type QaLog, type Tool } from "../../_shared.js";
import {
    buildTiledMap,
    isCellWalkable,
    walkableGridFromTilemap,
    type AbstractLayout,
    type TiledTileset,
    type TiledTileLayer,
} from "../_shared-map.js";
import { autotileLayer, BLOB_TILE_COUNT } from "../_autotile.js";
import { isReachable, type Point } from "../_reachability.js";
import type { ResolvedAsset } from "../../sprite/index.js";
import { TilemapPopulateInputSchema, TilemapPopulateOutputSchema, type TilemapPopulateOutput } from "./schema.js";

/** Where the .tmj and tileset land in the sandbox (engine-neutral paths). */
const mapPath = (nodeId: string) => `/project/assets/maps/${nodeId}.tmj`;
const tilesetPath = (name: string) => `/project/assets/tilesets/${name}.png`;

/** Built-in CC0 default tileset used when the catalog has no hit on free tier. */
const DEFAULT_TILESET = {
    name: "gamesmith_default_blob",
    url: "/project/assets/tilesets/gamesmith_default_blob.png",
    license: "CC0-1.0",
};

export interface PopulateDeps {
    resolveAsset(query: { description: string; asset_type: string; style_pack?: string }): Promise<ResolvedAsset>;
    imageGenPort?: ImageGenPort;
}

function defaultDeps(): PopulateDeps {
    return {
        async resolveAsset(query) {
            const { default: assetResolver } = await import("../../asset-resolver/index.js");
            const res = await assetResolver.handler({
                tool_id: "asset_resolver",
                input: query,
                node_id: "tilemap_populate_internal",
                project_id: "00000000-0000-4000-8000-000000000000",
                plan_version: 1,
                trace_id: "tilemap_populate_internal",
            });
            const out = res.output as ResolvedAsset | null;
            return {
                source: out?.source ?? "generative",
                fallback_generative: out?.fallback_generative ?? true,
                asset: out?.asset ? { download_url: out.asset.download_url, license: out.asset.license } : null,
            };
        },
    };
}

async function handler(invocation: ToolInvocation, deps: PopulateDeps = defaultDeps()) {
    const start = Date.now();
    const input = TilemapPopulateInputSchema.parse({
        ...invocation.input,
        project_id: invocation.project_id,
        plan_version: invocation.plan_version,
        trace_id: invocation.trace_id,
    });
    const tool = { tool_id: "tilemap_populate" as const, node_id: invocation.node_id, trace_id: invocation.trace_id };
    const layout = input.layout as AbstractLayout;
    const qa_log: QaLog = [];
    let cost = 0;

    // 1. Resolve the tileset (CC0-first; FLUX only on paid tier).
    const resolved = await deps.resolveAsset({
        description: `${input.genre} ${layout.meta.theme ?? ""} tileset`.trim(),
        asset_type: "tileset",
        style_pack: input.style_pack_id,
    });

    let tileset: { name: string; url: string; source: "catalog" | "generated" | "default"; license: string | null };
    if (resolved.asset && (!resolved.fallback_generative || input.tier === "free")) {
        tileset = { name: `ts_${input.style_pack_id}`, url: resolved.asset.download_url, source: "catalog", license: resolved.asset.license };
        qa_log.push({ check: "tileset_cc0", passed: true, detail: "catalog" });
    } else if (input.tier === "free") {
        // Free tier: never call FLUX — fall back to the shipped CC0 blob default.
        tileset = { ...DEFAULT_TILESET, source: "default" as const };
        qa_log.push({ check: "tileset_cc0", passed: true, detail: "default-blob" });
    } else if (!deps.imageGenPort) {
        // No generative provider wired yet: degrade to the shipped CC0 default
        // tileset (like free tier) instead of failing. The tilemap data is
        // still produced from the layout, so this node SUCCEEDS and downstream
        // code_gen runs. (Generative tilesets are wired in a later slice.)
        tileset = { ...DEFAULT_TILESET, source: "default" as const };
        qa_log.push({ check: "tileset_cc0", passed: true, detail: "default-blob (no generative provider)" });
    } else {
        const gen = await deps.imageGenPort.generateTileset({
            project_id: input.project_id, plan_version: input.plan_version, trace_id: input.trace_id,
            description: `${input.genre} tileset, style ${input.style_pack_id}`,
            style_pack_id: input.style_pack_id, tile_size: layout.tile_px,
        });
        cost += gen.cost_usd;
        tileset = { name: `ts_gen_${input.style_pack_id}`, url: gen.image_url, source: "generated", license: null };
        qa_log.push({ check: "tileset_generated", passed: true, detail: "flux" });
    }

    // 2. Autotile (caveat-1): a wall is "filled". The blob mask picks the seam-
    //    correct gid per wall cell; non-wall walkable cells get the floor gid.
    const FLOOR_GID = 1; // firstgid; floor occupies gid 1
    const WALL_FIRSTGID = 2; // walls use the 47-blob band starting at gid 2
    const wallMask = layout.cells.map((row) => row.map((c) => c === "wall" || c === "hazard"));
    const wallGids = autotileLayer(wallMask, WALL_FIRSTGID); // 0 where not a wall
    const data: number[] = [];
    for (let y = 0; y < layout.height; y++) {
        for (let x = 0; x < layout.width; x++) {
            const cell = layout.cells[y]![x]!;
            const wgid = wallGids[y * layout.width + x] ?? 0;
            data.push(wgid !== 0 ? wgid : isCellWalkable(cell) ? FLOOR_GID : 0);
        }
    }

    const tilesetDef: TiledTileset = {
        firstgid: 1, name: tileset.name, image: tilesetPath(tileset.name),
        imagewidth: layout.tile_px * 8, imageheight: layout.tile_px * 8,
        tilewidth: layout.tile_px, tileheight: layout.tile_px,
        tilecount: 1 + BLOB_TILE_COUNT, columns: 8,
    };
    const tiledMap = buildTiledMap({ width: layout.width, height: layout.height, tile_px: layout.tile_px, tileset: tilesetDef, groundData: data });

    // 3. Moat: reachability on the CONCRETE tilemap (walls = real gids).
    const wallGidSet = new Set<number>(wallGids.filter((g) => g !== 0));
    const grid = walkableGridFromTilemap(tiledMap.layers[0] as TiledTileLayer, wallGidSet);
    const goals: Point[] = [layout.exit, ...layout.entity_slots.filter((s) => s.required).map((s) => ({ x: s.x, y: s.y }))];
    const reachable = isReachable(grid, layout.entry, goals);
    qa_log.push({ check: "tilemap_reachable", passed: reachable, detail: reachable ? null : "concrete tilemap walled off a required cell" });

    // 4. Emit files: the .tmj (utf-8) + the tileset image (url-ref for W3 fetch).
    const files = [
        { path: mapPath(layout.node_id), content: JSON.stringify(tiledMap), encoding: "utf-8" as const },
        { path: tilesetPath(tileset.name), content: tileset.url, encoding: "url-ref" as const },
    ];

    const output: TilemapPopulateOutput = {
        trace_id: invocation.trace_id, cost_usd: cost, latency_ms: Date.now() - start,
        qa_log: [], tilemap: tiledMap as unknown as Record<string, unknown>, tileset, files,
    };
    return makeResult({
        invocation: tool,
        output: reachable ? output : null,
        qa_log,
        cost_usd: cost,
        latency_ms: Date.now() - start,
    });
}

const descriptor: Tool<PopulateDeps> = {
    id: "tilemap_populate",
    name: "Tilemap Populate",
    description: "Builds an engine-agnostic Tiled JSON from an abstract layout: CC0/FLUX tileset, blob autotiling, reachability-verified.",
    category: "level",
    inputSchema: TilemapPopulateInputSchema,
    outputSchema: TilemapPopulateOutputSchema,
    estimatedCostUsd: 0.0,
    estimatedDurationSeconds: 3,
    handler,
};
export default descriptor;
