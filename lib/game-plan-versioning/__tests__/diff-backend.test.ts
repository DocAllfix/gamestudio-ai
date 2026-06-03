/**
 * game-plan-versioning [3-W1] — RFC 6902 apply + apply_game_plan_diff
 * wrapper with optimistic concurrency.
 *
 * The RPC itself is exercised against a fake Supabase client that
 * mirrors migration 005's apply_game_plan_diff: it inserts a
 * game_plan_versions row and raises `parent_version_mismatch` when the
 * project's latest version != the patch's parent_version. This tests
 * OUR wrapper's behavior (correct args + error propagation) offline,
 * without a live DB.
 */
import { describe, expect, it } from "vitest";

import {
    type GamePlanPatch,
    type GamePlan,
} from "../../contracts/game-plan.contract.js";
import { templateSkeleton } from "../../reasoning/baseline.js";
import { applyRfc6902, persistGamePlanDiff } from "../diff-backend.js";

const PROJECT_ID = "11111111-1111-1111-1111-111111111111";

function seedPlan(): GamePlan {
    const base = templateSkeleton(PROJECT_ID, "hardcore_platformer", "godot", "Seed");
    return base;
}

function patch(parent_version: number, ops: GamePlanPatch["ops"]): GamePlanPatch {
    return { project_id: PROJECT_ID, parent_version, ops, summary: "test patch" };
}

/** Fake Supabase mirroring apply_game_plan_diff from migration 005. */
function fakeSupabase(initialLatest: number) {
    const rows: Array<{ version_no: number }> = [];
    let latest = initialLatest;
    return {
        rows,
        rpc(name: string, args: Record<string, unknown>) {
            if (name !== "apply_game_plan_diff") {
                return Promise.resolve({ data: null, error: { message: `unknown rpc ${name}` } });
            }
            if (args.p_parent_version !== latest) {
                return Promise.resolve({
                    data: null,
                    error: {
                        message: `parent_version_mismatch: expected ${args.p_parent_version}, found ${latest}`,
                    },
                });
            }
            const version_no = args.p_new_version as number;
            rows.push({ version_no });
            latest = version_no;
            return Promise.resolve({ data: "row-uuid", error: null });
        },
    };
}

describe("applyRfc6902", () => {
    it("applies a replace op and returns the new materialized plan", () => {
        const plan = seedPlan();
        const next = applyRfc6902(plan, [
            { op: "replace", path: "/meta/title", value: "Renamed" },
        ]);
        expect(next.meta.title).toBe("Renamed");
        expect(plan.meta.title).toBe("Seed"); // original untouched
    });

    it("applies an add op into the rules object", () => {
        const next = applyRfc6902(seedPlan(), [
            { op: "add", path: "/rules/score_per_kill", value: 50 },
        ]);
        expect(next.rules.score_per_kill).toBe(50);
    });

    it("applies a remove op", () => {
        const next = applyRfc6902(seedPlan(), [
            { op: "remove", path: "/rules/enemy_dmg" },
        ]);
        expect(next.rules.enemy_dmg).toBeUndefined();
    });
});

describe("persistGamePlanDiff", () => {
    it("creates a new game_plan_versions row at parent_version+1", async () => {
        const supabase = fakeSupabase(1);
        const result = await persistGamePlanDiff({
            supabase: supabase as never,
            parentPlan: seedPlan(),
            patch: patch(1, [{ op: "replace", path: "/meta/title", value: "v2" }]),
        });
        expect(result.new_version).toBe(2);
        expect(supabase.rows).toHaveLength(1);
        expect(supabase.rows[0]?.version_no).toBe(2);
    });

    it("raises parent_version_mismatch when the project moved on (optimistic CC)", async () => {
        const supabase = fakeSupabase(3); // project already at v3
        await expect(
            persistGamePlanDiff({
                supabase: supabase as never,
                parentPlan: seedPlan(),
                patch: patch(1, [{ op: "replace", path: "/meta/title", value: "stale" }]),
            }),
        ).rejects.toThrow(/parent_version_mismatch/);
        expect(supabase.rows).toHaveLength(0);
    });
});
