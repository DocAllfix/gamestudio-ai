import { cn } from "@/lib/utils";

const STEPS = ["Brief", "Engine", "Plan", "Generating", "Output"] as const;

interface Props {
  current: number; // 1-indexed
}

export function StepIndicator({ current }: Props) {
  return (
    <div className="flex items-center gap-1" aria-label="Progress" data-testid="step-indicator">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const done = stepNum < current;
        const active = stepNum === current;
        return (
          <div key={label} className="flex items-center gap-1">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                done && "bg-[#7C3AED] text-white",
                active && "border-2 border-[#7C3AED] text-[#A78BFA]",
                !done && !active && "border border-white/20 text-white/30",
              )}
            >
              {done ? "✓" : stepNum}
            </div>
            <span
              className={cn(
                "hidden text-xs sm:inline",
                active ? "text-white/80" : "text-white/30",
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-px w-4",
                  done ? "bg-[#7C3AED]" : "bg-white/10",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
