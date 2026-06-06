/**
 * model_3d_gen tool — 3D models, CC0-first.
 *
 * Same economic rule as sprite_gen/audio: free tier resolves a CC0 catalog
 * model (554 in the DB via asset-resolver, asset_type "model_3d") and never
 * calls a paid provider; paid tiers fall back to the MeshyModel3DPort
 * (Meshy/Replicate TRELLIS) behind ensureAllowed. With GENERATIVE_PAYWALL_DISABLED
 * the friends test can generate freely.
 */
import { z } from "zod";

import {
    ToolInputBaseSchema,
    ToolOutputBaseSchema,
    type ToolInvocation,
} from "../../contracts/tool-registry.contract.js";
import type { Model3DPort } from "../../contracts/generative.contract.js";
import { makeResult, type Tool } from "../_shared.js";

export const Model3DToolInputSchema = ToolInputBaseSchema.extend({
    description: z.string().min(1),
    style_pack_id: z.string().min(1).optional(),
    tier: z.enum(["free", "creator", "studio"]).default("free"),
});
export type Model3DToolInput = z.infer<typeof Model3DToolInputSchema>;

export const Model3DToolOutputSchema = ToolOutputBaseSchema.extend({
    source: z.enum(["catalog", "generated"]),
    glb_url: z.string(),
    license: z.string().nullable(),
});

interface ResolvedAsset {
    source: "catalog" | "generative";
    fallback_generative: boolean;
    asset: { download_url: string; license: string } | null;
}

export interface Model3DToolDeps {
    resolveAsset(query: { description: string; asset_type: string; style_pack?: string }): Promise<ResolvedAsset>;
    model3dPort?: Model3DPort;
}

function defaultDeps(): Model3DToolDeps {
    return {
        async resolveAsset(query) {
            const { default: assetResolver } = await import("../asset-resolver/index.js");
            const res = await assetResolver.handler({
                tool_id: "asset_resolver",
                input: query,
                node_id: "model_3d_internal",
                project_id: "00000000-0000-4000-8000-000000000000",
                plan_version: 1,
                trace_id: "model_3d_internal",
            });
            const out = res.output as ResolvedAsset | null;
            return {
                source: out?.source ?? "generative",
                fallback_generative: out?.fallback_generative ?? true,
                asset: out?.asset ? { download_url: out.asset.download_url, license: out.asset.license } : null,
            };
        },
    };
}

async function handler(invocation: ToolInvocation, deps: Model3DToolDeps = defaultDeps()) {
    const start = Date.now();
    const input = Model3DToolInputSchema.parse({
        ...invocation.input,
        project_id: invocation.project_id,
        plan_version: invocation.plan_version,
        trace_id: invocation.trace_id,
    });

    const resolved = await deps.resolveAsset({
        description: input.description,
        asset_type: "model_3d",
        style_pack: input.style_pack_id,
    });

    if (input.tier === "free") {
        if (resolved.asset) return done("catalog", resolved.asset.download_url, resolved.asset.license);
        return makeResult({
            invocation: { tool_id: "model_3d_gen", node_id: invocation.node_id, trace_id: invocation.trace_id },
            output: null,
            qa_log: [{ check: "cc0_available", passed: false, detail: "no CC0 3D model for free tier" }],
            error_message: "No CC0 3D model found; generation requires a paid tier.",
            latency_ms: Date.now() - start,
        });
    }

    if (resolved.source === "catalog" && !resolved.fallback_generative && resolved.asset) {
        return done("catalog", resolved.asset.download_url, resolved.asset.license);
    }
    if (!deps.model3dPort) {
        // No generative provider wired yet: degrade gracefully (CC0 if any,
        // else no model) WITHOUT throwing, so the run still produces a game.
        if (resolved.asset) return done("catalog", resolved.asset.download_url, resolved.asset.license);
        return makeResult({
            invocation: { tool_id: "model_3d_gen", node_id: invocation.node_id, trace_id: invocation.trace_id },
            output: null,
            qa_log: [{ check: "model_resolved", passed: false, detail: "no model; degraded (no generative provider)" }],
            latency_ms: Date.now() - start,
        });
    }
    const gen = await deps.model3dPort.generateModel({
        project_id: input.project_id,
        plan_version: input.plan_version,
        trace_id: input.trace_id,
        prompt: input.description,
        style_pack_id: input.style_pack_id ?? "default",
        rigged: true,
    });
    return done("generated", gen.glb_url, null, gen.cost_usd);

    function done(source: "catalog" | "generated", glb_url: string, license: string | null, cost = 0) {
        return makeResult({
            invocation: { tool_id: "model_3d_gen", node_id: invocation.node_id, trace_id: invocation.trace_id },
            output: { trace_id: invocation.trace_id, cost_usd: cost, latency_ms: Date.now() - start, qa_log: [], source, glb_url, license },
            qa_log: [{ check: "model_resolved", passed: true, detail: source }],
            cost_usd: cost,
            latency_ms: Date.now() - start,
        });
    }
}

const descriptor: Tool<Model3DToolDeps> = {
    id: "model_3d_gen",
    name: "3D Model Generator",
    description: "CC0-first 3D model resolution; Meshy/TRELLIS generation only on paid tiers.",
    category: "3d",
    inputSchema: Model3DToolInputSchema,
    outputSchema: Model3DToolOutputSchema,
    estimatedCostUsd: 0.5,
    estimatedDurationSeconds: 30,
    handler,
};

export default descriptor;
