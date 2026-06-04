import Stripe from "stripe";

let _stripe: Stripe | null = null;

/** Lazy singleton — throws at first call if STRIPE_SECRET_KEY is missing. */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  _stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
  return _stripe;
}
