"use client";

import { useCreator } from "@/components/creator/use-creator";
import { StepWelcome } from "@/components/creator/step-welcome";
import { StepEnginePicker } from "@/components/creator/step-engine-picker";
import { StepPlanPreview } from "@/components/creator/step-plan-preview";
import { StepGenerating } from "@/components/creator/step-generating";
import { StepOutput } from "@/components/creator/step-output";
import { StepIndicator } from "@/components/creator/step-indicator";
import { generateGame } from "./actions";

export default function CreatePage() {
  const creator = useCreator(generateGame);

  return (
    <div className="mx-auto max-w-2xl py-8">
      {/* Step progress */}
      <div className="mb-8">
        <StepIndicator current={creator.step} />
      </div>

      {/* Error banner */}
      {creator.error && (
        <div
          data-testid="error-banner"
          className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
        >
          {creator.error}
        </div>
      )}

      {/* Steps */}
      {creator.step === 1 && (
        <StepWelcome onNext={creator.submitPrompt} />
      )}
      {creator.step === 2 && (
        <StepEnginePicker
          onNext={creator.pickEngine}
          onBack={() => creator.setStep(1)}
        />
      )}
      {creator.step === 3 && (
        <StepPlanPreview
          response={creator.response}
          onGenerate={creator.startGeneration}
          onBack={() => creator.setStep(2)}
          loading={creator.loading}
        />
      )}
      {creator.step === 4 && creator.response && (
        <StepGenerating
          response={creator.response}
          onDone={creator.generationDone}
        />
      )}
      {creator.step === 5 && creator.response && (
        <StepOutput response={creator.response} onReset={creator.reset} />
      )}
    </div>
  );
}
