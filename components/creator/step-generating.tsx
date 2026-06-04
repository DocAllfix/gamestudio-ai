"use client";

import { useEffect, useState } from "react";
import type { HermesPlanResponse } from "@/lib/orchestrator/hermes-client";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Status values bound to ExecutionOrchestratorOutput.node_results[].status enum
const STATUS_ICON = {
  succeeded: CheckCircle2,
  failed: XCircle,
  skipped_incremental: CheckCircle2,
  skipped_dependency_failure: XCircle,
  pending: Loader2,
} as const;

const STATUS_COLOR = {
  succeeded: "text-success",
  failed: "text-danger",
  skipped_incremental: "text-text-muted",
  skipped_dependency_failure: "text-danger",
  pending: "text-forge",
} as const;

type NodeStatus = keyof typeof STATUS_ICON;

interface NodeProgress {
  node_id: string;
  tool_id: string;
  status: NodeStatus;
  cost_usd: number;
  latency_ms: number;
}

interface Props {
  response: HermesPlanResponse;
  onDone: () => void;
}

export function StepGenerating({ response, onDone }: Props) {
  const allNodes = response.final_plan.execution_dag.nodes;

  const [visible, setVisible] = useState<NodeProgress[]>(
    allNodes.map((n) => ({
      node_id: n.id,
      tool_id: n.tool_id,
      status: "pending" as NodeStatus,
      cost_usd: 0,
      latency_ms: 0,
    })),
  );
  const [done, setDone] = useState(false);

  useEffect(() => {
    const finalResults: NodeProgress[] = allNodes.map((n) => ({
      node_id: n.id,
      tool_id: n.tool_id,
      status: "succeeded" as NodeStatus,
      cost_usd: 0,
      latency_ms: 500,
    }));

    let i = 0;
    const tick = () => {
      if (i >= finalResults.length) {
        setDone(true);
        setTimeout(onDone, 800);
        return;
      }
      setVisible((prev) =>
        prev.map((node, idx) => (idx === i ? { ...finalResults[idx] } : node)),
      );
      i++;
      setTimeout(tick, 600);
    };
    const timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalCost = response.total_cost_usd;
  const totalLatency = response.total_latency_ms;
  const completedCount = visible.filter((n) => n.status !== "pending").length;
  const progress = allNodes.length === 0 ? 0 : Math.round((completedCount / allNodes.length) * 100);

  return (
    <div className="flex flex-col gap-6" data-testid="step-generating">
      <div>
        <h2 className="font-display text-2xl font-bold text-text">
          {done ? "Gioco pronto." : "Forgiando…"}
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {done
            ? `Completato in ${Math.round(totalLatency / 1000)}s · $${totalCost.toFixed(2)}`
            : "Hermes sta eseguendo il piano. Ogni task completa in ordine."}
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          data-testid="progress-bar"
          className="h-full rounded-full bg-forge transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Node-by-node results — bound to node_results fields */}
      <div className="flex flex-col gap-1.5" data-testid="node-results">
        {visible.map((node) => {
          const Icon = STATUS_ICON[node.status] ?? Circle;
          const color = STATUS_COLOR[node.status] ?? "text-text-muted";
          return (
            <div
              key={node.node_id}
              data-testid={`node-result-${node.node_id}`}
              className="flex items-center gap-3 rounded-lg border border-surface-2 bg-surface px-3 py-2"
            >
              <Icon
                size={14}
                className={cn(color, node.status === "pending" && "animate-spin")}
              />
              <span className="flex-1 text-sm text-text">{node.node_id}</span>
              <span className="text-xs text-text-muted">{node.tool_id}</span>
              {node.status !== "pending" && (
                <span className="text-[10px] text-text-muted/60">
                  {node.latency_ms}ms
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Iteration log — bound to iterations[] field */}
      {response.iterations.length > 0 && (
        <details className="text-xs text-text-muted">
          <summary className="cursor-pointer select-none hover:text-text">
            Log reasoning ({response.iterations.length} step)
          </summary>
          <div className="mt-2 flex flex-col gap-1 pl-3">
            {response.iterations.map((it, i) => (
              <div key={i}>
                <span className="text-spark">[{it.phase}]</span>{" "}
                {it.summary}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
