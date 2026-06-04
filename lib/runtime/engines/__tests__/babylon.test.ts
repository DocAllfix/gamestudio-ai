/**
 * Tests for the Babylon EngineAdapter (lib/runtime/engines/babylon.ts).
 *
 * Babylon's unique server-side verification: smokeTest runs the scene in
 * BABYLON.NullEngine (no GPU/canvas) in Node inside the sandbox, advances
 * N frames, and reports exceptions/crashes as one JSON line. build = TS
 * bundle, package = zip → R2.
 *
 * Driven by the programmable fake sandbox + r2Mock (no network, no real
 * Babylon packages).
 */
import { describe, expect, it } from "vitest";

import { e2bMock, r2Mock } from "../../../_mocks/baas.mock.js";
import { makeFakeSandbox } from "./_fake-sandbox.js";
import {
    BabylonAdapter,
    BABYLON_SMOKE_RUNNER,
    BABYLON_SMOKE_FRAMES,
} from "../babylon.js";

const deps = { e2b: e2bMock, r2: r2Mock, bucket: "game-builds" };

describe("BabylonAdapter", () => {
    const adapter = new BabylonAdapter(deps);

    it("declares engine = babylon", () => {
        expect(adapter.engine).toBe("babylon");
    });

    it("advances a positive number of frames in the smoke", () => {
        expect(BABYLON_SMOKE_FRAMES).toBeGreaterThan(0);
    });

    it("build() bundles the TS entry and returns exit_code 0 on a healthy project", async () => {
        const sandbox = makeFakeSandbox([{ match: "esbuild", exit_code: 0 }]);
        const res = await adapter.build(sandbox);
        expect(res.exit_code).toBe(0);
        expect(sandbox.commands.some((c) => c.includes("esbuild"))).toBe(true);
    });

    it("build() surfaces a non-zero exit on a TS compile/bundle error", async () => {
        const sandbox = makeFakeSandbox([
            { match: "esbuild", exit_code: 1, stderr: "TS2322: type error" },
        ]);
        const res = await adapter.build(sandbox);
        expect(res.exit_code).toBe(1);
        expect(res.stderr).toContain("TS2322");
    });

    it("smokeTest() → passed=true when NullEngine advances the frames cleanly", async () => {
        const sandbox = makeFakeSandbox([
            {
                match: BABYLON_SMOKE_RUNNER,
                exit_code: 0,
                stdout: '{"passed":true,"crash_reason":null}',
            },
        ]);
        const res = await adapter.smokeTest(sandbox);
        expect(res.passed).toBe(true);
        expect(res.crash_reason).toBeNull();
        // the NullEngine runner ran with the configured frame count
        expect(
            sandbox.commands.some(
                (c) => c.includes(BABYLON_SMOKE_RUNNER) && c.includes(String(BABYLON_SMOKE_FRAMES)),
            ),
        ).toBe(true);
    });

    it("smokeTest() → passed=false, crash_reason!=null when the scene throws", async () => {
        const sandbox = makeFakeSandbox([
            {
                match: BABYLON_SMOKE_RUNNER,
                exit_code: 0,
                stdout: '{"passed":false,"crash_reason":"TypeError: Cannot read properties of undefined (reading \'position\')"}',
            },
        ]);
        const res = await adapter.smokeTest(sandbox);
        expect(res.passed).toBe(false);
        expect(res.crash_reason).not.toBeNull();
        expect(res.crash_reason).toContain("TypeError");
    });

    it("smokeTest() → passed=false when the NullEngine runner process itself crashes", async () => {
        const sandbox = makeFakeSandbox([
            { match: BABYLON_SMOKE_RUNNER, exit_code: 1, stdout: "", stderr: "Segmentation fault" },
        ]);
        const res = await adapter.smokeTest(sandbox);
        expect(res.passed).toBe(false);
        expect(res.crash_reason).not.toBeNull();
    });

    it("package() → BuildArtifact tagged engine=babylon", async () => {
        const sandbox = makeFakeSandbox([{ match: "zip", exit_code: 0 }]);
        const art = await adapter.package(sandbox);
        expect(art.download_url).toMatch(/^https?:\/\//);
        expect(art.metadata.engine).toBe("babylon");
    });
});
