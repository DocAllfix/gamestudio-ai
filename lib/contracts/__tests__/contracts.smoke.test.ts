/**
 * Smoke tests for the six Phase-0 contracts.
 *
 * These tests do NOT exercise business logic. They verify three things
 * that matter most across the parallelism boundary:
 *   1. Each Zod schema rejects an empty object (so a half-constructed
 *      cross-Workstream call surfaces a clear error, not a runtime
 *      crash three layers in).
 *   2. Each schema accepts a hand-built example that mirrors the
 *      blueprint v2 / Pietra v5 documentation.
 *   3. The cycle-detection helper in game-graph correctly flags a
 *      cyclic gating subgraph.
 */
import { describe, expect, it } from "vitest";

import {
    AestheticCoherenceInputSchema,
    SoftLockDetectionInputSchema,
    StressCurveInputSchema,
    SmokeTestReportSchema,
    EvaluationReportSchema,
    AESTHETIC_COHERENCE_MIN,
    STRESS_CURVE_RMSE_MAX,
} from "../evaluation-metrics.contract.js";

import {
    GameGraphSchema,
    findDirectedGatingCycle,
} from "../game-graph.contract.js";

import {
    GamePlanSchema,
    GamePlanPatchSchema,
    ExecutionDagSchema,
} from "../game-plan.contract.js";

import {
    HermesPlanRequestSchema,
    HermesMemorySchema,
} from "../reasoning-engine.contract.js";

import {
    ToolInputBaseSchema,
    ToolOutputBaseSchema,
    ToolIdEnum,
} from "../tool-registry.contract.js";

import {
    AssemblerInputSchema,
    AssemblerOutputSchema,
} from "../assembly-pipeline.contract.js";

import {
    QuotaCheckRequestSchema,
    QuotaCheckResponseSchema,
    UsageEventSchema,
    TIER_DEFINITIONS,
} from "../billing.contract.js";

// ---- evaluation-metrics ---------------------------------------------------

describe("evaluation-metrics contract", () => {
    it("exposes the documented thresholds", () => {
        expect(AESTHETIC_COHERENCE_MIN).toBe(0.75);
        expect(STRESS_CURVE_RMSE_MAX).toBeCloseTo(0.15, 5);
    });

    it("AestheticCoherenceInputSchema rejects empty object", () => {
        expect(() => AestheticCoherenceInputSchema.parse({})).toThrow();
    });

    it("AestheticCoherenceInputSchema accepts a real example", () => {
        const parsed = AestheticCoherenceInputSchema.parse({
            style_pack_id: "pixel-art-dark",
            generated_screenshot_urls: ["https://example.com/a.png"],
            reference_moodboard_urls: ["https://example.com/b.png"],
        });
        expect(parsed.style_pack_id).toBe("pixel-art-dark");
    });

    it("SoftLockDetectionInputSchema accepts a graph with an empty starting inventory", () => {
        const parsed = SoftLockDetectionInputSchema.parse({
            world_graph_nodes: [{ id: "start" }],
            world_graph_edges: [],
        });
        expect(parsed.starting_inventory).toEqual([]);
    });

    it("StressCurveInputSchema requires at least two points", () => {
        expect(() =>
            StressCurveInputSchema.parse({
                planned_curve: [0.5],
                measured_runs: [[0.5]],
            }),
        ).toThrow();
    });

    it("SmokeTestReportSchema enforces engine enum", () => {
        expect(() =>
            SmokeTestReportSchema.parse({
                runs: [{ engine: "unity", passed: true, crash_reason: null }],
            }),
        ).toThrow();
    });

    it("EvaluationReportSchema round-trips an empty-verdicts rejection", () => {
        expect(() =>
            EvaluationReportSchema.parse({
                plan_version: "v1",
                verdicts: [],
                overall_passed: true,
            }),
        ).toThrow();
    });
});

// ---- game-graph -----------------------------------------------------------

describe("game-graph contract", () => {
    it("rejects an edge referencing a missing node", () => {
        expect(() =>
            GameGraphSchema.parse({
                nodes: [
                    { id: "start", display_name: "Start" },
                    { id: "end", display_name: "End" },
                ],
                edges: [{ from: "start", to: "ghost" }],
                entry_node_id: "start",
            }),
        ).toThrow();
    });

    it("rejects when entry_node_id is missing from nodes", () => {
        expect(() =>
            GameGraphSchema.parse({
                nodes: [{ id: "a", display_name: "A" }],
                edges: [],
                entry_node_id: "b",
            }),
        ).toThrow();
    });

    it("accepts a small valid graph", () => {
        const graph = GameGraphSchema.parse({
            nodes: [
                { id: "start", display_name: "Start" },
                { id: "boss", display_name: "Boss" },
            ],
            edges: [{ from: "start", to: "boss" }],
            entry_node_id: "start",
        });
        expect(graph.nodes).toHaveLength(2);
    });

    it("findDirectedGatingCycle returns [] for a DAG", () => {
        const graph = GameGraphSchema.parse({
            nodes: [
                { id: "a", display_name: "A" },
                { id: "b", display_name: "B" },
                { id: "c", display_name: "C" },
            ],
            edges: [
                { from: "a", to: "b" },
                { from: "b", to: "c" },
            ],
            entry_node_id: "a",
        });
        expect(findDirectedGatingCycle(graph)).toEqual([]);
    });

    it("findDirectedGatingCycle flags an obvious cycle on gating edges", () => {
        const graph = GameGraphSchema.parse({
            nodes: [
                { id: "a", display_name: "A" },
                { id: "b", display_name: "B" },
            ],
            edges: [
                { from: "a", to: "b", bidirectional: false },
                { from: "b", to: "a", bidirectional: false },
            ],
            entry_node_id: "a",
        });
        const cycle = findDirectedGatingCycle(graph);
        expect(cycle.length).toBeGreaterThan(0);
    });
});

// ---- game-plan ------------------------------------------------------------

describe("game-plan contract", () => {
    const validPlan = {
        plan_version: 1,
        project_id: "00000000-0000-4000-8000-000000000000",
        meta: {
            title: "Test Game",
            genre: "platformer_2d" as const,
            engine: "godot" as const,
            style_pack_id: "pixel-art-dark",
            template_origin: "platformer_2d_godot",
            target_duration_minutes: 30,
            difficulty: "balanced" as const,
        },
        world_graph: {
            nodes: [{ id: "start", display_name: "Start" }],
            edges: [],
            entry_node_id: "start",
            starting_inventory: [],
        },
        pacing_curve: [
            { progress: 0, stress: 0.2 },
            { progress: 1, stress: 0.8 },
        ],
        rules: { player_hp: 100 },
        asset_bindings: [],
        execution_dag: {
            nodes: [
                {
                    id: "n1",
                    tool_id: "code_gen_godot_gdscript",
                    input: {},
                    depends_on: [],
                },
            ],
        },
    };

    it("accepts the documented happy path", () => {
        const parsed = GamePlanSchema.parse(validPlan);
        expect(parsed.meta.engine).toBe("godot");
    });

    it("rejects an unknown engine string", () => {
        expect(() =>
            GamePlanSchema.parse({
                ...validPlan,
                meta: { ...validPlan.meta, engine: "unity" },
            }),
        ).toThrow();
    });

    it("rejects a pacing curve with a single point", () => {
        expect(() =>
            GamePlanSchema.parse({
                ...validPlan,
                pacing_curve: [{ progress: 0, stress: 0.5 }],
            }),
        ).toThrow();
    });

    it("ExecutionDagSchema rejects an empty nodes array", () => {
        expect(() => ExecutionDagSchema.parse({ nodes: [] })).toThrow();
    });

    it("GamePlanPatchSchema accepts a minimal replace op", () => {
        const patch = GamePlanPatchSchema.parse({
            project_id: "00000000-0000-4000-8000-000000000000",
            parent_version: 1,
            ops: [
                {
                    op: "replace",
                    path: "/rules/player_hp",
                    value: 150,
                },
            ],
            summary: "Buff the player HP",
        });
        expect(patch.ops).toHaveLength(1);
    });

    it("GamePlanPatchSchema rejects an op with a path missing the leading slash", () => {
        expect(() =>
            GamePlanPatchSchema.parse({
                project_id: "00000000-0000-4000-8000-000000000000",
                parent_version: 1,
                ops: [{ op: "remove", path: "rules/player_hp" }],
                summary: "Reset",
            }),
        ).toThrow();
    });
});

// ---- reasoning-engine -----------------------------------------------------

describe("reasoning-engine contract", () => {
    it("HermesMemorySchema defaults to empty maps and arrays", () => {
        const memory = HermesMemorySchema.parse({});
        expect(memory.short_term).toEqual({});
        expect(memory.long_term).toEqual({});
        expect(memory.episodic).toEqual([]);
    });

    it("HermesPlanRequestSchema requires user_id and user_prompt", () => {
        expect(() => HermesPlanRequestSchema.parse({})).toThrow();
    });

    it("HermesPlanRequestSchema accepts the documented happy path", () => {
        const parsed = HermesPlanRequestSchema.parse({
            user_id: "u_123",
            project_id: null,
            user_prompt: "make a metroidvania about cats",
        });
        expect(parsed.user_prompt).toMatch(/cats/);
    });
});

// ---- tool-registry --------------------------------------------------------

describe("tool-registry contract", () => {
    it("ToolIdEnum includes the 8 code generators", () => {
        const sample = [
            "code_gen_godot_gdscript",
            "code_gen_phaser_js",
            "code_gen_renpy_python",
            "code_gen_defold_lua",
            "code_gen_monogame_csharp",
            "code_gen_love2d_lua",
            "code_gen_threejs_ts",
            "code_gen_stride_csharp",
        ];
        for (const id of sample) {
            expect(() => ToolIdEnum.parse(id)).not.toThrow();
        }
    });

    it("ToolInputBaseSchema rejects an empty object", () => {
        expect(() => ToolInputBaseSchema.parse({})).toThrow();
    });

    it("ToolOutputBaseSchema accepts a minimal valid envelope", () => {
        const parsed = ToolOutputBaseSchema.parse({
            trace_id: "t_1",
            cost_usd: 0.01,
            latency_ms: 800,
            qa_log: [],
        });
        expect(parsed.cost_usd).toBe(0.01);
    });
});

// ---- assembly-pipeline ----------------------------------------------------

describe("assembly-pipeline contract", () => {
    it("AssemblerInputSchema rejects an unknown engine", () => {
        expect(() =>
            AssemblerInputSchema.parse({
                project_id: "00000000-0000-4000-8000-000000000000",
                plan_version: 1,
                engine: "unity",
                tool_outputs: {},
            }),
        ).toThrow();
    });

    it("AssemblerOutputSchema requires a build_log and smoke_test envelope", () => {
        expect(() =>
            AssemblerOutputSchema.parse({
                artifact_id: "00000000-0000-4000-8000-000000000000",
                download_url: "https://example.com/build.zip",
                size_bytes: 1024,
                total_duration_ms: 100,
            }),
        ).toThrow();
    });
});

// ---- billing --------------------------------------------------------------

describe("billing contract", () => {
    it("TIER_DEFINITIONS covers every UserTier", () => {
        for (const tier of ["free", "creator", "pro", "studio"] as const) {
            expect(TIER_DEFINITIONS[tier]).toBeDefined();
            expect(TIER_DEFINITIONS[tier].display_name).toBeTypeOf("string");
        }
    });

    it("free tier matches Pietra v5 monthly_price + cost cap", () => {
        expect(TIER_DEFINITIONS.free.monthly_price_usd).toBe(0);
        expect(TIER_DEFINITIONS.free.max_cost_usd_per_game).toBe(1.5);
        expect(TIER_DEFINITIONS.free.commercial_use).toBe(false);
    });

    it("QuotaCheckRequestSchema requires user_id and tool_id", () => {
        expect(() => QuotaCheckRequestSchema.parse({})).toThrow();
    });

    it("QuotaCheckResponseSchema accepts a denied response", () => {
        const parsed = QuotaCheckResponseSchema.parse({
            allowed: false,
            reason: "monthly_games_exhausted",
            current_usage: {
                games_used_this_month: 3,
                cost_used_on_current_game_usd: 0,
            },
        });
        expect(parsed.allowed).toBe(false);
    });

    it("UsageEventSchema enforces the event_name enum", () => {
        expect(() =>
            UsageEventSchema.parse({
                user_id: "u_1",
                project_id: null,
                event_name: "unknown_event",
                trace_id: "t_1",
                created_at: new Date().toISOString(),
            }),
        ).toThrow();
    });
});
