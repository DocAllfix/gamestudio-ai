/**
 * Smoke tests for the FASE 0.2 generative/world mocks.
 *
 * Two checks per port (FIX A4 — binary, no "verifica a vista"):
 *  1. a real-shaped input returns a contract-valid output (Zod parse on return);
 *  2. an invalid input makes the mock throw (proves the input .parse() is live).
 */
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { audioGenMock, model3dGenMock, imageGenMock } from "../generative.mock.js";
import { worldGenMock } from "../worldgen.mock.js";
import {
    AudioOutputSchema,
    Model3DOutputSchema,
    ImageOutputSchema,
    WorldGenOutputSchema,
} from "../../contracts/generative.contract.js";

const base = { project_id: randomUUID(), plan_version: 1, trace_id: "t1" };

describe("generative.mock — AudioGenPort", () => {
    it("generateBgm returns contract-valid output", async () => {
        const out = await audioGenMock.generateBgm({ ...base, mood_id: "epic_orchestral", duration_seconds: 60 });
        expect(() => AudioOutputSchema.parse(out)).not.toThrow();
    });
    it("generateBgm throws on invalid input (Zod active)", async () => {
        // @ts-expect-error intentionally malformed
        await expect(audioGenMock.generateBgm({ mood_id: 123 })).rejects.toThrow();
    });
});

describe("generative.mock — Model3DPort", () => {
    it("generateModel returns contract-valid output", async () => {
        const out = await model3dGenMock.generateModel({ ...base, prompt: "low-poly tree", style_pack_id: "low-poly-cute", rigged: false });
        expect(() => Model3DOutputSchema.parse(out)).not.toThrow();
    });
    it("generateModel throws on invalid input", async () => {
        // @ts-expect-error intentionally malformed
        await expect(model3dGenMock.generateModel({ prompt: "" })).rejects.toThrow();
    });
});

describe("generative.mock — ImageGenPort", () => {
    it("generateSprite returns contract-valid output", async () => {
        const out = await imageGenMock.generateSprite({ ...base, description: "knight idle", style_pack_id: "pixel-art-dark" });
        expect(() => ImageOutputSchema.parse(out)).not.toThrow();
    });
    it("generateSprite throws on invalid input", async () => {
        // @ts-expect-error intentionally malformed
        await expect(imageGenMock.generateSprite({ description: 5 })).rejects.toThrow();
    });
});

describe("worldgen.mock — WorldGenPort", () => {
    it("generateWorld returns contract-valid output", async () => {
        const out = await worldGenMock.generateWorld({ ...base, prompt: "crystal cave", style_pack_id: "psx-retro-3d" });
        expect(() => WorldGenOutputSchema.parse(out)).not.toThrow();
    });
    it("generateWorld throws on invalid input", async () => {
        // @ts-expect-error intentionally malformed
        await expect(worldGenMock.generateWorld({ prompt: null })).rejects.toThrow();
    });
});
