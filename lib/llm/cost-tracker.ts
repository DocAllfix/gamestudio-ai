/**
 * Per-user generation cost tracker.
 *
 * Accumulates each user's LLM + media generation spend and refuses a
 * charge that would push them past the Free-tier ceiling
 * (`GENERATION_COST_USD_MAX` from the evaluation-metrics contract). The
 * budget is stored in Upstash Redis so it survives across stateless
 * invocations; the store is injected so tests run in-memory and the
 * production path uses the Upstash REST API with zero extra deps.
 */
import { GENERATION_COST_USD_MAX } from "../contracts/evaluation-metrics.contract.js";

/** Minimal counter store the tracker depends on. Implemented by Upstash
 * REST in production and by an in-memory Map in tests. */
export interface CostStore {
    /** Current accumulated value for `key` (0 if unset). */
    get(key: string): Promise<number>;
    /** Atomically add `amount` to `key` and return the new total. */
    incrBy(key: string, amount: number): Promise<number>;
}

export class BudgetExceededError extends Error {
    constructor(
        readonly userId: string,
        readonly attempted: number,
        readonly limit: number,
    ) {
        super(
            `Generation budget exceeded for ${userId}: ` +
                `$${attempted.toFixed(4)} would exceed the $${limit} Free-tier cap`,
        );
        this.name = "BudgetExceededError";
    }
}

const KEY_PREFIX = "cost:generation:";

/** Production CostStore backed by the Upstash Redis REST API. Uses plain
 * `fetch` (zero extra deps); INCRBYFLOAT gives atomic accumulation and
 * GET reads the current total. Values are stored as strings by Redis. */
export function upstashStore(): CostStore {
    const url = process.env.UPSTASH_REDIS_URL;
    const token = process.env.UPSTASH_REDIS_TOKEN;
    if (!url || !token) {
        throw new Error("Missing UPSTASH_REDIS_URL / UPSTASH_REDIS_TOKEN");
    }

    async function command(args: (string | number)[]): Promise<unknown> {
        const res = await fetch(url as string, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify(args),
        });
        if (!res.ok) {
            throw new Error(`Upstash command failed: ${res.status} ${await res.text()}`);
        }
        const body = (await res.json()) as { result?: unknown; error?: string };
        if (body.error) {
            throw new Error(`Upstash error: ${body.error}`);
        }
        return body.result;
    }

    return {
        async get(key) {
            const raw = await command(["GET", key]);
            return raw === null || raw === undefined ? 0 : Number(raw);
        },
        async incrBy(key, amount) {
            const raw = await command(["INCRBYFLOAT", key, amount]);
            return Number(raw);
        },
    };
}

export class CostTracker {
    constructor(
        private readonly store: CostStore,
        private readonly limit: number = GENERATION_COST_USD_MAX,
    ) {}

    /** Total spent by `userId` so far. */
    async spent(userId: string): Promise<number> {
        return this.store.get(KEY_PREFIX + userId);
    }

    /** Reserve `costUsd` against `userId`'s budget. Throws
     * BudgetExceededError without recording if it would breach the cap. */
    async charge(userId: string, costUsd: number): Promise<number> {
        const current = await this.store.get(KEY_PREFIX + userId);
        if (current + costUsd > this.limit) {
            throw new BudgetExceededError(userId, current + costUsd, this.limit);
        }
        return this.store.incrBy(KEY_PREFIX + userId, costUsd);
    }
}
