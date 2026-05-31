/**
 * LLM router mock — exposes the same surface that W2 will implement
 * in `lib/llm/router.ts`. Used by W1 / W3 / W4 in test mode and during
 * parallelism. Returns Zod-validated stub responses.
 *
 * Replace at merge time per Supreme Plan §07.
 */
import { z } from "zod";

/** Models the router supports. Mirror what `lib/llm/router.ts` will
 * accept. Adding a new id here without updating the real router will
 * fail the contract check at merge time. */
export const ModelIdEnum = z.enum([
    "deepseek-chat", // default cheap
    "deepseek-reasoner",
    "claude-sonnet-4-7",
    "claude-haiku-4-5",
    "gpt-4o-mini",
    "gpt-4o",
    "gemini-2.5-flash",
]);
export type ModelId = z.infer<typeof ModelIdEnum>;

export const LlmCompleteRequestSchema = z.object({
    model: ModelIdEnum,
    system: z.string().optional(),
    user: z.string().min(1),
    response_schema: z.unknown().optional(),
    max_tokens: z.number().int().min(1).max(64000).default(2048),
    temperature: z.number().min(0).max(2).default(0.2),
    trace_id: z.string().min(1),
});
export type LlmCompleteRequest = z.infer<typeof LlmCompleteRequestSchema>;

export const LlmCompleteResponseSchema = z.object({
    trace_id: z.string().min(1),
    model: ModelIdEnum,
    /** When `response_schema` was provided, this is the parsed object;
     * otherwise raw text. */
    output: z.unknown(),
    cost_usd: z.number().min(0),
    latency_ms: z.number().int().min(0),
    tokens_in: z.number().int().min(0),
    tokens_out: z.number().int().min(0),
    cache_hit: z.boolean(),
});
export type LlmCompleteResponse = z.infer<typeof LlmCompleteResponseSchema>;

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
