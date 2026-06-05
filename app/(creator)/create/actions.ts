"use server";

import { auth } from "@clerk/nextjs/server";

import { ensureUser } from "@/lib/auth/ensure-user";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateGameTask } from "@/trigger/generate-game";
import type { GenerateGamePayload } from "@/trigger/generate-game";

export interface GenerateInput {
  user_prompt: string;
  moodboard_image_urls: string[];
  forced_engine?: string;
}

export type StartResult =
  | { ok: true; run_id: string }
  | { ok: false; error: string };

/**
 * Enqueue a generation run and return immediately (no waiting → no serverless
 * timeout). The Trigger.dev worker runs the full Hermes loop + E2B build and
 * writes status/result to generation_runs; the UI polls getGenerationStatus.
 */
export async function startGeneration(input: GenerateInput): Promise<StartResult> {
  // Resolve (or lazily create) the user's DB record — robust even if the Clerk
  // webhook hasn't populated public.users yet.
  const ctx = await ensureUser();
  if (!ctx) return { ok: false, error: "Not authenticated" };
  const { db, userId, clerkUserId } = ctx;
  const user = { id: userId };

  const request = {
    user_id: clerkUserId,
    project_id: null,
    user_prompt: input.user_prompt,
    moodboard_image_urls: input.moodboard_image_urls,
    reference_game_ids: [],
    ...(input.forced_engine ? { forced_engine: input.forced_engine } : {}),
  };

  // Create the run row first so the UI can poll even if enqueue is slow.
  const { data: run, error: insErr } = await db
    .from("generation_runs")
    .insert({ user_id: user.id, status: "queued", request })
    .select("id")
    .single();
  if (insErr || !run) return { ok: false, error: insErr?.message ?? "Could not create run" };

  try {
    const payload: GenerateGamePayload = {
      runId: run.id,
      request: request as GenerateGamePayload["request"],
    };
    const handle = await generateGameTask.trigger(payload);
    await db.from("generation_runs").update({ trigger_run_id: handle.id }).eq("id", run.id);
    return { ok: true, run_id: run.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not enqueue generation";
    await db.from("generation_runs").update({ status: "failed", error: message }).eq("id", run.id);
    return { ok: false, error: message };
  }
}

export interface GenerationStatus {
  status: "queued" | "running" | "done" | "failed";
  response: unknown | null;
  error: string | null;
}

/** Poll target for the UI. Reads the run the current user owns. */
export async function getGenerationStatus(runId: string): Promise<GenerationStatus | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const db = getAdminClient();
  const { data, error } = await db
    .from("generation_runs")
    .select("status, response, error, user_id, users!inner(clerk_user_id)")
    .eq("id", runId)
    .single();
  if (error || !data) return null;
  // Ownership check (service-role bypasses RLS). The embedded relation comes
  // back as an array from PostgREST; take the first row.
  const owner = (data as unknown as { users: { clerk_user_id: string } | { clerk_user_id: string }[] }).users;
  const ownerClerkId = Array.isArray(owner) ? owner[0]?.clerk_user_id : owner?.clerk_user_id;
  if (ownerClerkId !== userId) return null;

  return {
    status: data.status as GenerationStatus["status"],
    response: data.response,
    error: data.error,
  };
}
