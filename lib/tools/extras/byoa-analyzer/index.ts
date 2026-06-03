/**
 * byoa_analyzer — "Bring Your Own Asset" Vision analysis.
 *
 * Runs a vision-capable model over a user-supplied reference image and
 * extracts a palette + style descriptor used to pick / bias a style
 * pack. The router call is injected so the tool is testable without
 * hitting Azure; the default wires lib/llm/router.ts.
 */
import { z } from "zod";

import {
    ToolInputBaseSchema,
    ToolOutputBaseSchema,
    type ToolInvocation,
} from "../../../contracts/tool-registry.contract.js";
import type { LlmCompleteRequest, LlmCompleteResponse } from "../../../llm/router.js";
import { makeResult, type Tool } from "../../_shared.js";

export const ByoaInputSchema = ToolInputBaseSchema.extend({
    image_url: z.string().url(),
});
export type ByoaInput = z.infer<typeof ByoaInputSchema>;

export const ByoaOutputSchema = ToolOutputBaseSchema.extend({
    palette: z.array(z.string()).min(1),
    style_descriptor: z.string().min(1),
});
export type ByoaOutput = z.infer<typeof ByoaOutputSchema>;

const VisionResultSchema = z.object({
    palette: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).min(1).max(8),
    style_descriptor: z.string().min(1),
});

export interface ByoaDeps {
    complete(request: LlmCompleteRequest): Promise<LlmCompleteResponse>;
}

function defaultDeps(): ByoaDeps {
    return {
        async complete(request) {
            const { complete } = await import("../../../llm/router.js");
            return complete(request);
        },
    };
}

async function handler(invocation: ToolInvocation, deps: ByoaDeps = defaultDeps()) {
    const start = Date.now();
    const input = ByoaInputSchema.parse({
        ...invocation.input,
        project_id: invocation.project_id,
        plan_version: invocation.plan_version,
        trace_id: invocation.trace_id,
    });

    const completion = await deps.complete({
        model: "gpt-4o",
        system:
            "You analyze a reference image for a game's art direction. Return JSON " +
            "{palette: [hex...], style_descriptor}. Palette is the 3-8 dominant colors.",
        user: `Analyze this reference image: ${input.image_url}`,
        response_schema: VisionResultSchema,
        max_tokens: 512,
        temperature: 0.2,
        trace_id: invocation.trace_id,
    });

    const vision = VisionResultSchema.parse(completion.output);
    const output: ByoaOutput = {
        trace_id: invocation.trace_id,
        cost_usd: completion.cost_usd,
        latency_ms: completion.latency_ms,
        qa_log: [],
        palette: vision.palette,
        style_descriptor: vision.style_descriptor,
    };
    return makeResult({
        invocation: { tool_id: "byoa_analyzer", node_id: invocation.node_id, trace_id: invocation.trace_id },
        output,
        qa_log: [{ check: "palette_extracted", passed: vision.palette.length > 0, detail: null }],
        cost_usd: completion.cost_usd,
        latency_ms: Date.now() - start,
    });
}

const descriptor: Tool<ByoaDeps> = {
    id: "byoa_analyzer",
    name: "BYOA Analyzer",
    description: "Vision analysis of a user reference image → palette + style descriptor for style-pack selection.",
    category: "extras",
    inputSchema: ByoaInputSchema,
    outputSchema: ByoaOutputSchema,
    estimatedCostUsd: 0.005,
    estimatedDurationSeconds: 4,
    handler,
};

export default descriptor;
