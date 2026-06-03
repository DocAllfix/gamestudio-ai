/**
 * Generative Provider Ports — the hexagonal boundary for AI generation.
 *
 * The domain (W1 reasoning / D.5 orchestrator) asks for a capability
 * ("generate BGM for this mood", "generate a 3D model"); the port hides
 * which provider answers (Suno vs ElevenLabs, Meshy vs TRELLIS.2, Replicate
 * FLUX, World Labs Marble). W2 implements Audio/Model3D/Image ports; W3
 * implements WorldGen (Marble). Swapping a provider = swapping an adapter,
 * never touching the domain. See docs/EXECUTION_ARCHITECTURE.md Parte A/G.
 *
 * Every input/output Zod schema extends the tool-registry base shapes so the
 * cost/trace/qa plumbing is uniform. These are PAY-tier capabilities (audio,
 * 3D, premium image) gated behind check_quota — see docs/WOW_CONTRACT.md §9.
 */
import { z } from "zod";

import {
    ToolInputBaseSchema,
    ToolOutputBaseSchema,
} from "./tool-registry.contract.js";

// ---- Audio (Suno BGM, ElevenLabs SFX/voice) -------------------------------

export const BgmGenInputSchema = ToolInputBaseSchema.extend({
    /** Audio mood id from the seeded `audio_mood_library` catalog. */
    mood_id: z.string().min(1),
    /** Target loop length in seconds. */
    duration_seconds: z.number().int().min(5).max(300),
    /** Optional Suno prompt override; defaults to the mood's curated prompt. */
    prompt_override: z.string().optional(),
});
export type BgmGenInput = z.infer<typeof BgmGenInputSchema>;

export const SfxGenInputSchema = ToolInputBaseSchema.extend({
    /** Semantic description of the effect ("footstep on gravel", "ui click"). */
    description: z.string().min(1),
    duration_seconds: z.number().min(0.1).max(30),
});
export type SfxGenInput = z.infer<typeof SfxGenInputSchema>;

export const VoiceGenInputSchema = ToolInputBaseSchema.extend({
    text: z.string().min(1),
    /** ElevenLabs voice id or named preset. */
    voice: z.string().min(1),
});
export type VoiceGenInput = z.infer<typeof VoiceGenInputSchema>;

export const AudioOutputSchema = ToolOutputBaseSchema.extend({
    /** R2 (or provider) URL of the generated audio file. */
    audio_url: z.string().url(),
    format: z.enum(["mp3", "ogg", "wav"]),
    duration_seconds: z.number().min(0),
});
export type AudioOutput = z.infer<typeof AudioOutputSchema>;

export interface AudioGenPort {
    generateBgm(input: BgmGenInput): Promise<AudioOutput>;
    generateSfx(input: SfxGenInput): Promise<AudioOutput>;
    generateVoice(input: VoiceGenInput): Promise<AudioOutput>;
}

// ---- 3D (Meshy / TRELLIS.2 / Tripo) ---------------------------------------

export const Model3DInputSchema = ToolInputBaseSchema.extend({
    /** Text or image-derived description of the model. */
    prompt: z.string().min(1),
    /** Style pack id to keep the model coherent with the game's aesthetics. */
    style_pack_id: z.string().min(1),
    /** Whether the model must be rigged (character) or static (prop). */
    rigged: z.boolean().default(false),
});
export type Model3DInput = z.infer<typeof Model3DInputSchema>;

export const Anim3DInputSchema = ToolInputBaseSchema.extend({
    /** R2/provider URL of the rigged model to animate. */
    model_url: z.string().url(),
    /** Animation clip name (e.g. "walk", "attack"). */
    clip: z.string().min(1),
});
export type Anim3DInput = z.infer<typeof Anim3DInputSchema>;

export const TextureInputSchema = ToolInputBaseSchema.extend({
    description: z.string().min(1),
    /** Square texture resolution in pixels. */
    resolution: z.number().int().min(64).max(4096),
});
export type TextureInput = z.infer<typeof TextureInputSchema>;

export const Model3DOutputSchema = ToolOutputBaseSchema.extend({
    /** R2/provider URL of the GLB/GLTF asset. */
    glb_url: z.string().url(),
    triangle_count: z.number().int().min(0),
    has_rig: z.boolean(),
});
export type Model3DOutput = z.infer<typeof Model3DOutputSchema>;

export const TextureOutputSchema = ToolOutputBaseSchema.extend({
    texture_url: z.string().url(),
    resolution: z.number().int().min(0),
});
export type TextureOutput = z.infer<typeof TextureOutputSchema>;

export interface Model3DPort {
    generateModel(input: Model3DInput): Promise<Model3DOutput>;
    generateAnimation(input: Anim3DInput): Promise<Model3DOutput>;
    generateTexture(input: TextureInput): Promise<TextureOutput>;
}

// ---- Image (Replicate FLUX / SDXL + LoRA) ---------------------------------

export const SpriteGenInputSchema = ToolInputBaseSchema.extend({
    description: z.string().min(1),
    style_pack_id: z.string().min(1),
    /** Optional LoRA hf_repo from match_loras. */
    lora_hf_repo: z.string().optional(),
});
export type SpriteGenInput = z.infer<typeof SpriteGenInputSchema>;

export const TilesetGenInputSchema = ToolInputBaseSchema.extend({
    description: z.string().min(1),
    style_pack_id: z.string().min(1),
    /** Tile size in pixels (square). */
    tile_size: z.number().int().min(8).max(256),
});
export type TilesetGenInput = z.infer<typeof TilesetGenInputSchema>;

export const ImageOutputSchema = ToolOutputBaseSchema.extend({
    image_url: z.string().url(),
    width: z.number().int().min(1),
    height: z.number().int().min(1),
});
export type ImageOutput = z.infer<typeof ImageOutputSchema>;

export interface ImageGenPort {
    generateSprite(input: SpriteGenInput): Promise<ImageOutput>;
    generateTileset(input: TilesetGenInput): Promise<ImageOutput>;
}

// ---- World (World Labs Marble) --------------------------------------------

export const WorldGenInputSchema = ToolInputBaseSchema.extend({
    /** Text/image prompt describing the 3D world. */
    prompt: z.string().min(1),
    style_pack_id: z.string().min(1),
});
export type WorldGenInput = z.infer<typeof WorldGenInputSchema>;

export const WorldGenOutputSchema = ToolOutputBaseSchema.extend({
    /** R2/provider URL of the high-fidelity Gaussian splat (.spz/.ply). */
    splat_url: z.string().url(),
    /** R2/provider URL of the collider mesh (GLB) for physics/walkability. */
    collider_url: z.string().url(),
});
export type WorldGenOutput = z.infer<typeof WorldGenOutputSchema>;

export interface WorldGenPort {
    generateWorld(input: WorldGenInput): Promise<WorldGenOutput>;
}
