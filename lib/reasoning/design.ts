/**
 * D.2 Design Planner (PARTE D.2).
 *
 * Two modes, discriminated by `refinement_request`:
 *   - absent  → initial design pass: returns the fleshed plan as a
 *               `full_plan`. (Day-1 the structural pass is a pass-through
 *               of the D.1 skeleton; richer design lives behind the W2
 *               LLM router and is layered in post-merge.)
 *   - present → refine pass: emits an RFC 6902 `GamePlanPatch` against
 *               the plan's current version. The patch is what the
 *               game-plan-versioning backend persists via
 *               `apply_game_plan_diff` ([3-W1]).
 *
 * The patch ops are restricted to add/remove/replace per the contract.
 * We emit a single `replace` on `/meta/title` carrying the refinement
 * intent — a minimal, schema-valid diff. Real refinements (LLM-driven,
 * multi-op) plug in at the same seam without changing the output shape.
 */
import {
    type DesignPlanner,
    type DesignPlannerInput,
    type DesignPlannerOutput,
    DesignPlannerInputSchema,
} from "../contracts/reasoning-engine.contract.js";
import {
    type GamePlan,
    type GamePlanPatch,
} from "../contracts/game-plan.contract.js";
import { buildExecutionDag } from "./dag-builder.js";

function refinementPatch(
    plan: GamePlan,
    request: string,
): GamePlanPatch {
    return {
        project_id: plan.project_id,
        parent_version: plan.plan_version,
        ops: [
            {
                op: "replace",
                path: "/meta/title",
                value: plan.meta.title,
            },
        ],
        summary: request.slice(0, 280),
    };
}

export const designPlanner: DesignPlanner = {
    async refine(
        rawInput: DesignPlannerInput,
    ): Promise<DesignPlannerOutput> {
        const input = DesignPlannerInputSchema.parse(rawInput);

        if (input.refinement_request === undefined) {
            // Structural design: replace the 1-node skeleton DAG with the full
            // per-genre/engine pipeline so generation orchestrates all the real
            // tools (sprite, levels, tilemap, entities, audio, code).
            const { meta } = input.plan;
            const execution_dag = buildExecutionDag({
                genre: meta.genre,
                engine: meta.engine,
                style_pack_id: meta.style_pack_id,
                difficulty: meta.difficulty,
            });
            return {
                result: {
                    kind: "full_plan",
                    plan: { ...input.plan, execution_dag },
                },
                memory: input.memory,
            };
        }

        return {
            result: {
                kind: "patch",
                patch: refinementPatch(input.plan, input.refinement_request),
            },
            memory: input.memory,
        };
    },
};
