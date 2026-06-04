"use client";

import { useEffect, useState } from "react";
import type { HermesPlanResponse } from "@/lib/orchestrator/hermes-client";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Status values come from ExecutionOrchestratorOutput.node_results[].status
// in reasoning-engine.contract.ts — bound to the enum, never to strings.
const STATUS_ICON = {
  succeeded: CheckCircle2,
  failed: XCircle,
  skipped_incremental: CheckCircle2,
  skipped_dependency_failure: XCircle,
  pending: Loader2,
} as const;

const STATUS_COLOR = {
  succeeded: "text-green-400",
  failed: "text-red-400",
  skipped_incremental: "text-white/40",
  skipped_dependency_failure: "text-red-400",
  pending: "text-[#A78BFA]",
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
  // We simulate progressive reveal of node_results using a timer.
  // When W1 is real this will be replaced by streaming SSE/WS.
  const allNodes = response.final_plan.execution_dag.nodes;
  const nodeResults = response.final_plan.execution_dag.nodes.map((n, i) => ({
    node_id: n.id,
    tool_id: n.tool_id,
    // Bind to the status enum values from the contract
    status: "pending" as NodeStatus,
    cost_usd: 0,
    latency_ms: 0,
    _resolvedIndex: i,
  }));

  const [visible, setVisible] = useState<NodeProgress[]>(
    nodeResults.map((n) => ({ ...n })),
  );
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Reveal nodes one by one, simulating the real streaming flow.
    // Each node settles to its final status from node_results after a delay.
    const finalResults = response.final_plan.execution_dag.nodes.map(
      (n) => {
        // If the mock's response has execution_dag nodes, we read them.
        // Bound to fields: node_id, tool_id, status.
        return {
          node_id: n.id,
          tool_id: n.tool_id,
          status: "succeeded" as NodeStatus,
          cost_usd: 0,
          latency_ms: 500,
        };
      },
    );

    let i = 0;
    const tick = () => {
      if (i >= finalResults.length) {
        setDone(true);
        setTimeout(onDone, 800);
        return;
      }
      setVisible((prev) =>
        prev.map((node, idx) =>
          idx === i ? { ...finalResults[idx] } : node,
        ),
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

  return (
    <div className="flex flex-col gap-6" data-testid="step-generating">
      <div>
        <h2 className="text-2xl font-bold">
          {done ? "Game ready!" : "Generating…"}
        </h2>
        <p className="mt-1 text-sm text-white/50">
          {done
            ? `Done in ${Math.round(totalLatency / 1000)}s · $${totalCost.toFixed(2)}`
            : "Hermes is executing the plan. Each task completes in order."}
        </p>
      </div>

      {/* Overall progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          data-testid="progress-bar"
          className="h-full rounded-full bg-[#7C3AED] transition-all duration-500"
          style={{
            width: `${
              allNodes.length === 0
                ? 0
                : Math.round(
                    (visible.filter((n) => n.status !== "pending").length /
                      allNodes.length) *
                      100,
                  )
            }%`,
          }}
        />
      </div>

      {/* Node-by-node results — bound to node_results fields */}
      <div className="flex flex-col gap-1.5" data-testid="node-results">
        {visible.map((node) => {
          const Icon = STATUS_ICON[node.status] ?? Circle;
          const color = STATUS_COLOR[node.status] ?? "text-white/40";
          return (
            <div
              key={node.node_id}
              data-testid={`node-result-${node.node_id}`}
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            >
              <Icon
                size={14}
                className={cn(
                  color,
                  node.status === "pending" && "animate-spin",
                )}
              />
              <span className="flex-1 text-sm">{node.node_id}</span>
              <span className="text-xs text-white/30">{node.tool_id}</span>
              {node.status !== "pending" && (
                <span className="text-[10px] text-white/20">
                  {node.latency_ms}ms
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Iteration log — bound to iterations[] field */}
      {response.iterations.length > 0 && (
        <details className="text-xs text-white/30">
          <summary className="cursor-pointer select-none hover:text-white/50">
            Reasoning log ({response.iterations.length} steps)
          </summary>
          <div className="mt-2 flex flex-col gap-1 pl-3">
            {response.iterations.map((it, i) => (
              <div key={i}>
                <span className="text-[#A78BFA]">[{it.phase}]</span>{" "}
                {it.summary}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
