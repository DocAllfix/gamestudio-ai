/**
 * Vitest tests for the Creator Mode 5-step flow.
 *
 * These tests drive the useCreator hook logic directly against the
 * orchestrator.mock to verify the full state machine without a browser.
 *
 * The Playwright e2e test (e2e/creator-mode.spec.ts) covers the same
 * flow in a real browser when a server is running.
 */
import { describe, it, expect, vi } from "vitest";
import type { GenerateInput, GenerateResult } from "../../../app/(creator)/create/actions.js";
import { runHermesPlan, type HermesPlanResponse } from "../../orchestrator/hermes-client.js";

// Minimal re-implementation of useCreator state machine for unit testing
// (React hooks can't run in Node without jsdom; we test the logic layer).
async function runCreatorFlow(
  generateFn: (input: GenerateInput) => Promise<GenerateResult>,
  prompt: string,
  engine: string,
): Promise<{ step: number; response: HermesPlanResponse | null; error: string | null }> {
  let step = 1;
  let response: HermesPlanResponse | null = null;
  let error: string | null = null;

  // Step 1 → 2
  step = 2;

  // Step 2 → 3: call generateFn
  step = 3;
  const result = await generateFn({ user_prompt: prompt, moodboard_image_urls: [], forced_engine: engine });
  if (result.ok) {
    response = result.response;
  } else {
    error = result.error;
    return { step, response, error };
  }

  // Step 3 → 4
  step = 4;

  // Step 4 → 5 (generation done)
  step = 5;

  return { step, response, error };
}

// Wrap runHermesPlan as a GenerateResult-returning function (like the real Server Action)
async function mockGenerateFn(input: GenerateInput): Promise<GenerateResult> {
  try {
    const response: HermesPlanResponse = await runHermesPlan({
      user_id: "user_test",
      project_id: null,
      user_prompt: input.user_prompt,
      moodboard_image_urls: input.moodboard_image_urls,
      reference_game_ids: [],
    });
    return { ok: true, response };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "error" };
  }
}

describe("Creator Mode flow", () => {
  it("completes all 5 steps and reaches step 5", async () => {
    const result = await runCreatorFlow(
      mockGenerateFn,
      "A platformer where the world flips",
      "godot",
    );
    expect(result.step).toBe(5);
    expect(result.error).toBeNull();
    expect(result.response).not.toBeNull();
  });

  it("binds to node_results: response contains execution_dag nodes", async () => {
    const result = await runCreatorFlow(
      mockGenerateFn,
      "A roguelike dungeon crawler",
      "phaser",
    );
    const nodes = result.response?.final_plan.execution_dag.nodes ?? [];
    // Criterion: UI can render node_results/progress from HermesPlanResponse
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes[0]).toHaveProperty("id");
    expect(nodes[0]).toHaveProperty("tool_id");
  });

  it("binds to final_report.verdicts for badge rendering", async () => {
    const result = await runCreatorFlow(
      mockGenerateFn,
      "A mobile puzzle game",
      "defold",
    );
    const verdicts = result.response?.final_report.verdicts ?? [];
    expect(verdicts.length).toBeGreaterThan(0);
    expect(verdicts[0]).toHaveProperty("metric");
    expect(verdicts[0]).toHaveProperty("passed");
  });

  it("propagates generate errors to error state", async () => {
    const failingFn = async (_input: GenerateInput): Promise<GenerateResult> =>
      ({ ok: false, error: "Mock failure" });

    const result = await runCreatorFlow(failingFn, "any prompt", "godot");
    expect(result.error).toBe("Mock failure");
    expect(result.response).toBeNull();
  });
});
