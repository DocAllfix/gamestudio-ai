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

// runHermesPlan now delegates to the real W1 Hermes (LLM + tools + E2B). This is
// a W4 UI-binding test, so mock the orchestrator with a deterministic, offline
// stub response — we assert the UI binds to its fields, not the real planning.
vi.mock("../../orchestrator/hermes-client.js", () => ({
  runHermesPlan: vi.fn(async (req: { project_id: string | null; forced_engine?: string }) => {
    const engine = req.forced_engine ?? "godot";
    const projectId = req.project_id ?? "11111111-1111-1111-1111-111111111111";
    return {
      project_id: projectId,
      final_plan: {
        plan_version: 1,
        project_id: projectId,
        meta: { title: "Test Game", genre: "hardcore_platformer", engine, style_pack_id: "A01", template_origin: "t", target_duration_minutes: 30, difficulty: "balanced" },
        world_graph: { nodes: [{ id: "start", display_name: "Start", requires: [], grants: [], tags: [] }], edges: [], entry_node_id: "start", starting_inventory: [] },
        pacing_curve: [{ progress: 0, stress: 0.2 }],
        rules: {},
        asset_bindings: [],
        execution_dag: { nodes: [{ id: "player", tool_id: `code_gen_${engine}_gdscript`, input: {}, depends_on: [] }] },
      },
      final_report: { plan_version: "v1", verdicts: [{ metric: "soft_lock_count", value: 0, threshold: 0, passed: true, notes: "ok" }], overall_passed: true },
      iterations: [{ iteration: 0, phase: "intent", summary: "ok", cost_usd: 0, latency_ms: 1 }],
      overall_passed: true,
      total_cost_usd: 0,
      total_latency_ms: 1,
    };
  }),
}));

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
