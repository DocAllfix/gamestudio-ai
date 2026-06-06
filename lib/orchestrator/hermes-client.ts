/**
 * W4 adapter for the Hermes orchestrator — Next.js / Turbopack compatible.
 *
 * Does NOT import from lib/contracts/ (those use .js ESM suffixes that
 * Turbopack cannot resolve). Instead defines the minimal request/response
 * shapes inline using Zod, mirroring HermesPlanRequestSchema and
 * HermesPlanResponseSchema from reasoning-engine.contract.ts.
 *
 * The real Hermes (lib/orchestrator/hermes.ts) is loaded via a dynamic import
 * INSIDE runHermesPlan — this file is only imported from "use server" code
 * (app/(creator)/create/actions.ts), so the heavy graph (which transitively
 * imports lib/contracts/*.js) loads at runtime on the server, never in the
 * client/Turbopack bundle. The inline Zod schemas + types below stay so the
 * client keeps its types without importing the contracts.
 */
import { z } from "zod";

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
  build_artifact_id?: string | null;
  /** Public URL of the browser-playable build, embedded in /play/<id>. */
  iframe_url?: string | null;
};

// ---- Real implementation (delegates to W1 Hermes, server-side only) --------

export async function runHermesPlan(
  request: HermesPlanRequest,
): Promise<HermesPlanResponse> {
  // Validate with the inline schema, then hand to the real orchestrator. The
  // dynamic import keeps lib/orchestrator/hermes.ts (and its contracts/*.js
  // graph) out of the client/Turbopack bundle — this runs only in "use server".
  const parsed = HermesPlanRequestSchema.parse(request);
  // No .js suffix here: this dynamic import is resolved by Turbopack/Next, which
  // wants the extensionless specifier (the rest of the repo uses .js for tsx/ESM).
  const { runHermesPlan: runReal } = await import("./hermes");
  // The real request type matches this shape; cast across the inline/contract
  // type boundary (same fields, validated above).
  const response = await runReal(parsed as unknown as Parameters<typeof runReal>[0]);
  return response as unknown as HermesPlanResponse;
}
