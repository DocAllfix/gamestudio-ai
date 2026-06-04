/**
 * Tests for the E2B sandbox wrapper (lib/runtime/sandbox/e2b.ts).
 *
 * The wrapper adapts the E2B SDK shape into the contract's
 * SandboxHandle / CommandResult. We inject `e2bMock` from baas.mock.ts
 * so the suite runs with no network and no real `e2b` SDK installed.
 */
import { describe, expect, it } from "vitest";

import { e2bMock } from "../../../_mocks/baas.mock.js";
import { bootSandbox } from "../e2b.js";

describe("e2b sandbox wrapper", () => {
    it("boot → writeFile → runCommand returns a valid CommandResult", async () => {
        const sandbox = await bootSandbox(e2bMock);

        expect(sandbox.id).toMatch(/^sbx_mock_/);

        await sandbox.writeFile("/game/main.gd", "extends Node\n");

        const result = await sandbox.runCommand("godot --version");

        expect(result.exit_code).toBe(0);
        expect(typeof result.stdout).toBe("string");
        expect(result.stdout).toContain("godot --version");
        expect(typeof result.stderr).toBe("string");
        expect(result.duration_ms).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(result.duration_ms)).toBe(true);

        await sandbox.close();
    });

    it("writeFile propagates an empty-path error from the client", async () => {
        const sandbox = await bootSandbox(e2bMock);
        await expect(sandbox.writeFile("", "x")).rejects.toThrow();
        await sandbox.close();
    });

    it("close is idempotent and releases the sandbox", async () => {
        const sandbox = await bootSandbox(e2bMock);
        await sandbox.close();
        await expect(sandbox.close()).resolves.toBeUndefined();
    });
});
