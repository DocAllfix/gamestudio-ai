/**
 * asset_resolver — CC0-first asset retrieval over the match_assets RPC.
 *
 * Threshold policy (prompt [2-W2]): RPC floor 0.78; a hit with
 * similarity > 0.85 is served straight from the catalog
 * (source:"catalog"); a weaker hit (0.78..0.85) is returned but flagged
 * for generative fallback; no hit → signal generative.
 *
 * The match_assets caller is injected so no DB/embedding is touched.
 */
import { describe, expect, it, vi } from "vitest";

import assetResolver from "../asset-resolver/index.js";
import { ToolExecutionResultSchema } from "../../contracts/tool-registry.contract.js";

const baseInvocation = {
    tool_id: "asset_resolver" as const,
    node_id: "n1",
    project_id: "00000000-0000-4000-8000-000000000000",
    plan_version: 1,
    trace_id: "trace_ar",
};

function matchAssetsReturning(similarity: number) {
    return vi.fn(async () => [
        {
            id: "00000000-0000-4000-8000-000000000aaa",
            source_url: "https://example.com/a",
            download_url: "https://example.com/a.png",
            license: "CC0-1.0",
            asset_type: "sprite",
            semantic_description: "a knight",
            quality_score: 5,
            success_score: 2,
            similarity,
        },
    ]);
}

describe("asset_resolver handler", () => {
    it("returns a contract-valid ToolExecutionResult", async () => {
        const res = await assetResolver.handler(
            { ...baseInvocation, input: { description: "a knight sprite", asset_type: "sprite" } },
            { matchAssets: matchAssetsReturning(0.9) },
        );
        expect(() => ToolExecutionResultSchema.parse(res)).not.toThrow();
        expect(res.status).toBe("succeeded");
    });

    it("serves from catalog when best match > 0.85", async () => {
        const res = await assetResolver.handler(
            { ...baseInvocation, input: { description: "a knight", asset_type: "sprite" } },
            { matchAssets: matchAssetsReturning(0.9) },
        );
        expect(res.output?.source).toBe("catalog");
        expect(res.output?.fallback_generative).toBe(false);
    });

    it("flags generative fallback when best match is between 0.78 and 0.85", async () => {
        const res = await assetResolver.handler(
            { ...baseInvocation, input: { description: "a knight", asset_type: "sprite" } },
            { matchAssets: matchAssetsReturning(0.8) },
        );
        expect(res.output?.fallback_generative).toBe(true);
    });

    it("signals generative when there is no catalog hit", async () => {
        const res = await assetResolver.handler(
            { ...baseInvocation, input: { description: "a knight", asset_type: "sprite" } },
            { matchAssets: vi.fn(async () => []) },
        );
        expect(res.output?.source).toBe("generative");
        expect(res.output?.fallback_generative).toBe(true);
    });
});
