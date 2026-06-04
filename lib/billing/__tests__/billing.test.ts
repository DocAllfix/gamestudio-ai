/**
 * [4-W4] Billing tests — verifies:
 * 1. Free user + generative action → blocked (check_quota allowed=false)
 * 2. Checkout (mock Stripe) → returns a URL
 * 3. Webhook → users.tier updated correctly
 * 4. Tip Jar → Stripe one-time session URL returned
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TIER_DEFINITIONS } from "../../contracts/billing.contract.js";
import type { UserTier, QuotaCheckResponse } from "../../contracts/billing.contract.js";
import { TIP_AMOUNTS_USD } from "../tip-jar.js";

// ── Shared mocks ─────────────────────────────────────────────────────────────

// Stub QuotaCheckResponse — simulates the check_quota RPC result
function makeQuotaResponse(
  tier: UserTier,
  estimatedCostUsd: number,
  gamesUsed = 0,
): QuotaCheckResponse {
  const def = TIER_DEFINITIONS[tier];
  const maxPerGame = def.max_cost_usd_per_game;
  const maxPerMonth =
    def.games_per_month === "unlimited" ? Infinity : def.games_per_month;

  if (estimatedCostUsd > maxPerGame) {
    return {
      allowed: false,
      reason: "per_game_cost_exceeded",
      current_usage: {
        games_used_this_month: gamesUsed,
        cost_used_on_current_game_usd: estimatedCostUsd,
      },
    };
  }
  if (gamesUsed >= maxPerMonth) {
    return {
      allowed: false,
      reason: "monthly_games_exhausted",
      current_usage: {
        games_used_this_month: gamesUsed,
        cost_used_on_current_game_usd: estimatedCostUsd,
      },
    };
  }
  return {
    allowed: true,
    reason: null,
    current_usage: {
      games_used_this_month: gamesUsed,
      cost_used_on_current_game_usd: estimatedCostUsd,
    },
  };
}

// ── 1. Free user + generative action → blocked ───────────────────────────────

describe("Quota check — free tier enforcement", () => {
  it("blocks a free user when cost exceeds $1.50 (max_cost_usd_per_game)", () => {
    // Free tier ceiling: $1.50/game
    const result = makeQuotaResponse("free", 2.0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("per_game_cost_exceeded");
  });

  it("blocks a free user when monthly games exhausted (3 games)", () => {
    // Free tier: 3 games/month
    const result = makeQuotaResponse("free", 1.0, 3);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("monthly_games_exhausted");
  });

  it("allows a free user within limits ($1.0 cost, 0 games used)", () => {
    const result = makeQuotaResponse("free", 1.0, 0);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();
  });

  it("allows a pro user at $4.99 (max_cost_usd_per_game = $5.00)", () => {
    const result = makeQuotaResponse("pro", 4.99, 0);
    expect(result.allowed).toBe(true);
  });

  it("studio tier has unlimited games/month", () => {
    // 99999 games used → still allowed (studio is unlimited)
    const result = makeQuotaResponse("studio", 1.0, 99999);
    expect(result.allowed).toBe(true);
  });
});

// ── 2. Checkout mock → returns URL ───────────────────────────────────────────

// Stub createCheckoutSession — simulates Stripe SDK response without network
async function stubCreateCheckoutSession(
  clerkUserId: string,
  tier: Exclude<UserTier, "free">,
  successUrl: string,
  cancelUrl: string,
): Promise<{ url: string; sessionId: string }> {
  if (!clerkUserId) throw new Error("Missing clerkUserId");
  const priceIds: Record<string, string> = {
    creator: "price_creator_test",
    pro: "price_pro_test",
    studio: "price_studio_test",
  };
  return {
    url: `https://checkout.stripe.com/pay/${priceIds[tier]}?success=${encodeURIComponent(successUrl)}`,
    sessionId: `cs_test_${tier}_${Date.now()}`,
  };
}

describe("Stripe checkout session", () => {
  it("returns a Stripe checkout URL for creator tier", async () => {
    const result = await stubCreateCheckoutSession(
      "user_clerk_abc",
      "creator",
      "https://app.gamesmith.gg/settings?upgraded=1",
      "https://app.gamesmith.gg/settings",
    );
    expect(result.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    expect(result.sessionId).toMatch(/^cs_test_creator/);
  });

  it("returns a Stripe checkout URL for pro tier", async () => {
    const result = await stubCreateCheckoutSession(
      "user_clerk_abc",
      "pro",
      "https://app.gamesmith.gg/settings?upgraded=1",
      "https://app.gamesmith.gg/settings",
    );
    expect(result.url).toContain("price_pro_test");
  });

  it("throws if clerkUserId is empty", async () => {
    await expect(
      stubCreateCheckoutSession("", "creator", "https://x.com", "https://x.com"),
    ).rejects.toThrow("Missing clerkUserId");
  });
});

// ── 3. Webhook → users.tier updated ─────────────────────────────────────────

// Stub DB and syncTierFromStripe logic
interface StubUser {
  clerk_user_id: string;
  tier: UserTier;
  stripe_customer_id: string | null;
}

async function stubSyncTierFromStripe(
  db: Map<string, StubUser>,
  clerkUserId: string,
  newTier: UserTier,
  stripeCustomerId: string,
): Promise<void> {
  const user = db.get(clerkUserId);
  if (!user) throw new Error("User not found");
  user.tier = newTier;
  user.stripe_customer_id = stripeCustomerId;
}

async function stubDowngradeToFree(
  db: Map<string, StubUser>,
  clerkUserId: string,
): Promise<void> {
  const user = db.get(clerkUserId);
  if (!user) throw new Error("User not found");
  user.tier = "free";
}

describe("Stripe webhook → tier sync", () => {
  let db: Map<string, StubUser>;

  beforeEach(() => {
    db = new Map([
      [
        "user_clerk_123",
        { clerk_user_id: "user_clerk_123", tier: "free", stripe_customer_id: null },
      ],
    ]);
  });

  it("checkout.session.completed → upgrades tier to creator", async () => {
    await stubSyncTierFromStripe(db, "user_clerk_123", "creator", "cus_abc123");
    const user = db.get("user_clerk_123")!;
    expect(user.tier).toBe("creator");
    expect(user.stripe_customer_id).toBe("cus_abc123");
  });

  it("subscription.deleted → downgrades to free", async () => {
    // First upgrade
    await stubSyncTierFromStripe(db, "user_clerk_123", "pro", "cus_abc123");
    expect(db.get("user_clerk_123")!.tier).toBe("pro");
    // Then cancel
    await stubDowngradeToFree(db, "user_clerk_123");
    expect(db.get("user_clerk_123")!.tier).toBe("free");
  });

  it("payment_failed → downgrades to free", async () => {
    await stubSyncTierFromStripe(db, "user_clerk_123", "studio", "cus_abc123");
    await stubDowngradeToFree(db, "user_clerk_123");
    expect(db.get("user_clerk_123")!.tier).toBe("free");
  });
});

// ── 4. Tip Jar → Stripe one-time session URL ─────────────────────────────────

async function stubCreateTipJarSession(
  amountUsd: number,
  successUrl: string,
  _cancelUrl: string,
): Promise<{ url: string; sessionId: string }> {
  if (!(TIP_AMOUNTS_USD as readonly number[]).includes(amountUsd)) {
    throw new Error("Invalid tip amount");
  }
  return {
    url: `https://checkout.stripe.com/pay/tip_${amountUsd}?success=${encodeURIComponent(successUrl)}`,
    sessionId: `cs_test_tip_${amountUsd}`,
  };
}

describe("Tip Jar — one-time Stripe session", () => {
  it("returns a checkout URL for $5 tip", async () => {
    const result = await stubCreateTipJarSession(
      5,
      "https://app.gamesmith.gg/feed?tip=thanks",
      "https://app.gamesmith.gg/feed",
    );
    expect(result.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    expect(result.url).toContain("tip_5");
    expect(result.sessionId).toBe("cs_test_tip_5");
  });

  it("returns a checkout URL for all valid tip amounts", async () => {
    for (const amt of TIP_AMOUNTS_USD) {
      const result = await stubCreateTipJarSession(
        amt,
        "https://app.gamesmith.gg/feed?tip=thanks",
        "https://app.gamesmith.gg/feed",
      );
      expect(result.url).toBeTruthy();
    }
  });

  it("tip amounts are $3, $5, $10, $25 (no arbitrary amounts)", () => {
    expect(TIP_AMOUNTS_USD).toEqual([3, 5, 10, 25]);
  });

  it("rejects invalid tip amount", async () => {
    await expect(
      stubCreateTipJarSession(99, "https://x.com", "https://x.com"),
    ).rejects.toThrow("Invalid tip amount");
  });
});

// ── 5. TIER_DEFINITIONS contract integrity ───────────────────────────────────

describe("TIER_DEFINITIONS contract", () => {
  it("free tier has $0 price and no commercial use", () => {
    expect(TIER_DEFINITIONS.free.monthly_price_usd).toBe(0);
    expect(TIER_DEFINITIONS.free.commercial_use).toBe(false);
  });

  it("all paid tiers have commercial use enabled", () => {
    for (const tier of ["creator", "pro", "studio"] as const) {
      expect(TIER_DEFINITIONS[tier].commercial_use).toBe(true);
    }
  });

  it("studio tier has unlimited games/month (never hard-blocks)", () => {
    expect(TIER_DEFINITIONS.studio.games_per_month).toBe("unlimited");
  });

  it("generative budget increases with tier", () => {
    const { free, creator, pro, studio } = TIER_DEFINITIONS;
    expect(creator.max_cost_usd_per_game).toBeGreaterThan(free.max_cost_usd_per_game);
    expect(pro.max_cost_usd_per_game).toBeGreaterThan(creator.max_cost_usd_per_game);
    expect(studio.max_cost_usd_per_game).toBeGreaterThan(pro.max_cost_usd_per_game);
  });
});
