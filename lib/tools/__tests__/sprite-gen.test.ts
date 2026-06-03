/**
 * sprite_gen — CC0-first sprite tool.
 *
 * FIX A7 economic constraint: on tier=free the tool must resolve a CC0
 * asset and NEVER instantiate or call the ImageGenPort (FLUX). FLUX is
 * paywalled (tier >= creator). The asset resolver and the generative
 * port are injected so the test can assert the port is never touched.
 */
import { describe, expect, it, vi } from "vitest";

import spriteGen from "../sprite/index.js";
import { ToolExecutionResultSchema } from "../../contracts/tool-registry.contract.js";

const baseInvocation = {
    tool_id: "sprite_gen" as const,
    node_id: "n1",
    project_id: "00000000-0000-4000-8000-000000000000",
    plan_version: 1,
    trace_id: "trace_sg",
};

function catalogResolver() {
    return vi.fn(async () => ({
        source: "catalog" as const,
        fallback_generative: false,
        asset: { download_url: "https://example.com/knight.png", license: "CC0-1.0" },
    }));
}

function fakeImageGenPort() {
    return {
        generateSprite: vi.fn(),
        generateTileset: vi.fn(),
    };
}

describe("sprite_gen tier=free", () => {
    it("does NOT call ImageGenPort (FLUX) — CC0 only", async () => {
        const imageGenPort = fakeImageGenPort();
        await spriteGen.handler(
            {
                ...baseInvocation,
                input: { description: "a knight", style_pack_id: "sp_pixel", tier: "free" },
            },
            { resolveAsset: catalogResolver(), imageGenPort },
        );
        expect(imageGenPort.generateSprite).not.toHaveBeenCalled();
    });

    it("returns a contract-valid result sourced from the catalog", async () => {
        const res = await spriteGen.handler(
            {
                ...baseInvocation,
                input: { description: "a knight", style_pack_id: "sp_pixel", tier: "free" },
            },
            { resolveAsset: catalogResolver(), imageGenPort: fakeImageGenPort() },
        );
        expect(() => ToolExecutionResultSchema.parse(res)).not.toThrow();
        expect(res.output?.source).toBe("catalog");
    });
});
