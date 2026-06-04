"use server";

import { auth } from "@clerk/nextjs/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { trackEvent } from "@/lib/analytics/track";

export interface ForkInput {
  /** Source project to fork */
  sourceProjectId: string;
}

export interface ForkResult {
  ok: true;
  newProjectId: string;
}

/**
 * Forks a project: creates a new projects row with the same
 * title/engine/genre/latest_game_plan, status='draft', then
 * emits a 'fork' usage_event to both Supabase and PostHog.
 *
 * Migration 006 added 'fork' to usage_events.event_name CHECK constraint.
 */
export async function forkProject(
  input: ForkInput,
): Promise<ForkResult | { ok: false; error: string }> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const db = getAdminClient();

  // Resolve forking user's DB id
  const { data: forkingUser, error: userErr } = await db
    .from("users")
    .select("id")
    .eq("clerk_user_id", userId)
    .single();

  if (userErr || !forkingUser) {
    return { ok: false, error: "User record not found" };
  }

  // Load source project (incl. owner + status for the authorization check).
  const { data: source, error: srcErr } = await db
    .from("projects")
    .select("title, engine, genre, latest_game_plan, user_id, status")
    .eq("id", input.sourceProjectId)
    .single();

  if (srcErr || !source) {
    return { ok: false, error: "Source project not found" };
  }

  // Authorization: only a PUBLISHED project, or one the caller already owns, can
  // be forked. The admin client bypasses RLS, so this check is the gate that
  // prevents forking another user's private/draft project (and its game plan).
  const isOwner = source.user_id === forkingUser.id;
  const isPublished = source.status === "published";
  if (!isOwner && !isPublished) {
    return { ok: false, error: "Project not available for forking" };
  }

  // Insert forked project owned by the forking user
  const { data: newProject, error: insertErr } = await db
    .from("projects")
    .insert({
      user_id: forkingUser.id,
      title: `${source.title} (fork)`,
      engine: source.engine,
      genre: source.genre,
      status: "draft",
      latest_game_plan: source.latest_game_plan,
    })
    .select("id")
    .single();

  if (insertErr || !newProject) {
    return { ok: false, error: insertErr?.message ?? "Insert failed" };
  }

  // Dual-write fork event → Supabase usage_events + PostHog
  try {
    await trackEvent({
      clerkUserId: userId,
      dbUserId: forkingUser.id,
      projectId: newProject.id,
      eventName: "fork",
      metadata: {
        source_project_id: input.sourceProjectId,
        engine: source.engine,
        genre: source.genre,
      },
    });
  } catch (err) {
    // Event tracking failure must not block the fork succeeding
    console.error({ msg: "fork event tracking failed (non-fatal)", err });
  }

  return { ok: true, newProjectId: newProject.id };
}
