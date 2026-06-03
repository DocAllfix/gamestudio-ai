/**
 * Tests for the Defold EngineAdapter (lib/runtime/engines/defold.ts).
 *
 * Defold builds with bob.jar headless and exports a native Android .apk
 * (the day-1 .apk prerogative, WOW §3). smokeTest = Defold's official
 * headless smoke "without graphics/sound", which prints a JSON line.
 *
 * Driven by the programmable fake sandbox + r2Mock (no network, no real
 * bob/JDK toolchain).
 */
import { describe, expect, it } from "vitest";

import { e2bMock, r2Mock } from "../../../_mocks/baas.mock.js";
import { makeFakeSandbox } from "./_fake-sandbox.js";
import { DefoldAdapter, DEFOLD_APK_PATH, DEFOLD_SMOKE_RUNNER } from "../defold.js";

const deps = { e2b: e2bMock, r2: r2Mock, bucket: "game-builds" };

describe("DefoldAdapter", () => {
    const adapter = new DefoldAdapter(deps);

    it("declares engine = defold", () => {
        expect(adapter.engine).toBe("defold");
    });

    it("build() runs bob.jar headless, exports an Android .apk, and verifies it exists", async () => {
        const sandbox = makeFakeSandbox([
            { match: "bob.jar", exit_code: 0, stdout: "bundle ok" },
            { match: "test -f", exit_code: 0 }, // .apk present
        ]);
        const res = await adapter.build(sandbox);

        expect(res.exit_code).toBe(0);
        expect(sandbox.commands.some((c) => c.includes("bob.jar"))).toBe(true);
        // Android platform requested
        expect(sandbox.commands.some((c) => c.includes("armv7-android") || c.includes("android"))).toBe(true);
        // the produced .apk was verified
        expect(sandbox.commands.some((c) => c.includes("test -f") && c.includes(DEFOLD_APK_PATH))).toBe(true);
    });

    it("build() fails (non-zero) when the .apk is not produced", async () => {
        const sandbox = makeFakeSandbox([
            { match: "bob.jar", exit_code: 0 },
            { match: "test -f", exit_code: 1 }, // .apk missing
        ]);
        const res = await adapter.build(sandbox);
        expect(res.exit_code).not.toBe(0);
        expect(res.stderr).toContain(".apk");
    });

    it("smokeTest() → passed=true on the headless 'no graphics/sound' smoke", async () => {
        const sandbox = makeFakeSandbox([
            { match: DEFOLD_SMOKE_RUNNER, exit_code: 0, stdout: '{"passed":true,"crash_reason":null}' },
        ]);
        const res = await adapter.smokeTest(sandbox);
        expect(res.passed).toBe(true);
        expect(res.crash_reason).toBeNull();
    });

    it("smokeTest() → passed=false, crash_reason!=null when the headless smoke aborts", async () => {
        const sandbox = makeFakeSandbox([
            {
                match: DEFOLD_SMOKE_RUNNER,
                exit_code: 0,
                stdout: '{"passed":false,"crash_reason":"ERROR:GAMEOBJECT: instance failed"}',
            },
        ]);
        const res = await adapter.smokeTest(sandbox);
        expect(res.passed).toBe(false);
        expect(res.crash_reason).toContain("GAMEOBJECT");
    });

    it("package() → BuildArtifact tagged engine=defold", async () => {
        const sandbox = makeFakeSandbox([{ match: "zip", exit_code: 0 }]);
        const art = await adapter.package(sandbox);
        expect(art.download_url).toMatch(/^https?:\/\//);
        expect(art.metadata.engine).toBe("defold");
    });
});
