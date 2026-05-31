/**
 * Evaluation Metrics Contract — the WOW promise thresholds.
 *
 * These constants encode what "shippable game" means for Game Studio AI
 * across all 4 workstreams. They are taken verbatim from
 * `docs/GAME_REASONING_ENGINE_BLUEPRINT_v2.md` PARTE A.1 (KPI Wow
 * Effect) and `docs/PIETRA_v5_ADDENDUM.md` §A.1.
 *
 * Treat the thresholds as system-wide invariants: W1 enforces them in
 * D.6 Evaluation Agent, W3 reports the raw numbers from the sandbox,
 * W4 surfaces violations in the UI. The numbers are deliberately
 * hardcoded rather than tunable — Sett 5 tuning is documented in the
 * blueprint as a follow-up and lives in a separate constants file
 * when that happens.
 */
import { z } from "zod";

// ---- Thresholds (system-wide invariants) ---------------------------------

/** Minimum mean CLIP cosine similarity between generated screenshot and
 * the Style Pack reference moodboard. Below this the game is rejected
 * as visually incoherent and a new generation pass is attempted. */
export const AESTHETIC_COHERENCE_MIN = 0.75;

/** Maximum root-mean-square error between the projected pacing curve
 * (from the Game Plan) and the curve measured by the Playtester Agent
 * over N=10 simulated runs. Above this the balance loop iterates. */
export const STRESS_CURVE_RMSE_MAX = 0.15;

/** Minimum smoke-test pass rate across the 8 supported engines for a
 * batch of generated games to ship. The smoke test is a 10-second
 * headless run with crash detection per engine. */
export const SMOKE_TEST_PASS_RATE_MIN = 0.95;

/** Soft locks are dead-end world states the player cannot escape.
 * The Consistency Manager (D.3) ASP-validates the world graph; any
 * count > 0 fails the gate. */
export const SOFT_LOCK_COUNT_MAX = 0;

/** Per-game LLM + image + audio + 3D generation cost ceiling on the
 * Free tier. Above this the user is bumped to a paid plan or the run
 * is aborted with a clear quota message. */
export const GENERATION_COST_USD_MAX = 1.5;

/** Wall-clock seconds from "user clicks Generate" to "playable build in
 * sandbox". Above this we either streamline the DAG or fall back to a
 * cheaper-and-faster baseline template. */
export const GENERATION_TIME_SECONDS_MAX = 15 * 60;

// ---- Per-metric input schemas --------------------------------------------

/** Aesthetic coherence measurement: a Style Pack id + the generated
 * screenshot URLs + the reference moodboard URLs. The downstream
 * function fetches the embeddings and computes mean cosine similarity. */
export const AestheticCoherenceInputSchema = z.object({
    style_pack_id: z.string().min(1),
    generated_screenshot_urls: z.array(z.string().url()).min(1).max(20),
    reference_moodboard_urls: z.array(z.string().url()).min(1).max(20),
});
export type AestheticCoherenceInput = z.infer<
    typeof AestheticCoherenceInputSchema
>;

/** Soft-lock detection input: the world graph from D.2 Design Planner.
 * The Consistency Manager wraps this into a clingo ASP program. */
export const SoftLockDetectionInputSchema = z.object({
    world_graph_nodes: z
        .array(
            z.object({
                id: z.string().min(1),
                /** Items the player must have to ENTER this node. */
                requires: z.array(z.string()).default([]),
                /** Items the player can OBTAIN here. */
                grants: z.array(z.string()).default([]),
            }),
        )
        .min(1),
    world_graph_edges: z.array(
        z.object({
            from: z.string().min(1),
            to: z.string().min(1),
            /** Items required to traverse this edge. */
            requires: z.array(z.string()).default([]),
        }),
    ),
    /** Inventory the player starts the game with. Empty array is the
     * common case ("you start with nothing"). */
    starting_inventory: z.array(z.string()).default([]),
});
export type SoftLockDetectionInput = z.infer<
    typeof SoftLockDetectionInputSchema
>;

/** Playtest stress curve input: the planned curve from the Game Plan +
 * the measured stress samples from N playthroughs. RMSE is computed
 * between the two normalized to the same length. */
export const StressCurveInputSchema = z.object({
    planned_curve: z.array(z.number().min(0).max(1)).min(2),
    measured_runs: z
        .array(z.array(z.number().min(0).max(1)).min(2))
        .min(1),
});
export type StressCurveInput = z.infer<typeof StressCurveInputSchema>;

/** Smoke test report: per-engine pass/fail outcomes from the batch run. */
export const SmokeTestReportSchema = z.object({
    runs: z
        .array(
            z.object({
                engine: z.enum([
                    "godot",
                    "phaser",
                    "renpy",
                    "defold",
                    "monogame",
                    "love2d",
                    "threejs",
                    "stride",
                ]),
                passed: z.boolean(),
                crash_reason: z.string().nullable().default(null),
            }),
        )
        .min(1),
});
export type SmokeTestReport = z.infer<typeof SmokeTestReportSchema>;

// ---- Per-metric output schemas -------------------------------------------

export const MetricVerdictSchema = z.object({
    metric: z.enum([
        "aesthetic_coherence",
        "soft_lock_count",
        "stress_curve_rmse",
        "smoke_test_pass_rate",
        "generation_cost_usd",
        "generation_time_seconds",
    ]),
    /** The measured numeric value. Range depends on metric. */
    value: z.number(),
    /** The threshold this metric was compared against. */
    threshold: z.number(),
    /** True when the value satisfies the constraint
     * (`value >= threshold` for "min" metrics, `value <= threshold` for
     * "max" metrics). */
    passed: z.boolean(),
    /** Human-readable explanation for the UI / logs. */
    notes: z.string(),
});
export type MetricVerdict = z.infer<typeof MetricVerdictSchema>;

export const EvaluationReportSchema = z.object({
    /** Game Plan version this report references; lets the diff timeline
     * UI in W4 show the metrics evolution over plan iterations. */
    plan_version: z.string().min(1),
    verdicts: z.array(MetricVerdictSchema).min(1),
    /** True iff every verdict passed. The Orchestrator gates ship on this. */
    overall_passed: z.boolean(),
});
export type EvaluationReport = z.infer<typeof EvaluationReportSchema>;
