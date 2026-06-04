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

  // iframe_url comes from WebBuildArtifact.iframe_url (W3 contract, [dipende da v0.1.0-contracts]).
  // With the mock we show a placeholder; bound to the field, not the value.
  const iframeUrl = (plan as unknown as { iframe_url?: string }).iframe_url ?? null;
  const downloadUrl = (plan as unknown as { bundle_url?: string }).bundle_url ?? null;

  return (
    <div className="flex flex-col gap-6" data-testid="step-output">
      <div>
        <h2 className="text-2xl font-bold">{plan.meta.title}</h2>
        <p className="mt-1 text-sm text-white/50">
          {plan.meta.engine} · {plan.meta.genre.replace(/_/g, " ")} ·{" "}
          {plan.meta.difficulty}
        </p>
      </div>

      {/* Evaluation badges — bound to final_report.verdicts fields */}
      <div className="flex flex-wrap gap-2" data-testid="verdict-badges">
        {report.verdicts.map((v: MetricVerdict) => (
          <span
            key={v.metric}
            data-testid={`verdict-${v.metric}`}
            className={cn(
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
              v.passed
                ? "bg-green-500/10 text-green-400"
                : "bg-red-500/10 text-red-400",
            )}
          >
            {v.passed ? (
              <CheckCircle2 size={11} />
            ) : (
              <XCircle size={11} />
            )}
            {v.metric.replace(/_/g, " ")}
          </span>
        ))}
      </div>

      {/* Game player iframe — sandboxed */}
      <div
        className="aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black"
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
          <div className="flex h-full items-center justify-center text-sm text-white/30">
            Game player — will load{" "}
            <code className="ml-1 text-[#A78BFA]">iframe_url</code> from
            WebBuildArtifact once W3 ships
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
            className="flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-medium hover:border-white/40"
          >
            <Download size={14} />
            Download .zip
          </a>
        )}

        <button
          type="button"
          data-testid="open-studio-btn"
          disabled
          title="Studio Mode — Phase 2"
          className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-white/30"
        >
          <ExternalLink size={14} />
          Open in Studio
          <span className="rounded bg-white/10 px-1 py-0.5 text-[10px]">F2</span>
        </button>

        <button
          type="button"
          data-testid="create-another-btn"
          onClick={onReset}
          className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium hover:bg-white/15"
        >
          <RotateCcw size={14} />
          Create another
        </button>
      </div>

      {/* Cost + time summary — bound to response fields */}
      <p className="text-xs text-white/30">
        Generated in {Math.round(response.total_latency_ms / 1000)}s ·
        cost ${response.total_cost_usd.toFixed(2)} ·
        {response.overall_passed ? " all checks passed" : " some checks failed"}
      </p>
    </div>
  );
}
