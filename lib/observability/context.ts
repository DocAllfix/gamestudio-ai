/**
 * Ambient run tracer via AsyncLocalStorage.
 *
 * The LLM router, tools, build and smoke all need to write to the same run's
 * trace, but threading a Tracer through every call signature would touch dozens
 * of files. Instead the orchestrator runs the whole generation inside
 * `withTracer(tracer, fn)`, and any code deep in the stack calls
 * `currentTracer()` to get it (or null outside a run). Standard Node pattern,
 * no global mutable singleton, safe under concurrency.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { Tracer } from "./tracer.js";

const storage = new AsyncLocalStorage<Tracer>();

/** Run `fn` with `tracer` available to everything it calls. */
export function withTracer<T>(tracer: Tracer, fn: () => Promise<T>): Promise<T> {
    return storage.run(tracer, fn);
}

/** The tracer for the current run, or null when not inside withTracer. */
export function currentTracer(): Tracer | null {
    return storage.getStore() ?? null;
}
