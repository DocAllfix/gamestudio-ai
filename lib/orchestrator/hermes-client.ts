/**
 * W4 adapter for the Hermes orchestrator — Next.js / Turbopack compatible.
 *
 * Does NOT import from lib/contracts/ (those use .js ESM suffixes that
 * Turbopack cannot resolve). Instead defines the minimal request/response
 * shapes inline using Zod, mirroring HermesPlanRequestSchema and
 * HermesPlanResponseSchema from reasoning-engine.contract.ts.
 *
 * Replace at merge time: swap this mock with the real hermes.ts (W1).
 * When W1 ships the lib/contracts .js issue will be resolved repo-wide
 * because W1 owns the build context.
 */
import { z } from "zod";
import { randomUUID } from "crypto";

// ---- Minimal inline schemas (mirrors the contracts, no .js imports) -------

const MetricVerdictSchema = z.object({
  metric: z.enum([
    "aesthetic_coherence",
    "soft_lock_count",
    "stress_curve_rmse",
    "smoke_test_pass_rate",
    "generation_cost_usd",
    "generation_time_seconds",
  ]),
  value: z.number(),
  threshold: z.number(),
  passed: z.boolean(),
  notes: z.string(),
});

const EvaluationReportSchema = z.object({
  plan_version: z.string().min(1),
  verdicts: z.array(MetricVerdictSchema).min(1),
  overall_passed: z.boolean(),
});

export const HermesPlanRequestSchema = z.object({
  user_id: z.string().min(1),
  project_id: z.string().uuid().nullable(),
  user_prompt: z.string().min(1).max(4000),
  moodboard_image_urls: z.array(z.string()).max(20).default([]),
  reference_game_ids: z.array(z.string()).max(20).default([]),
  forced_engine: z
    .enum([
      "godot",
      "phaser",
      "renpy",
      "defold",
      "monogame",
      "love2d",
      "threejs",
      "stride",
      "babylon",
    ])
    .optional(),
});

export type HermesPlanRequest = z.infer<typeof HermesPlanRequestSchema>;
export type HermesPlanResponse = {
  project_id: string;
  final_plan: {
    plan_version: number;
    project_id: string;
    meta: {
      title: string;
      genre: string;
      engine: string;
      style_pack_id: string;
      template_origin: string;
      target_duration_minutes: number;
      difficulty: string;
    };
    world_graph: {
      nodes: Array<{ id: string; display_name: string; requires: string[]; grants: string[]; tags: string[] }>;
      edges: Array<{ from: string; to: string; requires: string[]; bidirectional: boolean }>;
      entry_node_id: string;
      starting_inventory: string[];
    };
    pacing_curve: Array<{ progress: number; stress: number }>;
    rules: Record<string, number | string | boolean>;
    asset_bindings: unknown[];
    execution_dag: {
      nodes: Array<{
        id: string;
        tool_id: string;
        input: Record<string, unknown>;
        depends_on: string[];
      }>;
    };
  };
  final_report: z.infer<typeof EvaluationReportSchema>;
  iterations: Array<{
    iteration: number;
    phase: string;
    summary: string;
    cost_usd: number;
    latency_ms: number;
  }>;
  overall_passed: boolean;
  total_cost_usd: number;
  total_latency_ms: number;
};

// ---- Mock implementation --------------------------------------------------

export async function runHermesPlan(
  request: HermesPlanRequest,
): Promise<HermesPlanResponse> {
  const parsed = HermesPlanRequestSchema.parse(request);
  const projectId = parsed.project_id ?? randomUUID();
  const engine = parsed.forced_engine ?? "godot";

  return {
    project_id: projectId,
    final_plan: {
      plan_version: 1,
      project_id: projectId,
      meta: {
        title: "Stub Platformer (mocked)",
        genre: "hardcore_platformer",
        engine,
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
            tool_id: `code_gen_${engine}_gdscript`,
            input: { mechanic: "player_controller" },
            depends_on: [],
          },
          {
            id: "level",
            tool_id: `code_gen_${engine}_gdscript`,
            input: { mechanic: "level_layout" },
            depends_on: ["player"],
          },
          {
            id: "enemy",
            tool_id: `code_gen_${engine}_gdscript`,
            input: { mechanic: "enemy_ai" },
            depends_on: ["player"],
          },
        ],
      },
    },
    final_report: EvaluationReportSchema.parse({
      plan_version: "v1",
      verdicts: [
        {
          metric: "aesthetic_coherence",
          value: 0.82,
          threshold: 0.75,
          passed: true,
          notes: "mocked",
        },
        {
          metric: "soft_lock_count",
          value: 0,
          threshold: 0,
          passed: true,
          notes: "no soft locks",
        },
        {
          metric: "smoke_test_pass_rate",
          value: 1.0,
          threshold: 0.95,
          passed: true,
          notes: "all passed",
        },
      ],
      overall_passed: true,
    }),
    iterations: [
      {
        iteration: 0,
        phase: "intent",
        summary: "Interpreted brief as hardcore platformer",
        cost_usd: 0,
        latency_ms: 120,
      },
      {
        iteration: 0,
        phase: "execution",
        summary: "Generated 3 DAG nodes",
        cost_usd: 0,
        latency_ms: 800,
      },
    ],
    overall_passed: true,
    total_cost_usd: 0,
    total_latency_ms: 920,
  };
}
