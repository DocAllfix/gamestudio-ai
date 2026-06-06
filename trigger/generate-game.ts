import { task } from "@trigger.dev/sdk";

import { getAdminClient } from "@/lib/supabase/admin";
import { runHermesPlan } from "@/lib/orchestrator/hermes";
import type { HermesPlanRequest } from "@/lib/contracts/reasoning-engine.contract";

/**
 * The long generation job: full Hermes loop (intent → ... → execution → E2B
 * build → evaluation) off Vercel's serverless limit. The creator enqueues this
 * via the startGeneration server action; the UI polls generation_runs for status.
 *
 * Payload: { runId, request } — runId is the generation_runs row to update.
 * The worker uses the service-role client (bypasses RLS) to write status/result.
 */
export interface GenerateGamePayload {
  runId: string;
  request: HermesPlanRequest;
}

export const generateGameTask = task({
  id: "generate-game",
  maxDuration: 1800,
  run: async ({ runId, request }: GenerateGamePayload) => {
    const db = getAdminClient();
    // Read the run's owner (internal users.id) — projects.user_id is NOT NULL
    // with a FK to users, and generation_runs.project_id has a FK to projects.
    const { data: runRow } = await db
      .from("generation_runs")
      .select("user_id")
      .eq("id", runId)
      .single();
    const ownerId = runRow?.user_id as string | undefined;

    await db.from("generation_runs").update({ status: "running" }).eq("id", runId);

    try {
      // Pass the run id so the orchestrator writes per-step audit traces.
      const response = await runHermesPlan({ ...request, run_id: runId });
      const meta = response.final_plan?.meta;

      // Create the projects row BEFORE referencing it: generation_runs.project_id
      // has a FK to projects(id). Without this the update below fails the FK
      // (23503), Supabase returns {error} (it does not throw), and the run is
      // left "running" forever — the UI then polls a never-finishing job.
      if (ownerId && meta) {
        const { error: projErr } = await db.from("projects").upsert(
          {
            id: response.project_id,
            user_id: ownerId,
            title: meta.title,
            engine: meta.engine,
            genre: meta.genre,
            status: response.overall_passed ? "ready" : "failed",
            latest_plan_version: response.final_plan.plan_version ?? 1,
          },
          { onConflict: "id" },
        );
        if (projErr) {
          console.error("generate-game: projects upsert failed: " + projErr.message);
        }
      }

      const { error: updErr } = await db
        .from("generation_runs")
        .update({
          status: "done",
          response,
          // Only link the project if its row exists, so this update can't fail
          // the FK and strand the run.
          project_id: ownerId && meta ? response.project_id : null,
        })
        .eq("id", runId);
      if (updErr) {
        // The result is computed but couldn't be saved — record the failure
        // instead of leaving the run "running" (the UI must stop polling).
        console.error("generate-game: done-update failed: " + updErr.message);
        await db
          .from("generation_runs")
          .update({ status: "failed", error: "save failed: " + updErr.message })
          .eq("id", runId);
        return { ok: false, error: updErr.message };
      }
      return { ok: true, project_id: response.project_id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      console.error("generate-game task failed runId=" + runId + ": " + message);
      await db.from("generation_runs").update({ status: "failed", error: message }).eq("id", runId);
      return { ok: false, error: message };
    }
  },
});
