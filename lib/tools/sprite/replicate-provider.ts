/**
 * Concrete ImageProvider — Replicate FLUX. The real HTTP call behind
 * ReplicateImagePort (generative.ts). Kept separate so the port stays
 * provider-agnostic and tests inject a fake provider.
 *
 * Uses flux-schnell (fast, ~$0.003/img) for sprites. Replicate's sync API
 * (Prefer: wait) returns the output inline so we don't poll. A LoRA repo, when
 * supplied, switches to a LoRA-capable FLUX model.
 */
import type { ImageProvider } from "./generative.js";

const FLUX_SCHNELL = "black-forest-labs/flux-schnell";
// flux-dev LoRA explorer (accepts hf_lora) — used only when a LoRA is requested.
const FLUX_LORA = "lucataco/flux-dev-lora";

export class ReplicateImageProvider implements ImageProvider {
    constructor(private readonly token: string) {}

    async generate(args: {
        prompt: string;
        style_pack_id: string;
        lora_hf_repo?: string;
        tile_size?: number;
    }): Promise<{ image_url: string; width: number; height: number; cost_usd: number }> {
        const useLora = !!args.lora_hf_repo;
        const model = useLora ? FLUX_LORA : FLUX_SCHNELL;
        // A sprite-friendly prompt: transparent-ish, centered, game-asset style.
        const prompt = `${args.prompt}, game sprite, centered, simple background, ${args.style_pack_id} style`;
        const input: Record<string, unknown> = {
            prompt,
            num_outputs: 1,
            aspect_ratio: "1:1",
            output_format: "png",
        };
        if (useLora) {
            input.hf_lora = args.lora_hf_repo;
            input.lora_scale = 0.9;
        }

        const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.token}`,
                "Content-Type": "application/json",
                Prefer: "wait", // synchronous: block until the prediction is done
            },
            body: JSON.stringify({ input }),
        });
        if (!res.ok) {
            throw new Error(`Replicate FLUX failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
        }
        const body = (await res.json()) as { output?: string | string[]; error?: string };
        if (body.error) throw new Error(`Replicate FLUX error: ${body.error}`);
        const url = Array.isArray(body.output) ? body.output[0] : body.output;
        if (!url) throw new Error("Replicate FLUX returned no image");

        // flux-schnell ≈ $0.003/img, flux-dev-lora ≈ $0.04/img (rough).
        return { image_url: url, width: 1024, height: 1024, cost_usd: useLora ? 0.04 : 0.003 };
    }
}
