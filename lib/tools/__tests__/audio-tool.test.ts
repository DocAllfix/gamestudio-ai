/**
 * Audio tools (bgm_gen / sfx_gen / voice_gen) — CC0-first economic rule,
 * mirroring sprite_gen. Free tier never touches the paid AudioGenPort.
 */
import { describe, it, expect, vi } from "vitest";

import { bgmGenTool, sfxGenTool, voiceGenTool, type AudioToolDeps } from "../audio/tool.js";
import { isImplemented } from "../registry.js";
import type { ToolInvocation } from "../../contracts/tool-registry.contract.js";

const inv = (input: Record<string, unknown>): ToolInvocation => ({
  tool_id: "bgm_gen",
  input,
  node_id: "n1",
  project_id: "00000000-0000-4000-8000-000000000001",
  plan_version: 1,
  trace_id: "t1",
});

const catalogHit: AudioToolDeps = {
  resolveAsset: async () => ({
    source: "catalog",
    fallback_generative: false,
    asset: { download_url: "https://cc0.example/loop.mp3", license: "CC0-1.0" },
  }),
};

const noHit: AudioToolDeps = {
  resolveAsset: async () => ({ source: "generative", fallback_generative: true, asset: null }),
};

describe("audio tools — CC0-first", () => {
  it("free tier serves a CC0 catalog asset and never calls the port", async () => {
    const audioPort = { generateBgm: vi.fn(), generateSfx: vi.fn(), generateVoice: vi.fn() };
    const res = await bgmGenTool.handler(inv({ description: "epic loop", tier: "free" }), { ...catalogHit, audioPort });
    expect(res.status).toBe("succeeded");
    expect((res.output as { source: string }).source).toBe("catalog");
    expect(audioPort.generateBgm).not.toHaveBeenCalled();
  });

  it("free tier with no CC0 hit is rejected (no paid generation)", async () => {
    const res = await sfxGenTool.handler(inv({ description: "laser zap", tier: "free" }), noHit);
    expect(res.status).not.toBe("succeeded");
    expect(res.output).toBeNull();
  });

  it("paid tier generates via the AudioGenPort when the catalog is weak", async () => {
    const audioPort = {
      generateBgm: vi.fn(),
      generateSfx: vi.fn(async () => ({ trace_id: "t1", cost_usd: 0.05, latency_ms: 5, qa_log: [], audio_url: "https://gen.example/sfx.ogg", format: "ogg" as const, duration_seconds: 2 })),
      generateVoice: vi.fn(),
    };
    const res = await sfxGenTool.handler(inv({ description: "laser zap", tier: "creator", duration_seconds: 2 }), { ...noHit, audioPort });
    expect(res.status).toBe("succeeded");
    expect((res.output as { source: string }).source).toBe("generated");
    expect(audioPort.generateSfx).toHaveBeenCalledOnce();
  });

  it("registers bgm_gen / sfx_gen / voice_gen in the registry", () => {
    expect(isImplemented("bgm_gen")).toBe(true);
    expect(isImplemented("sfx_gen")).toBe(true);
    expect(isImplemented("voice_gen")).toBe(true);
  });

  it("voice_gen routes text to generateVoice on paid tier", async () => {
    const audioPort = {
      generateBgm: vi.fn(),
      generateSfx: vi.fn(),
      generateVoice: vi.fn(async () => ({ trace_id: "t1", cost_usd: 0.1, latency_ms: 5, qa_log: [], audio_url: "https://gen.example/v.mp3", format: "mp3" as const, duration_seconds: 0 })),
    };
    const res = await voiceGenTool.handler(inv({ description: "Welcome, hero", tier: "studio", voice: "narrator" }), { ...noHit, audioPort });
    expect(res.status).toBe("succeeded");
    expect(audioPort.generateVoice).toHaveBeenCalledOnce();
  });
});
