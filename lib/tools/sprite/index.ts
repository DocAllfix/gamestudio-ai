/**
 * sprite_gen — 2D sprite tool, CC0-first.
 *
 * Economic rule (FIX A7, lib/tools/CLAUDE.md §6): on tier=free the tool
 * resolves a CC0 catalog asset and MUST NOT call the ImageGenPort
 * (FLUX) — premium generation is paywalled (tier >= creator). The asset
 * resolver and the generative port are injected; on free tier the port
 * is never touched (and may be absent).
 */
import { z } from "zod";

import {
    ToolInputBaseSchema,
    ToolOutputBaseSchema,
    type ToolInvocation,
} from "../../contracts/tool-registry.contract.js";
import type { ImageGenPort } from "../../contracts/generative.contract.js";
import { makeResult, type Tool } from "../_shared.js";

export const SpriteToolInputSchema = ToolInputBaseSchema.extend({
    description: z.string().min(1),
    style_pack_id: z.string().min(1),
    tier: z.enum(["free", "creator", "studio"]).default("free"),
    lora_hf_repo: z.string().optional(),
});
export type SpriteToolInput = z.infer<typeof SpriteToolInputSchema>;

export const SpriteToolOutputSchema = ToolOutputBaseSchema.extend({
    source: z.enum(["catalog", "generated"]),
    image_url: z.string(),
    license: z.string().nullable(),
});
export type SpriteToolOutput = z.infer<typeof SpriteToolOutputSchema>;

export interface ResolvedAsset {
    source: "catalog" | "generative";
    fallback_generative: boolean;
    asset: { download_url: string; license: string } | null;
}

export interface SpriteGenDeps {
    resolveAsset(query: { description: string; asset_type: string; style_pack?: string }): Promise<ResolvedAsset>;
    /** Only constructed/used on paid tiers. Optional so free-tier callers
     * never need to wire a generative provider. */
    imageGenPort?: ImageGenPort;
}

function defaultDeps(): SpriteGenDeps {
    return {
        async resolveAsset(query) {
            const { default: assetResolver } = await import("../asset-resolver/index.js");
            const res = await assetResolver.handler({
                tool_id: "asset_resolver",
                input: query,
                node_id: "sprite_gen_internal",
                project_id: "00000000-0000-4000-8000-000000000000",
                plan_version: 1,
                trace_id: "sprite_gen_internal",
            });
            const out = res.output as { source: "catalog" | "generative"; fallback_generative: boolean; asset: { download_url: string; license: string } | null } | null;
            return {
                source: out?.source ?? "generative",
                fallback_generative: out?.fallback_generative ?? true,
                asset: out?.asset ? { download_url: out.asset.download_url, license: out.asset.license } : null,
            };
        },
        // Wire the real FLUX provider when a Replicate token is present, so paid
        // (or paywall-disabled) runs generate real sprites instead of degrading
        // to placeholders. Built lazily to avoid the import on free-tier paths.
        imageGenPort: buildImageGenPort(),
    };
}

/** Construct the Replicate FLUX ImageGenPort, or undefined if no token (→ the
 * tool degrades to catalog/placeholder, unchanged). */
function buildImageGenPort(): ImageGenPort | undefined {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) return undefined;
    return {
        async generateSprite(input) {
            const [{ ReplicateImagePort }, { ReplicateImageProvider }, { makeAdapterDeps }] = await Promise.all([
                import("./generative.js"),
                import("./replicate-provider.js"),
                import("../_gating-default.js"),
            ]);
            // No per-user id in this internal path; the gate honors
            // GENERATIVE_PAYWALL_DISABLED for the friends test.
            const port = new ReplicateImagePort(makeAdapterDeps("system"), new ReplicateImageProvider(token));
            return port.generateSprite(input);
        },
        async generateTileset(input) {
            const [{ ReplicateImagePort }, { ReplicateImageProvider }, { makeAdapterDeps }] = await Promise.all([
                import("./generative.js"),
                import("./replicate-provider.js"),
                import("../_gating-default.js"),
            ]);
            const port = new ReplicateImagePort(makeAdapterDeps("system"), new ReplicateImageProvider(token));
            return port.generateTileset(input);
        },
    };
}

async function handler(invocation: ToolInvocation, deps: SpriteGenDeps = defaultDeps()) {
    const start = Date.now();
    const input = SpriteToolInputSchema.parse({
        ...invocation.input,
        project_id: invocation.project_id,
        plan_version: invocation.plan_version,
        trace_id: invocation.trace_id,
    });

    const resolved = await deps.resolveAsset({
        description: input.description,
        asset_type: "sprite",
        style_pack: input.style_pack_id,
    });

    // Free tier: CC0 only. Never invoke FLUX — even when the catalog hit
    // is weak we serve what we have rather than paying for generation.
    if (input.tier === "free") {
        if (resolved.asset) {
            return done("catalog", resolved.asset.download_url, resolved.asset.license);
        }
        return makeResult({
            invocation: { tool_id: "sprite_gen", node_id: invocation.node_id, trace_id: invocation.trace_id },
            output: null,
            qa_log: [{ check: "cc0_available", passed: false, detail: "no CC0 asset for free tier" }],
            error_message: "No CC0 asset found; premium generation requires a paid tier.",
            latency_ms: Date.now() - start,
        });
    }

    // Paid tier: prefer a strong catalog hit, otherwise generate with FLUX.
    if (resolved.source === "catalog" && !resolved.fallback_generative && resolved.asset) {
        return done("catalog", resolved.asset.download_url, resolved.asset.license);
    }
    if (!deps.imageGenPort) {
        // No generative provider wired yet: degrade gracefully. Use any CC0 hit
        // we have; otherwise return no asset (output null) WITHOUT throwing, so
        // the run continues and the code_gen draws placeholder art. (Generative
        // providers are wired in a later slice.)
        if (resolved.asset) {
            return done("catalog", resolved.asset.download_url, resolved.asset.license);
        }
        return makeResult({
            invocation: { tool_id: "sprite_gen", node_id: invocation.node_id, trace_id: invocation.trace_id },
            output: null,
            qa_log: [{ check: "asset_resolved", passed: false, detail: "no asset; degraded (no generative provider)" }],
            latency_ms: Date.now() - start,
        });
    }
    const generated = await deps.imageGenPort.generateSprite({
        project_id: input.project_id,
        plan_version: input.plan_version,
        trace_id: input.trace_id,
        description: input.description,
        style_pack_id: input.style_pack_id,
        lora_hf_repo: input.lora_hf_repo,
    });
    return done("generated", generated.image_url, null, generated.cost_usd);

    function done(source: "catalog" | "generated", image_url: string, license: string | null, cost = 0) {
        const output: SpriteToolOutput = {
            trace_id: invocation.trace_id,
            cost_usd: cost,
            latency_ms: Date.now() - start,
            qa_log: [],
            source,
            image_url,
            license,
        };
        return makeResult({
            invocation: { tool_id: "sprite_gen", node_id: invocation.node_id, trace_id: invocation.trace_id },
            output,
            qa_log: [{ check: "image_resolved", passed: true, detail: source }],
            cost_usd: cost,
            latency_ms: Date.now() - start,
        });
    }
}

const descriptor: Tool<SpriteGenDeps> = {
    id: "sprite_gen",
    name: "Sprite Generator",
    description: "CC0-first sprite resolution; FLUX generation only on paid tiers.",
    category: "sprite",
    inputSchema: SpriteToolInputSchema,
    outputSchema: SpriteToolOutputSchema,
    estimatedCostUsd: 0.02,
    estimatedDurationSeconds: 6,
    handler,
};

export default descriptor;
