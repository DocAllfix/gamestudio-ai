"use client";

import { useState, useCallback } from "react";
import type { HermesPlanResponse } from "@/lib/orchestrator/hermes-client";
import type { GenerateInput } from "@/app/(creator)/create/actions";

/**
 * Creator state machine — progressive disclosure (no rigid wizard).
 *
 * Phases, not steps: the user writes one idea + optionally tweaks the proposed
 * setup (engine/genre/style/advanced) on a single "forge" screen, then submits.
 * After submit the response drives plan-preview → generating → output as PHASES.
 */
export type CreatorPhase = "setup" | "plan" | "generating" | "done";

export interface CreatorConfig {
  prompt: string;
  /** undefined = let Hermes auto-pick the engine (Auto / recommended). */
  engine?: string;
  difficulty?: string;
  imageUrls: string[];
}

interface CreatorState {
  phase: CreatorPhase;
  response: HermesPlanResponse | null;
  error: string | null;
  loading: boolean;
}

const INITIAL: CreatorState = {
  phase: "setup",
  response: null,
  error: null,
  loading: false,
};

export function useCreator(
  generateFn: (input: GenerateInput) => Promise<
    { ok: true; response: HermesPlanResponse } | { ok: false; error: string }
  >,
) {
  const [state, setState] = useState<CreatorState>(INITIAL);

  /** Submit the setup → Hermes proposes/builds the plan → show plan preview. */
  const forge = useCallback(
    async (config: CreatorConfig) => {
      setState((s) => ({ ...s, loading: true, error: null }));
      const result = await generateFn({
        user_prompt: config.prompt,
        moodboard_image_urls: config.imageUrls,
        forced_engine: config.engine, // undefined → Hermes auto-picks
      });
      if (result.ok) {
        setState((s) => ({ ...s, phase: "plan", response: result.response, loading: false }));
      } else {
        setState((s) => ({ ...s, error: result.error, loading: false }));
      }
    },
    [generateFn],
  );

  /** Plan confirmed → run the generation phase. */
  const startGeneration = useCallback(() => {
    setState((s) => ({ ...s, phase: "generating" }));
  }, []);

  /** Generation animation complete → output. */
  const generationDone = useCallback(() => {
    setState((s) => ({ ...s, phase: "done" }));
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, forge, startGeneration, generationDone, reset };
}
