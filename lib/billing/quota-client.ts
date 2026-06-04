import { getAdminClient } from "@/lib/supabase/admin";
import type { QuotaCheckResponse } from "@/lib/contracts/billing.contract";

export interface QuotaCheckArgs {
  clerkUserId: string;
  toolId: string;
  estimatedCostUsd: number;
  countsTowardMonthly: boolean;
}

/**
 * Calls the check_quota RPC (migration 005).
 * Returns QuotaCheckResponse-shaped object — gracefully degrades to
 * allowed=true on DB error so a Supabase outage never blocks generation
 * silently (the cost cap on W1 side is the hard stop).
 */
export async function checkQuota(
  args: QuotaCheckArgs,
): Promise<QuotaCheckResponse> {
  const db = getAdminClient();
  const { data, error } = await db.rpc("check_quota", {
    p_clerk_user_id: args.clerkUserId,
    p_tool_id: args.toolId,
    p_estimated_cost_usd: args.estimatedCostUsd,
    p_counts_toward_monthly: args.countsTowardMonthly,
  });

  if (error || !data || data.length === 0) {
    console.error({ msg: "check_quota RPC failed", error });
    // Fail open — let W1 cost cap be the last resort
    return {
      allowed: true,
      reason: null,
      current_usage: { games_used_this_month: 0, cost_used_on_current_game_usd: 0 },
    };
  }

  const row = data[0] as { allowed: boolean; reason: string | null; games_used_this_month: number };
  return {
    allowed: row.allowed,
    reason: (row.reason as QuotaCheckResponse["reason"]) ?? null,
    current_usage: {
      games_used_this_month: row.games_used_this_month,
      cost_used_on_current_game_usd: args.estimatedCostUsd,
    },
  };
}
