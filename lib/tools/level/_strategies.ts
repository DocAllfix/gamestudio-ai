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

// --- Platformer generator (deterministic, jump-reach-aware) -----------------
// Lays a left→right chain of platforms where every gap to the next platform is
// within the controller's jump reach (from the shared physics profile), so the
// level is always completable. The LLM never sets these distances. Validated
// afterward by the tool's reachability + jump-reachability checks.

import { jumpReachCells, DEFAULT_PLATFORMER_PHYSICS } from "./_platformer-physics.js";

/** Tiny seeded RNG (mulberry32) for deterministic placement. */
function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a |= 0; a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function generatePlatformLayout(args: {
    node: GameGraphNode;
    width: number;
    height: number;
    genre: string;
    theme: string | null;
    density: number;
    difficulty: string;
    seed: number;
    tile_px: number;
}): AbstractLayout {
    const { width, height, node, tile_px, seed } = args;
    const rand = rng(seed);
    const cells: SemanticCell[][] = Array.from({ length: height }, () =>
        Array.from({ length: width }, () => "empty" as SemanticCell));

    const reach = jumpReachCells(DEFAULT_PLATFORMER_PHYSICS, tile_px);
    // Keep each hop a bit under the max so it's comfortably clearable.
    const maxGap = Math.max(2, reach.maxGapX - 1);
    const maxRise = Math.max(1, reach.maxRiseY - 1);
    const groundY = height - 2;            // first platform near the bottom
    const platLen = Math.max(3, Math.floor(maxGap * 0.8)); // platform width in cells

    // Build the chain of platform tops as (x, y) of the left edge.
    const platforms: { x: number; y: number; len: number }[] = [];
    let x = 1;
    let y = groundY;
    while (x + platLen < width - 1) {
        const len = platLen + Math.floor(rand() * 3);
        platforms.push({ x, y, len: Math.min(len, width - 1 - x) });
        // Next platform: jumpable gap to the right, a small vertical change.
        const gap = 1 + Math.floor(rand() * maxGap);
        const dy = Math.floor((rand() * 2 - 1) * maxRise); // up or down, within rise
        x = x + len + gap;
        y = Math.min(height - 2, Math.max(2, y + dy));
    }
    if (platforms.length === 0) platforms.push({ x: 1, y: groundY, len: Math.min(platLen, width - 2) });

    // Paint platforms as "platform" cells.
    for (const p of platforms) {
        for (let i = 0; i < p.len && p.x + i < width; i++) {
            if (cells[p.y]) cells[p.y]![p.x + i] = "platform";
        }
    }

    // Entry on the first platform, exit on the last (one cell above the top).
    // Spawn at the platform's CENTER, not its left edge — a player dropped on the
    // edge (minimal overlap) slides off and "falls at 0.5s", failing the playtest.
    const first = platforms[0]!;
    const last = platforms[platforms.length - 1]!;
    const entry = { x: first.x + Math.floor(first.len / 2), y: Math.max(0, first.y - 1) };
    const exit = { x: last.x + Math.floor(last.len / 2), y: Math.max(0, last.y - 1) };
    if (cells[entry.y]) cells[entry.y]![entry.x] = "entry";
    if (cells[exit.y]) cells[exit.y]![exit.x] = "exit";

    // Pickups: required grants on platforms (above the surface, reachable);
    // plus a few coins; a light sprinkle of enemies on wider platforms.
    const entity_slots: AbstractLayout["entity_slots"] = [];
    node.grants.forEach((grant, i) => {
        const p = platforms[Math.min(platforms.length - 1, 1 + i)] ?? first;
        const sx = p.x + Math.floor(p.len / 2);
        const sy = Math.max(0, p.y - 1);
        if (cells[sy]) cells[sy]![sx] = "pickup_slot";
        entity_slots.push({ id: `pickup_${grant}`, kind: "pickup", x: sx, y: sy, required: true, grants: [grant] });
    });
    for (let i = 0; i < platforms.length; i++) {
        const p = platforms[i]!;
        if (i > 0 && rand() < 0.6) { // coin above a platform
            const cx = p.x + Math.floor(p.len / 2);
            const cy = Math.max(0, p.y - 1);
            if (cells[cy]?.[cx] === "empty") { cells[cy]![cx] = "pickup_slot"; entity_slots.push({ id: `coin_${i}`, kind: "pickup", x: cx, y: cy, required: false, grants: [] }); }
        }
        if (i > 1 && p.len >= 4 && rand() < 0.4) { // enemy on a wider platform
            const ex = p.x + 1;
            const ey = Math.max(0, p.y - 1);
            if (cells[ey]?.[ex] === "empty") { cells[ey]![ex] = "enemy_slot"; entity_slots.push({ id: `enemy_${i}`, kind: "enemy", x: ex, y: ey, required: false, grants: [] }); }
        }
    }

    return {
        node_id: node.id, width, height, tile_px, cells, entity_slots, entry, exit,
        meta: { genre: args.genre, strategy: "platform", theme: args.theme, density: args.density, difficulty: args.difficulty, seed },
    };
}
