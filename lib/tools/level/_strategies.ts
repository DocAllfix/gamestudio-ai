/**
 * Strategy selection + procedural layout generators for level_layout_2d.
 *
 * The genre selects a strategy (auto), each strategy fills an AbstractLayout's
 * cell grid. LLM strategies are handled in the tool (they call the router);
 * the procedural strategies here are deterministic (seeded) and dependency-light.
 *
 * rot.js is wrapped behind `rotMap` so it stays injectable: the default uses the
 * real rot-js generators, tests inject a fake. This keeps the tool offline-testable
 * and means rot-js is the only hard new dep on the procedural path.
 */
import type { AbstractLayout, SemanticCell } from "./_shared-map.js";
import type { GameGraphNode } from "../../contracts/game-graph.contract.js";

export type LayoutStrategy =
    | "llm"
    | "rotjs_digger"
    | "rotjs_uniform"
    | "rotjs_cellular"
    | "rotjs_maze"
    | "wfc"
    | "platform"
    | "grid_puzzle"
    | "arena"
    | "skip"; // non-spatial genres (card_game / visual_novel)

/** Genres with no spatial map — the tool early-returns for these. */
const NON_SPATIAL = new Set(["card_game", "visual_novel"]);

/**
 * Genre → default strategy (the `auto` resolution). Mirrors the plan's
 * genre→strategy table. 3D genres map to a 2D proxy here; the 3D path is
 * level_layout_3d / heightmap_gen.
 */
export function strategyForGenre(genre: string): LayoutStrategy {
    if (NON_SPATIAL.has(genre)) return "skip";
    switch (genre) {
        case "roguelike":
            return "rotjs_uniform";
        case "retro_8bit":
            return "rotjs_cellular";
        case "jrpg":
            return "rotjs_digger";
        case "metroidvania":
        case "hardcore_platformer":
            return "platform";
        case "mobile_puzzle":
            return "grid_puzzle";
        case "bullet_hell":
        case "browser_arcade":
        case "multiplayer_arena":
            return "arena";
        case "social_sim":
            return "grid_puzzle"; // room grid
        case "threejs_showcase":
        case "stride_action":
            return "arena"; // 2D proxy; real 3D via level_layout_3d
        default:
            return "llm";
    }
}

export function isNonSpatial(genre: string): boolean {
    return NON_SPATIAL.has(genre);
}

/** Dimensions per size bucket (cells). */
export function dimsForSize(size: "s" | "m" | "l"): { width: number; height: number } {
    switch (size) {
        case "s":
            return { width: 16, height: 12 };
        case "l":
            return { width: 48, height: 32 };
        default:
            return { width: 32, height: 20 };
    }
}

/** Spec passed to a procedural generator. */
export interface RotMapSpec {
    strategy: LayoutStrategy;
    width: number;
    height: number;
    seed: number;
    density: number;
}

/** Result of a procedural generator: just the walkable mask + room anchors. */
export interface RotMapResult {
    /** cells[y][x]: true = floor, false = wall. */
    floor: boolean[][];
    /** Distinct anchor points (room centers) for entry/exit/slot placement. */
    anchors: { x: number; y: number }[];
}

export interface StrategyDeps {
    /** Procedural generator. Default wraps rot-js; tests inject a fake. */
    rotMap(spec: RotMapSpec): RotMapResult;
}

/**
 * Convert a procedural floor mask + node grants into a full AbstractLayout:
 * place entry/exit/required-pickup slots on distinct anchors, mark walls.
 */
export function layoutFromFloorMask(args: {
    node: GameGraphNode;
    floor: boolean[][];
    anchors: { x: number; y: number }[];
    genre: string;
    strategy: LayoutStrategy;
    theme: string | null;
    density: number;
    difficulty: string;
    seed: number;
    tile_px: number;
}): AbstractLayout {
    const { floor, anchors, node } = args;
    const height = floor.length;
    const width = floor[0]?.length ?? 0;

    const cells: SemanticCell[][] = floor.map((row) =>
        row.map((walkable) => (walkable ? "floor" : "wall") as SemanticCell),
    );

    // Pick anchors deterministically: first = entry, last = exit, middle ones
    // for required grants. Fall back to scanning for any floor cell.
    const usable = anchors.length >= 2 ? anchors : scanFloors(floor);
    const entry = usable[0] ?? { x: 0, y: 0 };
    const exit = usable[usable.length - 1] ?? entry;

    cells[entry.y]![entry.x] = "entry";
    cells[exit.y]![exit.x] = "exit";

    // One required pickup slot per gating item the node grants.
    const entity_slots = node.grants.map((grant, i) => {
        const anchor = usable[(i + 1) % Math.max(usable.length, 1)] ?? entry;
        if (cells[anchor.y]?.[anchor.x] === "floor") {
            cells[anchor.y]![anchor.x] = "pickup_slot";
        }
        return {
            id: `pickup_${grant}`,
            kind: "pickup" as const,
            x: anchor.x,
            y: anchor.y,
            required: true,
            grants: [grant],
        };
    });

    return {
        node_id: node.id,
        width,
        height,
        tile_px: args.tile_px,
        cells,
        entity_slots,
        entry,
        exit,
        meta: {
            genre: args.genre,
            strategy: args.strategy,
            theme: args.theme,
            density: args.density,
            difficulty: args.difficulty,
            seed: args.seed,
        },
    };
}

function scanFloors(floor: boolean[][]): { x: number; y: number }[] {
    const found: { x: number; y: number }[] = [];
    for (let y = 0; y < floor.length; y++) {
        for (let x = 0; x < (floor[y]?.length ?? 0); x++) {
            if (floor[y]![x]) found.push({ x, y });
        }
    }
    return found;
}
