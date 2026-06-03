/**
 * Tests for the per-user cost tracker (lib/llm/cost-tracker.ts).
 *
 * The tracker accumulates per-user generation spend and blocks once a
 * charge would push the user past GENERATION_COST_USD_MAX (the Free-tier
 * ceiling from evaluation-metrics.contract.ts). Redis transport is
 * injected as an in-memory fake — no network.
 */
import { describe, expect, it } from "vitest";

import { CostTracker, BudgetExceededError, type CostStore } from "../cost-tracker.js";
import { GENERATION_COST_USD_MAX } from "../../contracts/evaluation-metrics.contract.js";

/** In-memory CostStore: a Map keyed by the same string the tracker uses. */
function memoryStore(): CostStore {
    const data = new Map<string, number>();
    return {
        async get(key) {
            return data.get(key) ?? 0;
        },
        async incrBy(key, amount) {
            const next = (data.get(key) ?? 0) + amount;
            data.set(key, next);
            return next;
        },
    };
}

describe("CostTracker", () => {
    it("allows a charge under the threshold and records it", async () => {
        const tracker = new CostTracker(memoryStore());
        await tracker.charge("user_1", 0.5);
        expect(await tracker.spent("user_1")).toBeCloseTo(0.5);
    });

    it("throws BudgetExceededError when a charge would exceed the threshold", async () => {
        const tracker = new CostTracker(memoryStore());
        await tracker.charge("user_1", GENERATION_COST_USD_MAX - 0.1);
        await expect(tracker.charge("user_1", 0.5)).rejects.toBeInstanceOf(BudgetExceededError);
    });

    it("does not record the spend when a charge is rejected", async () => {
        const store = memoryStore();
        const tracker = new CostTracker(store);
        await tracker.charge("user_1", GENERATION_COST_USD_MAX - 0.1);
        await tracker.charge("user_1", 0.5).catch(() => {});
        expect(await tracker.spent("user_1")).toBeCloseTo(GENERATION_COST_USD_MAX - 0.1);
    });

    it("tracks users independently", async () => {
        const tracker = new CostTracker(memoryStore());
        await tracker.charge("user_1", 1.0);
        await tracker.charge("user_2", 0.2);
        expect(await tracker.spent("user_2")).toBeCloseTo(0.2);
    });
});
