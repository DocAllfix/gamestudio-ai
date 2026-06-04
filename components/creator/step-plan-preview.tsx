"use client";

import type { HermesPlanResponse } from "@/lib/orchestrator/hermes-client";
import { Loader2, Hammer } from "lucide-react";

interface Props {
  response: HermesPlanResponse | null;
  onGenerate: () => void;
  onBack: () => void;
  loading: boolean;
}

export function StepPlanPreview({ response, onGenerate, onBack, loading }: Props) {
  const plan = response?.final_plan;
  const nodes = plan?.execution_dag.nodes ?? [];

  const estimatedCost = response ? `$${response.total_cost_usd.toFixed(2)}` : "—";
  const estimatedTime = response
    ? `${Math.round(response.total_latency_ms / 1000)}s`
    : "—";

  return (
    <div className="flex flex-col gap-6" data-testid="step-plan-preview">
      <div>
        <h2 className="font-display text-2xl font-bold text-text">
          Generation plan
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Hermes designed this plan for your game. Review it before forging.
        </p>
      </div>

      {!plan && (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 size={14} className="animate-spin text-forge" />
          Loading plan…
        </div>
      )}

      {plan && (
        <>
          {/* Meta stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["Engine", plan.meta.engine],
                ["Genre", plan.meta.genre.replace(/_/g, " ")],
                ["Est. cost", estimatedCost],
                ["Est. time", estimatedTime],
              ] as [string, string][]
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-surface-2 bg-surface p-3"
              >
                <div className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                  {label}
                </div>
                <div className="mt-1 font-display text-sm font-semibold capitalize text-text">
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Execution DAG nodes */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Tasks ({nodes.length})
            </h3>
            <div className="flex flex-col gap-1.5" data-testid="dag-nodes">
              {nodes.map((node) => (
                <div
                  key={node.id}
                  data-testid={`dag-node-${node.id}`}
                  className="flex items-center gap-3 rounded-lg border border-surface-2 bg-surface px-3 py-2"
                >
                  <Hammer size={12} className="shrink-0 text-spark" />
                  <span className="flex-1 text-sm text-text">{node.id}</span>
                  <span className="text-xs text-text-muted">{node.tool_id}</span>
                  {node.depends_on.length > 0 && (
                    <span className="text-[10px] text-text-muted/60">
                      after {node.depends_on.join(", ")}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-text-muted hover:text-text"
        >
          ← Back
        </button>
        <button
          type="button"
          data-testid="generate-btn"
          onClick={onGenerate}
          disabled={!plan || loading}
          className="flex items-center gap-2 rounded-lg bg-forge px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-40 hover:bg-spark transition-colors"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          Forge the game
        </button>
      </div>
    </div>
  );
}
