import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MetricVerdict } from "@/lib/contracts/evaluation-metrics.contract";

const METRIC_LABELS: Record<string, string> = {
  aesthetic_coherence: "Coherent style",
  soft_lock_count: "0 soft-locks",
  stress_curve_rmse: "Balanced",
  smoke_test_pass_rate: "Runs",
  generation_cost_usd: "Cost",
  generation_time_seconds: "Time",
};

interface Props {
  verdicts: MetricVerdict[];
  /** When true renders a compact inline row; default is a flex-wrap group */
  compact?: boolean;
}

export function VerdictBadges({ verdicts, compact = false }: Props) {
  const allPassed = verdicts.every((v) => v.passed);

  return (
    <div
      className={cn("flex flex-wrap gap-1.5", compact && "gap-1")}
      data-testid="verdict-badges"
    >
      {/* Overall badge */}
      <span
        className={cn(
          "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold font-display",
          allPassed
            ? "bg-success/10 text-success"
            : "bg-danger/10 text-danger",
        )}
        data-testid="verdict-overall"
      >
        {allPassed ? (
          <CheckCircle2 size={11} />
        ) : (
          <AlertCircle size={11} />
        )}
        {allPassed ? "Verificato ✓" : "Verifica fallita"}
      </span>

      {/* Per-metric badges */}
      {verdicts.map((v) => (
        <span
          key={v.metric}
          data-testid={`verdict-${v.metric}`}
          title={v.notes}
          className={cn(
            "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
            v.passed
              ? "bg-success/10 text-success"
              : "bg-danger/10 text-danger",
          )}
        >
          {v.passed ? (
            <CheckCircle2 size={10} />
          ) : (
            <XCircle size={10} />
          )}
          {METRIC_LABELS[v.metric] ?? v.metric.replace(/_/g, " ")}
        </span>
      ))}
    </div>
  );
}
