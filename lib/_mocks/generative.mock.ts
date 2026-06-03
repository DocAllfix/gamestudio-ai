/**
 * Generative ports mock — consumed by W1 / W4 while W2 builds the real
 * Audio/Model3D/Image adapters (Suno, ElevenLabs, Meshy/TRELLIS.2, Replicate).
 *
 * Each method Zod-validates its input against generative.contract.ts and
 * returns a shape-conformant stub (placeholder URLs, cost_usd: 0). No network,
 * no provider calls. Replace at merge time per Supreme Plan §07.
 */
import {
    type AudioGenPort,
    type Model3DPort,
    type ImageGenPort,
    BgmGenInputSchema,
    SfxGenInputSchema,
    VoiceGenInputSchema,
    AudioOutputSchema,
    type BgmGenInput,
    type SfxGenInput,
    type VoiceGenInput,
    type AudioOutput,
    Model3DInputSchema,
    Anim3DInputSchema,
    TextureInputSchema,
    Model3DOutputSchema,
    TextureOutputSchema,
    type Model3DInput,
    type Anim3DInput,
    type TextureInput,
    type Model3DOutput,
    type TextureOutput,
    SpriteGenInputSchema,
    TilesetGenInputSchema,
    ImageOutputSchema,
    type SpriteGenInput,
    type TilesetGenInput,
    type ImageOutput,
} from "../contracts/generative.contract.js";

export const audioGenMock: AudioGenPort = {
    async generateBgm(input: BgmGenInput): Promise<AudioOutput> {
        const parsed = BgmGenInputSchema.parse(input);
        return AudioOutputSchema.parse({
            trace_id: parsed.trace_id,
            cost_usd: 0,
            latency_ms: 0,
            qa_log: [],
            audio_url: "https://mock-r2.example.com/audio/bgm-mocked.mp3",
            format: "mp3",
            duration_seconds: parsed.duration_seconds,
        });
    },
    async generateSfx(input: SfxGenInput): Promise<AudioOutput> {
        const parsed = SfxGenInputSchema.parse(input);
        return AudioOutputSchema.parse({
            trace_id: parsed.trace_id,
            cost_usd: 0,
            latency_ms: 0,
            qa_log: [],
            audio_url: "https://mock-r2.example.com/audio/sfx-mocked.ogg",
            format: "ogg",
            duration_seconds: parsed.duration_seconds,
        });
    },
    async generateVoice(input: VoiceGenInput): Promise<AudioOutput> {
        const parsed = VoiceGenInputSchema.parse(input);
        return AudioOutputSchema.parse({
            trace_id: parsed.trace_id,
            cost_usd: 0,
            latency_ms: 0,
            qa_log: [],
            audio_url: "https://mock-r2.example.com/audio/voice-mocked.mp3",
            format: "mp3",
            duration_seconds: 1,
        });
    },
};

export const model3dGenMock: Model3DPort = {
    async generateModel(input: Model3DInput): Promise<Model3DOutput> {
        const parsed = Model3DInputSchema.parse(input);
        return Model3DOutputSchema.parse({
            trace_id: parsed.trace_id,
            cost_usd: 0,
            latency_ms: 0,
            qa_log: [],
            glb_url: "https://mock-r2.example.com/3d/model-mocked.glb",
            triangle_count: 1000,
            has_rig: parsed.rigged,
        });
    },
    async generateAnimation(input: Anim3DInput): Promise<Model3DOutput> {
        const parsed = Anim3DInputSchema.parse(input);
        return Model3DOutputSchema.parse({
            trace_id: parsed.trace_id,
            cost_usd: 0,
            latency_ms: 0,
            qa_log: [],
            glb_url: "https://mock-r2.example.com/3d/anim-mocked.glb",
            triangle_count: 1000,
            has_rig: true,
        });
    },
    async generateTexture(input: TextureInput): Promise<TextureOutput> {
        const parsed = TextureInputSchema.parse(input);
        return TextureOutputSchema.parse({
            trace_id: parsed.trace_id,
            cost_usd: 0,
            latency_ms: 0,
            qa_log: [],
            texture_url: "https://mock-r2.example.com/3d/texture-mocked.png",
            resolution: parsed.resolution,
        });
    },
};

export const imageGenMock: ImageGenPort = {
    async generateSprite(input: SpriteGenInput): Promise<ImageOutput> {
        const parsed = SpriteGenInputSchema.parse(input);
        return ImageOutputSchema.parse({
            trace_id: parsed.trace_id,
            cost_usd: 0,
            latency_ms: 0,
            qa_log: [],
            image_url: "https://mock-r2.example.com/sprite/mocked.png",
            width: 64,
            height: 64,
        });
    },
    async generateTileset(input: TilesetGenInput): Promise<ImageOutput> {
        const parsed = TilesetGenInputSchema.parse(input);
        return ImageOutputSchema.parse({
            trace_id: parsed.trace_id,
            cost_usd: 0,
            latency_ms: 0,
            qa_log: [],
            image_url: "https://mock-r2.example.com/tileset/mocked.png",
            width: parsed.tile_size * 8,
            height: parsed.tile_size * 8,
        });
    },
};
