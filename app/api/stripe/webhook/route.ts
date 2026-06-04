import type { NextRequest } from "next/server";
import { getStripe } from "@/lib/billing/stripe-client";
import { syncTierFromStripe, downgradeToFree } from "@/lib/billing/tier-sync";
import type { UserTier } from "@/lib/contracts/billing.contract";

export async function POST(req: NextRequest): Promise<Response> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  let event: import("stripe").Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as import("stripe").Stripe.Checkout.Session;
        const clerkUserId = session.metadata?.clerk_user_id;
        const tier = session.metadata?.tier as UserTier | undefined;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? "";

        if (clerkUserId && tier && customerId) {
          await syncTierFromStripe(clerkUserId, tier, customerId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as import("stripe").Stripe.Subscription;
        const clerkUserId = sub.metadata?.clerk_user_id;
        const tier = sub.metadata?.tier as UserTier | undefined;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;

        if (clerkUserId && tier && customerId) {
          await syncTierFromStripe(clerkUserId, tier, customerId);
        }
        break;
      }

      case "customer.subscription.deleted":
      case "invoice.payment_failed": {
        const obj = event.data.object as
          | import("stripe").Stripe.Subscription
          | import("stripe").Stripe.Invoice;
        const clerkUserId =
          "metadata" in obj ? (obj as import("stripe").Stripe.Subscription).metadata?.clerk_user_id : undefined;
        if (clerkUserId) await downgradeToFree(clerkUserId);
        break;
      }

      default:
        // Acknowledged but ignored
        break;
    }
  } catch (err) {
    console.error({ msg: "Stripe webhook handler error", event: event.type, err });
    return new Response("Handler error", { status: 500 });
  }

  return new Response(null, { status: 200 });
}
