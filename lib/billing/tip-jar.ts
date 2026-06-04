import { getStripe } from "./stripe-client";

const TIP_AMOUNTS_USD = [3, 5, 10, 25] as const;
export type TipAmount = (typeof TIP_AMOUNTS_USD)[number];

export interface CreateTipSessionResult {
  url: string;
  sessionId: string;
}

/**
 * Creates a one-time Stripe Checkout session for a Tip Jar donation.
 * No subscription — direct payment_intent, 0% platform fee (Stripe std rate only).
 * Amount in USD cents.
 */
export async function createTipJarSession(
  amountUsd: TipAmount,
  successUrl: string,
  cancelUrl: string,
): Promise<CreateTipSessionResult> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountUsd * 100,
          product_data: {
            name: "GameSmith Tip Jar",
            description: "Supporta lo sviluppo di GameSmith — grazie!",
          },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { tip_amount_usd: String(amountUsd) },
  });

  if (!session.url) throw new Error("Stripe did not return a tip URL");
  return { url: session.url, sessionId: session.id };
}

export { TIP_AMOUNTS_USD };
