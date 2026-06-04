/**
 * Shared plumbing for W2 tools.
 *
 * Every tool handler takes a ToolInvocation (the envelope the
 * Orchestrator emits) and returns a ToolExecutionResult (the envelope
 * persisted in `tool_executions`). `makeResult()` builds that envelope
 * from the tool's own output + qa log, so each tool only writes its
 * domain logic, not the boilerplate.
 */
import { z } from "zod";

import {
    type ToolCategory,
    type ToolExecutionResult,
    ToolExecutionResultSchema,
    type ToolId,
    type ToolInvocation,
} from "../contracts/tool-registry.contract.js";

export type QaLog = ToolExecutionResult["qa_log"];

/** Registry shape every W2 tool exports as its default.
 *
 * Note on the contract: `ToolDescriptor.handler` in
 * tool-registry.contract.ts is typed `(input: I) => Promise<O>` — the
 * inner request/response shape used by W1's mocks. The real dispatch
 * surface (mirrored by lib/_mocks/tools.mock.ts `invokeTool`) is
 * invocation → ToolExecutionResult, so the implemented handler takes a
 * ToolInvocation and an optional injected-deps bag. We keep the
 * descriptor metadata (id/name/schemas) contract-aligned and type the
 * handler to the real dispatch surface. */
export interface Tool<Deps = void> {
    id: ToolId;
    name: string;
    description: string;
    category: ToolCategory;
    inputSchema: z.ZodTypeAny;
    outputSchema: z.ZodTypeAny;
    estimatedCostUsd: number;
    estimatedDurationSeconds: number;
    handler: Deps extends void
        ? (invocation: ToolInvocation) => Promise<ToolExecutionResult>
        : (invocation: ToolInvocation, deps?: Deps) => Promise<ToolExecutionResult>;
}

export interface MakeResultArgs {
    invocation: Pick<ToolInvocation, "node_id" | "trace_id"> & { tool_id: ToolId };
    /** Tool-specific output object, or null when the tool failed. */
    output: Record<string, unknown> | null;
    qa_log: QaLog;
    cost_usd?: number;
    latency_ms?: number;
    error_message?: string | null;
}

/** Derive the envelope status from the qa log + error: any failed check
 * → rejected_by_qa, an error_message → failed, otherwise succeeded. */
function deriveStatus(qa_log: QaLog, error_message: string | null): ToolExecutionResult["status"] {
    if (error_message) {
        return "failed";
    }
    if (qa_log.some((q) => !q.passed)) {
        return "rejected_by_qa";
    }
    return "succeeded";
}

export function makeResult(args: MakeResultArgs): ToolExecutionResult {
    const error_message = args.error_message ?? null;
    return ToolExecutionResultSchema.parse({
        tool_id: args.invocation.tool_id,
        node_id: args.invocation.node_id,
        trace_id: args.invocation.trace_id,
        status: deriveStatus(args.qa_log, error_message),
        output: args.output,
        cost_usd: args.cost_usd ?? 0,
        latency_ms: args.latency_ms ?? 0,
        qa_log: args.qa_log,
        error_message,
        created_at: new Date().toISOString(),
    });
}
