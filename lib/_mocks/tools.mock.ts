/**
 * Tools mock — consumed by W1 (Reasoning) and W4 (Frontend) while W2
 * builds the real 48 tool implementations.
 *
 * Every export here MUST satisfy the contract in
 * `lib/contracts/tool-registry.contract.ts`. The mocks Zod-validate
 * the input (so a caller's bug surfaces immediately) and return a
 * shape-conformant stub. They DO NOT touch network, LLM APIs, or the
 * DB — they are pure functions of their input.
 *
 * At merge time §07 of the Supreme Plan, all `from '@/lib/_mocks/tools.mock'`
 * imports are replaced with `from '@/lib/tools/<actual_id>/index'`.
 */
import {
    type ToolExecutionResult,
    ToolExecutionResultSchema,
    type ToolInvocation,
    ToolInvocationSchema,
} from "../contracts/tool-registry.contract.js";

/** Single-call mock dispatcher. Validates the invocation, returns a
 * canned succeeded result. Caller should pretend the output came
 * from a real tool — it is shape-correct and Zod-validated.
 *
 * This stays a PURE stub (no network/LLM/DB): the real [2-W2] tools live
 * in `lib/tools/<category>/.../index.ts` and are wired through
 * `lib/tools/registry.ts`. At merge time (§07) consumers import the
 * registry directly; until then this mock keeps the contract surface
 * available to W1/W3/W4 without side effects. */
export async function invokeTool(
    invocation: ToolInvocation,
): Promise<ToolExecutionResult> {
    const parsed = ToolInvocationSchema.parse(invocation);

    const result: ToolExecutionResult = ToolExecutionResultSchema.parse({
        tool_id: parsed.tool_id,
        node_id: parsed.node_id,
        trace_id: parsed.trace_id,
        status: "succeeded",
        // Generic stub output — every tool will return its own shape
        // in production. Callers that need a richer shape per tool_id
        // should consume the tool-specific mock once it lives in
        // `lib/tools/<tool_id>/__mocks__/`.
        output: {
            stub: true,
            note: `mocked invocation of ${parsed.tool_id} — replace at merge time`,
            input_echo: parsed.input,
        },
        cost_usd: 0,
        latency_ms: 0,
        qa_log: [
            {
                check: "mock_dispatch",
                passed: true,
                detail: "lib/_mocks/tools.mock.ts canned response",
            },
        ],
        error_message: null,
        created_at: new Date().toISOString(),
    });

    return result;
}

/** Batch dispatch — used by the Orchestrator (W1 D.5) when running
 * DAG nodes in parallel. The mock just maps invokeTool over the array
 * but the signature mirrors the real Trigger.dev batch entrypoint. */
export async function invokeToolBatch(
    invocations: readonly ToolInvocation[],
): Promise<ToolExecutionResult[]> {
    return Promise.all(invocations.map((inv) => invokeTool(inv)));
}
