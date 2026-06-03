/**
 * asset_resolver tool — CC0-first asset retrieval (D.5 Asset Resolver).
 *
 * Queries the `match_assets` RPC (migration 003) with a query embedding
 * and returns the best catalog hit. Threshold policy:
 *   - RPC floor 0.78 (weaker hits are not returned by the RPC)
 *   - similarity > 0.85 → serve from catalog (source:"catalog")
 *   - 0.78 .. 0.85    → return the hit but flag generative fallback
 *   - no hit          → source:"generative", caller should generate
 *
 * The match_assets caller is injected so tools/tests can run without a
 * live Supabase/embedding round-trip; the default wires the real RPC.
 */
import { z } from "zod";

import {
    ToolInputBaseSchema,
    ToolOutputBaseSchema,
    type ToolInvocation,
} from "../../contracts/tool-registry.contract.js";
import { makeResult, type Tool } from "../_shared.js";

const CATALOG_THRESHOLD = 0.85;

export interface MatchedAsset {
    id: string;
    source_url: string;
    download_url: string;
    license: string;
    asset_type: string;
    semantic_description: string;
    quality_score: number;
    success_score: number;
    similarity: number;
}

export interface AssetResolverDeps {
    matchAssets(query: {
        description: string;
        asset_type?: string;
        style_pack?: string;
        genre?: string;
        engine?: string;
    }): Promise<MatchedAsset[]>;
}

export const AssetResolverInputSchema = ToolInputBaseSchema.extend({
    description: z.string().min(1),
    asset_type: z.string().optional(),
    style_pack: z.string().optional(),
    genre: z.string().optional(),
    engine: z.string().optional(),
});
export type AssetResolverInput = z.infer<typeof AssetResolverInputSchema>;

export const AssetResolverOutputSchema = ToolOutputBaseSchema.extend({
    source: z.enum(["catalog", "generative"]),
    /** True when the caller should fall back to a generative tool: either
     * no hit, or a hit too weak to use without a generated alternative. */
    fallback_generative: z.boolean(),
    asset: z
        .object({
            id: z.string(),
            download_url: z.string(),
            license: z.string(),
            similarity: z.number(),
        })
        .nullable(),
});
export type AssetResolverOutput = z.infer<typeof AssetResolverOutputSchema>;

async function defaultMatchAssets(query: {
    description: string;
    asset_type?: string;
    style_pack?: string;
    genre?: string;
    engine?: string;
}): Promise<MatchedAsset[]> {
    const { createClient } = await import("@supabase/supabase-js");
    const { embed } = await import("../../llm/embed.js");

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error({ context: "asset_resolver.defaultMatchAssets", error: "missing supabase env" });
        return [];
    }
    try {
        const embedding = await embed(query.description);
        const supabase = createClient(url, key);
        const { data, error } = await supabase.rpc("match_assets", {
            p_query_embedding: `[${embedding.join(",")}]`,
            p_asset_type: query.asset_type ?? null,
            p_style_pack: query.style_pack ?? null,
            p_genre: query.genre ?? null,
            p_engine: query.engine ?? null,
        });
        if (error) {
            console.error({ context: "asset_resolver.match_assets.rpc", query, error });
            return [];
        }
        return (data ?? []) as MatchedAsset[];
    } catch (error) {
        console.error({ context: "asset_resolver.defaultMatchAssets", query, error });
        return [];
    }
}

async function handler(
    invocation: ToolInvocation,
    deps: AssetResolverDeps = { matchAssets: defaultMatchAssets },
) {
    const start = Date.now();
    const input = AssetResolverInputSchema.parse({ ...invocation.input, ...pickBase(invocation) });

    const hits = await deps.matchAssets({
        description: input.description,
        asset_type: input.asset_type,
        style_pack: input.style_pack,
        genre: input.genre,
        engine: input.engine,
    });
    const best = hits[0] ?? null;

    let output: AssetResolverOutput;
    if (best && best.similarity > CATALOG_THRESHOLD) {
        output = okOutput(invocation.trace_id, "catalog", false, best);
    } else if (best) {
        output = okOutput(invocation.trace_id, "catalog", true, best);
    } else {
        output = okOutput(invocation.trace_id, "generative", true, null);
    }

    return makeResult({
        invocation: { tool_id: "asset_resolver", node_id: invocation.node_id, trace_id: invocation.trace_id },
        output,
        qa_log: [
            {
                check: "catalog_match",
                passed: true,
                detail: best ? `best similarity ${best.similarity.toFixed(3)}` : "no catalog hit",
            },
        ],
        latency_ms: Date.now() - start,
    });
}

function pickBase(invocation: ToolInvocation) {
    return {
        project_id: invocation.project_id,
        plan_version: invocation.plan_version,
        trace_id: invocation.trace_id,
    };
}

function okOutput(
    trace_id: string,
    source: "catalog" | "generative",
    fallback_generative: boolean,
    best: MatchedAsset | null,
): AssetResolverOutput {
    return {
        trace_id,
        cost_usd: 0,
        latency_ms: 0,
        qa_log: [],
        source,
        fallback_generative,
        asset: best
            ? {
                  id: best.id,
                  download_url: best.download_url,
                  license: best.license,
                  similarity: best.similarity,
              }
            : null,
    };
}

const descriptor: Tool<AssetResolverDeps> = {
    id: "asset_resolver",
    name: "Asset Resolver",
    description: "CC0-first catalog retrieval via match_assets; signals generative fallback when no strong hit.",
    category: "extras",
    inputSchema: AssetResolverInputSchema,
    outputSchema: AssetResolverOutputSchema,
    estimatedCostUsd: 0.0005,
    estimatedDurationSeconds: 1,
    handler,
};

export default descriptor;
