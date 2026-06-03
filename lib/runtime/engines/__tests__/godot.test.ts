/**
 * Tests for the Godot EngineAdapter (lib/runtime/engines/godot.ts).
 *
 * Godot Web export is headless WASM: build = `godot --headless
 * --export-release` to a Web preset + coi-serviceworker injection, then
 * verify the expected export files exist; smokeTest = load the WASM
 * headless and crash-detect via a JSON-line runner.
 *
 * Driven by the programmable fake sandbox + r2Mock (no network, no real
 * Godot toolchain).
 */
import { describe, expect, it } from "vitest";

import { e2bMock, r2Mock } from "../../../_mocks/baas.mock.js";
import { makeFakeSandbox } from "./_fake-sandbox.js";
import { GodotAdapter, GODOT_EXPECTED_FILES, GODOT_SMOKE_RUNNER } from "../godot.js";

const deps = { e2b: e2bMock, r2: r2Mock, bucket: "game-builds" };

/** A fake where every `test -f <expected>` succeeds → all files present. */
function healthyExportSandbox() {
    return makeFakeSandbox([
        { match: "--export-release", exit_code: 0, stdout: "exported" },
        { match: "test -f", exit_code: 0 },
    ]);
}

describe("GodotAdapter", () => {
    const adapter = new GodotAdapter(deps);

    it("declares engine = godot", () => {
        expect(adapter.engine).toBe("godot");
    });

    it("build() exports WASM, injects coi-serviceworker, and verifies expected files", async () => {
        const sandbox = healthyExportSandbox();
        const res = await adapter.build(sandbox);

        expect(res.exit_code).toBe(0);
        // headless export invoked
        expect(sandbox.commands.some((c) => c.includes("--headless") && c.includes("--export-release"))).toBe(true);
        // coi-serviceworker injected for cross-origin isolation (SharedArrayBuffer)
        expect(sandbox.commands.some((c) => c.includes("coi-serviceworker"))).toBe(true);
        // every expected Web-export file was checked
        for (const f of GODOT_EXPECTED_FILES) {
            expect(sandbox.commands.some((c) => c.includes("test -f") && c.includes(f))).toBe(true);
        }
    });

    it("build() fails (non-zero) when an expected export file is missing", async () => {
        const sandbox = makeFakeSandbox([
            { match: "--export-release", exit_code: 0 },
            { match: "index.wasm", exit_code: 1 }, // the .wasm is missing
            { match: "test -f", exit_code: 0 }, // others present
        ]);
        const res = await adapter.build(sandbox);
        expect(res.exit_code).not.toBe(0);
        expect(res.stderr).toContain("index.wasm");
    });

    it("smokeTest() → passed=true when the headless WASM load reports no crash", async () => {
        const sandbox = makeFakeSandbox([
            { match: GODOT_SMOKE_RUNNER, exit_code: 0, stdout: '{"passed":true,"crash_reason":null}' },
        ]);
        const res = await adapter.smokeTest(sandbox);
        expect(res.passed).toBe(true);
        expect(res.crash_reason).toBeNull();
    });

    it("smokeTest() → passed=false, crash_reason!=null on a WASM crash", async () => {
        const sandbox = makeFakeSandbox([
            {
                match: GODOT_SMOKE_RUNNER,
                exit_code: 0,
                stdout: '{"passed":false,"crash_reason":"RuntimeError: abort() at wasm"}',
            },
        ]);
        const res = await adapter.smokeTest(sandbox);
        expect(res.passed).toBe(false);
        expect(res.crash_reason).toContain("abort");
    });

    it("package() → BuildArtifact tagged engine=godot", async () => {
        const sandbox = makeFakeSandbox([{ match: "zip", exit_code: 0 }]);
        const art = await adapter.package(sandbox);
        expect(art.download_url).toMatch(/^https?:\/\//);
        expect(art.metadata.engine).toBe("godot");
    });
});
