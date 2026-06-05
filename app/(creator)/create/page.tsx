"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { useCreator } from "@/components/creator/use-creator";
import { StepSetup } from "@/components/creator/step-setup";
import { StepPlanPreview } from "@/components/creator/step-plan-preview";
import { StepGenerating } from "@/components/creator/step-generating";
import { StepOutput } from "@/components/creator/step-output";
import { generateGame } from "./actions";

function CreateFlow() {
  const params = useSearchParams();
  const initialPrompt = params.get("prompt") ?? "";
  const creator = useCreator(generateGame);

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
        <StepSetup initialPrompt={initialPrompt} loading={creator.loading} onForge={creator.forge} />
      )}
      {creator.phase === "plan" && (
        <div className="py-8">
          <StepPlanPreview
            response={creator.response}
            onGenerate={creator.startGeneration}
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
