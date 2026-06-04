import { getAdminClient } from "@/lib/supabase/admin";
import { getPostHogServer } from "./posthog-server";
import type { UsageEvent } from "@/lib/contracts/billing.contract";

export type TrackableEventName = UsageEvent["event_name"];

export interface TrackEventArgs {
  clerkUserId: string;
  /** Internal DB user UUID (resolved upstream). */
  dbUserId: string;
  projectId: string | null;
  eventName: TrackableEventName;
  metadata?: Record<string, unknown>;
  traceId?: string;
}

/**
 * Dual-write: PostHog server-side capture + Supabase usage_events insert.
 * The flywheel (W1) reads usage_events for success_score EMA.
 * PostHog receives the same event for funnel / retention analysis.
 *
 * Fails silently on PostHog errors (analytics must never break the user flow).
 * Throws on Supabase errors (the DB row is the source of truth for billing).
 */
export async function trackEvent(args: TrackEventArgs): Promise<void> {
  const traceId = args.traceId ?? `${args.eventName}-${Date.now()}`;

  // PostHog — fire-and-forget, never throw
  try {
    const ph = getPostHogServer();
    ph.capture({
      distinctId: args.clerkUserId,
      event: args.eventName,
      properties: {
        project_id: args.projectId,
        trace_id: traceId,
        ...args.metadata,
      },
    });
    // flushAt=1 means the event is sent immediately
  } catch (err) {
    console.error({ msg: "PostHog capture failed (non-fatal)", err });
  }

  // Supabase usage_events — throws on failure (billing source of truth)
  const db = getAdminClient();
  const { error } = await db.from("usage_events").insert({
    user_id: args.dbUserId,
    project_id: args.projectId,
    event_name: args.eventName,
    metadata: args.metadata ?? {},
    trace_id: traceId,
  });

  if (error) {
    throw new Error(`trackEvent insert failed: ${error.message}`);
  }
}
