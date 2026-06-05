"use client";

import { useState, useCallback, useRef } from "react";
import type { HermesPlanResponse } from "@/lib/orchestrator/hermes-client";
import type { GenerateInput, StartResult, GenerationStatus } from "@/app/(creator)/create/actions";

/**
 * Creator state machine — progressive disclosure + async generation.
 *
 * The generation runs as a Trigger.dev job (full Hermes loop + E2B build exceeds
 * a serverless limit). forge() enqueues it and the hook POLLS getGenerationStatus
 * until done|failed, then drives plan → generating → output as PHASES.
 */
export type CreatorPhase = "setup" | "running" | "plan" | "generating" | "done";

export interface CreatorConfig {
  prompt: string;
  engine?: string; // undefined = Hermes auto-picks
  difficulty?: string;
  imageUrls: string[];
}

interface CreatorState {
  phase: CreatorPhase;
  response: HermesPlanResponse | null;
  error: string | null;
}

const INITIAL: CreatorState = { phase: "setup", response: null, error: null };
const POLL_MS = 3000;

export interface CreatorDeps {
  start: (input: GenerateInput) => Promise<StartResult>;
  status: (runId: string) => Promise<GenerationStatus | null>;
}

export function useCreator(deps: CreatorDeps) {
  const [state, setState] = useState<CreatorState>(INITIAL);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poll = useCallback(
    (runId: string) => {
      timer.current = setTimeout(async () => {
        const s = await deps.status(runId);
        if (!s) {
          setState((p) => ({ ...p, phase: "setup", error: "Lost track of the generation run." }));
          return;
        }
        if (s.status === "done") {
          setState({ phase: "plan", response: s.response as HermesPlanResponse, error: null });
        } else if (s.status === "failed") {
          setState({ phase: "setup", response: null, error: s.error ?? "Generation failed." });
        } else {
          poll(runId); // queued | running → keep polling
        }
      }, POLL_MS);
    },
    [deps],
  );

  const forge = useCallback(
    async (config: CreatorConfig) => {
      setState({ phase: "running", response: null, error: null });
      const res = await deps.start({
        user_prompt: config.prompt,
        moodboard_image_urls: config.imageUrls,
        forced_engine: config.engine,
      });
      if (res.ok) {
        poll(res.run_id);
      } else {
        setState({ phase: "setup", response: null, error: res.error });
      }
    },
    [deps, poll],
  );

  const startGenerationPhase = useCallback(() => {
    setState((s) => ({ ...s, phase: "generating" }));
  }, []);

  const generationDone = useCallback(() => {
    setState((s) => ({ ...s, phase: "done" }));
  }, []);

  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setState(INITIAL);
  }, []);

  return { ...state, forge, startGenerationPhase, generationDone, reset };
}
