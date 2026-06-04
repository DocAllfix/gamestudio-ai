/**
 * Shared map types + builders for the level/ tools.
 *
 * Two representations flow through the pipeline:
 *  1. AbstractLayout — a grid of SEMANTIC cells (role, not pixel). Style-agnostic.
 *     Produced by level_layout_2d, consumed by tilemap_populate + entity_placement.
 *  2. Tiled JSON (.tmj) — the engine-agnostic concrete tilemap. Produced by
 *     tilemap_populate, written into tool_outputs[node_id].files[], consumed by
 *     every day-1 engine adapter.
 *
 * Keeping these here (not in lib/contracts/) is deliberate: they are W2-internal
 * tool plumbing, not a cross-workstream contract. The cross-workstream surface is
 * the file written into tool_outputs (a plain Tiled JSON string), which W3's
 * Assembler treats as an opaque file.
 */
import { z } from "zod";

// ---- Semantic cells (AbstractLayout) --------------------------------------

export const SemanticCellEnum = z.enum([
    "empty", // out of bounds / void
    "floor", // walkable ground
    "wall", // blocking
    "platform", // walkable ledge (platformers)
    "hazard", // blocking + damages (spikes/lava)
    "door", // walkable, may gate on an item
    "entry", // spawn point (walkable)
    "exit", // level exit (walkable)
    "pickup_slot", // walkable; an item/grant lands here
    "enemy_slot", // walkable; an enemy lands here
    "decor", // walkable cosmetic
]);
export type SemanticCell = z.infer<typeof SemanticCellEnum>;

/** Cells the player can stand on / pass through — drives reachability. */
const WALKABLE: ReadonlySet<SemanticCell> = new Set<SemanticCell>([
    "floor",
    "platform",
    "door",
    "entry",
    "exit",
    "pickup_slot",
    "enemy_slot",
    "decor",
]);

export function isCellWalkable(cell: SemanticCell): boolean {
    return WALKABLE.has(cell);
}

export const EntitySlotSchema = z.object({
    id: z.string().min(1),
    kind: z.enum(["enemy", "pickup", "npc", "hazard", "checkpoint"]),
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    /** True when this slot grants a gating item — must stay reachable. */
    required: z.boolean().default(false),
    /** Items this slot grants (mirrors GameGraphNode.grants). */
    grants: z.array(z.string()).default([]),
});
export type EntitySlot = z.infer<typeof EntitySlotSchema>;

export const PointSchema = z.object({ x: z.number().int().min(0), y: z.number().int().min(0) });

export const AbstractLayoutSchema = z.object({
    node_id: z.string().min(1),
    width: z.number().int().min(1),
    height: z.number().int().min(1),
    tile_px: z.number().int().min(1).default(16),
    /** Row-major: cells[y][x]. */
    cells: z.array(z.array(SemanticCellEnum)),
    entity_slots: z.array(EntitySlotSchema).default([]),
    entry: PointSchema,
    exit: PointSchema,
    meta: z.object({
        genre: z.string(),
        strategy: z.string(),
        theme: z.string().nullable().default(null),
        density: z.number().min(0).max(1).default(0.5),
        difficulty: z.string().default("balanced"),
        seed: z.number().int(),
    }),
});
export type AbstractLayout = z.infer<typeof AbstractLayoutSchema>;

/** Build the boolean walkable grid the reachability moat consumes. */
export function walkableGridFromLayout(layout: AbstractLayout): boolean[][] {
    return layout.cells.map((row) => row.map((c) => isCellWalkable(c)));
}

// ---- Tiled JSON (.tmj) — concrete, engine-agnostic ------------------------

export interface TiledTileset {
    firstgid: number;
    name: string;
    image: string; // r2 url or relative path
    imagewidth: number;
    imageheight: number;
    tilewidth: number;
    tileheight: number;
    tilecount: number;
    columns: number;
}

export interface TiledTileLayer {
    type: "tilelayer";
    name: string;
    width: number;
    height: number;
    data: number[]; // length width*height, gid (0 = empty)
}

export interface TiledObject {
    id: number;
    name: string;
    type: string;
    x: number;
    y: number;
    properties?: { name: string; type: string; value: string }[];
}

export interface TiledObjectGroup {
    type: "objectgroup";
    name: string;
    objects: TiledObject[];
}

export interface TiledMap {
    type: "map";
    orientation: "orthogonal";
    renderorder: "right-down";
    width: number;
    height: number;
    tilewidth: number;
    tileheight: number;
    infinite: false;
    tilesets: TiledTileset[];
    layers: (TiledTileLayer | TiledObjectGroup)[];
}

/** Walkable check on a CONCRETE tilemap: a cell is walkable unless its ground
 * gid is in `wallGids` (or 0/empty). This lets tilemap_populate re-verify the
 * concrete map (walls are now real gids), catching the case where tile
 * population accidentally walled off a slot the abstract layout left open. */
export function walkableGridFromTilemap(
    layer: TiledTileLayer,
    wallGids: ReadonlySet<number>,
): boolean[][] {
    const grid: boolean[][] = [];
    for (let y = 0; y < layer.height; y++) {
        const row: boolean[] = [];
        for (let x = 0; x < layer.width; x++) {
            const gid = layer.data[y * layer.width + x] ?? 0;
            row.push(gid !== 0 && !wallGids.has(gid));
        }
        grid.push(row);
    }
    return grid;
}

/** Construct a minimal valid orthogonal Tiled map from a single ground layer. */
export function buildTiledMap(args: {
    width: number;
    height: number;
    tile_px: number;
    tileset: TiledTileset;
    groundData: number[];
}): TiledMap {
    return {
        type: "map",
        orientation: "orthogonal",
        renderorder: "right-down",
        width: args.width,
        height: args.height,
        tilewidth: args.tile_px,
        tileheight: args.tile_px,
        infinite: false,
        tilesets: [args.tileset],
        layers: [
            {
                type: "tilelayer",
                name: "ground",
                width: args.width,
                height: args.height,
                data: args.groundData,
            },
        ],
    };
}

/** Append (or replace) an "entities" objectgroup on a Tiled map. */
export function withEntities(map: TiledMap, objects: TiledObject[]): TiledMap {
    const layers = map.layers.filter(
        (l) => !(l.type === "objectgroup" && l.name === "entities"),
    );
    layers.push({ type: "objectgroup", name: "entities", objects });
    return { ...map, layers };
}
