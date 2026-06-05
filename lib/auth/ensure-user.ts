import { auth, currentUser } from "@clerk/nextjs/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { upsertUser } from "./upsert-user";

export interface EnsuredUser {
  db: ReturnType<typeof getAdminClient>;
  /** Internal public.users.id (uuid). */
  userId: string;
  /** Clerk user id (user_...). */
  clerkUserId: string;
}

/**
 * Resolve the current user's internal users.id, creating the row on the fly if
 * the Clerk webhook hasn't populated it yet. This makes every server action
 * robust regardless of webhook config/timing (the webhook stays the primary
 * path; this is the safety net). Returns null only when there's no session.
 */
export async function ensureUser(): Promise<EnsuredUser | null> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return null;

  const db = getAdminClient();

  const existing = await db.from("users").select("id").eq("clerk_user_id", clerkUserId).single();
  if (existing.data) {
    return { db, userId: existing.data.id, clerkUserId };
  }

  // No row yet → create it from the Clerk profile, then re-read the id.
  const profile = await currentUser();
  const email =
    profile?.primaryEmailAddress?.emailAddress ??
    profile?.emailAddresses?.[0]?.emailAddress ??
    `${clerkUserId}@placeholder.local`;
  const displayName = profile?.firstName ?? profile?.username ?? null;

  await upsertUser(db, { clerk_user_id: clerkUserId, email, display_name: displayName });

  const created = await db.from("users").select("id").eq("clerk_user_id", clerkUserId).single();
  if (!created.data) return null;
  return { db, userId: created.data.id, clerkUserId };
}
