/**
 * ImageGenPort adapter — Replicate FLUX/SDXL (+ LoRA from match_loras).
 *
 * The PREMIUM image path (drop-in for imageGenMock). Distinct from the
 * FREE `sprite/index.ts` tool, which serves CC0 only and never reaches
 * this adapter on the free tier. Gated + cost-recorded; the Replicate
 * call is injected.
 */
import {
    type ImageGenPort,
    type SpriteGenInput,
    type TilesetGenInput,
    type ImageOutput,
    SpriteGenInputSchema,
    TilesetGenInputSchema,
    ImageOutputSchema,
} from "../../contracts/generative.contract.js";
import { type GenerativeAdapterDeps, ensureAllowed } from "../_gating.js";

const EST_SPRITE_COST = 0.02;
const EST_TILESET_COST = 0.04;

export interface ImageProvider {
    generate(args: {
        prompt: string;
        style_pack_id: string;
        lora_hf_repo?: string;
        tile_size?: number;
    }): Promise<{ image_url: string; width: number; height: number; cost_usd: number }>;
}

export class ReplicateImagePort implements ImageGenPort {
    constructor(
        private readonly deps: GenerativeAdapterDeps,
        private readonly provider: ImageProvider,
    ) {}

    async generateSprite(input: SpriteGenInput): Promise<ImageOutput> {
        const parsed = SpriteGenInputSchema.parse(input);
        await ensureAllowed(this.deps, "sprite_gen", EST_SPRITE_COST);
        const start = Date.now();
        const r = await this.provider.generate({
            prompt: parsed.description,
            style_pack_id: parsed.style_pack_id,
            lora_hf_repo: parsed.lora_hf_repo,
        });
        return this.finish("sprite_gen", parsed, r, start);
    }

    async generateTileset(input: TilesetGenInput): Promise<ImageOutput> {
        const parsed = TilesetGenInputSchema.parse(input);
        await ensureAllowed(this.deps, "tileset_gen", EST_TILESET_COST);
        const start = Date.now();
        const r = await this.provider.generate({
            prompt: parsed.description,
            style_pack_id: parsed.style_pack_id,
            tile_size: parsed.tile_size,
        });
        return this.finish("tileset_gen", parsed, r, start);
    }

    private async finish(
        tool_id: "sprite_gen" | "tileset_gen",
        parsed: { project_id: string; plan_version: number; trace_id: string },
        r: { image_url: string; width: number; height: number; cost_usd: number },
        start: number,
    ): Promise<ImageOutput> {
        const latency_ms = Date.now() - start;
        const output = ImageOutputSchema.parse({
            trace_id: parsed.trace_id,
            cost_usd: r.cost_usd,
            latency_ms,
            qa_log: [],
            image_url: r.image_url,
            width: r.width,
            height: r.height,
        });
        await this.deps.recordExecution({
            tool_id,
            project_id: parsed.project_id,
            plan_version: parsed.plan_version,
            node_id: tool_id,
            trace_id: parsed.trace_id,
            cost_usd: r.cost_usd,
            latency_ms,
            output,
        });
        return output;
    }
}
