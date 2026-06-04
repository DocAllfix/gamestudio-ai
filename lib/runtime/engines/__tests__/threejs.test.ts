/**
 * Tests for the Three.js EngineAdapter (lib/runtime/engines/threejs.ts).
 *
 * Three.js is browser-native like Phaser; it shares the
 * BrowserEngineAdapter behaviour. We assert the same build / smokeTest /
 * package contract under the `threejs` engine id, driven by the
 * programmable fake sandbox + r2Mock (no network).
 */
import { describe, expect, it } from "vitest";

import { e2bMock, r2Mock } from "../../../_mocks/baas.mock.js";
import { makeFakeSandbox } from "./_fake-sandbox.js";
import { ThreejsAdapter, SMOKE_RUNNER_PATH } from "../threejs.js";

describe("ThreejsAdapter", () => {
    const adapter = new ThreejsAdapter({ e2b: e2bMock, r2: r2Mock, bucket: "game-builds" });

    it("declares engine = threejs", () => {
        expect(adapter.engine).toBe("threejs");
    });

    it("build() returns exit_code 0 on a healthy project", async () => {
        const sandbox = makeFakeSandbox([{ match: "esbuild", exit_code: 0 }]);
        const res = await adapter.build(sandbox);
        expect(res.exit_code).toBe(0);
        expect(sandbox.commands.some((c) => c.includes("esbuild"))).toBe(true);
    });

    it("smokeTest() → passed=true on a healthy bundle", async () => {
        const sandbox = makeFakeSandbox([
            { match: SMOKE_RUNNER_PATH, exit_code: 0, stdout: '{"passed":true,"crash_reason":null}' },
        ]);
        const res = await adapter.smokeTest(sandbox);
        expect(res.passed).toBe(true);
        expect(res.crash_reason).toBeNull();
    });

    it("smokeTest() → passed=false, crash_reason!=null on a throwing bundle", async () => {
        const sandbox = makeFakeSandbox([
            {
                match: SMOKE_RUNNER_PATH,
                exit_code: 0,
                stdout: '{"passed":false,"crash_reason":"TypeError: scene.add is not a function"}',
            },
        ]);
        const res = await adapter.smokeTest(sandbox);
        expect(res.passed).toBe(false);
        expect(res.crash_reason).toContain("TypeError");
    });

    it("package() → BuildArtifact tagged engine=threejs", async () => {
        const sandbox = makeFakeSandbox([{ match: "zip", exit_code: 0 }]);
        const art = await adapter.package(sandbox);
        expect(art.download_url).toMatch(/^https?:\/\//);
        expect(art.metadata.engine).toBe("threejs");
    });
});
