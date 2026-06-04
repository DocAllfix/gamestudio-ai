"use server";

import { auth } from "@clerk/nextjs/server";
import {
  runHermesPlan,
  type HermesPlanRequest,
  type HermesPlanResponse,
} from "@/lib/orchestrator/hermes-client";

export interface GenerateInput {
  user_prompt: string;
  moodboard_image_urls: string[];
  forced_engine?: string;
}

export type GenerateResult =
  | { ok: true; response: HermesPlanResponse }
  | { ok: false; error: string };

export async function generateGame(
  input: GenerateInput,
): Promise<GenerateResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "Not authenticated" };

  const request: HermesPlanRequest = {
    user_id: userId,
    project_id: null,
    user_prompt: input.user_prompt,
    moodboard_image_urls: input.moodboard_image_urls,
    reference_game_ids: [],
  };
  if (input.forced_engine) {
    request.forced_engine =
      input.forced_engine as HermesPlanRequest["forced_engine"];
  }

  try {
    const response = await runHermesPlan(request);
    return { ok: true, response };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
