/**
 * Real generative adapters (Audio / 3D / Image).
 *
 * Each adapter is constructed with a GatingContext + injected provider
 * functions + injected gate/record deps, so these tests assert the
 * contract output shape and the gating behavior without any network.
 */
import { describe, expect, it, vi } from "vitest";

import {
    AudioOutputSchema,
    Model3DOutputSchema,
    TextureOutputSchema,
    ImageOutputSchema,
} from "../../contracts/generative.contract.js";
import { SunoElevenAudioPort } from "../audio/index.js";
import { MeshyModel3DPort } from "../3d/index.js";
import { ReplicateImagePort } from "../sprite/generative.js";
import type { GenerativeAdapterDeps } from "../_gating.js";

const baseInput = {
    project_id: "00000000-0000-4000-8000-000000000000",
    plan_version: 1,
    trace_id: "trace_gen",
};

function allowDeps(): GenerativeAdapterDeps {
    return {
        clerk_user_id: "user_creator",
        gate: vi.fn(async () => ({ allowed: true, reason: null, games_used_this_month: 0 })),
        recordExecution: vi.fn(async () => "exec_1"),
    };
}

function denyDeps(): GenerativeAdapterDeps {
    return {
        clerk_user_id: "user_free",
        gate: vi.fn(async () => ({
            allowed: false,
            reason: "generative_requires_paid_tier",
            games_used_this_month: 0,
        })),
        recordExecution: vi.fn(async () => "exec_1"),
    };
}

describe("SunoElevenAudioPort", () => {
    it("generateBgm returns a contract-valid AudioOutput", async () => {
        const port = new SunoElevenAudioPort(allowDeps(), {
            suno: { generateBgm: async () => ({ audio_url: "https://r2.example.com/bgm.mp3", cost_usd: 0.3 }) },
            elevenlabs: { generateSfx: async () => ({ audio_url: "x", cost_usd: 0 }), generateVoice: async () => ({ audio_url: "x", cost_usd: 0 }) },
        });
        const res = await port.generateBgm({ ...baseInput, mood_id: "tense", duration_seconds: 30 });
        expect(() => AudioOutputSchema.parse(res)).not.toThrow();
        expect(res.audio_url).toBe("https://r2.example.com/bgm.mp3");
    });

    it("rejects when the gate denies (free tier)", async () => {
        const port = new SunoElevenAudioPort(denyDeps(), {
            suno: { generateBgm: async () => ({ audio_url: "x", cost_usd: 0 }) },
            elevenlabs: { generateSfx: async () => ({ audio_url: "x", cost_usd: 0 }), generateVoice: async () => ({ audio_url: "x", cost_usd: 0 }) },
        });
        await expect(port.generateBgm({ ...baseInput, mood_id: "tense", duration_seconds: 30 })).rejects.toThrow(
            /generative_requires_paid_tier/,
        );
    });
});

describe("MeshyModel3DPort", () => {
    it("generateModel returns a contract-valid Model3DOutput", async () => {
        const port = new MeshyModel3DPort(allowDeps(), {
            generateModel: async () => ({ glb_url: "https://r2.example.com/m.glb", triangle_count: 5000, has_rig: false, cost_usd: 0.5 }),
            generateAnimation: async () => ({ glb_url: "x", triangle_count: 1, has_rig: true, cost_usd: 0 }),
            generateTexture: async () => ({ texture_url: "x", resolution: 512, cost_usd: 0 }),
        });
        const res = await port.generateModel({ ...baseInput, prompt: "a barrel", style_pack_id: "sp1", rigged: false });
        expect(() => Model3DOutputSchema.parse(res)).not.toThrow();
    });

    it("generateTexture returns a contract-valid TextureOutput", async () => {
        const port = new MeshyModel3DPort(allowDeps(), {
            generateModel: async () => ({ glb_url: "x", triangle_count: 1, has_rig: false, cost_usd: 0 }),
            generateAnimation: async () => ({ glb_url: "x", triangle_count: 1, has_rig: true, cost_usd: 0 }),
            generateTexture: async () => ({ texture_url: "https://r2.example.com/t.png", resolution: 1024, cost_usd: 0.1 }),
        });
        const res = await port.generateTexture({ ...baseInput, description: "rusty metal", resolution: 1024 });
        expect(() => TextureOutputSchema.parse(res)).not.toThrow();
        expect(res.resolution).toBe(1024);
    });
});

describe("ReplicateImagePort", () => {
    it("generateSprite returns a contract-valid ImageOutput", async () => {
        const port = new ReplicateImagePort(allowDeps(), {
            generate: async () => ({ image_url: "https://r2.example.com/s.png", width: 64, height: 64, cost_usd: 0.02 }),
        });
        const res = await port.generateSprite({ ...baseInput, description: "a knight", style_pack_id: "sp1" });
        expect(() => ImageOutputSchema.parse(res)).not.toThrow();
    });

    it("rejects when the gate denies", async () => {
        const port = new ReplicateImagePort(denyDeps(), {
            generate: async () => ({ image_url: "x", width: 1, height: 1, cost_usd: 0 }),
        });
        await expect(
            port.generateTileset({ ...baseInput, description: "grass", style_pack_id: "sp1", tile_size: 16 }),
        ).rejects.toThrow(/generative_requires_paid_tier/);
    });
});
