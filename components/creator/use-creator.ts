"use client";

import { useState, useCallback } from "react";
import type { HermesPlanResponse } from "@/lib/orchestrator/hermes-client";
import type { GenerateInput } from "@/app/(creator)/create/actions";

export type CreatorStep = 1 | 2 | 3 | 4 | 5;

interface CreatorState {
  step: CreatorStep;
  prompt: string;
  imageUrls: string[];
  engine: string | null;
  response: HermesPlanResponse | null;
  error: string | null;
  loading: boolean;
}

const INITIAL: CreatorState = {
  step: 1,
  prompt: "",
  imageUrls: [],
  engine: null,
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

  const setStep = useCallback((step: CreatorStep) => {
    setState((s) => ({ ...s, step }));
  }, []);

  // Step 1 → 2
  const submitPrompt = useCallback((prompt: string, imageUrls: string[]) => {
    setState((s) => ({ ...s, step: 2, prompt, imageUrls }));
  }, []);

  // Step 2 → 3: pick engine, immediately call the mock to get the plan
  const pickEngine = useCallback(
    async (engine: string) => {
      setState((s) => ({ ...s, step: 3, engine, loading: true, error: null }));
      const result = await generateFn({
        user_prompt: state.prompt,
        moodboard_image_urls: state.imageUrls,
        forced_engine: engine,
      });
      if (result.ok) {
        setState((s) => ({
          ...s,
          response: result.response,
          loading: false,
        }));
      } else {
        setState((s) => ({ ...s, error: result.error, loading: false }));
      }
    },
    [generateFn, state.prompt, state.imageUrls],
  );

  // Step 3 → 4: user confirmed the plan, start generation animation
  const startGeneration = useCallback(() => {
    setState((s) => ({ ...s, step: 4 }));
  }, []);

  // Step 4 → 5: animation complete
  const generationDone = useCallback(() => {
    setState((s) => ({ ...s, step: 5 }));
  }, []);

  // Reset to step 1
  const reset = useCallback(() => {
    setState(INITIAL);
  }, []);

  return {
    ...state,
    submitPrompt,
    pickEngine,
    startGeneration,
    generationDone,
    setStep,
    reset,
  };
}
