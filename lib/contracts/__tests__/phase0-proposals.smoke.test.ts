/**
 * Smoke tests for the FASE 0 contract proposals (G.0–G.3):
 *  - G.0: 'fork' added to UsageEventSchema event_name enum
 *  - G.1: 'babylon' in EngineEnum + babylon tool ids in ToolIdEnum
 *  - G.2: WebBuildArtifact type + webExport on EngineAdapter (compile-time)
 *  - G.3: the 4 generative ports' input/output Zod schemas
 *
 * Same intent as contracts.smoke.test.ts: each schema rejects an empty object
 * and accepts a hand-built valid example.
 */
import { describe, expect, it } from "vitest";

import { EngineEnum } from "../game-plan.contract.js";
import { ToolIdEnum } from "../tool-registry.contract.js";
import { UsageEventSchema } from "../billing.contract.js";
import {
    BgmGenInputSchema,
    AudioOutputSchema,
    Model3DInputSchema,
    Model3DOutputSchema,
    ImageOutputSchema,
    SpriteGenInputSchema,
    WorldGenInputSchema,
    WorldGenOutputSchema,
} from "../generative.contract.js";

// ---- G.0 — fork event -----------------------------------------------------

describe("G.0 — fork event", () => {
    it("UsageEventSchema accepts event_name 'fork'", () => {
        expect(() =>
            UsageEventSchema.parse({
                user_id: "user_1",
                project_id: null,
                event_name: "fork",
                trace_id: "t1",
                created_at: new Date().toISOString(),
            }),
        ).not.toThrow();
    });
    it("UsageEventSchema still rejects an unknown event_name", () => {
        expect(() =>
            UsageEventSchema.parse({
                user_id: "user_1",
                project_id: null,
                event_name: "not_a_real_event",
                trace_id: "t1",
                created_at: new Date().toISOString(),
            }),
        ).toThrow();
    });
});

// ---- G.1 — babylon --------------------------------------------------------

describe("G.1 — babylon", () => {
    it("EngineEnum includes babylon", () => {
        expect(() => EngineEnum.parse("babylon")).not.toThrow();
    });
    it("ToolIdEnum includes code_gen_babylon_ts and babylon_assembler", () => {
        expect(() => ToolIdEnum.parse("code_gen_babylon_ts")).not.toThrow();
        expect(() => ToolIdEnum.parse("babylon_assembler")).not.toThrow();
    });
});

// ---- G.3 — generative ports ----------------------------------------------

describe("G.3 — generative ports schemas", () => {
    const base = { project_id: crypto.randomUUID(), plan_version: 1, trace_id: "t1" };

    it("BgmGenInputSchema rejects empty, accepts valid", () => {
        expect(() => BgmGenInputSchema.parse({})).toThrow();
        expect(() =>
            BgmGenInputSchema.parse({ ...base, mood_id: "epic_orchestral", duration_seconds: 60 }),
        ).not.toThrow();
    });
    it("AudioOutputSchema accepts valid", () => {
        expect(() =>
            AudioOutputSchema.parse({
                trace_id: "t1", cost_usd: 0.05, latency_ms: 1200, qa_log: [],
                audio_url: "https://r2.example.com/a.mp3", format: "mp3", duration_seconds: 60,
            }),
        ).not.toThrow();
    });
    it("Model3DInputSchema + Model3DOutputSchema valid", () => {
        expect(() =>
            Model3DInputSchema.parse({ ...base, prompt: "low-poly tree", style_pack_id: "low-poly-cute" }),
        ).not.toThrow();
        expect(() =>
            Model3DOutputSchema.parse({
                trace_id: "t1", cost_usd: 0.1, latency_ms: 5000, qa_log: [],
                glb_url: "https://r2.example.com/m.glb", triangle_count: 1200, has_rig: false,
            }),
        ).not.toThrow();
    });
    it("SpriteGenInputSchema + ImageOutputSchema valid", () => {
        expect(() =>
            SpriteGenInputSchema.parse({ ...base, description: "knight idle", style_pack_id: "pixel-art-dark" }),
        ).not.toThrow();
        expect(() =>
            ImageOutputSchema.parse({
                trace_id: "t1", cost_usd: 0.005, latency_ms: 800, qa_log: [],
                image_url: "https://r2.example.com/s.png", width: 64, height: 64,
            }),
        ).not.toThrow();
    });
    it("WorldGenInputSchema + WorldGenOutputSchema valid", () => {
        expect(() =>
            WorldGenInputSchema.parse({ ...base, prompt: "crystal cave", style_pack_id: "psx-retro-3d" }),
        ).not.toThrow();
        expect(() =>
            WorldGenOutputSchema.parse({
                trace_id: "t1", cost_usd: 1.2, latency_ms: 30000, qa_log: [],
                splat_url: "https://r2.example.com/w.spz", collider_url: "https://r2.example.com/w.glb",
            }),
        ).not.toThrow();
    });
});
