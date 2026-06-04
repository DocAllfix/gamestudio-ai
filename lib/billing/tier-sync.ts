import { getAdminClient } from "@/lib/supabase/admin";
import { UserTierEnum, type UserTier } from "@/lib/contracts/billing.contract";

/**
 * Called by the Stripe webhook handler after verifying the event.
 * Updates users.tier from Stripe subscription metadata.
 */
export async function syncTierFromStripe(
  clerkUserId: string,
  newTier: UserTier,
  stripeCustomerId: string,
): Promise<void> {
  // Validate tier value against the contract enum before writing to DB
  UserTierEnum.parse(newTier);

  const db = getAdminClient();
  const { error } = await db
    .from("users")
    .update({
      tier: newTier,
      stripe_customer_id: stripeCustomerId,
      updated_at: new Date().toISOString(),
    })
    .eq("clerk_user_id", clerkUserId);

  if (error) {
    throw new Error(`syncTierFromStripe failed: ${error.message}`);
  }
}

/**
 * Downgrades user to free when subscription is cancelled or payment fails.
 */
export async function downgradeToFree(clerkUserId: string): Promise<void> {
  const db = getAdminClient();
  const { error } = await db
    .from("users")
    .update({ tier: "free", updated_at: new Date().toISOString() })
    .eq("clerk_user_id", clerkUserId);

  if (error) {
    throw new Error(`downgradeToFree failed: ${error.message}`);
  }
}
