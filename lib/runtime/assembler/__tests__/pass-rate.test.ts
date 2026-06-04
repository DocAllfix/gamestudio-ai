/**
 * Tests for smokePassRate (lib/runtime/assembler/pass-rate.ts) — the
 * [5-W3] aggregate gate. The threshold itself is owned by the contract
 * (evaluation-metrics.contract.ts: SMOKE_TEST_PASS_RATE_MIN = 0.95); this
 * module only computes the rate over a batch and compares.
 */
import { describe, expect, it } from "vitest";

import { SMOKE_TEST_PASS_RATE_MIN } from "../../../contracts/evaluation-metrics.contract.js";
import type { AssemblerOutput } from "../../../contracts/assembly-pipeline.contract.js";
import { smokePassRate } from "../pass-rate.js";

function out(ran: boolean, passed: boolean | null): AssemblerOutput {
    return {
        artifact_id: "00000000-0000-4000-8000-000000000000",
        download_url: "https://r2.example.com/a.zip",
        size_bytes: 1,
        build_log: "",
        smoke_test: { ran, passed, crash_reason: null, duration_ms: ran ? 1 : null },
        total_duration_ms: 1,
    };
}

describe("smokePassRate", () => {
    it("uses the contract threshold (0.95), not a local copy", () => {
        expect(SMOKE_TEST_PASS_RATE_MIN).toBe(0.95);
    });

    it("computes rate over runs that actually ran and meets the threshold at 100%", () => {
        const batch = [out(true, true), out(true, true), out(true, true)];
        const r = smokePassRate(batch);
        expect(r.total).toBe(3);
        expect(r.passed).toBe(3);
        expect(r.rate).toBe(1);
        expect(r.meets_threshold).toBe(true);
    });

    it("fails the gate below 0.95 (19/20 = 0.95 passes, 18/20 = 0.9 fails)", () => {
        const pass19 = Array.from({ length: 19 }, () => out(true, true));
        const exactly95 = smokePassRate([...pass19, out(true, false)]);
        expect(exactly95.rate).toBeCloseTo(0.95, 5);
        expect(exactly95.meets_threshold).toBe(true);

        const pass18 = Array.from({ length: 18 }, () => out(true, true));
        const below = smokePassRate([...pass18, out(true, false), out(true, false)]);
        expect(below.rate).toBeCloseTo(0.9, 5);
        expect(below.meets_threshold).toBe(false);
    });

    it("ignores skipped (ran=false) runs in the denominator", () => {
        const r = smokePassRate([out(true, true), out(false, null), out(false, null)]);
        expect(r.total).toBe(1);
        expect(r.rate).toBe(1);
    });

    it("does not meet the threshold when nothing ran (rate=0, total=0)", () => {
        const r = smokePassRate([out(false, null)]);
        expect(r.total).toBe(0);
        expect(r.rate).toBe(0);
        expect(r.meets_threshold).toBe(false);
    });
});
