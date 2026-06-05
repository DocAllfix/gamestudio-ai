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
    await db.from("generation_runs").update({ status: "running" }).eq("id", runId);

    try {
      const response = await runHermesPlan(request);
      await db
        .from("generation_runs")
        .update({
          status: "done",
          response,
          project_id: response.project_id,
        })
        .eq("id", runId);
      return { ok: true, project_id: response.project_id };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      console.error({ context: "generate-game task", runId, error });
      await db.from("generation_runs").update({ status: "failed", error: message }).eq("id", runId);
      return { ok: false, error: message };
    }
  },
});
