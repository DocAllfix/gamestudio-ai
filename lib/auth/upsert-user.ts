import type { SupabaseClient } from "@supabase/supabase-js";

export interface ClerkUserPayload {
  clerk_user_id: string;
  email: string;
  display_name: string | null;
}

/** Upsert a Clerk user into the public.users table.
 *  Extracted so the webhook handler and tests can share it. */
export async function upsertUser(
  db: SupabaseClient,
  payload: ClerkUserPayload,
): Promise<void> {
  const { error } = await db.from("users").upsert(
    {
      clerk_user_id: payload.clerk_user_id,
      email: payload.email,
      display_name: payload.display_name,
    },
    { onConflict: "clerk_user_id" },
  );
  if (error) {
    throw new Error(`upsertUser failed: ${error.message}`);
  }
}
