"use client";

import { cn } from "@/lib/utils";

// The 5 day-1 engines — display metadata only. Engine values bind to
// the EngineEnum in game-plan.contract.ts; never hardcode logic on them.
const ENGINES = [
  {
    id: "godot",
    label: "Godot",
    tagline: "2D + 3D generalist",
    detail: "Strong KB (2551 chunks). Best for platformers, RPGs, metroidvania.",
    recommended: true,
  },
  {
    id: "phaser",
    label: "Phaser",
    tagline: "Instant browser",
    detail: "Native JS/HTML5. Fastest build, best for arcade & puzzle.",
    recommended: false,
  },
  {
    id: "threejs",
    label: "Three.js",
    tagline: "3D showcase",
    detail: "WebGL native. Best for 3D experiences and visual showcases.",
    recommended: false,
  },
  {
    id: "babylon",
    label: "Babylon.js",
    tagline: "3D physics games",
    detail: "Built-in physics & GUI. NullEngine for server-side verification.",
    recommended: false,
  },
  {
    id: "defold",
    label: "Defold",
    tagline: "Mobile-first (.apk)",
    detail: "Native Android .apk + PWA. Best for mobile-first games.",
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
        <h2 className="text-2xl font-bold">Choose your engine</h2>
        <p className="mt-1 text-sm text-white/50">
          Hermes will recommend the best fit. You can override it here.
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
              "relative flex flex-col gap-1 rounded-xl border p-4 text-left transition-colors hover:border-[#7C3AED]/60 hover:bg-[#7C3AED]/10",
              engine.recommended
                ? "border-[#7C3AED]/40 bg-[#7C3AED]/5"
                : "border-white/10 bg-white/5",
            )}
          >
            {engine.recommended && (
              <span className="absolute right-3 top-3 rounded-full bg-[#7C3AED] px-2 py-0.5 text-[10px] font-semibold text-white">
                Recommended
              </span>
            )}
            <span className="text-base font-semibold">{engine.label}</span>
            <span className="text-xs font-medium text-[#A78BFA]">
              {engine.tagline}
            </span>
            <span className="mt-1 text-xs text-white/40">{engine.detail}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onBack}
        className="self-start text-sm text-white/40 hover:text-white/60"
      >
        ← Back
      </button>
    </div>
  );
}
