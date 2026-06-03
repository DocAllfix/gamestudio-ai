/**
 * D.4 Balance Controller — [2-W1].
 *
 * Clamps plan.rules into the per-genre rules_ranges. A numeric rule
 * outside [min,max] is clamped and recorded in adjustments; a rule
 * already in range is left untouched and produces no adjustment.
 */
import { describe, expect, it } from "vitest";

import {
    BalanceControllerOutputSchema,
    type BalanceControllerInput,
    HermesMemorySchema,
} from "../../contracts/reasoning-engine.contract.js";
import { type GamePlan } from "../../contracts/game-plan.contract.js";
import { templateSkeleton } from "../baseline.js";
import { balanceController } from "../balance.js";

const memory = HermesMemorySchema.parse({});

function planWith(rules: GamePlan["rules"]): GamePlan {
    const base = templateSkeleton(
        "00000000-0000-0000-0000-000000000000",
        "hardcore_platformer",
        "godot",
        "Test",
    );
    return { ...base, rules };
}

function input(
    plan: GamePlan,
    rules_ranges: BalanceControllerInput["rules_ranges"],
): BalanceControllerInput {
    return { plan, rules_ranges, memory };
}

describe("D.4 BalanceController.balance", () => {
    it("clamps a numeric rule above max and records the adjustment", async () => {
        const out = await balanceController.balance(
            input(planWith({ enemy_dmg: 999 }), {
                enemy_dmg: { min: 5, max: 50 },
            }),
        );
        expect(out.balanced_plan.rules.enemy_dmg).toBe(50);
        const adj = out.adjustments.find((a) => a.rule_name === "enemy_dmg");
        expect(adj).toBeDefined();
        expect(adj?.before).toBe(999);
        expect(adj?.after).toBe(50);
    });

    it("clamps a numeric rule below min", async () => {
        const out = await balanceController.balance(
            input(planWith({ player_hp: 1 }), {
                player_hp: { min: 50, max: 200 },
            }),
        );
        expect(out.balanced_plan.rules.player_hp).toBe(50);
    });

    it("leaves an in-range rule untouched and emits no adjustment for it", async () => {
        const out = await balanceController.balance(
            input(planWith({ player_hp: 100 }), {
                player_hp: { min: 50, max: 200 },
            }),
        );
        expect(out.balanced_plan.rules.player_hp).toBe(100);
        expect(out.adjustments.find((a) => a.rule_name === "player_hp")).toBeUndefined();
    });

    it("ignores rules that have no range entry", async () => {
        const out = await balanceController.balance(
            input(planWith({ score_per_kill: 10 }), {
                player_hp: { min: 50, max: 200 },
            }),
        );
        expect(out.balanced_plan.rules.score_per_kill).toBe(10);
    });

    it("round-trips the output through its contract", async () => {
        const out = await balanceController.balance(
            input(planWith({ enemy_dmg: 999 }), {
                enemy_dmg: { min: 5, max: 50 },
            }),
        );
        expect(() =>
            BalanceControllerOutputSchema.parse(out),
        ).not.toThrow();
    });
});
