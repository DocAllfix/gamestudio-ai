/**
 * D.2 Design Planner — [1-W1] DONE criteria.
 *
 * Initial pass (no refinement_request) → result.kind === "full_plan",
 * the plan validates GamePlanSchema. A refine pass (with a
 * refinement_request) → result.kind === "patch", the patch validates
 * GamePlanPatchSchema (RFC 6902, ops add/remove/replace).
 */
import { describe, expect, it } from "vitest";

import {
    DesignPlannerOutputSchema,
    type DesignPlannerInput,
    HermesMemorySchema,
} from "../../contracts/reasoning-engine.contract.js";
import {
    GamePlanPatchSchema,
    GamePlanSchema,
    type GamePlan,
} from "../../contracts/game-plan.contract.js";
import { intentInterpreter } from "../intent.js";
import { designPlanner } from "../design.js";

const emptyMemory = HermesMemorySchema.parse({});

async function seedPlan(): Promise<GamePlan> {
    const out = await intentInterpreter.propose({
        user_prompt: "A hard 2D platformer, pixel art, boss at the end.",
        memory: emptyMemory,
    });
    return out.draft_plan;
}

function input(plan: GamePlan, refinement_request?: string): DesignPlannerInput {
    return { plan, refinement_request, memory: emptyMemory };
}

describe("D.2 DesignPlanner.refine", () => {
    it("returns a full_plan on the initial pass (no refinement_request)", async () => {
        const { result } = await designPlanner.refine(input(await seedPlan()));
        expect(result.kind).toBe("full_plan");
        if (result.kind === "full_plan") {
            expect(() => GamePlanSchema.parse(result.plan)).not.toThrow();
        }
    });

    it("returns a patch that GamePlanPatchSchema.parse accepts on a refine pass", async () => {
        const { result } = await designPlanner.refine(
            input(await seedPlan(), "Make the boss easier and add a secret room."),
        );
        expect(result.kind).toBe("patch");
        if (result.kind === "patch") {
            expect(() => GamePlanPatchSchema.parse(result.patch)).not.toThrow();
        }
    });

    it("the patch targets the plan it was given (parent_version + project_id)", async () => {
        const plan = await seedPlan();
        const { result } = await designPlanner.refine(
            input(plan, "Buff the player HP."),
        );
        expect(result.kind).toBe("patch");
        if (result.kind === "patch") {
            expect(result.patch.parent_version).toBe(plan.plan_version);
            expect(result.patch.project_id).toBe(plan.project_id);
        }
    });

    it("round-trips the full DesignPlannerOutput through its contract", async () => {
        const out = await designPlanner.refine(
            input(await seedPlan(), "Add a checkpoint."),
        );
        expect(() => DesignPlannerOutputSchema.parse(out)).not.toThrow();
    });
});
