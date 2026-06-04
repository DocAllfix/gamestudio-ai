"use client";

import { cn } from "@/lib/utils";

const ENGINES = [
  {
    id: "godot",
    label: "Godot",
    tagline: "2D + 3D all-rounder",
    detail: "Solid KB (2551 chunks). Great for platformers, RPGs, metroidvanias.",
    recommended: true,
  },
  {
    id: "phaser",
    label: "Phaser",
    tagline: "Instant browser",
    detail: "Native JS/HTML5. Blazing-fast builds. Arcade & puzzle.",
    recommended: false,
  },
  {
    id: "threejs",
    label: "Three.js",
    tagline: "3D showcase",
    detail: "Native WebGL. 3D experiences and visual showcases.",
    recommended: false,
  },
  {
    id: "babylon",
    label: "Babylon.js",
    tagline: "3D with physics",
    detail: "Built-in physics + GUI. NullEngine for server-side checks.",
    recommended: false,
  },
  {
    id: "defold",
    label: "Defold",
    tagline: "Mobile-first (.apk)",
    detail: "Native Android .apk + PWA. Great for mobile games.",
    recommended: false,
  },
] as const;

interface Props {
  onNext: (engine: string) => void;
  onBack: () => void;
}

export function StepEnginePicker({ onNext, onBack }: Props) {
  return (
    <div className="flex flex-col gap-6" data-testid="step-engine-picker">
      <div>
        <h2 className="font-display text-2xl font-bold text-text">
          Choose your engine
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Hermes suggests the best fit. The call is yours.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ENGINES.map((engine) => (
          <button
            key={engine.id}
            type="button"
            data-testid={`engine-${engine.id}`}
            onClick={() => onNext(engine.id)}
            className={cn(
              "relative flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors hover:border-forge/60 hover:bg-forge/5",
              engine.recommended
                ? "border-forge/40 bg-forge/5"
                : "border-surface-2 bg-surface",
            )}
          >
            {engine.recommended && (
              <span className="absolute right-3 top-3 rounded-full bg-forge px-2 py-0.5 text-[10px] font-semibold text-ink">
                Recommended
              </span>
            )}
            <span className="font-display text-base font-semibold text-text">
              {engine.label}
            </span>
            <span className="text-xs font-medium text-spark">
              {engine.tagline}
            </span>
            <span className="mt-1 text-xs text-text-muted">{engine.detail}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="self-start text-sm text-text-muted hover:text-text"
      >
        ← Back
      </button>
    </div>
  );
}
