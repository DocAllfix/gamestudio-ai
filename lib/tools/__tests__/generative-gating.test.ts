/**
 * Gating layer for the PAY generative ports.
 *
 * Two gates: (1) the check_quota RPC (DB-side per-game cost + monthly
 * ceiling) and (2) the W2 paywall policy "generative requires tier >=
 * creator". Both the quota RPC and the tier lookup are injected so these
 * tests run with no DB.
 */
import { describe, expect, it, vi } from "vitest";

import { gateGenerative, type GateDeps } from "../_gating.js";

function deps(tier: "free" | "creator" | "pro" | "studio", quotaAllowed = true): GateDeps {
    return {
        getUserTier: vi.fn(async () => tier),
        checkQuota: vi.fn(async () => ({
            allowed: quotaAllowed,
            reason: quotaAllowed ? null : "per_game_cost_exceeded",
            games_used_this_month: 0,
        })),
    };
}

describe("gateGenerative", () => {
    it("denies a free-tier user for a generative tool (paywall)", async () => {
        const res = await gateGenerative(
            { clerk_user_id: "user_free", tool_id: "bgm_gen", estimated_cost_usd: 0.1 },
            deps("free"),
        );
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe("generative_requires_paid_tier");
    });

    it("allows a creator-tier user for a generative tool", async () => {
        const res = await gateGenerative(
            { clerk_user_id: "user_creator", tool_id: "bgm_gen", estimated_cost_usd: 0.1 },
            deps("creator"),
        );
        expect(res.allowed).toBe(true);
    });

    it("denies a paid user when check_quota refuses (cost ceiling)", async () => {
        const res = await gateGenerative(
            { clerk_user_id: "user_creator", tool_id: "model_3d_gen", estimated_cost_usd: 99 },
            deps("creator", false),
        );
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe("per_game_cost_exceeded");
    });

    it("does not call check_quota when the paywall already denies", async () => {
        const d = deps("free");
        await gateGenerative(
            { clerk_user_id: "user_free", tool_id: "sfx_gen", estimated_cost_usd: 0.1 },
            d,
        );
        expect(d.checkQuota).not.toHaveBeenCalled();
    });
});
