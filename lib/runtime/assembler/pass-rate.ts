/**
 * Aggregate smoke-test pass rate — Workstream W3 [5-W3].
 *
 * AssemblerOutput carries a single smoke result (one build = one engine =
 * one smoke). The ship gate is a *batch* metric: the smoke-test pass rate
 * across many generated games must meet SMOKE_TEST_PASS_RATE_MIN. This
 * function computes that rate and compares — the threshold is owned by
 * the contract (evaluation-metrics.contract.ts), never redefined here.
 *
 * Only runs whose smoke actually ran count toward the denominator; a
 * skipped smoke ("skip QA" debug build) is not evidence either way. A
 * batch where nothing ran does NOT meet the threshold (nothing verified).
 */
import { SMOKE_TEST_PASS_RATE_MIN } from "../../contracts/evaluation-metrics.contract.js";
import type { AssemblerOutput } from "../../contracts/assembly-pipeline.contract.js";

export interface SmokePassRate {
    /** Runs whose smoke test actually ran (the denominator). */
    total: number;
    /** Of those, how many passed. */
    passed: number;
    /** passed / total, or 0 when nothing ran. */
    rate: number;
    /** rate >= SMOKE_TEST_PASS_RATE_MIN, and at least one run happened. */
    meets_threshold: boolean;
}

export function smokePassRate(batch: AssemblerOutput[]): SmokePassRate {
    const ran = batch.filter((o) => o.smoke_test.ran);
    const total = ran.length;
    const passed = ran.filter((o) => o.smoke_test.passed === true).length;
    const rate = total === 0 ? 0 : passed / total;
    return {
        total,
        passed,
        rate,
        meets_threshold: total > 0 && rate >= SMOKE_TEST_PASS_RATE_MIN,
    };
}
