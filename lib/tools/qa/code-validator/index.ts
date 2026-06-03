/**
 * code_validator — engine-specific static checks on a single source blob.
 *
 * No engine binaries are available in this environment, so "lint/parse"
 * is a deterministic structural check: bracket/paren balance (for
 * C-family engines) and non-empty content. A failed check yields
 * status=rejected_by_qa so the Orchestrator can re-generate.
 */
import { z } from "zod";

import {
    ToolInputBaseSchema,
    ToolOutputBaseSchema,
    type ToolInvocation,
} from "../../../contracts/tool-registry.contract.js";
import { makeResult, type QaLog, type Tool } from "../../_shared.js";

const CURLY_ENGINES = new Set(["threejs", "babylon", "phaser", "monogame", "stride", "love2d", "defold"]);

export const CodeValidatorInputSchema = ToolInputBaseSchema.extend({
    engine: z.string().min(1),
    code: z.string(),
});
export type CodeValidatorInput = z.infer<typeof CodeValidatorInputSchema>;

export const CodeValidatorOutputSchema = ToolOutputBaseSchema.extend({
    valid: z.boolean(),
});
export type CodeValidatorOutput = z.infer<typeof CodeValidatorOutputSchema>;

function balanced(code: string, open: string, close: string): boolean {
    let depth = 0;
    for (const ch of code) {
        if (ch === open) depth++;
        else if (ch === close) {
            depth--;
            if (depth < 0) return false;
        }
    }
    return depth === 0;
}

async function handler(invocation: ToolInvocation) {
    const start = Date.now();
    const input = CodeValidatorInputSchema.parse({
        ...invocation.input,
        project_id: invocation.project_id,
        plan_version: invocation.plan_version,
        trace_id: invocation.trace_id,
    });

    const qa_log: QaLog = [
        { check: "non_empty", passed: input.code.trim().length > 0, detail: null },
        { check: "parens_balanced", passed: balanced(input.code, "(", ")"), detail: null },
    ];
    if (CURLY_ENGINES.has(input.engine)) {
        qa_log.push({ check: "braces_balanced", passed: balanced(input.code, "{", "}"), detail: null });
    }
    const valid = qa_log.every((q) => q.passed);

    const output: CodeValidatorOutput = {
        trace_id: invocation.trace_id,
        cost_usd: 0,
        latency_ms: Date.now() - start,
        qa_log: [],
        valid,
    };
    return makeResult({
        invocation: { tool_id: "code_validator", node_id: invocation.node_id, trace_id: invocation.trace_id },
        output,
        qa_log,
        latency_ms: Date.now() - start,
    });
}

const descriptor: Tool = {
    id: "code_validator",
    name: "Code Validator",
    description: "Deterministic structural validation (bracket balance, non-empty) per engine.",
    category: "qa",
    inputSchema: CodeValidatorInputSchema,
    outputSchema: CodeValidatorOutputSchema,
    estimatedCostUsd: 0,
    estimatedDurationSeconds: 1,
    handler,
};

export default descriptor;
