/**
 * AudioGenPort adapter — Suno (BGM, HTTP) + ElevenLabs (SFX, voice).
 *
 * Implements the contract port verbatim (drop-in for audioGenMock).
 * Gated: each method runs the W2 paywall + check_quota gate before
 * calling a provider, then records the real cost. Provider calls are
 * injected so the adapter is testable without network.
 */
import {
    type AudioGenPort,
    type BgmGenInput,
    type SfxGenInput,
    type VoiceGenInput,
    type AudioOutput,
    BgmGenInputSchema,
    SfxGenInputSchema,
    VoiceGenInputSchema,
    AudioOutputSchema,
} from "../../contracts/generative.contract.js";
import {
    type GenerativeAdapterDeps,
    ensureAllowed,
} from "../_gating.js";

const EST_BGM_COST = 0.3;
const EST_SFX_COST = 0.05;
const EST_VOICE_COST = 0.1;

export interface ProviderResult {
    audio_url: string;
    cost_usd: number;
}

export interface AudioProviders {
    suno: { generateBgm(input: BgmGenInput): Promise<ProviderResult> };
    elevenlabs: {
        generateSfx(input: SfxGenInput): Promise<ProviderResult>;
        generateVoice(input: VoiceGenInput): Promise<ProviderResult>;
    };
}

export class SunoElevenAudioPort implements AudioGenPort {
    constructor(
        private readonly deps: GenerativeAdapterDeps,
        private readonly providers: AudioProviders,
    ) {}

    async generateBgm(input: BgmGenInput): Promise<AudioOutput> {
        const parsed = BgmGenInputSchema.parse(input);
        await ensureAllowed(this.deps, "bgm_gen", EST_BGM_COST);
        const start = Date.now();
        const result = await this.providers.suno.generateBgm(parsed);
        return this.finish("bgm_gen", parsed, result, "mp3", parsed.duration_seconds, start);
    }

    async generateSfx(input: SfxGenInput): Promise<AudioOutput> {
        const parsed = SfxGenInputSchema.parse(input);
        await ensureAllowed(this.deps, "sfx_gen", EST_SFX_COST);
        const start = Date.now();
        const result = await this.providers.elevenlabs.generateSfx(parsed);
        return this.finish("sfx_gen", parsed, result, "ogg", parsed.duration_seconds, start);
    }

    async generateVoice(input: VoiceGenInput): Promise<AudioOutput> {
        const parsed = VoiceGenInputSchema.parse(input);
        await ensureAllowed(this.deps, "voice_gen", EST_VOICE_COST);
        const start = Date.now();
        const result = await this.providers.elevenlabs.generateVoice(parsed);
        return this.finish("voice_gen", parsed, result, "mp3", 0, start);
    }

    private async finish(
        tool_id: "bgm_gen" | "sfx_gen" | "voice_gen",
        parsed: { project_id: string; plan_version: number; trace_id: string },
        result: ProviderResult,
        format: "mp3" | "ogg" | "wav",
        duration_seconds: number,
        start: number,
    ): Promise<AudioOutput> {
        const latency_ms = Date.now() - start;
        const output = AudioOutputSchema.parse({
            trace_id: parsed.trace_id,
            cost_usd: result.cost_usd,
            latency_ms,
            qa_log: [],
            audio_url: result.audio_url,
            format,
            duration_seconds,
        });
        await this.deps.recordExecution({
            tool_id,
            project_id: parsed.project_id,
            plan_version: parsed.plan_version,
            node_id: tool_id,
            trace_id: parsed.trace_id,
            cost_usd: result.cost_usd,
            latency_ms,
            output,
        });
        return output;
    }
}
