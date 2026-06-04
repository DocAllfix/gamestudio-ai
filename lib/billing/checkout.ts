import { getStripe } from "./stripe-client";
import type { UserTier } from "@/lib/contracts/billing.contract";

/**
 * Map tier → Stripe Price ID.
 * Set these env vars in Vercel/local: STRIPE_PRICE_CREATOR, _PRO, _STUDIO.
 * Free tier has no price (downgrade path uses subscription.cancel).
 */
function getPriceId(tier: Exclude<UserTier, "free">): string {
  const envKey = `STRIPE_PRICE_${tier.toUpperCase()}` as const;
  const id = process.env[envKey];
  if (!id) throw new Error(`Missing env var ${envKey}`);
  return id;
}

export interface CreateCheckoutResult {
  url: string;
  sessionId: string;
}

/**
 * Creates a Stripe Checkout session for a subscription upgrade.
 * `successUrl` and `cancelUrl` must be absolute URLs.
 */
export async function createCheckoutSession(
  clerkUserId: string,
  tier: Exclude<UserTier, "free">,
  successUrl: string,
  cancelUrl: string,
): Promise<CreateCheckoutResult> {
  const stripe = getStripe();
  const priceId = getPriceId(tier);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Store clerk_user_id in metadata so the webhook can map back
    metadata: { clerk_user_id: clerkUserId, tier },
    subscription_data: {
      metadata: { clerk_user_id: clerkUserId, tier },
    },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, sessionId: session.id };
}
