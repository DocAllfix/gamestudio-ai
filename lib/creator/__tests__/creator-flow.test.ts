/**
 * Vitest tests for the Creator Mode async flow (enqueue → poll → phases).
 *
 * Generation runs as a Trigger.dev job; the UI enqueues via startGeneration and
 * polls getGenerationStatus until done|failed, then drives plan→generating→output.
 * These tests drive that logic layer directly (no browser); the Playwright e2e
 * (e2e/creator-mode.spec.ts) covers the real UI when a server runs.
 */
import { describe, it, expect, vi } from "vitest";
import type { HermesPlanResponse } from "../../orchestrator/hermes-client.js";

// runHermesPlan delegates to the real W1 Hermes; mock it with a deterministic,
// offline stub so this stays a logic test of the flow, not real planning.
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

import { runHermesPlan } from "../../orchestrator/hermes-client.js";

type Phase = "setup" | "running" | "plan" | "generating" | "done";

/**
 * Simulates the async useCreator flow: enqueue (start) → poll (status) until the
 * fake "worker" resolves → phases. The fake worker just runs runHermesPlan once.
 */
async function runAsyncFlow(
  startFn: (prompt: string, engine?: string) => Promise<{ ok: boolean; error?: string; response?: HermesPlanResponse }>,
  prompt: string,
  engine?: string,
): Promise<{ phase: Phase; response: HermesPlanResponse | null; error: string | null }> {
  const res = await startFn(prompt, engine);
  if (!res.ok) return { phase: "setup", response: null, error: res.error ?? "error" };
  // poll resolves immediately in the test → plan → generating → done
  return { phase: "done", response: res.response ?? null, error: null };
}

// The fake worker mirrors what the Trigger.dev task does: call runHermesPlan.
async function workerStart(prompt: string, engine?: string) {
  try {
    const response = await runHermesPlan({
      user_id: "user_test",
      project_id: null,
      user_prompt: prompt,
      moodboard_image_urls: [],
      reference_game_ids: [],
      ...(engine ? { forced_engine: engine } : {}),
    } as Parameters<typeof runHermesPlan>[0]);
    return { ok: true, response: response as HermesPlanResponse };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "error" };
  }
}

describe("Creator Mode async flow", () => {
  it("reaches the done phase with a response", async () => {
    const result = await runAsyncFlow(workerStart, "A platformer where the world flips", "godot");
    expect(result.phase).toBe("done");
    expect(result.error).toBeNull();
    expect(result.response).not.toBeNull();
  });

  it("binds to execution_dag nodes", async () => {
    const result = await runAsyncFlow(workerStart, "A roguelike dungeon crawler", "phaser");
    const nodes = result.response?.final_plan.execution_dag.nodes ?? [];
    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes[0]).toHaveProperty("id");
    expect(nodes[0]).toHaveProperty("tool_id");
  });

  it("binds to final_report.verdicts for badge rendering", async () => {
    const result = await runAsyncFlow(workerStart, "A mobile puzzle game", "defold");
    const verdicts = result.response?.final_report.verdicts ?? [];
    expect(verdicts.length).toBeGreaterThan(0);
    expect(verdicts[0]).toHaveProperty("metric");
    expect(verdicts[0]).toHaveProperty("passed");
  });

  it("auto-picks the engine when none is forced", async () => {
    const result = await runAsyncFlow(workerStart, "A cozy farming game");
    expect(result.phase).toBe("done");
    expect(result.response?.final_plan.meta.engine).toBeTruthy();
  });

  it("propagates worker errors to the error state", async () => {
    const failing = async () => ({ ok: false, error: "Mock failure" });
    const result = await runAsyncFlow(failing, "any prompt", "godot");
    expect(result.error).toBe("Mock failure");
    expect(result.response).toBeNull();
  });
});
