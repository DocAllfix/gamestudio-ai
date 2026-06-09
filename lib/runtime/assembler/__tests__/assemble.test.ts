/**
 * Tests for the real Assembler (lib/runtime/assembler/assemble.ts) — the
 * [5-W3] replacement for runtimeBuild in runtime.mock.ts.
 *
 * assemble() boots a sandbox via the resolved EngineAdapter, writes the
 * DAG tool_outputs into the sandbox FS, builds, optionally smoke-tests,
 * packages to R2, and returns a contract-valid AssemblerOutput.
 *
 * We inject a stub EngineAdapter so each path (build ok/fail, smoke
 * on/off, smoke pass/fail) is driven from the test with no network.
 */
import { describe, expect, it, vi } from "vitest";

import {
    AssemblerOutputSchema,
    type AssemblerInput,
    type BuildArtifact,
    type CommandResult,
    type EngineAdapter,
    type SandboxHandle,
    type SmokeTestResult,
    type WebBuildArtifact,
} from "../../../contracts/assembly-pipeline.contract.js";
import { assemble } from "../assemble.js";

/** A scriptable EngineAdapter stub recording the files written. */
function stubAdapter(overrides: Partial<EngineAdapter> = {}): EngineAdapter & {
    written: { path: string; content: string | Buffer }[];
} {
    const written: { path: string; content: string | Buffer }[] = [];
    const handle: SandboxHandle = { id: "sbx_stub", close: vi.fn(async () => {}) };
    const okBuild: CommandResult = { exit_code: 0, stdout: "built", stderr: "", duration_ms: 5 };
    const okSmoke: SmokeTestResult = { passed: true, crash_reason: null, duration_ms: 7, logs: "" };
    const artifact: BuildArtifact = {
        artifact_id: "11111111-1111-4111-8111-111111111111",
        download_url: "https://r2.example.com/a.zip",
        size_bytes: 2048,
        metadata: { engine: "phaser" },
    };
    const web: WebBuildArtifact = {
        iframe_url: "https://r2.example.com/i.html",
        bundle_size_bytes: 2048,
        target: "browser",
        mobile_apk_url: null,
    };
    return {
        engine: "phaser",
        written,
        async bootSandbox() { return handle; },
        async writeFile(_s, path, content) { written.push({ path, content }); },
        async runCommand() { return okBuild; },
        async build() { return okBuild; },
        async smokeTest() { return okSmoke; },
        async package() { return artifact; },
        async webExport() { return web; },
        ...overrides,
    };
}

const baseInput: AssemblerInput = {
    project_id: "00000000-0000-4000-8000-000000000000",
    plan_version: 1,
    engine: "phaser",
    tool_outputs: {
        n1: {
            tool_id: "code_gen_phaser",
            files: [
                { path: "src/main.js", content: "new Phaser.Game({ scene: {} }); // hi", encoding: "utf-8" },
            ],
        },
        n2: {
            tool_id: "sprite_gen",
            files: [
                { path: "assets/hero.png", content: "aGVsbG8=", encoding: "base64" },
            ],
        },
    },
    run_smoke_test: true,
};

describe("assemble()", () => {
    it("returns a contract-valid AssemblerOutput on the happy path", async () => {
        const adapter = stubAdapter();
        const out = await assemble(baseInput, adapter);
        const parsed = AssemblerOutputSchema.parse(out);
        expect(parsed.smoke_test.ran).toBe(true);
        expect(parsed.smoke_test.passed).toBe(true);
        expect(parsed.download_url).toMatch(/^https?:\/\//);
        expect(parsed.total_duration_ms).toBeGreaterThanOrEqual(0);
    });

    it("scaffolds the engine project from the tool outputs into the sandbox", async () => {
        const adapter = stubAdapter();
        await assemble(baseInput, adapter);
        const paths = adapter.written.map((w) => w.path);
        // Phaser scaffold: the code_gen source becomes the esbuild entry, an
        // index.html is added so the bundle is playable, and asset files pass
        // through verbatim.
        expect(paths).toContain("/project/src/main.js");
        expect(paths).toContain("/project/dist/index.html");
        expect(paths).toContain("assets/hero.png");
        // The entry holds the generated gameplay source.
        const entry = adapter.written.find((w) => w.path === "/project/src/main.js");
        expect(entry?.content).toBe("new Phaser.Game({ scene: {} }); // hi");
    });

    it("skips the smoke test when run_smoke_test=false", async () => {
        const adapter = stubAdapter();
        const out = await assemble({ ...baseInput, run_smoke_test: false }, adapter);
        const parsed = AssemblerOutputSchema.parse(out);
        expect(parsed.smoke_test.ran).toBe(false);
        expect(parsed.smoke_test.passed).toBeNull();
    });

    it("reports a failing smoke (passed=false, crash_reason) without throwing", async () => {
        const adapter = stubAdapter({
            async smokeTest(): Promise<SmokeTestResult> {
                return { passed: false, crash_reason: "boom", duration_ms: 3, logs: "trace" };
            },
        });
        const out = await assemble(baseInput, adapter);
        const parsed = AssemblerOutputSchema.parse(out);
        expect(parsed.smoke_test.passed).toBe(false);
        expect(parsed.smoke_test.crash_reason).toBe("boom");
    });

    it("throws on a build failure (non-zero exit) and still closes the sandbox", async () => {
        const closeSpy = vi.fn(async () => {});
        const adapter = stubAdapter({
            async bootSandbox(): Promise<SandboxHandle> {
                return { id: "sbx_close", close: closeSpy };
            },
            async build(): Promise<CommandResult> {
                return { exit_code: 1, stdout: "", stderr: "compile error", duration_ms: 2 };
            },
        });
        await expect(assemble(baseInput, adapter)).rejects.toThrow(/build/i);
        expect(closeSpy).toHaveBeenCalled();
    });
});
