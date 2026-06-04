"use client";

import type { HermesPlanResponse } from "@/lib/orchestrator/hermes-client";
import { Loader2, Zap } from "lucide-react";

interface Props {
  response: HermesPlanResponse | null;
  onGenerate: () => void;
  onBack: () => void;
  loading: boolean;
}

export function StepPlanPreview({ response, onGenerate, onBack, loading }: Props) {
  const plan = response?.final_plan;
  const nodes = plan?.execution_dag.nodes ?? [];

  // Rough cost/time estimates derived from the mock response.
  // Bound to fields (total_cost_usd, total_latency_ms) — never to hardcoded values.
  const estimatedCost = response
    ? `$${response.total_cost_usd.toFixed(2)}`
    : "—";
  const estimatedTime = response
    ? `${Math.round(response.total_latency_ms / 1000)}s`
    : "—";

  return (
    <div className="flex flex-col gap-6" data-testid="step-plan-preview">
      <div>
        <h2 className="text-2xl font-bold">Generation plan</h2>
        <p className="mt-1 text-sm text-white/50">
          Hermes designed this execution plan for your game. Review it before generating.
        </p>
      </div>

      {!plan && (
        <div className="flex items-center gap-2 text-sm text-white/40">
          <Loader2 size={14} className="animate-spin" />
          Loading plan…
        </div>
      )}

      {plan && (
        <>
          {/* Meta */}
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
                className="rounded-lg border border-white/10 bg-white/5 p-3"
              >
                <div className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                  {label}
                </div>
                <div className="mt-1 text-sm font-semibold capitalize">
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Execution DAG nodes */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              Tasks ({nodes.length})
            </h3>
            <div
              className="flex flex-col gap-1.5"
              data-testid="dag-nodes"
            >
              {nodes.map((node) => (
                <div
                  key={node.id}
                  data-testid={`dag-node-${node.id}`}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                >
                  <Zap size={12} className="shrink-0 text-[#A78BFA]" />
                  <span className="flex-1 text-sm">{node.id}</span>
                  <span className="text-xs text-white/30">{node.tool_id}</span>
                  {node.depends_on.length > 0 && (
                    <span className="text-[10px] text-white/20">
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
          className="text-sm text-white/40 hover:text-white/60"
        >
          ← Back
        </button>
        <button
          type="button"
          data-testid="generate-btn"
          onClick={onGenerate}
          disabled={!plan || loading}
          className="flex items-center gap-2 rounded-lg bg-[#7C3AED] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-[#6D28D9]"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          Generate game
        </button>
      </div>
    </div>
  );
}
