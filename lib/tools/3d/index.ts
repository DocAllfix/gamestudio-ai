/**
 * Model3DPort adapter — Meshy.ai / Replicate TRELLIS.2.
 *
 * Implements the contract port verbatim (drop-in for model3dGenMock).
 * Gated + cost-recorded like the audio port; provider calls injected.
 */
import {
    type Model3DPort,
    type Model3DInput,
    type Anim3DInput,
    type TextureInput,
    type Model3DOutput,
    type TextureOutput,
    Model3DInputSchema,
    Anim3DInputSchema,
    TextureInputSchema,
    Model3DOutputSchema,
    TextureOutputSchema,
} from "../../contracts/generative.contract.js";
import { type GenerativeAdapterDeps, ensureAllowed } from "../_gating.js";

const EST_MODEL_COST = 0.5;
const EST_ANIM_COST = 0.4;
const EST_TEXTURE_COST = 0.1;

export interface Model3DProviders {
    generateModel(input: Model3DInput): Promise<{ glb_url: string; triangle_count: number; has_rig: boolean; cost_usd: number }>;
    generateAnimation(input: Anim3DInput): Promise<{ glb_url: string; triangle_count: number; has_rig: boolean; cost_usd: number }>;
    generateTexture(input: TextureInput): Promise<{ texture_url: string; resolution: number; cost_usd: number }>;
}

export class MeshyModel3DPort implements Model3DPort {
    constructor(
        private readonly deps: GenerativeAdapterDeps,
        private readonly providers: Model3DProviders,
    ) {}

    async generateModel(input: Model3DInput): Promise<Model3DOutput> {
        const parsed = Model3DInputSchema.parse(input);
        await ensureAllowed(this.deps, "model_3d_gen", EST_MODEL_COST);
        const start = Date.now();
        const r = await this.providers.generateModel(parsed);
        const output = Model3DOutputSchema.parse({
            trace_id: parsed.trace_id,
            cost_usd: r.cost_usd,
            latency_ms: Date.now() - start,
            qa_log: [],
            glb_url: r.glb_url,
            triangle_count: r.triangle_count,
            has_rig: r.has_rig,
        });
        await this.record("model_3d_gen", parsed, r.cost_usd, output);
        return output;
    }

    async generateAnimation(input: Anim3DInput): Promise<Model3DOutput> {
        const parsed = Anim3DInputSchema.parse(input);
        await ensureAllowed(this.deps, "animation_3d_gen", EST_ANIM_COST);
        const start = Date.now();
        const r = await this.providers.generateAnimation(parsed);
        const output = Model3DOutputSchema.parse({
            trace_id: parsed.trace_id,
            cost_usd: r.cost_usd,
            latency_ms: Date.now() - start,
            qa_log: [],
            glb_url: r.glb_url,
            triangle_count: r.triangle_count,
            has_rig: r.has_rig,
        });
        await this.record("animation_3d_gen", parsed, r.cost_usd, output);
        return output;
    }

    async generateTexture(input: TextureInput): Promise<TextureOutput> {
        const parsed = TextureInputSchema.parse(input);
        await ensureAllowed(this.deps, "texture_gen", EST_TEXTURE_COST);
        const start = Date.now();
        const r = await this.providers.generateTexture(parsed);
        const output = TextureOutputSchema.parse({
            trace_id: parsed.trace_id,
            cost_usd: r.cost_usd,
            latency_ms: Date.now() - start,
            qa_log: [],
            texture_url: r.texture_url,
            resolution: r.resolution,
        });
        await this.record("texture_gen", parsed, r.cost_usd, output);
        return output;
    }

    private async record(
        tool_id: "model_3d_gen" | "animation_3d_gen" | "texture_gen",
        parsed: { project_id: string; plan_version: number; trace_id: string },
        cost_usd: number,
        output: Record<string, unknown>,
    ): Promise<void> {
        await this.deps.recordExecution({
            tool_id,
            project_id: parsed.project_id,
            plan_version: parsed.plan_version,
            node_id: tool_id,
            trace_id: parsed.trace_id,
            cost_usd,
            latency_ms: typeof output.latency_ms === "number" ? output.latency_ms : 0,
            output,
        });
    }
}
