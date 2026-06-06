/**
 * Tracer — per-step audit of a generation run into public.run_traces.
 *
 * Every phase (game-designer, each tool, build, smoke, web-export, db-write,
 * llm-call) records one ordered row: inputs, outputs, status, error, timing,
 * cost, and the bulky artifacts (generated code, build stderr, smoke log). One
 * query (`WHERE run_id ORDER BY seq`) replays exactly what happened.
 *
 * Best-effort by design: a tracing failure NEVER throws into the run. If there
 * is no run_id (e.g. local script), it degrades to console and does nothing to
 * the DB. The same events are forwarded to Langfuse when configured
 * (lib/observability/langfuse.ts), so LLM calls get a visual trace too.
 */
import { getAdminClient } from "../supabase/admin.js";

export type TracePhase =
    | "intent"
    | "game_designer"
    | "reference_games"
    | "design"
    | "consistency"
    | "balance"
    | "execution"
    | "tool"
    | "build"
    | "smoke"
    | "playtest"
    | "web_export"
    | "evaluation"
    | "db_write"
    | "llm_call";

export type TraceStatus = "started" | "succeeded" | "failed" | "degraded" | "skipped";

export interface TraceStep {
    phase: TracePhase;
    status: TraceStatus;
    tool_id?: string;
    node_id?: string;
    engine?: string;
    input?: unknown;
    output?: unknown;
    generated_code?: string;
    build_log?: string;
    smoke_log?: string;
    error?: string;
    latency_ms?: number;
    cost_usd?: number;
    model?: string;
    prompt_tokens?: number;
    completion_tokens?: number;
}

/** Trim a value so a single oversized field can't blow up the jsonb write. */
function cap(v: unknown, max = 20_000): unknown {
    if (v == null) return v;
    const s = typeof v === "string" ? v : JSON.stringify(v);
    return s.length > max ? s.slice(0, max) + `…[+${s.length - max}]` : v;
}

export class Tracer {
    private seq = 0;
    constructor(
        private readonly runId: string | null,
        private projectId: string | null = null,
    ) {}

    setProjectId(id: string): void {
        this.projectId = id;
    }

    /** Record one step. Never throws. */
    async record(step: TraceStep): Promise<void> {
        const seq = this.seq++;
        try {
            // Forward LLM calls to Langfuse for the visual trace (best-effort).
            if (step.phase === "llm_call") {
                const { traceLlmCall } = await import("./langfuse.js");
                traceLlmCall(this.runId, step);
            }

            if (!this.runId) {
                console.error(
                    `[trace ${seq}] ${step.phase}${step.tool_id ? "/" + step.tool_id : ""} ` +
                    `${step.status}${step.error ? " err=" + step.error.slice(0, 120) : ""}`,
                );
                return;
            }
            const db = getAdminClient();
            const { error } = await db.from("run_traces").insert({
                run_id: this.runId,
                project_id: this.projectId,
                seq,
                phase: step.phase,
                tool_id: step.tool_id ?? null,
                node_id: step.node_id ?? null,
                engine: step.engine ?? null,
                status: step.status,
                input: cap(step.input) ?? null,
                output: cap(step.output) ?? null,
                generated_code: step.generated_code ?? null,
                build_log: step.build_log ? String(step.build_log).slice(0, 100_000) : null,
                smoke_log: step.smoke_log ? String(step.smoke_log).slice(0, 20_000) : null,
                error: step.error ?? null,
                latency_ms: step.latency_ms ?? null,
                cost_usd: step.cost_usd ?? 0,
                model: step.model ?? null,
                prompt_tokens: step.prompt_tokens ?? null,
                completion_tokens: step.completion_tokens ?? null,
            });
            if (error) console.error("tracer.record insert failed: " + error.message);
        } catch (e) {
            console.error("tracer.record failed: " + (e instanceof Error ? e.message : String(e)));
        }
    }

    /** Convenience: time an async step and record start→succeeded/failed. */
    async span<T>(
        base: Omit<TraceStep, "status" | "latency_ms">,
        fn: () => Promise<T>,
    ): Promise<T> {
        const start = Date.now();
        try {
            const result = await fn();
            await this.record({ ...base, status: "succeeded", latency_ms: Date.now() - start });
            return result;
        } catch (e) {
            await this.record({
                ...base,
                status: "failed",
                latency_ms: Date.now() - start,
                error: e instanceof Error ? e.message : String(e),
            });
            throw e;
        }
    }
}

/** A no-op tracer for paths without a run (keeps call sites simple). */
export const NULL_TRACER = new Tracer(null);
