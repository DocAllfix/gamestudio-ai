/**
 * asset_resolver — character slots (asset_type="sprite") must require a
 * transparent background (has_alpha) so no in-game character shows a box.
 * Other slots (tileset/background) do not. Uses an injected matchAssets that
 * records the query, so no DB/embedding round-trip.
 */
import { describe, it, expect } from "vitest";

import descriptor, { type AssetResolverDeps, type MatchedAsset } from "../index.js";
import type { ToolInvocation } from "../../../contracts/tool-registry.contract.js";

function invocation(input: Record<string, unknown>): ToolInvocation {
    return {
        tool_id: "asset_resolver",
        input,
        node_id: "n1",
        project_id: "00000000-0000-4000-8000-000000000000",
        plan_version: 1,
        trace_id: "t1",
    };
}

function capturingDeps(hits: MatchedAsset[] = []): { deps: AssetResolverDeps; last: () => { require_alpha?: boolean } | null } {
    let captured: { require_alpha?: boolean } | null = null;
    return {
        deps: { matchAssets: async (q) => { captured = q; return hits; } },
        last: () => captured,
    };
}

const spriteHit: MatchedAsset = {
    id: "a1", source_url: "u", download_url: "https://x/hero.png", license: "CC0-1.0",
    asset_type: "sprite", semantic_description: "hero", quality_score: 5, success_score: 0,
    has_alpha: true, similarity: 0.9,
};

describe("asset_resolver — has_alpha enforcement", () => {
    it("requires alpha for a sprite (character) slot", async () => {
        const { deps, last } = capturingDeps();
        await descriptor.handler(invocation({ description: "hero", asset_type: "sprite" }), deps);
        expect(last()?.require_alpha).toBe(true);
    });

    it("does NOT require alpha for a tileset slot", async () => {
        const { deps, last } = capturingDeps();
        await descriptor.handler(invocation({ description: "ground tiles", asset_type: "tileset" }), deps);
        expect(last()?.require_alpha).toBe(false);
    });

    it("does NOT require alpha for a background slot", async () => {
        const { deps, last } = capturingDeps();
        await descriptor.handler(invocation({ description: "sky", asset_type: "background" }), deps);
        expect(last()?.require_alpha).toBe(false);
    });

    it("serves a transparent catalog sprite", async () => {
        const { deps } = capturingDeps([spriteHit]);
        const res = await descriptor.handler(invocation({ description: "hero", asset_type: "sprite" }), deps);
        const out = res.output as { source: string; asset: { download_url: string } | null };
        expect(out.source).toBe("catalog");
        expect(out.asset?.download_url).toBe("https://x/hero.png");
    });
});
