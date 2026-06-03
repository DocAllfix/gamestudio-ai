/**
 * [5-W1] Flywheel EMA — usage_events → success_score.
 *
 * Verifies: (1) the canonical EMA formula new = old*0.95 + (success?1:0)
 * *0.05; (2) monotonic growth toward 1 under repeated success; (3) the
 * documented event→success map; (4) recordUsageEvent fans the update out
 * to update_episodic_memory (per skill) + increment_asset_usage (per
 * asset), against a fake Supabase that mirrors migration 005's RPC math.
 */
import { describe, expect, it } from "vitest";

import {
    emaUpdate,
    eventSuccess,
    recordUsageEvent,
    type FlywheelEvent,
} from "../flywheel.js";

const USER = "00000000-0000-0000-0000-0000000000aa";

describe("emaUpdate (canonical formula)", () => {
    it("applies new = old*0.95 + 0.05 on a success from 0", () => {
        expect(emaUpdate(0, true)).toBeCloseTo(0.05, 10);
    });

    it("applies new = old*0.95 on a failure", () => {
        expect(emaUpdate(0.5, false)).toBeCloseTo(0.475, 10);
    });

    it("grows monotonically toward 1 under repeated success", () => {
        let score = 0;
        let prev = -1;
        for (let i = 0; i < 200; i++) {
            score = emaUpdate(score, true);
            expect(score).toBeGreaterThan(prev);
            expect(score).toBeLessThanOrEqual(1);
            prev = score;
        }
        expect(score).toBeGreaterThan(0.9); // converges toward 1
    });
});

describe("eventSuccess (documented event→success map)", () => {
    it("treats game_completed / exported / fork as success=true", () => {
        expect(eventSuccess("game_completed")).toBe(true);
        expect(eventSuccess("game_exported_itch")).toBe(true);
        expect(eventSuccess("fork")).toBe(true);
    });

    it("treats a regeneration (plan_refined) as success=false", () => {
        expect(eventSuccess("plan_refined")).toBe(false);
    });

    it("returns null for events that do not feed the flywheel", () => {
        expect(eventSuccess("upgrade_clicked")).toBeNull();
    });
});

/** Fake Supabase mirroring update_episodic_memory + increment_asset_usage. */
function fakeSupabase() {
    const skills = new Map<string, { success_score: number; times_used: number }>();
    const assets: Array<{ asset_id: string; success: boolean }> = [];
    return {
        skills,
        assets,
        rpc(name: string, args: Record<string, unknown>) {
            if (name === "update_episodic_memory") {
                const key = `${args.p_user_id}:${args.p_skill_name}`;
                const prev = skills.get(key) ?? { success_score: 0, times_used: 0 };
                const next = emaUpdate(prev.success_score, args.p_success as boolean);
                skills.set(key, { success_score: next, times_used: prev.times_used + 1 });
                return Promise.resolve({ data: next, error: null });
            }
            if (name === "increment_asset_usage") {
                assets.push({ asset_id: args.p_asset_id as string, success: args.p_success as boolean });
                return Promise.resolve({ data: null, error: null });
            }
            return Promise.resolve({ data: null, error: { message: `unknown rpc ${name}` } });
        },
    };
}

function event(overrides: Partial<FlywheelEvent> = {}): FlywheelEvent {
    return {
        user_id: USER,
        event_name: "game_completed",
        skill_names: ["code_gen_godot_gdscript"],
        asset_ids: [],
        ...overrides,
    };
}

describe("recordUsageEvent", () => {
    it("raises a skill's success_score by the EMA on a success event", async () => {
        const supabase = fakeSupabase();
        const res = await recordUsageEvent({
            supabase: supabase as never,
            event: event({ skill_names: ["s1"] }),
        });
        expect(res.applied).toBe(true);
        expect(res.skill_scores.s1).toBeCloseTo(0.05, 10);
    });

    it("a second success event grows the score monotonically", async () => {
        const supabase = fakeSupabase();
        const first = await recordUsageEvent({
            supabase: supabase as never,
            event: event({ skill_names: ["s1"] }),
        });
        const second = await recordUsageEvent({
            supabase: supabase as never,
            event: event({ skill_names: ["s1"] }),
        });
        expect(second.skill_scores.s1).toBeGreaterThan(first.skill_scores.s1!);
    });

    it("fans out to increment_asset_usage for each used asset", async () => {
        const supabase = fakeSupabase();
        await recordUsageEvent({
            supabase: supabase as never,
            event: event({ asset_ids: ["a1", "a2"] }),
        });
        expect(supabase.assets.map((a) => a.asset_id).sort()).toEqual(["a1", "a2"]);
        expect(supabase.assets.every((a) => a.success)).toBe(true);
    });

    it("does nothing for an event that doesn't feed the flywheel", async () => {
        const supabase = fakeSupabase();
        const res = await recordUsageEvent({
            supabase: supabase as never,
            event: event({ event_name: "upgrade_clicked", skill_names: ["s1"] }),
        });
        expect(res.applied).toBe(false);
        expect(supabase.skills.size).toBe(0);
    });
});
