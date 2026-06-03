/**
 * LLM router mock — exposes the same surface that W2 will implement
 * in `lib/llm/router.ts`. Used by W1 / W3 / W4 in test mode and during
 * parallelism. Returns Zod-validated stub responses.
 *
 * Replace at merge time per Supreme Plan §07.
 */
/** The request/response schemas are owned by the real router
 * (lib/llm/router.ts) and re-exported here so the mock can never drift
 * from the implementation: changing the router shape changes the mock
 * shape automatically. */
export {
    ModelIdEnum,
    LlmCompleteRequestSchema,
    LlmCompleteResponseSchema,
} from "../llm/router.js";
export type {
    ModelId,
    LlmCompleteRequest,
    LlmCompleteResponse,
} from "../llm/router.js";

import {
    LlmCompleteRequestSchema,
    LlmCompleteResponseSchema,
    type LlmCompleteRequest,
    type LlmCompleteResponse,
} from "../llm/router.js";

/** Mock router complete call. Validates request, returns a shape-
 * conformant stub. */
export async function complete(
    request: LlmCompleteRequest,
): Promise<LlmCompleteResponse> {
    const parsed = LlmCompleteRequestSchema.parse(request);
    return LlmCompleteResponseSchema.parse({
        trace_id: parsed.trace_id,
        model: parsed.model,
        output: parsed.response_schema
            ? {
                  stub: true,
                  note: `mocked LLM completion for ${parsed.model}`,
              }
            : "[mocked LLM completion]",
        cost_usd: 0,
        latency_ms: 0,
        tokens_in: 0,
        tokens_out: 0,
        cache_hit: false,
    });
}

/** Mock embed call. Returns a 1536-dim zero vector — callers must NOT
 * rely on the values being meaningful, only on the shape and length. */
export async function embed(input: string): Promise<number[]> {
    if (input.length === 0) {
        throw new Error("embed: input must be non-empty");
    }
    return new Array<number>(1536).fill(0);
}
