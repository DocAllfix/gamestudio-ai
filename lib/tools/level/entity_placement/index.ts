/**
 * entity_placement — places concrete entities (enemies, pickups, NPCs, hazards)
 * onto the tilemap, from the abstract layout's entity_slots.
 *
 * DeepSeek decides types/counts/params per slot, constrained by genre +
 * difficulty (cheap bulk decision, matches the >=60%->DeepSeek routing). Every
 * entity is snapped to a walkable tile (never inside a wall); required-granting
 * entities (e.g. the key) must stay reachable — the final A* moat check.
 */
import type { ToolInvocation } from "../../../contracts/tool-registry.contract.js";
import type { LlmCompleteRequest, LlmCompleteResponse } from "../../../llm/router.js";
import { makeResult, type QaLog, type Tool } from "../../_shared.js";
import {
    walkableGridFromLayout,
    withEntities,
    type AbstractLayout,
    type TiledMap,
    type TiledObject,
} from "../_shared-map.js";
import { isReachable, reachableCells, type Point } from "../_reachability.js";
import { EntityPlacementInputSchema, EntityPlacementOutputSchema, type EntityPlacementOutput } from "./schema.js";

const mapPath = (nodeId: string) => `/project/assets/maps/${nodeId}.tmj`;

export interface EntityDeps {
    complete(request: LlmCompleteRequest): Promise<LlmCompleteResponse>;
}

function defaultDeps(): EntityDeps {
    return {
        async complete(request) {
            const { complete } = await import("../../../llm/router.js");
            return complete(request);
        },
    };
}

interface PlannedEntity {
    id: string;
    kind: string;
    slot_id?: string;
    grants?: string[];
}

async function handler(invocation: ToolInvocation, deps: EntityDeps = defaultDeps()) {
    const start = Date.now();
    const input = EntityPlacementInputSchema.parse({
        ...invocation.input,
        project_id: invocation.project_id,
        plan_version: invocation.plan_version,
        trace_id: invocation.trace_id,
    });
    const tool = { tool_id: "entity_placement" as const, node_id: invocation.node_id, trace_id: invocation.trace_id };
    const layout = input.layout as AbstractLayout;
    const tiledMap = input.tilemap as unknown as TiledMap;
    const qa_log: QaLog = [];

    // DeepSeek decides what populates each slot (counts/types/params by difficulty).
    const completion = await deps.complete({
        model: "deepseek-chat",
        system:
            "You are a game balance designer. Given a level's entity slots, decide concrete " +
            "entity types and counts per slot, scaled by difficulty. Required pickup slots MUST " +
            "keep exactly one entity that grants their item. Return JSON {entities:[{id,kind,slot_id,grants}]}.",
        user:
            `Genre: ${input.genre}. Difficulty: ${input.difficulty}. ` +
            `Slots: ${JSON.stringify(layout.entity_slots)}.`,
        max_tokens: 2048,
        temperature: 0.4,
        trace_id: invocation.trace_id,
    });
    const planned = parsePlanned(completion.output, layout);

    // Snap each planned entity to its slot's walkable tile (slots are placed on
    // walkable cells by level_layout_2d). Required-grant entities keep their slot.
    const grid = walkableGridFromLayout(layout);
    const reached = reachableCells(grid, layout.entry);
    const slotById = new Map(layout.entity_slots.map((s) => [s.id, s]));

    const entities: { id: string; kind: string; x: number; y: number; grants: string[] }[] = [];
    const objects: TiledObject[] = [];
    let objId = 1;
    for (const p of planned) {
        const slot = p.slot_id ? slotById.get(p.slot_id) : undefined;
        const pos: Point = slot ? { x: slot.x, y: slot.y } : nearestWalkable(grid, layout.entry);
        const grants = p.grants ?? slot?.grants ?? [];
        entities.push({ id: p.id, kind: p.kind, x: pos.x, y: pos.y, grants });
        objects.push({
            id: objId++, name: p.id, type: p.kind,
            x: pos.x * layout.tile_px, y: pos.y * layout.tile_px,
            properties: grants.length ? [{ name: "grants", type: "string", value: grants.join(",") }] : undefined,
        });
    }

    // Platformer (no tilemap): platforms are gap-separated, so the 4-dir BFS
    // moat doesn't apply (the level already validated jump-reachability). Skip
    // the walkable/reachability QA — entities are placed on the layout's slots.
    const isPlatformer = !input.tilemap || layout.meta?.strategy === "platform";
    let allOnWalkable = true;
    let reachable = true;
    if (!isPlatformer) {
        allOnWalkable = entities.every((e) => grid[e.y]?.[e.x] === true);
        qa_log.push({ check: "entities_on_walkable", passed: allOnWalkable, detail: allOnWalkable ? null : "an entity is inside a wall" });
        const requiredGoals: Point[] = entities.filter((e) => e.grants.length > 0).map((e) => ({ x: e.x, y: e.y }));
        reachable = isReachable(grid, layout.entry, [layout.exit, ...requiredGoals]);
        qa_log.push({ check: "required_entities_reachable", passed: reachable, detail: reachable ? null : "a required-grant entity is unreachable" });
    }
    void reached;

    // tilemap may be absent (platformer) → emit just the entities (no map merge).
    const mapWithEntities = tiledMap ? withEntities(tiledMap, objects) : { entities: objects };
    const files = [{ path: mapPath(layout.node_id), content: JSON.stringify(mapWithEntities), encoding: "utf-8" as const }];

    const passed = allOnWalkable && reachable;
    const output: EntityPlacementOutput = {
        trace_id: invocation.trace_id, cost_usd: completion.cost_usd, latency_ms: Date.now() - start,
        qa_log: [], entities, tilemap_with_entities: mapWithEntities as unknown as Record<string, unknown>, files,
    };
    return makeResult({
        invocation: tool,
        output: passed ? EntityPlacementOutputSchema.parse(output) : null,
        qa_log,
        cost_usd: completion.cost_usd,
        latency_ms: Date.now() - start,
    });
}

function parsePlanned(raw: unknown, layout: AbstractLayout): PlannedEntity[] {
    const obj = (raw ?? {}) as { entities?: unknown };
    const arr = Array.isArray(obj.entities) ? (obj.entities as Record<string, unknown>[]) : [];
    const planned: PlannedEntity[] = arr.map((e, i) => ({
        id: String(e.id ?? `entity_${i}`),
        kind: String(e.kind ?? "enemy"),
        slot_id: e.slot_id ? String(e.slot_id) : undefined,
        grants: Array.isArray(e.grants) ? (e.grants as string[]) : undefined,
    }));
    // Safety net: ensure every required slot has exactly one granting entity,
    // even if the LLM omitted it (the moat depends on this).
    for (const slot of layout.entity_slots.filter((s) => s.required)) {
        if (!planned.some((p) => p.slot_id === slot.id)) {
            planned.push({ id: `req_${slot.id}`, kind: "pickup", slot_id: slot.id, grants: slot.grants });
        }
    }
    return planned;
}

function nearestWalkable(grid: boolean[][], from: Point): Point {
    if (grid[from.y]?.[from.x]) return from;
    for (let y = 0; y < grid.length; y++) {
        for (let x = 0; x < (grid[y]?.length ?? 0); x++) {
            if (grid[y]![x]) return { x, y };
        }
    }
    return from;
}

const descriptor: Tool<EntityDeps> = {
    id: "entity_placement",
    name: "Entity Placement",
    description: "Places enemies/pickups/NPCs on the tilemap (DeepSeek, difficulty-scaled), reachability-verified.",
    category: "level",
    inputSchema: EntityPlacementInputSchema,
    outputSchema: EntityPlacementOutputSchema,
    estimatedCostUsd: 0.005,
    estimatedDurationSeconds: 4,
    handler,
};
export default descriptor;
