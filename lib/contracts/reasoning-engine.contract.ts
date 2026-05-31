/**
 * Reasoning Engine Contract — interfaces for the 6 modules D.1-D.6.
 *
 * Each module is owned by W1. W2 / W3 / W4 import the input/output
 * Zod shapes here when they need to mock or react to a module result.
 * The Hermes pattern (3-level memory) is encoded in `HermesMemory`
 * which every module receives and may mutate.
 *
 * Module IDs match `docs/GAME_REASONING_ENGINE_BLUEPRINT_v2.md` PARTE D
 * exactly: D.1 Intent, D.2 Design, D.3 Consistency, D.4 Balance,
 * D.5 Execution, D.6 Evaluation.
 */
import { z } from "zod";

import {
    GamePlanPatchSchema,
    GamePlanSchema,
} from "./game-plan.contract.js";
import { GameGraphSchema } from "./game-graph.contract.js";
import {
    EvaluationReportSchema,
    SmokeTestReportSchema,
} from "./evaluation-metrics.contract.js";

// ---- Hermes 3-level memory ------------------------------------------------

/** Hermes Agent memory — Pietra v4 §1.3 / v5 §F.
 *
 * - `short_term`: scratchpad for the current run (cleared per request)
 * - `long_term`: project-wide notes the user added or the engine
 *   accumulated (persists across runs)
 * - `episodic`: per-user-per-skill success_score with EMA decay (the
 *   Voyager pattern). W1 reads to bias tool selection; W4 surfaces in
 *   the Studio Mode UI as "skills learned by your assistant". */
export const HermesMemorySchema = z.object({
    short_term: z.record(z.unknown()).default({}),
    long_term: z.record(z.unknown()).default({}),
    episodic: z
        .array(
            z.object({
                skill_name: z.string().min(1),
                /** EMA: new = old*0.95 + (success?1:0)*0.05 */
                success_score: z.number().min(0).max(1),
                times_used: z.number().int().min(0),
                last_used_at: z.string().datetime(),
            }),
        )
        .default([]),
});
export type HermesMemory = z.infer<typeof HermesMemorySchema>;

// ---- D.1 Intent Interpreter ----------------------------------------------

export const IntentInterpreterInputSchema = z.object({
    /** The raw user brief in any natural language. */
    user_prompt: z.string().min(1).max(4000),
    /** Optional user-uploaded references (BYOA from W4). The Style
     * Inference sub-module (W2) consumes these. */
    moodboard_image_urls: z.array(z.string().url()).max(20).optional(),
    /** Reference games the user picked from the catalog. */
    reference_game_ids: z.array(z.string().uuid()).max(20).optional(),
    /** Optional engine forced by the user (default: D.1 picks one). */
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
        ])
        .optional(),
    memory: HermesMemorySchema,
});
export type IntentInterpreterInput = z.infer<
    typeof IntentInterpreterInputSchema
>;

export const IntentInterpreterOutputSchema = z.object({
    /** A first-pass Game Plan, NOT yet validated by D.3 or balanced by
     * D.4. The pipeline calls D.2 next. */
    draft_plan: GamePlanSchema,
    /** Free-text explanation surfaced in the Creator Mode UI: "I picked
     * Godot because your reference uses 2D platforming with parallax;
     * Phaser would also fit if you want browser." */
    rationale: z.string().min(1),
    memory: HermesMemorySchema,
});
export type IntentInterpreterOutput = z.infer<
    typeof IntentInterpreterOutputSchema
>;

// ---- D.2 Design Planner --------------------------------------------------

export const DesignPlannerInputSchema = z.object({
    plan: GamePlanSchema,
    /** Optional user feedback that triggers a refine pass instead of a
     * full re-plan. RFC 6902 patch emitted in output. */
    refinement_request: z.string().max(2000).optional(),
    memory: HermesMemorySchema,
});
export type DesignPlannerInput = z.infer<typeof DesignPlannerInputSchema>;

export const DesignPlannerOutputSchema = z.object({
    /** Either a new full plan (initial pass) or a patch (refinement). */
    result: z.discriminatedUnion("kind", [
        z.object({
            kind: z.literal("full_plan"),
            plan: GamePlanSchema,
        }),
        z.object({
            kind: z.literal("patch"),
            patch: GamePlanPatchSchema,
        }),
    ]),
    memory: HermesMemorySchema,
});
export type DesignPlannerOutput = z.infer<typeof DesignPlannerOutputSchema>;

// ---- D.3 Consistency Manager ---------------------------------------------

export const ConsistencyManagerInputSchema = z.object({
    world_graph: GameGraphSchema,
    /** Dialogues / events that reference items or nodes — validated for
     * referential integrity. */
    dialogues: z
        .array(
            z.object({
                id: z.string().min(1),
                node_id: z.string().min(1),
                preconditions: z.array(z.string()).default([]),
            }),
        )
        .default([]),
});
export type ConsistencyManagerInput = z.infer<
    typeof ConsistencyManagerInputSchema
>;

export const ConsistencyManagerOutputSchema = z.object({
    valid: z.boolean(),
    soft_locks: z.array(
        z.object({
            from_node_id: z.string().min(1),
            missing_items: z.array(z.string()),
        }),
    ),
    /** Suggested corrections emitted as a patch. When `valid` is true
     * this is an empty patch. */
    corrections: z
        .array(
            z.object({
                op: z.enum(["add", "remove", "replace"]),
                path: z.string(),
                value: z.unknown().optional(),
            }),
        )
        .default([]),
});
export type ConsistencyManagerOutput = z.infer<
    typeof ConsistencyManagerOutputSchema
>;

// ---- D.4 Balance Controller ----------------------------------------------

export const BalanceControllerInputSchema = z.object({
    plan: GamePlanSchema,
    /** Per-genre rule ranges from the seeded `genre_templates` table.
     * The controller clamps `plan.rules` into these ranges. */
    rules_ranges: z.record(
        z.union([
            z.object({ min: z.number(), max: z.number() }),
            z.array(z.union([z.string(), z.number()])),
        ]),
    ),
    memory: HermesMemorySchema,
});
export type BalanceControllerInput = z.infer<
    typeof BalanceControllerInputSchema
>;

export const BalanceControllerOutputSchema = z.object({
    balanced_plan: GamePlanSchema,
    /** Tuples explaining what the controller changed (UI explainability). */
    adjustments: z.array(
        z.object({
            rule_name: z.string(),
            before: z.union([z.number(), z.string(), z.boolean()]),
            after: z.union([z.number(), z.string(), z.boolean()]),
            reason: z.string(),
        }),
    ),
    memory: HermesMemorySchema,
});
export type BalanceControllerOutput = z.infer<
    typeof BalanceControllerOutputSchema
>;

// ---- D.5 Execution Orchestrator ------------------------------------------

export const ExecutionOrchestratorInputSchema = z.object({
    plan: GamePlanSchema,
    /** When true, only DAG nodes downstream of changed plan paths get
     * re-executed. The Orchestrator computes the cut from the parent
     * patch. */
    incremental: z.boolean().default(false),
    /** Previous build artifact reference, used in incremental mode. */
    previous_build_artifact_id: z.string().uuid().optional(),
    memory: HermesMemorySchema,
});
export type ExecutionOrchestratorInput = z.infer<
    typeof ExecutionOrchestratorInputSchema
>;

export const ExecutionOrchestratorOutputSchema = z.object({
    /** Reference to the build artifact .zip in R2. */
    build_artifact_id: z.string().uuid(),
    /** Per-node execution result. The Studio Mode UI shows each in the
     * Game Plan DAG canvas. */
    node_results: z.array(
        z.object({
            node_id: z.string().min(1),
            tool_id: z.string().min(1),
            status: z.enum([
                "succeeded",
                "failed",
                "skipped_incremental",
                "skipped_dependency_failure",
            ]),
            cost_usd: z.number().min(0),
            latency_ms: z.number().int().min(0),
            error_message: z.string().nullable().default(null),
        }),
    ),
    smoke_test_report: SmokeTestReportSchema,
    total_cost_usd: z.number().min(0),
    total_latency_ms: z.number().int().min(0),
    memory: HermesMemorySchema,
});
export type ExecutionOrchestratorOutput = z.infer<
    typeof ExecutionOrchestratorOutputSchema
>;

// ---- D.6 Evaluation Agent ------------------------------------------------

export const EvaluationAgentInputSchema = z.object({
    plan: GamePlanSchema,
    build_artifact_id: z.string().uuid(),
    /** Number of playtest simulator runs. PIETRA_v5 §A.1 calls for 10. */
    num_playtests: z.number().int().min(1).max(50).default(10),
    memory: HermesMemorySchema,
});
export type EvaluationAgentInput = z.infer<typeof EvaluationAgentInputSchema>;

export const EvaluationAgentOutputSchema = z.object({
    report: EvaluationReportSchema,
    /** When the report fails, the Agent emits a refinement request
     * forwarded to D.2 for the next iteration. */
    refinement_request: z.string().nullable().default(null),
    memory: HermesMemorySchema,
});
export type EvaluationAgentOutput = z.infer<
    typeof EvaluationAgentOutputSchema
>;

// ---- Hermes Orchestrator (the outer loop) --------------------------------

export const HermesPlanRequestSchema = z.object({
    user_id: z.string().min(1),
    project_id: z.string().uuid().nullable(),
    user_prompt: z.string().min(1).max(4000),
    moodboard_image_urls: z.array(z.string().url()).max(20).default([]),
    reference_game_ids: z.array(z.string().uuid()).max(20).default([]),
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
        ])
        .optional(),
});
export type HermesPlanRequest = z.infer<typeof HermesPlanRequestSchema>;

export const HermesPlanResponseSchema = z.object({
    project_id: z.string().uuid(),
    final_plan: GamePlanSchema,
    final_report: EvaluationReportSchema,
    /** Iteration log — every D.1 / D.2 / D.6 turn taken. Surfaced in
     * the Studio Mode UI as a timeline of reasoning steps. */
    iterations: z.array(
        z.object({
            iteration: z.number().int().min(0),
            phase: z.enum([
                "intent",
                "design",
                "consistency",
                "balance",
                "execution",
                "evaluation",
                "refinement",
            ]),
            summary: z.string().max(500),
            cost_usd: z.number().min(0),
            latency_ms: z.number().int().min(0),
        }),
    ),
    overall_passed: z.boolean(),
    total_cost_usd: z.number().min(0),
    total_latency_ms: z.number().int().min(0),
});
export type HermesPlanResponse = z.infer<typeof HermesPlanResponseSchema>;

// ---- Module interfaces (TypeScript-only, no runtime validation) ----------

export interface IntentInterpreter {
    propose(
        input: IntentInterpreterInput,
    ): Promise<IntentInterpreterOutput>;
}

export interface DesignPlanner {
    refine(input: DesignPlannerInput): Promise<DesignPlannerOutput>;
}

export interface ConsistencyManager {
    validate(
        input: ConsistencyManagerInput,
    ): Promise<ConsistencyManagerOutput>;
}

export interface BalanceController {
    balance(input: BalanceControllerInput): Promise<BalanceControllerOutput>;
}

export interface ExecutionOrchestrator {
    materialize(
        input: ExecutionOrchestratorInput,
    ): Promise<ExecutionOrchestratorOutput>;
}

export interface EvaluationAgent {
    evaluate(input: EvaluationAgentInput): Promise<EvaluationAgentOutput>;
}

export interface HermesOrchestrator {
    run(request: HermesPlanRequest): Promise<HermesPlanResponse>;
}
