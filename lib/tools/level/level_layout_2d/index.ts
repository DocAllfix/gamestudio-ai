/**
 * level_layout_2d — expands a world-graph node into an abstract 2D layout.
 *
 * Strategy is genre-driven (auto) or forced. LLM strategies (Claude Sonnet) plan
 * platformer/puzzle layouts; rot.js strategies generate dungeons/caves
 * deterministically. Every result is verified by the A* reachability moat
 * (entry -> exit -> every required pickup); a failure drives a seeded
 * regenerate loop, and a final failure surfaces as rejected_by_qa via makeResult.
 */
import type { ToolInvocation } from "../../../contracts/tool-registry.contract.js";
import type { LlmCompleteRequest, LlmCompleteResponse } from "../../../llm/router.js";
import type { GameGraphNode } from "../../../contracts/game-graph.contract.js";
import { makeResult, type QaLog, type Tool } from "../../_shared.js";
import {
    AbstractLayoutSchema,
    type AbstractLayout,
    type SemanticCell,
    walkableGridFromLayout,
} from "../_shared-map.js";
import { isReachable, type Point } from "../_reachability.js";
import { jumpReachCells, DEFAULT_PLATFORMER_PHYSICS } from "../_platformer-physics.js";
import {
    dimsForSize,
    isNonSpatial,
    layoutFromFloorMask,
    strategyForGenre,
    type LayoutStrategy,
    type RotMapResult,
    type RotMapSpec,
} from "../_strategies.js";
import { LevelLayout2dInputSchema, type LevelLayout2dOutput } from "./schema.js";

const MAX_REGEN = 3;

export interface LayoutDeps {
    complete(request: LlmCompleteRequest): Promise<LlmCompleteResponse>;
    rotMap(spec: RotMapSpec): RotMapResult | Promise<RotMapResult>;
    isReachable(grid: boolean[][], start: Point, goals: readonly Point[]): boolean;
}

function defaultDeps(): LayoutDeps {
    return {
        async complete(request) {
            const { complete } = await import("../../../llm/router.js");
            return complete(request);
        },
        async rotMap(spec) {
            const { rotMapDefault } = await import("../_rotjs-default.js");
            return rotMapDefault(spec);
        },
        isReachable,
    };
}

/** Stable fallback seed from the node id when the caller omits one. */
function seedFromNode(node: GameGraphNode): number {
    let h = 0;
    for (const ch of node.id) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return Math.abs(h);
}

/** Empty 1x1 layout for non-spatial genres (card_game / visual_novel). */
function emptyLayout(node: GameGraphNode, genre: string, seed: number): AbstractLayout {
    return {
        node_id: node.id,
        width: 1,
        height: 1,
        tile_px: 16,
        cells: [["empty"] as SemanticCell[]],
        entity_slots: [],
        entry: { x: 0, y: 0 },
        exit: { x: 0, y: 0 },
        meta: { genre, strategy: "skip", theme: null, density: 0, difficulty: "balanced", seed },
    };
}

async function handler(invocation: ToolInvocation, deps: LayoutDeps = defaultDeps()) {
    const start = Date.now();
    const input = LevelLayout2dInputSchema.parse({
        ...invocation.input,
        project_id: invocation.project_id,
        plan_version: invocation.plan_version,
        trace_id: invocation.trace_id,
    });

    const tool = { tool_id: "level_layout_2d" as const, node_id: invocation.node_id, trace_id: invocation.trace_id };

    // Non-spatial genres: succeed with an empty layout (the Orchestrator simply
    // won't schedule downstream map tools; this is the safety net).
    if (isNonSpatial(input.genre)) {
        const layout = emptyLayout(input.node, input.genre, input.seed ?? 0);
        const output: LevelLayout2dOutput = {
            trace_id: invocation.trace_id, cost_usd: 0, latency_ms: Date.now() - start,
            qa_log: [], layout, non_spatial: true,
        };
        return makeResult({
            invocation: tool, output,
            qa_log: [{ check: "non_spatial_genre", passed: true, detail: `${input.genre}: no spatial map` }],
            latency_ms: Date.now() - start,
        });
    }

    const strategy: LayoutStrategy = input.strategy === "auto" ? strategyForGenre(input.genre) : input.strategy;
    const baseSeed = input.seed ?? seedFromNode(input.node);
    const { width, height } = dimsForSize(input.size);

    let layout: AbstractLayout | null = null;
    let totalCost = 0;
    const qa_log: QaLog = [];

    for (let attempt = 1; attempt <= MAX_REGEN; attempt++) {
        const seed = baseSeed + attempt;
        const candidate = await generate(strategy, { input, width, height, seed }, deps);
        totalCost += candidate.cost;
        layout = candidate.layout;

        // Platformer reachability is JUMP-based (platforms separated by gaps),
        // not 4-dir BFS — so validate the platform chain against the jump reach
        // instead. Other strategies use the walkable BFS moat.
        let reachable: boolean;
        if (strategy === "platform") {
            reachable = isJumpReachable(layout);
            qa_log.push({ check: `jump_reachable_attempt_${attempt}`, passed: reachable, detail: reachable ? null : "a platform is beyond jump reach" });
        } else {
            const grid = walkableGridFromLayout(layout);
            const goals: Point[] = [layout.exit, ...layout.entity_slots.filter((s) => s.required).map((s) => ({ x: s.x, y: s.y }))];
            reachable = deps.isReachable(grid, layout.entry, goals);
            qa_log.push({ check: `layout_reachable_attempt_${attempt}`, passed: reachable, detail: reachable ? null : "entry cannot reach exit/required slots" });
        }
        if (reachable) break;
    }

    const finalReachable = qa_log[qa_log.length - 1]?.passed ?? false;
    const output: LevelLayout2dOutput = {
        trace_id: invocation.trace_id, cost_usd: totalCost, latency_ms: Date.now() - start,
        qa_log: [], layout: AbstractLayoutSchema.parse(layout), non_spatial: false,
    };

    return makeResult({
        invocation: tool,
        output: finalReachable ? output : null,
        qa_log,
        cost_usd: totalCost,
        latency_ms: Date.now() - start,
        error_message: finalReachable ? null : null, // unreachable -> rejected_by_qa (a failed qa check), not "failed"
    });
}

interface GenArgs {
    input: ReturnType<typeof LevelLayout2dInputSchema.parse>;
    width: number;
    height: number;
    seed: number;
}

async function generate(strategy: LayoutStrategy, args: GenArgs, deps: LayoutDeps): Promise<{ layout: AbstractLayout; cost: number }> {
    const { input, width, height, seed } = args;

    // Procedural strategies via rot.js (deterministic, free).
    if (strategy.startsWith("rotjs_")) {
        const res = await deps.rotMap({ strategy, width, height, seed, density: input.density });
        const layout = layoutFromFloorMask({
            node: input.node, floor: res.floor, anchors: res.anchors,
            genre: input.genre, strategy, theme: input.theme, density: input.density,
            difficulty: input.difficulty, seed, tile_px: input.tile_px,
        });
        return { layout, cost: 0 };
    }

    // Platformer: deterministic, jump-reach-aware generator (free, no LLM). The
    // platforms are spaced within the controller's jump distance, so the level
    // is always completable. The LLM never sets these gaps.
    if (strategy === "platform") {
        const { generatePlatformLayout } = await import("../_strategies.js");
        const layout = generatePlatformLayout({
            node: input.node, width, height, genre: input.genre, theme: input.theme,
            density: input.density, difficulty: input.difficulty, seed, tile_px: input.tile_px,
        });
        return { layout, cost: 0 };
    }

    // LLM strategies (llm / platform / grid_puzzle / arena): Claude Sonnet plans
    // the abstract grid directly. The router omits temperature for claude-*.
    const completion = await deps.complete({
        model: "claude-sonnet-4-7",
        system:
            "You are a level designer. Output a 2D grid of semantic cells for a game level. " +
            "Cells: floor, wall, platform, hazard, door, entry, exit, pickup_slot, enemy_slot, decor. " +
            "Return JSON {cells: string[][], entry:{x,y}, exit:{x,y}, entity_slots:[{id,kind,x,y,required,grants}]}. " +
            "Guarantee a walkable path from entry to exit and to every required pickup_slot.",
        user:
            `Genre: ${input.genre}. Strategy: ${strategy}. Size ${width}x${height}. ` +
            `Density ${input.density}. Difficulty ${input.difficulty}. ` +
            `Theme: ${input.theme ?? "none"}. ` +
            `Node "${input.node.id}" grants [${input.node.grants.join(", ")}] (each needs a required pickup_slot).`,
        max_tokens: 4096,
        temperature: 0.3, // router drops this for claude-* per the Azure rule
        trace_id: input.trace_id,
    });

    const parsed = parseLlmLayout(completion.output, input, strategy, width, height, seed);
    return { layout: parsed, cost: completion.cost_usd };
}

/**
 * Jump-reachability for platformer layouts: the BFS walkable moat can't model
 * jumps (platforms are separated by empty gaps). Instead, extract platform runs,
 * sort left→right, and confirm each platform is reachable from a previous one
 * within the controller's jump reach (gap & rise from the physics profile). The
 * generator already places them within reach; this is the guard that proves it.
 */
function isJumpReachable(layout: AbstractLayout): boolean {
    // Collect every platform/entry/exit cell as a standable point.
    const stand: Point[] = [];
    for (let y = 0; y < layout.cells.length; y++) {
        const row = layout.cells[y]!;
        for (let x = 0; x < row.length; x++) {
            const c = row[x];
            if (c === "platform" || c === "entry" || c === "exit") stand.push({ x, y });
        }
    }
    if (stand.length === 0) return false;
    const reach = jumpReachCells(DEFAULT_PLATFORMER_PHYSICS, layout.tile_px);
    // BFS over standable points where an edge exists if two points are within
    // one jump (horizontal gap <= maxGapX, vertical rise <= maxRiseY going up;
    // any drop going down). Start from entry, must reach exit.
    const key = (p: Point) => `${p.x},${p.y}`;
    const byKey = new Map(stand.map((p) => [key(p), p]));
    const canHop = (a: Point, b: Point): boolean => {
        const dx = Math.abs(a.x - b.x);
        const dyUp = a.y - b.y; // positive = b is higher
        if (dx > reach.maxGapX) return false;
        if (dyUp > reach.maxRiseY) return false; // too high to jump up to
        return true; // dropping down or within rise
    };
    const start = byKey.get(key(layout.entry)) ?? stand[0]!;
    const seen = new Set<string>([key(start)]);
    const queue: Point[] = [start];
    while (queue.length) {
        const cur = queue.shift()!;
        if (cur.x === layout.exit.x && cur.y === layout.exit.y) return true;
        for (const p of stand) {
            if (seen.has(key(p))) continue;
            if (canHop(cur, p)) { seen.add(key(p)); queue.push(p); }
        }
    }
    return seen.has(key(layout.exit));
}

/** Coerce the LLM JSON into an AbstractLayout, clamping to bounds. */
function parseLlmLayout(
    raw: unknown,
    input: GenArgs["input"],
    strategy: LayoutStrategy,
    width: number,
    height: number,
    seed: number,
): AbstractLayout {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const rawCells = Array.isArray(obj.cells) ? (obj.cells as unknown[][]) : [];
    const cells: SemanticCell[][] = Array.from({ length: height }, (_, y) =>
        Array.from({ length: width }, (_, x) => {
            const v = rawCells[y]?.[x];
            return (typeof v === "string" && isCell(v) ? v : "floor") as SemanticCell;
        }),
    );
    const clampPt = (p: unknown): Point => {
        const o = (p ?? {}) as { x?: number; y?: number };
        return { x: clamp(o.x ?? 0, 0, width - 1), y: clamp(o.y ?? 0, 0, height - 1) };
    };
    const entry = clampPt(obj.entry);
    const exit = clampPt(obj.exit);
    cells[entry.y]![entry.x] = "entry";
    cells[exit.y]![exit.x] = "exit";

    // Ensure one required slot per grant, regardless of what the LLM returned.
    const entity_slots = input.node.grants.map((grant: string, i: number) => {
        const fromLlm = Array.isArray(obj.entity_slots) ? (obj.entity_slots as Record<string, unknown>[])[i] : undefined;
        const x = clamp(Number(fromLlm?.x ?? entry.x + i + 1), 0, width - 1);
        const y = clamp(Number(fromLlm?.y ?? entry.y), 0, height - 1);
        if (cells[y]![x] === "floor") cells[y]![x] = "pickup_slot";
        return { id: `pickup_${grant}`, kind: "pickup" as const, x, y, required: true, grants: [grant] };
    });

    return {
        node_id: input.node.id, width, height, tile_px: input.tile_px, cells, entity_slots, entry, exit,
        meta: { genre: input.genre, strategy, theme: input.theme, density: input.density, difficulty: input.difficulty, seed },
    };
}

function isCell(v: string): v is SemanticCell {
    return ["empty", "floor", "wall", "platform", "hazard", "door", "entry", "exit", "pickup_slot", "enemy_slot", "decor"].includes(v);
}
function clamp(n: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, Math.round(n)));
}

const tool: Tool<LayoutDeps> = {
    id: "level_layout_2d",
    name: "2D Level Layout",
    description: "Expands a world-graph node into an abstract 2D layout (semantic cell grid + entity slots), verified for reachability.",
    category: "level",
    inputSchema: LevelLayout2dInputSchema,
    outputSchema: AbstractLayoutSchema,
    estimatedCostUsd: 0.01,
    estimatedDurationSeconds: 6,
    handler,
};
export default tool;
