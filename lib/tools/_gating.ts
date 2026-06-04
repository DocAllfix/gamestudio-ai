/**
 * Gating layer for the PAY generative ports (Audio / 3D / Image).
 *
 * The generative.contract.ts port method inputs intentionally do NOT
 * carry user identity or tier — they extend ToolInputBase only. So the
 * adapters take a GatingContext at construction time and run two gates
 * before any provider call:
 *
 *   1. W2 paywall policy — generative AI requires tier >= creator
 *      (CLAUDE.md §6: "generativo SEMPRE dietro paywall"). check_quota's
 *      free-tier branch only rejects on cost/monthly, never on "is
 *      generative", so this rule lives in W2.
 *   2. check_quota RPC — DB-side per-game cost + monthly ceiling.
 *
 * After a successful generation the adapter persists the real cost via
 * record_tool_execution. The quota RPC, tier lookup, and persistence are
 * injected so the adapters are testable without a live Supabase.
 */
import type { ToolId } from "../contracts/tool-registry.contract.js";

export type Tier = "free" | "creator" | "pro" | "studio";

const PAID_TIERS: ReadonlySet<Tier> = new Set<Tier>(["creator", "pro", "studio"]);

export interface QuotaVerdict {
    allowed: boolean;
    reason: string | null;
    games_used_this_month: number;
}

export interface GateRequest {
    clerk_user_id: string;
    tool_id: ToolId;
    estimated_cost_usd: number;
    counts_toward_monthly?: boolean;
}

export interface GateDeps {
    getUserTier(clerk_user_id: string): Promise<Tier>;
    checkQuota(request: GateRequest): Promise<QuotaVerdict>;
}

/** Run the paywall gate first (cheap, no RPC), then the quota RPC. */
export async function gateGenerative(
    request: GateRequest,
    deps: GateDeps,
): Promise<QuotaVerdict> {
    const tier = await deps.getUserTier(request.clerk_user_id);
    if (!PAID_TIERS.has(tier)) {
        return { allowed: false, reason: "generative_requires_paid_tier", games_used_this_month: 0 };
    }
    return deps.checkQuota(request);
}

// ---- Adapter-side deps (gate + persistence injected into each port) -------

export interface RecordExecutionArgs {
    tool_id: ToolId;
    project_id: string;
    plan_version: number;
    node_id: string;
    trace_id: string;
    cost_usd: number;
    latency_ms: number;
    output: Record<string, unknown>;
}

/** Deps every generative adapter is constructed with: the caller's
 * identity, a gate function, and a cost-recording function. */
export interface GenerativeAdapterDeps {
    clerk_user_id: string;
    gate(request: GateRequest): Promise<QuotaVerdict>;
    recordExecution(args: RecordExecutionArgs): Promise<string>;
}

export class QuotaDeniedError extends Error {
    constructor(readonly reason: string | null) {
        super(`Generative call denied: ${reason ?? "unknown"}`);
        this.name = "QuotaDeniedError";
    }
}

/** Throw if the gate refuses; returns the verdict otherwise. Centralizes
 * the throw so every adapter method gates identically. */
export async function ensureAllowed(
    deps: GenerativeAdapterDeps,
    tool_id: ToolId,
    estimated_cost_usd: number,
    counts_toward_monthly = false,
): Promise<void> {
    const verdict = await deps.gate({
        clerk_user_id: deps.clerk_user_id,
        tool_id,
        estimated_cost_usd,
        counts_toward_monthly,
    });
    if (!verdict.allowed) {
        throw new QuotaDeniedError(verdict.reason);
    }
}
