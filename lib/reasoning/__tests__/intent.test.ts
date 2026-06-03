/**
 * D.1 Intent Interpreter — [1-W1] DONE criteria.
 *
 * The binding gate is `GamePlanSchema.parse(output.draft_plan)` not
 * throwing. We assert the full IntentInterpreterOutput round-trips
 * through its contract too, since W4 binds the UI to it.
 */
import { describe, expect, it } from "vitest";

import {
    IntentInterpreterOutputSchema,
    type IntentInterpreterInput,
    HermesMemorySchema,
} from "../../contracts/reasoning-engine.contract.js";
import { GamePlanSchema } from "../../contracts/game-plan.contract.js";
import { intentInterpreter } from "../intent.js";

const emptyMemory = HermesMemorySchema.parse({});

function briefInput(
    overrides: Partial<IntentInterpreterInput> = {},
): IntentInterpreterInput {
    return {
        user_prompt:
            "A hard 2D platformer with a crystal cave, a boss at the end, " +
            "and tight jumping. Pixel art, dark mood.",
        memory: emptyMemory,
        ...overrides,
    };
}

describe("D.1 IntentInterpreter.propose", () => {
    it("produces a draft_plan that GamePlanSchema.parse accepts", async () => {
        const output = await intentInterpreter.propose(briefInput());
        expect(() => GamePlanSchema.parse(output.draft_plan)).not.toThrow();
    });

    it("returns a full IntentInterpreterOutput that round-trips its contract", async () => {
        const output = await intentInterpreter.propose(briefInput());
        expect(() =>
            IntentInterpreterOutputSchema.parse(output),
        ).not.toThrow();
        expect(output.rationale.length).toBeGreaterThan(0);
    });

    it("honours forced_engine when the user pins one", async () => {
        const output = await intentInterpreter.propose(
            briefInput({ forced_engine: "phaser" }),
        );
        expect(output.draft_plan.meta.engine).toBe("phaser");
    });

    it("emits a draft_plan at version 1 (freshly created from a template)", async () => {
        const output = await intentInterpreter.propose(briefInput());
        expect(output.draft_plan.plan_version).toBe(1);
    });

    it("produces a world_graph whose entry_node_id exists in nodes", async () => {
        const { world_graph } = (await intentInterpreter.propose(briefInput()))
            .draft_plan;
        const ids = world_graph.nodes.map((n) => n.id);
        expect(ids).toContain(world_graph.entry_node_id);
    });
});
