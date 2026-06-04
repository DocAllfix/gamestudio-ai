/**
 * Episodic Memory / Flywheel ([5-W1]) — closes the self-improvement loop.
 *
 * When a real user value-event lands in `usage_events`, the engine
 * updates two success signals:
 *   - per (user, skill): RPC `update_episodic_memory` — the Voyager EMA
 *     `new = old*0.95 + (success?1:0)*0.05` (migration 005);
 *   - per asset used in the generation: RPC `increment_asset_usage`
 *     (migration 003).
 *
 * EVENT → SUCCESS MAP (documented, source of truth here):
 *   - game_completed       → success=true   (player finished the game)
 *   - game_exported_itch   → success=true   (creator shipped it)
 *   - fork                 → success=true   (third party reused it;
 *                            requires migration 006 applied)
 *   - plan_refined         → success=false  (a regeneration: the prior
 *                            output wasn't good enough → negative signal)
 *   - anything else        → null           (does not feed the flywheel)
 *
 * `success` is therefore a REAL user signal, never engine self-validation
 * (cf. WOW_CONTRACT §5): D.6 passing its own gate does not move the score.
 *
 * The Supabase client is injected (DI), matching lib/game-plan-versioning
 * — keeps the path pure of env at import time and testable offline.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { type UsageEvent } from "../contracts/billing.contract.js";

type EventName = UsageEvent["event_name"];

/** Canonical Voyager EMA, mirroring migration 005's update_episodic_memory.
 * Kept here as the W1-side source of truth for the formula. */
export function emaUpdate(oldScore: number, success: boolean): number {
    return oldScore * 0.95 + (success ? 1 : 0) * 0.05;
}

/** Map a usage event to its flywheel success signal, or null when the
 * event does not feed success_score. */
export function eventSuccess(eventName: EventName): boolean | null {
    switch (eventName) {
        case "game_completed":
        case "game_exported_itch":
        case "fork":
            return true;
        case "plan_refined":
            return false;
        default:
            return null;
    }
}

/** The flywheel-relevant slice of a usage event: who, what, and the
 * skills + assets that produced the generation being judged. */
export interface FlywheelEvent {
    user_id: string;
    event_name: EventName;
    /** Skills exercised in the generation (e.g. tool ids). */
    skill_names: string[];
    /** Catalog asset ids used in the generation. */
    asset_ids: string[];
}

export interface RecordEventArgs {
    supabase: SupabaseClient;
    event: FlywheelEvent;
}

export interface RecordEventResult {
    /** False when the event does not feed the flywheel (no-op). */
    applied: boolean;
    /** New success_score per skill, keyed by skill_name. */
    skill_scores: Record<string, number>;
}

/** Fan a value-event out to the two success-score RPCs. A non-flywheel
 * event is a no-op. RPC failures are logged and skipped (graceful
 * degradation): one failing skill update must not lose the others. */
export async function recordUsageEvent(
    args: RecordEventArgs,
): Promise<RecordEventResult> {
    const { supabase, event } = args;
    const success = eventSuccess(event.event_name);
    if (success === null) {
        return { applied: false, skill_scores: {} };
    }

    const skillScores: Record<string, number> = {};
    for (const skill of event.skill_names) {
        const { data, error } = await supabase.rpc("update_episodic_memory", {
            p_user_id: event.user_id,
            p_skill_name: skill,
            p_success: success,
        });
        if (error) {
            console.error({ context: "recordUsageEvent.skill", skill, error });
            continue;
        }
        skillScores[skill] = data as number;
    }

    for (const assetId of event.asset_ids) {
        const { error } = await supabase.rpc("increment_asset_usage", {
            p_asset_id: assetId,
            p_success: success,
        });
        if (error) {
            console.error({ context: "recordUsageEvent.asset", assetId, error });
        }
    }

    return { applied: true, skill_scores: skillScores };
}
