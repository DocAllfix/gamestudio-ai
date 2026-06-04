/**
 * Tests for the Phaser EngineAdapter (lib/runtime/engines/phaser.ts).
 *
 * Phaser is browser-native JS/TS: build ≈ esbuild bundle, smokeTest =
 * headless Chromium runner that loads the bundle ~10s and reports
 * console errors / crashes as a single JSON line, package = .zip → R2.
 *
 * We drive every outcome from a programmable fake sandbox (_fake-sandbox)
 * and inject `r2Mock` for package() — no network, no real toolchain.
 */
import { describe, expect, it } from "vitest";

import { e2bMock, r2Mock } from "../../../_mocks/baas.mock.js";
import { makeFakeSandbox } from "./_fake-sandbox.js";
import { PhaserAdapter, SMOKE_RUNNER_PATH } from "../phaser.js";

describe("PhaserAdapter", () => {
    const adapter = new PhaserAdapter({ e2b: e2bMock, r2: r2Mock, bucket: "game-builds" });

    it("declares engine = phaser", () => {
        expect(adapter.engine).toBe("phaser");
    });

    it("build() returns exit_code 0 on a healthy project", async () => {
        const sandbox = makeFakeSandbox([{ match: "esbuild", exit_code: 0 }]);
        const res = await adapter.build(sandbox);
        expect(res.exit_code).toBe(0);
        // build must invoke the bundler
        expect(sandbox.commands.some((c) => c.includes("esbuild"))).toBe(true);
    });

    it("build() surfaces a non-zero exit on a broken project", async () => {
        const sandbox = makeFakeSandbox([
            { match: "esbuild", exit_code: 1, stderr: "Build failed: syntax error" },
        ]);
        const res = await adapter.build(sandbox);
        expect(res.exit_code).toBe(1);
        expect(res.stderr).toContain("Build failed");
    });

    it("smokeTest() → passed=true on a healthy bundle", async () => {
        const sandbox = makeFakeSandbox([
            { match: SMOKE_RUNNER_PATH, exit_code: 0, stdout: '{"passed":true,"crash_reason":null}' },
        ]);
        const res = await adapter.smokeTest(sandbox);
        expect(res.passed).toBe(true);
        expect(res.crash_reason).toBeNull();
        expect(res.duration_ms).toBeGreaterThanOrEqual(0);
    });

    it("smokeTest() → passed=false, crash_reason!=null on a throwing bundle", async () => {
        const sandbox = makeFakeSandbox([
            {
                match: SMOKE_RUNNER_PATH,
                exit_code: 0,
                stdout: '{"passed":false,"crash_reason":"ReferenceError: foo is not defined"}',
            },
        ]);
        const res = await adapter.smokeTest(sandbox);
        expect(res.passed).toBe(false);
        expect(res.crash_reason).not.toBeNull();
        expect(res.crash_reason).toContain("ReferenceError");
    });

    it("smokeTest() → passed=false when the runner itself crashes (non-zero, no JSON)", async () => {
        const sandbox = makeFakeSandbox([
            { match: SMOKE_RUNNER_PATH, exit_code: 137, stdout: "", stderr: "Killed" },
        ]);
        const res = await adapter.smokeTest(sandbox);
        expect(res.passed).toBe(false);
        expect(res.crash_reason).not.toBeNull();
    });

    it("package() zips and uploads → BuildArtifact with a download_url", async () => {
        const sandbox = makeFakeSandbox([{ match: "zip", exit_code: 0 }]);
        const art = await adapter.package(sandbox);
        expect(art.artifact_id.length).toBeGreaterThan(0);
        expect(art.download_url).toMatch(/^https?:\/\//);
        expect(art.size_bytes).toBeGreaterThanOrEqual(0);
        expect(art.metadata.engine).toBe("phaser");
    });
});
