/**
 * Hermes orchestrator mock — consumed by W4 (Frontend) while W1
 * builds the real `lib/orchestrator/hermes.ts`.
 *
 * Validates the inbound HermesPlanRequest, returns a Zod-validated
 * stub HermesPlanResponse. The stub plan is intentionally generic —
 * W4 should bind UI to fields not values.
 *
 * Replace at merge time per Supreme Plan §07.
 */
import { randomUUID } from "node:crypto";

import {
    type HermesPlanRequest,
    HermesPlanRequestSchema,
    type HermesPlanResponse,
    HermesPlanResponseSchema,
} from "../contracts/reasoning-engine.contract.js";
import { type GamePlan } from "../contracts/game-plan.contract.js";

/** Stub Game Plan that satisfies GamePlanSchema. Used as the
 * `final_plan` field of the mock HermesPlanResponse. The shape mirrors
 * a smallest-valid Hardcore Platformer Godot project — enough to let
 * the W4 UI render every field without optional fallbacks. */
function buildStubPlan(projectId: string): GamePlan {
    return {
        plan_version: 1,
        project_id: projectId,
        meta: {
            title: "Stub Platformer (mocked)",
            genre: "hardcore_platformer",
            engine: "godot",
            style_pack_id: "pixel-art-dark",
            template_origin: "hardcore_platformer_godot",
            target_duration_minutes: 30,
            difficulty: "balanced",
        },
        world_graph: {
            nodes: [
                { id: "start", display_name: "Start", requires: [], grants: [], tags: [] },
                { id: "boss", display_name: "Boss room", requires: [], grants: [], tags: [] },
            ],
            edges: [{ from: "start", to: "boss", requires: [], bidirectional: true }],
            entry_node_id: "start",
            starting_inventory: [],
        },
        pacing_curve: [
            { progress: 0, stress: 0.2 },
            { progress: 0.5, stress: 0.5 },
            { progress: 1, stress: 0.9 },
        ],
        rules: { player_hp: 100, enemy_dmg: 10 },
        asset_bindings: [],
        execution_dag: {
            nodes: [
                {
                    id: "player",
                    tool_id: "code_gen_godot_gdscript",
                    input: { mechanic: "player_controller" },
                    depends_on: [],
                },
            ],
        },
    };
}

/** Mock entrypoint for the entire reasoning loop. W4's Creator Mode
 * calls this; the real implementation lives in
 * `lib/orchestrator/hermes.ts` once W1 ships. */
export async function runHermesPlan(
    request: HermesPlanRequest,
): Promise<HermesPlanResponse> {
    const parsed = HermesPlanRequestSchema.parse(request);
    const projectId = parsed.project_id ?? randomUUID();
    const stubPlan = buildStubPlan(projectId);

    return HermesPlanResponseSchema.parse({
        project_id: projectId,
        final_plan: stubPlan,
        final_report: {
            plan_version: "v1",
            verdicts: [
                {
                    metric: "aesthetic_coherence",
                    value: 0.82,
                    threshold: 0.75,
                    passed: true,
                    notes: "mocked verdict — replace at merge time",
                },
            ],
            overall_passed: true,
        },
        iterations: [
            {
                iteration: 0,
                phase: "intent",
                summary: "mocked iteration log entry",
                cost_usd: 0,
                latency_ms: 0,
            },
        ],
        overall_passed: true,
        total_cost_usd: 0,
        total_latency_ms: 0,
    });
}
