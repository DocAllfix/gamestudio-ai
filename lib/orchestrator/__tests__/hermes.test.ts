/**
 * Hermes loop [3-W1] — the outer reasoning loop that replaces
 * orchestrator.mock.ts (runHermesPlan).
 *
 * D.1 → D.2 → D.3 (gate) → D.4 → D.5 → D.6(stub). The whole response
 * must round-trip HermesPlanResponseSchema; the final_plan's project_id
 * must equal the response project_id; the iteration log records the
 * phases taken.
 */
import { describe, expect, it } from "vitest";

import {
    HermesPlanResponseSchema,
    type HermesPlanRequest,
} from "../../contracts/reasoning-engine.contract.js";
import { hermesOrchestrator } from "../hermes.js";

function request(overrides: Partial<HermesPlanRequest> = {}): HermesPlanRequest {
    return {
        user_id: "user_abc",
        project_id: null,
        user_prompt: "A hard pixel-art platformer with a boss at the end.",
        moodboard_image_urls: [],
        reference_game_ids: [],
        ...overrides,
    };
}

describe("HermesOrchestrator.run", () => {
    it("returns a response that round-trips HermesPlanResponseSchema", async () => {
        const res = await hermesOrchestrator.run(request());
        expect(() => HermesPlanResponseSchema.parse(res)).not.toThrow();
    });

    it("reconciles final_plan.project_id with the response project_id", async () => {
        const res = await hermesOrchestrator.run(request());
        expect(res.final_plan.project_id).toBe(res.project_id);
    });

    it("honours forced_engine end-to-end", async () => {
        const res = await hermesOrchestrator.run(request({ forced_engine: "phaser" }));
        expect(res.final_plan.meta.engine).toBe("phaser");
    });

    it("records an iteration log covering the core phases", async () => {
        const res = await hermesOrchestrator.run(request());
        const phases = res.iterations.map((i) => i.phase);
        expect(phases).toContain("intent");
        expect(phases).toContain("design");
        expect(phases).toContain("consistency");
        expect(phases).toContain("execution");
        expect(phases).toContain("evaluation");
    });

    it("passes the D.3 gate on a clean baseline plan (overall_passed reflects evaluation)", async () => {
        const res = await hermesOrchestrator.run(request());
        // The baseline skeleton has no soft-lock, so the gate must not
        // short-circuit; execution + evaluation run and set overall_passed.
        expect(typeof res.overall_passed).toBe("boolean");
        expect(res.final_report.overall_passed).toBe(res.overall_passed);
    });
});
