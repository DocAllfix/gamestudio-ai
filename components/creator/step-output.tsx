"use client";

import type { HermesPlanResponse } from "@/lib/orchestrator/hermes-client";

type MetricVerdict = {
  metric: string;
  value: number;
  threshold: number;
  passed: boolean;
  notes: string;
};
import { CheckCircle2, Download, ExternalLink, RotateCcw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  response: HermesPlanResponse;
  onReset: () => void;
}

export function StepOutput({ response, onReset }: Props) {
  const plan = response.final_plan;
  const report = response.final_report;

  // iframe_url from WebBuildArtifact.iframe_url (W3 contract) — bound to field
  const iframeUrl = (plan as unknown as { iframe_url?: string }).iframe_url ?? null;
  const downloadUrl = (plan as unknown as { bundle_url?: string }).bundle_url ?? null;

  return (
    <div className="flex flex-col gap-6" data-testid="step-output">
      <div>
        <h2 className="font-display text-2xl font-bold text-text">{plan.meta.title}</h2>
        <p className="mt-1 text-sm text-text-muted">
          {plan.meta.engine} · {plan.meta.genre.replace(/_/g, " ")} ·{" "}
          {plan.meta.difficulty}
        </p>
      </div>

      {/* Verdict badges — bound to final_report.verdicts fields */}
      <div className="flex flex-wrap gap-2" data-testid="verdict-badges">
        {report.verdicts.map((v: MetricVerdict) => (
          <span
            key={v.metric}
            data-testid={`verdict-${v.metric}`}
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
              v.passed
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger",
            )}
          >
            {v.passed ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
            {v.metric.replace(/_/g, " ")}
          </span>
        ))}
      </div>

      {/* Game player — sandboxed iframe */}
      <div
        className="aspect-video w-full overflow-hidden rounded-xl border border-surface-2 bg-ink"
        data-testid="game-player"
      >
        {iframeUrl ? (
          <iframe
            src={iframeUrl}
            sandbox="allow-scripts allow-same-origin"
            className="h-full w-full"
            title={plan.meta.title}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-text-muted">
            <span className="font-display text-forge text-xl">▶</span>
            <span>
              Player — caricherà{" "}
              <code className="text-spark">iframe_url</code> da WebBuildArtifact una volta che W3 è live
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {downloadUrl && (
          <a
            href={downloadUrl}
            download
            data-testid="download-btn"
            className="flex items-center gap-2 rounded-lg border border-surface-2 px-4 py-2.5 text-sm font-medium text-text hover:border-text-muted transition-colors"
          >
            <Download size={14} />
            Download .zip
          </a>
        )}

        <button
          type="button"
          data-testid="open-studio-btn"
          disabled
          title="Studio Mode — F2"
          className="flex items-center gap-2 rounded-lg border border-surface-2 px-4 py-2.5 text-sm font-medium text-text-muted"
        >
          <ExternalLink size={14} />
          Open in Studio
          <span className="rounded bg-surface-2 px-1 py-0.5 text-[10px]">F2</span>
        </button>

        <button
          type="button"
          data-testid="create-another-btn"
          onClick={onReset}
          className="flex items-center gap-2 rounded-lg bg-forge px-4 py-2.5 text-sm font-semibold text-ink hover:bg-spark transition-colors"
        >
          <RotateCcw size={14} />
          Forge another
        </button>
      </div>

      {/* Cost + time summary */}
      <p className="text-xs text-text-muted">
        Generated in {Math.round(response.total_latency_ms / 1000)}s ·
        cost ${response.total_cost_usd.toFixed(2)} ·
        {response.overall_passed ? " all checks passed ✓" : " some checks failed"}
      </p>
    </div>
  );
}
