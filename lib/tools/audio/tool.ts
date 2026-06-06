/**
 * Audio tools — bgm_gen / sfx_gen / voice_gen, CC0-first.
 *
 * Same economic rule as sprite_gen (lib/tools/CLAUDE.md §6): on tier=free the
 * tool resolves a CC0 catalog audio asset and MUST NOT call a paid provider
 * (Suno/ElevenLabs); generative audio is paywalled (tier >= creator). The
 * catalog resolver and the AudioGenPort are injected; on free tier the port is
 * never touched. Mirrors lib/tools/sprite/index.ts so there is one pattern.
 */
import { z } from "zod";

import {
    ToolInputBaseSchema,
    ToolOutputBaseSchema,
    type ToolInvocation,
} from "../../contracts/tool-registry.contract.js";
import type { AudioGenPort } from "../../contracts/generative.contract.js";
import { makeResult, type Tool } from "../_shared.js";

type AudioKind = "bgm_gen" | "sfx_gen" | "voice_gen";
const ASSET_TYPE: Record<AudioKind, string> = {
    bgm_gen: "audio_bgm",
    sfx_gen: "audio_sfx",
    voice_gen: "audio_voice",
};

export const AudioToolInputSchema = ToolInputBaseSchema.extend({
    description: z.string().min(1),
    style_pack_id: z.string().min(1).optional(),
    mood_id: z.string().min(1).optional(),
    duration_seconds: z.number().min(0.1).max(300).default(10),
    voice: z.string().optional(),
    tier: z.enum(["free", "creator", "studio"]).default("free"),
});
export type AudioToolInput = z.infer<typeof AudioToolInputSchema>;

export const AudioToolOutputSchema = ToolOutputBaseSchema.extend({
    source: z.enum(["catalog", "generated"]),
    audio_url: z.string(),
    license: z.string().nullable(),
});
export type AudioToolOutput = z.infer<typeof AudioToolOutputSchema>;

interface ResolvedAudio {
    source: "catalog" | "generative";
    fallback_generative: boolean;
    asset: { download_url: string; license: string } | null;
}

export interface AudioToolDeps {
    resolveAsset(query: { description: string; asset_type: string; style_pack?: string }): Promise<ResolvedAudio>;
    /** Paid-tier only; absent on free tier (never invoked there). */
    audioPort?: AudioGenPort;
}

function defaultDeps(): AudioToolDeps {
    return {
        async resolveAsset(query) {
            const { default: assetResolver } = await import("../asset-resolver/index.js");
            const res = await assetResolver.handler({
                tool_id: "asset_resolver",
                input: query,
                node_id: "audio_internal",
                project_id: "00000000-0000-4000-8000-000000000000",
                plan_version: 1,
                trace_id: "audio_internal",
            });
            const out = res.output as ResolvedAudio | null;
            return {
                source: out?.source ?? "generative",
                fallback_generative: out?.fallback_generative ?? true,
                asset: out?.asset ? { download_url: out.asset.download_url, license: out.asset.license } : null,
            };
        },
    };
}

function makeHandler(kind: AudioKind) {
    return async function handler(invocation: ToolInvocation, deps: AudioToolDeps = defaultDeps()) {
        const start = Date.now();
        const input = AudioToolInputSchema.parse({
            ...invocation.input,
            project_id: invocation.project_id,
            plan_version: invocation.plan_version,
            trace_id: invocation.trace_id,
        });

        const resolved = await deps.resolveAsset({
            description: input.description,
            asset_type: ASSET_TYPE[kind],
            style_pack: input.style_pack_id,
        });

        // Free tier: CC0 only, never call a paid audio provider.
        if (input.tier === "free") {
            if (resolved.asset) return done("catalog", resolved.asset.download_url, resolved.asset.license);
            return makeResult({
                invocation: { tool_id: kind, node_id: invocation.node_id, trace_id: invocation.trace_id },
                output: null,
                qa_log: [{ check: "cc0_available", passed: false, detail: `no CC0 ${ASSET_TYPE[kind]} for free tier` }],
                error_message: "No CC0 audio found; generative audio requires a paid tier.",
                latency_ms: Date.now() - start,
            });
        }

        // Paid tier: strong catalog hit wins, otherwise generate.
        if (resolved.source === "catalog" && !resolved.fallback_generative && resolved.asset) {
            return done("catalog", resolved.asset.download_url, resolved.asset.license);
        }
        if (!deps.audioPort) {
            // No generative provider wired yet: degrade gracefully (CC0 if any,
            // else no audio) WITHOUT throwing, so the run still produces a game.
            if (resolved.asset) return done("catalog", resolved.asset.download_url, resolved.asset.license);
            return makeResult({
                invocation: { tool_id: kind, node_id: invocation.node_id, trace_id: invocation.trace_id },
                output: null,
                qa_log: [{ check: "audio_resolved", passed: false, detail: "no audio; degraded (no generative provider)" }],
                latency_ms: Date.now() - start,
            });
        }
        const base = { project_id: input.project_id, plan_version: input.plan_version, trace_id: input.trace_id };
        const gen =
            kind === "bgm_gen"
                ? await deps.audioPort.generateBgm({ ...base, mood_id: input.mood_id ?? "neutral", duration_seconds: input.duration_seconds, prompt_override: input.description })
                : kind === "sfx_gen"
                ? await deps.audioPort.generateSfx({ ...base, description: input.description, duration_seconds: input.duration_seconds })
                : await deps.audioPort.generateVoice({ ...base, text: input.description, voice: input.voice ?? "default" });
        return done("generated", gen.audio_url, null, gen.cost_usd);

        function done(source: "catalog" | "generated", audio_url: string, license: string | null, cost = 0) {
            const output: AudioToolOutput = {
                trace_id: invocation.trace_id,
                cost_usd: cost,
                latency_ms: Date.now() - start,
                qa_log: [],
                source,
                audio_url,
                license,
            };
            return makeResult({
                invocation: { tool_id: kind, node_id: invocation.node_id, trace_id: invocation.trace_id },
                output,
                qa_log: [{ check: "audio_resolved", passed: true, detail: source }],
                cost_usd: cost,
                latency_ms: Date.now() - start,
            });
        }
    };
}

function descriptorFor(kind: AudioKind, name: string, cost: number): Tool<AudioToolDeps> {
    return {
        id: kind,
        name,
        description: `CC0-first ${name.toLowerCase()}; generative provider only on paid tiers.`,
        category: "audio",
        inputSchema: AudioToolInputSchema,
        outputSchema: AudioToolOutputSchema,
        estimatedCostUsd: cost,
        estimatedDurationSeconds: 8,
        handler: makeHandler(kind),
    };
}

export const bgmGenTool = descriptorFor("bgm_gen", "Background Music", 0.3);
export const sfxGenTool = descriptorFor("sfx_gen", "Sound Effect", 0.05);
export const voiceGenTool = descriptorFor("voice_gen", "Voice", 0.1);
