"use server";

import { auth } from "@clerk/nextjs/server";
import { getAdminClient } from "@/lib/supabase/admin";

// Event names accepted by usage_events.event_name CHECK constraint (migration 005 + 006).
export type FeedEventName =
  | "game_started"
  | "game_completed"
  | "game_failed";

export interface TrackEventInput {
  project_id: string;
  event_name: FeedEventName;
  metadata?: Record<string, unknown>;
}

export interface TrackEventResult {
  ok: true;
  id: string;
}

export async function trackUsageEvent(
  input: TrackEventInput,
): Promise<TrackEventResult | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const db = getAdminClient();

  // Resolve internal user id from clerk_user_id
  const { data: user, error: userErr } = await db
    .from("users")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  if (userErr || !user) {
    return { ok: false, error: "User record not found" };
  }

  const { data, error } = await db
    .from("usage_events")
    .insert({
      user_id: user.id,
      project_id: input.project_id,
      event_name: input.event_name,
      metadata: input.metadata ?? {},
      trace_id: `feed-${Date.now()}`,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Insert failed" };
  }

  return { ok: true, id: data.id };
}
