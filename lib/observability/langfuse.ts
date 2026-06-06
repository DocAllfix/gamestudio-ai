/**
 * Langfuse bridge — visual tracing for LLM calls.
 *
 * Best-effort and lazy: if LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY are unset
 * (or the SDK isn't installed), every function here is a no-op, so the system
 * runs identically without Langfuse. When configured, each LLM call from the
 * router shows up as a generation under the run's trace, with prompt, response,
 * model, tokens and cost — the "why did the LLM answer this" view that
 * complements the run_traces audit ("what happened").
 */
import type { TraceStep } from "./tracer.js";

let client: unknown = null;
let initPromise: Promise<unknown> | null = null;

async function getClient(): Promise<unknown> {
    if (initPromise) return initPromise;
    initPromise = (async () => {
        const pub = process.env.LANGFUSE_PUBLIC_KEY;
        const sec = process.env.LANGFUSE_SECRET_KEY;
        if (!pub || !sec) return null;
        try {
            // Dynamic import (ESM) so the package is optional and `require` is
            // never used (require is not defined under ESM).
            const mod = await import("langfuse");
            const Langfuse = (mod as { Langfuse: new (o: object) => unknown }).Langfuse;
            client = new Langfuse({
                publicKey: pub,
                secretKey: sec,
                baseUrl: process.env.LANGFUSE_HOST || undefined,
            });
        } catch (e) {
            console.error("langfuse init skipped: " + (e instanceof Error ? e.message : String(e)));
            client = null;
        }
        return client;
    })();
    return initPromise;
}

/** Record one LLM call as a Langfuse generation. No-op when unconfigured. */
export async function traceLlmCall(runId: string | null, step: TraceStep): Promise<void> {
    const lf = (await getClient()) as {
        generation?: (a: object) => void;
    } | null;
    if (!lf?.generation) return;
    try {
        lf.generation({
            name: step.tool_id ?? "llm_call",
            model: step.model,
            input: step.input,
            output: step.output,
            metadata: { run_id: runId, node_id: step.node_id, status: step.status },
            usage: {
                input: step.prompt_tokens,
                output: step.completion_tokens,
                totalCost: step.cost_usd,
            },
        });
    } catch (e) {
        console.error("langfuse generation failed: " + (e instanceof Error ? e.message : String(e)));
    }
}

/** Flush pending events (call at the end of a run). No-op when unconfigured. */
export async function flushLangfuse(): Promise<void> {
    const lf = (await getClient()) as { flushAsync?: () => Promise<void> } | null;
    if (lf?.flushAsync) {
        try {
            await lf.flushAsync();
        } catch (e) {
            console.error("langfuse flush failed: " + (e instanceof Error ? e.message : String(e)));
        }
    }
}
