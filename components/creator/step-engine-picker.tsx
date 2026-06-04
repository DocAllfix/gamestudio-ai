"use client";

import { cn } from "@/lib/utils";

const ENGINES = [
  {
    id: "godot",
    label: "Godot",
    tagline: "2D + 3D generalista",
    detail: "KB solida (2551 chunk). Ottimo per platformer, RPG, metroidvania.",
    recommended: true,
  },
  {
    id: "phaser",
    label: "Phaser",
    tagline: "Browser istantaneo",
    detail: "JS/HTML5 nativo. Build velocissima. Arcade & puzzle.",
    recommended: false,
  },
  {
    id: "threejs",
    label: "Three.js",
    tagline: "3D showcase",
    detail: "WebGL nativo. Esperienze 3D e showcase visivi.",
    recommended: false,
  },
  {
    id: "babylon",
    label: "Babylon.js",
    tagline: "3D con fisica",
    detail: "Fisica + GUI integrati. NullEngine per verifica server-side.",
    recommended: false,
  },
  {
    id: "defold",
    label: "Defold",
    tagline: "Mobile-first (.apk)",
    detail: "Android .apk nativo + PWA. Ottimo per giochi mobile.",
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
          Scegli il motore
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Hermes suggerisce il migliore. Puoi scegliere tu.
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
                Consigliato
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
        ← Indietro
      </button>
    </div>
  );
}
