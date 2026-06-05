"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useCreator } from "@/components/creator/use-creator";
import { StepSetup } from "@/components/creator/step-setup";
import { StepPlanPreview } from "@/components/creator/step-plan-preview";
import { StepGenerating } from "@/components/creator/step-generating";
import { StepOutput } from "@/components/creator/step-output";
import { startGeneration, getGenerationStatus } from "./actions";

const deps = { start: startGeneration, status: getGenerationStatus };

function CreateFlow() {
  const params = useSearchParams();
  const initialPrompt = params.get("prompt") ?? "";
  const creator = useCreator(deps);

  return (
    <div className="mx-auto max-w-2xl px-6">
      {creator.error && (
        <div
          data-testid="error-banner"
          className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {creator.error}
        </div>
      )}

      {creator.phase === "setup" && (
        <StepSetup initialPrompt={initialPrompt} loading={false} onForge={creator.forge} />
      )}

      {creator.phase === "running" && (
        <div
          data-testid="generation-running"
          className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 text-center"
        >
          <Loader2 size={28} className="animate-spin text-forge" />
          <p className="font-display text-lg font-semibold text-text">Forging your game…</p>
          <p className="max-w-sm text-sm text-text-muted">
            Designing the plan, generating code and assets, and checking it actually runs.
            This takes a few minutes.
          </p>
        </div>
      )}

      {creator.phase === "plan" && (
        <div className="py-8">
          <StepPlanPreview
            response={creator.response}
            onGenerate={creator.startGenerationPhase}
            onBack={creator.reset}
            loading={false}
          />
        </div>
      )}
      {creator.phase === "generating" && creator.response && (
        <div className="py-8">
          <StepGenerating response={creator.response} onDone={creator.generationDone} />
        </div>
      )}
      {creator.phase === "done" && creator.response && (
        <div className="py-8">
          <StepOutput response={creator.response} onReset={creator.reset} />
        </div>
      )}
    </div>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <CreateFlow />
    </Suspense>
  );
}
