/**
 * Billing Contract — user tiers, quotas, and usage events.
 *
 * W4 implements Stripe integration + frontend UI. W1 / W2 read this
 * contract to enforce per-tool quotas before dispatch. The free tier
 * cost ceiling matches `GENERATION_COST_USD_MAX` in
 * `evaluation-metrics.contract.ts` — a Free user who burns through
 * that ceiling sees a clear upgrade prompt, not a silent failure.
 *
 * Pricing is documented in Pietra v5 §G. The contract encodes the
 * day-1 tiers (Free, Creator, Pro, Studio). Enterprise + creator
 * marketplace (Polar.sh) are Phase 2.
 */
import { z } from "zod";

// ---- User tier ------------------------------------------------------------

export const UserTierEnum = z.enum(["free", "creator", "pro", "studio"]);
export type UserTier = z.infer<typeof UserTierEnum>;

/** Day-1 tier definitions. The numbers come straight from Pietra v5
 * §G ("Sustainability Model"). Treat them as the single source of
 * truth — Stripe products and Supabase RLS quotas point back here. */
export const TIER_DEFINITIONS: Record<
    UserTier,
    {
        display_name: string;
        monthly_price_usd: number;
        games_per_month: number | "unlimited";
        max_cost_usd_per_game: number;
        priority_queue: boolean;
        commercial_use: boolean;
    }
> = {
    free: {
        display_name: "Free",
        monthly_price_usd: 0,
        games_per_month: 3,
        max_cost_usd_per_game: 1.5,
        priority_queue: false,
        commercial_use: false,
    },
    creator: {
        display_name: "Creator",
        monthly_price_usd: 19,
        games_per_month: 15,
        max_cost_usd_per_game: 3.0,
        priority_queue: false,
        commercial_use: true,
    },
    pro: {
        display_name: "Pro",
        monthly_price_usd: 49,
        games_per_month: 25,
        max_cost_usd_per_game: 5.0,
        priority_queue: true,
        commercial_use: true,
    },
    studio: {
        display_name: "Studio",
        monthly_price_usd: 99,
        games_per_month: "unlimited",
        max_cost_usd_per_game: 10.0,
        priority_queue: true,
        commercial_use: true,
    },
};

// ---- Quota check (called before any tool dispatch) -----------------------

export const QuotaCheckRequestSchema = z.object({
    user_id: z.string().min(1),
    tool_id: z.string().min(1),
    /** Estimated cost of this specific call (cumulated by Orchestrator). */
    estimated_cost_usd: z.number().min(0),
    /** Whether this counts toward the games_per_month budget (true on
     * any "shipping" tool like an assembler, false on internal LLM
     * calls during the same generation run). */
    counts_toward_monthly: z.boolean().default(false),
});
export type QuotaCheckRequest = z.infer<typeof QuotaCheckRequestSchema>;

export const QuotaCheckResponseSchema = z.object({
    allowed: z.boolean(),
    /** When `allowed=false`, the reason is one of these codes — the UI
     * shows the matching upgrade prompt. */
    reason: z
        .enum([
            "monthly_games_exhausted",
            "per_game_cost_exceeded",
            "tier_disallows_commercial",
            "tier_disallows_tool",
            "payment_method_failed",
            "account_suspended",
        ])
        .nullable(),
    /** Snapshot of the user's current consumption for the UI. */
    current_usage: z.object({
        games_used_this_month: z.number().int().min(0),
        cost_used_on_current_game_usd: z.number().min(0),
    }),
});
export type QuotaCheckResponse = z.infer<typeof QuotaCheckResponseSchema>;

// ---- Usage event (PostHog + Supabase usage_events table) -----------------

export const UsageEventSchema = z.object({
    user_id: z.string().min(1),
    project_id: z.string().uuid().nullable(),
    event_name: z.enum([
        "game_started",
        "game_completed",
        "game_failed",
        "tool_executed",
        "plan_refined",
        "asset_uploaded",
        "game_exported_itch",
        "game_exported_steam",
        "upgrade_clicked",
        "downgrade_clicked",
    ]),
    metadata: z.record(z.unknown()).default({}),
    /** Helps stitch PostHog and Helicone telemetry across the same run. */
    trace_id: z.string().min(1),
    created_at: z.string().datetime(),
});
export type UsageEvent = z.infer<typeof UsageEventSchema>;

// ---- Stripe webhook envelope --------------------------------------------

/** Restricted set of webhook events we react to. Everything else is
 * acknowledged with 200 and ignored. Documented in W4's Stripe
 * integration code. */
export const StripeWebhookEventEnum = z.enum([
    "checkout.session.completed",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_failed",
    "invoice.payment_succeeded",
]);
export type StripeWebhookEvent = z.infer<typeof StripeWebhookEventEnum>;

export const StripeWebhookPayloadSchema = z.object({
    type: StripeWebhookEventEnum,
    /** Stripe customer id, mapped to users.clerk_user_id via the Stripe
     * customer metadata. */
    stripe_customer_id: z.string().min(1),
    /** Subscription id (when present). */
    stripe_subscription_id: z.string().nullable(),
    /** Stripe price id, mapped to UserTier via a metadata field. */
    stripe_price_id: z.string().nullable(),
    /** Raw event object — we keep it for debugging but never trust it
     * blindly. The W4 webhook handler always re-reads via Stripe SDK. */
    raw_event_id: z.string().min(1),
});
export type StripeWebhookPayload = z.infer<typeof StripeWebhookPayloadSchema>;
