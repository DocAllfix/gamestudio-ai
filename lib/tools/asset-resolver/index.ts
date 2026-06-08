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

// Above this similarity we serve the catalog asset directly; below (but above
// the RPC floor 0.45) we return it flagged for generative fallback. Tuned to
// text-embedding-3-small's real range on these captions (perfect ~0.63), not the
// theoretical 0.85 which never triggered.
const CATALOG_THRESHOLD = 0.55;

export interface MatchedAsset {
    id: string;
    source_url: string;
    download_url: string;
    license: string;
    asset_type: string;
    semantic_description: string;
    quality_score: number;
    success_score: number;
    /** Whether the sprite's background is transparent (migration 012). Required
     * for character slots so no in-game character shows a background box. */
    has_alpha?: boolean;
    similarity: number;
}

export interface UserLibraryAsset {
    id: string;
    download_url: string;
    license: string;
}

export interface AssetResolverDeps {
    matchAssets(query: {
        description: string;
        asset_type?: string;
        style_pack?: string;
        genre?: string;
        engine?: string;
        /** Serve only transparent sprites (character slots → no in-game box). */
        require_alpha?: boolean;
    }): Promise<MatchedAsset[]>;
    /** Optional: the user's personal Studio library (project_assets). When it
     * returns an asset, it wins over catalog/generative (curated library feeds
     * the game first). Absent in tests/contexts without a user library. */
    findUserAsset?(query: {
        user_id: string;
        asset_type?: string;
        style_pack?: string;
    }): Promise<UserLibraryAsset | null>;
}

export const AssetResolverInputSchema = ToolInputBaseSchema.extend({
    description: z.string().min(1),
    asset_type: z.string().optional(),
    style_pack: z.string().optional(),
    genre: z.string().optional(),
    engine: z.string().optional(),
    /** When present (+ findUserAsset dep), the user's library is checked first. */
    user_id: z.string().optional(),
});
export type AssetResolverInput = z.infer<typeof AssetResolverInputSchema>;

export const AssetResolverOutputSchema = ToolOutputBaseSchema.extend({
    source: z.enum(["user_library", "catalog", "generative"]),
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

/** download_urls the engine build can actually load directly. Some catalog rows
 * (especially older OpenGameArt imports) point at archives or source files
 * (.zip/.7z/.psd/.blend/...), which the assembler rejects at build → the slot
 * falls back to a placeholder even though a "match" was found. Reject those so a
 * loadable hit ranks ahead of an unusable one. */
const NON_LOADABLE_URL = /\.(zip|7z|rar|tar|gz|tgz|psd|xcf|blend|ai|kra|aseprite|ase|fla|tmx|tsx)(\?|#|$)/i;
function preferLoadable(hits: MatchedAsset[]): MatchedAsset[] {
    const loadable = hits.filter((h) => !NON_LOADABLE_URL.test(h.download_url ?? ""));
    // Keep the original (similarity) order; only drop the unusable ones. Fall
    // back to the raw hits if every match is an archive (better an archive the
    // build skips than no signal at all — the slot placeholder still renders).
    return loadable.length > 0 ? loadable : hits;
}

async function defaultMatchAssets(query: {
    description: string;
    asset_type?: string;
    style_pack?: string;
    genre?: string;
    engine?: string;
    require_alpha?: boolean;
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
        const p_query_embedding = `[${embedding.join(",")}]`;
        // text-embedding-3-small scores even perfect matches ~0.60-0.65 on these
        // descriptive CC0 captions, so the RPC's 0.75 default rejected everything
        // (every game was mute / used no CC0 art). 0.45 is the realistic floor.
        const p_match_threshold = 0.45;

        // GRACEFUL WIDENING. style_pack and genre are HARD filters in the RPC
        // (asset must contain the exact pack/genre), so a single drift — an
        // invalid style_pack_id like "<genre>_default", or asset genre_affinity
        // using a different vocabulary than the GenreEnum — makes the strict
        // query return 0 and the slot degrades to a placeholder. Asset slots
        // are visual enrichment: a same-type contextual hit (ranked by embedding
        // similarity) beats an empty placeholder. So try strict first (best
        // coherence), then progressively drop genre, then style, keeping the
        // semantic ranking throughout. Engine + asset_type stay (a 3D model in a
        // 2D slot would be wrong).
        const attempts: Array<{ style_pack: string | null; genre: string | null }> = [
            { style_pack: query.style_pack ?? null, genre: query.genre ?? null },
            { style_pack: query.style_pack ?? null, genre: null },
            { style_pack: null, genre: null },
        ];
        for (const a of attempts) {
            const { data, error } = await supabase.rpc("match_assets", {
                p_query_embedding,
                p_asset_type: query.asset_type ?? null,
                p_style_pack: a.style_pack,
                p_genre: a.genre,
                p_engine: query.engine ?? null,
                p_match_threshold,
                // Kept across the style/genre widening: NEVER serve a boxed sprite.
                p_require_alpha: query.require_alpha ?? false,
            });
            if (error) {
                console.error({ context: "asset_resolver.match_assets.rpc", query, attempt: a, error });
                return [];
            }
            const hits = (data ?? []) as MatchedAsset[];
            if (hits.length > 0) return preferLoadable(hits);
        }
        return [];
    } catch (error) {
        console.error({ context: "asset_resolver.defaultMatchAssets", query, error });
        return [];
    }
}

/** Default user-library lookup: most recent matching asset from project_assets. */
async function defaultFindUserAsset(query: {
    user_id: string;
    asset_type?: string;
    style_pack?: string;
}): Promise<UserLibraryAsset | null> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    try {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(url, key);
        // user_id here is the internal users.id (resolved by the caller).
        let q = supabase
            .from("project_assets")
            .select("id, url, license, asset_type, style_pack_id")
            .eq("user_id", query.user_id)
            .order("favorite", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(1);
        if (query.asset_type) q = q.eq("asset_type", query.asset_type);
        if (query.style_pack) q = q.eq("style_pack_id", query.style_pack);
        const { data, error } = await q;
        if (error || !data || data.length === 0) return null;
        const a = data[0] as { id: string; url: string; license: string };
        return { id: a.id, download_url: a.url, license: a.license };
    } catch (error) {
        console.error({ context: "asset_resolver.defaultFindUserAsset", query, error });
        return null;
    }
}

async function handler(
    invocation: ToolInvocation,
    deps: AssetResolverDeps = { matchAssets: defaultMatchAssets, findUserAsset: defaultFindUserAsset },
) {
    const start = Date.now();
    const input = AssetResolverInputSchema.parse({ ...invocation.input, ...pickBase(invocation) });

    // 1) User's curated Studio library wins, when available.
    if (deps.findUserAsset && input.user_id) {
        const owned = await deps.findUserAsset({
            user_id: input.user_id,
            asset_type: input.asset_type,
            style_pack: input.style_pack,
        });
        if (owned) {
            return makeResult({
                invocation: { tool_id: "asset_resolver", node_id: invocation.node_id, trace_id: invocation.trace_id },
                output: userLibraryOutput(invocation.trace_id, owned),
                qa_log: [{ check: "user_library", passed: true, detail: `library asset ${owned.id}` }],
                latency_ms: Date.now() - start,
            });
        }
    }

    // 2) CC0 catalog. Sprites are in-game characters/objects → require a
    // transparent background so none ever shows a box in scene.
    const hits = await deps.matchAssets({
        description: input.description,
        asset_type: input.asset_type,
        style_pack: input.style_pack,
        genre: input.genre,
        engine: input.engine,
        require_alpha: input.asset_type === "sprite",
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
    source: "user_library" | "catalog" | "generative",
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

/** A user-library hit is an exact, curated choice — similarity 1, no fallback. */
function userLibraryOutput(trace_id: string, asset: UserLibraryAsset): AssetResolverOutput {
    return {
        trace_id,
        cost_usd: 0,
        latency_ms: 0,
        qa_log: [],
        source: "user_library",
        fallback_generative: false,
        asset: { id: asset.id, download_url: asset.download_url, license: asset.license, similarity: 1 },
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
