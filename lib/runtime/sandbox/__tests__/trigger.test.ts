/**
 * Tests for the Trigger.dev assembly job entrypoint
 * (lib/runtime/sandbox/trigger.ts).
 *
 * The entrypoint is the enqueue side of the long assembly job: it
 * contract-validates the AssemblerInput, then dispatches the task via the
 * injected client. We inject `triggerMock` (baas.mock.ts) so the suite
 * runs with no network and no real @trigger.dev/sdk installed. The actual
 * build logic lands in [5-W3]'s Assembler.
 */
import { describe, expect, it } from "vitest";

import { triggerMock } from "../../../_mocks/baas.mock.js";
import { ASSEMBLY_TASK_ID, enqueueAssembly } from "../trigger.js";
import type { AssemblerInput } from "../../../contracts/assembly-pipeline.contract.js";

const validInput: AssemblerInput = {
    project_id: "00000000-0000-4000-8000-000000000000",
    plan_version: 1,
    engine: "godot",
    tool_outputs: {
        n1: {
            tool_id: "code_gen_godot_gdscript",
            files: [{ path: "main.gd", content: "extends Node", encoding: "utf-8" }],
        },
    },
    run_smoke_test: true,
};

describe("trigger.dev assembly entrypoint", () => {
    it("enqueues a valid AssemblerInput and returns a runId", async () => {
        const res = await enqueueAssembly(triggerMock, validInput);
        expect(res.run_id).toMatch(/^run_mock_/);
        expect(res.run_id).toContain(ASSEMBLY_TASK_ID);
    });

    it("rejects a malformed AssemblerInput before dispatching", async () => {
        const bad = { ...validInput, project_id: "not-a-uuid" } as AssemblerInput;
        await expect(enqueueAssembly(triggerMock, bad)).rejects.toThrow();
    });

    it("applies run_smoke_test default when omitted", async () => {
        // run_smoke_test has a Zod default(true); omitting it must not throw.
        const { run_smoke_test: _omit, ...partial } = validInput;
        const res = await enqueueAssembly(
            triggerMock,
            partial as unknown as AssemblerInput,
        );
        expect(res.run_id).toMatch(/^run_mock_/);
    });
});
