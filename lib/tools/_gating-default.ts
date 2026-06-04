/**
 * Production wiring for the generative gating layer.
 *
 * Builds GenerativeAdapterDeps backed by the real Supabase RPCs
 * (check_quota, record_tool_execution) and a tier lookup on the `users`
 * table. The adapters never import Supabase directly — they receive
 * these deps, so tests inject fakes and only this file touches the DB.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
    GateDeps,
    GateRequest,
    GenerativeAdapterDeps,
    QuotaVerdict,
    RecordExecutionArgs,
    Tier,
} from "./_gating.js";
import { gateGenerative } from "./_gating.js";

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

let cached: SupabaseClient | null = null;
function supabase(): SupabaseClient {
    if (cached === null) {
        cached = createClient(
            requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
            requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
        );
    }
    return cached;
}

const realGateDeps: GateDeps = {
    async getUserTier(clerk_user_id: string): Promise<Tier> {
        const { data, error } = await supabase()
            .from("users")
            .select("tier")
            .eq("clerk_user_id", clerk_user_id)
            .single();
        if (error || !data) {
            // Fail closed: unknown user → cheapest tier → paywall denies.
            console.error({ context: "gating.getUserTier", clerk_user_id, error });
            return "free";
        }
        return data.tier as Tier;
    },
    async checkQuota(request: GateRequest): Promise<QuotaVerdict> {
        const { data, error } = await supabase().rpc("check_quota", {
            p_clerk_user_id: request.clerk_user_id,
            p_tool_id: request.tool_id,
            p_estimated_cost_usd: request.estimated_cost_usd,
            p_counts_toward_monthly: request.counts_toward_monthly ?? false,
        });
        if (error || !data || data.length === 0) {
            console.error({ context: "gating.checkQuota", request, error });
            return { allowed: false, reason: "quota_check_failed", games_used_this_month: 0 };
        }
        const row = data[0] as QuotaVerdict;
        return { allowed: row.allowed, reason: row.reason, games_used_this_month: row.games_used_this_month };
    },
};

async function realRecordExecution(args: RecordExecutionArgs): Promise<string> {
    const { data, error } = await supabase().rpc("record_tool_execution", {
        p_project_id: args.project_id,
        p_plan_version: args.plan_version,
        p_tool_id: args.tool_id,
        p_node_id: args.node_id,
        p_trace_id: args.trace_id,
        p_input: {},
        p_output: args.output,
        p_status: "succeeded",
        p_cost_usd: args.cost_usd,
        p_latency_ms: args.latency_ms,
        p_qa_log: [],
        p_error_message: null,
    });
    if (error) {
        console.error({ context: "gating.recordExecution", args, error });
        return "";
    }
    return (data as string) ?? "";
}

/** Build the adapter deps for a given Clerk user, wired to real RPCs. */
export function makeAdapterDeps(clerk_user_id: string): GenerativeAdapterDeps {
    return {
        clerk_user_id,
        gate: (request) => gateGenerative(request, realGateDeps),
        recordExecution: realRecordExecution,
    };
}
