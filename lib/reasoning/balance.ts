/**
 * D.4 Balance Controller (PARTE D.4).
 *
 * Clamps `plan.rules` into the per-genre `rules_ranges` (sourced from
 * the seeded genre_templates row). Every clamp is recorded as an
 * adjustment {rule_name, before, after, reason} for UI explainability.
 *
 * A range is either a numeric {min,max} (clamp) or an array of allowed
 * values (enum: snap to the first allowed value when the current one is
 * not in the set). Rules with no range entry are left untouched.
 */
import {
    type BalanceController,
    type BalanceControllerInput,
    type BalanceControllerOutput,
    BalanceControllerInputSchema,
} from "../contracts/reasoning-engine.contract.js";
import { type GamePlan } from "../contracts/game-plan.contract.js";

type RuleValue = GamePlan["rules"][string];
type Range = BalanceControllerInput["rules_ranges"][string];
type Adjustment = BalanceControllerOutput["adjustments"][number];

/** Clamp one rule against its range. Returns the (possibly unchanged)
 * value plus an adjustment when it had to move. */
function clampRule(
    name: string,
    value: RuleValue,
    range: Range,
): { value: RuleValue; adjustment: Adjustment | null } {
    if (Array.isArray(range)) {
        if (range.includes(value as string | number)) {
            return { value, adjustment: null };
        }
        const fallback = range[0]!;
        return {
            value: fallback,
            adjustment: {
                rule_name: name,
                before: value,
                after: fallback,
                reason: `"${String(value)}" not in allowed values; snapped to "${String(fallback)}"`,
            },
        };
    }

    // Numeric {min,max}. Non-numeric values can't be clamped numerically;
    // leave them as-is (a range mismatch is a plan-authoring error, not
    // something the balancer silently coerces).
    if (typeof value !== "number") {
        return { value, adjustment: null };
    }

    const clamped = Math.min(Math.max(value, range.min), range.max);
    if (clamped === value) {
        return { value, adjustment: null };
    }
    const bound = clamped === range.min ? "min" : "max";
    return {
        value: clamped,
        adjustment: {
            rule_name: name,
            before: value,
            after: clamped,
            reason: `clamped to ${bound} (${range.min}-${range.max})`,
        },
    };
}

export const balanceController: BalanceController = {
    async balance(
        rawInput: BalanceControllerInput,
    ): Promise<BalanceControllerOutput> {
        const input = BalanceControllerInputSchema.parse(rawInput);

        const balancedRules: GamePlan["rules"] = { ...input.plan.rules };
        const adjustments: Adjustment[] = [];

        for (const [name, value] of Object.entries(input.plan.rules)) {
            const range = input.rules_ranges[name];
            if (range === undefined) continue;
            const { value: next, adjustment } = clampRule(name, value, range);
            balancedRules[name] = next;
            if (adjustment) adjustments.push(adjustment);
        }

        return {
            balanced_plan: { ...input.plan, rules: balancedRules },
            adjustments,
            memory: input.memory,
        };
    },
};
