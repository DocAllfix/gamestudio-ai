/**
 * code_gen tools — engine-specific source generation grounded in RAG.
 *
 * Godot/Defold have dense KB → must call getReferences(). Babylon must
 * NOT harvest the KB (Phase-1 pipeline frozen) and instead uses curated
 * in-prompt grounding. The router and KB client are injected; no network.
 */
import { describe, expect, it, vi } from "vitest";

import godotCodeGen from "../code/godot/index.js";
import babylonCodeGen from "../code/babylon/index.js";
import { ToolExecutionResultSchema } from "../../contracts/tool-registry.contract.js";
import type { CodeReference, ReferenceQuery } from "../../types.js";

const baseInvocation = {
    node_id: "n1",
    project_id: "00000000-0000-4000-8000-000000000000",
    plan_version: 1,
    trace_id: "trace_cg",
};

function fakeComplete(code = "extends Node\nfunc _ready():\n\tpass") {
    return vi.fn(async () => ({
        trace_id: "trace_cg",
        model: "deepseek-chat" as const,
        output: { code, language: "gdscript", filename: "player.gd", notes: "" },
        cost_usd: 0,
        latency_ms: 1,
        tokens_in: 1,
        tokens_out: 1,
        cache_hit: false,
    }));
}

describe("code_gen_godot_gdscript", () => {
    it("calls getReferences() for RAG grounding", async () => {
        const getReferences = vi.fn(async (_query: ReferenceQuery): Promise<CodeReference[]> => []);
        await godotCodeGen.handler(
            { ...baseInvocation, tool_id: "code_gen_godot_gdscript", input: { mechanic: "player_controller" } },
            { getReferences, complete: fakeComplete() },
        );
        expect(getReferences).toHaveBeenCalledTimes(1);
        expect(getReferences.mock.calls[0]?.[0].engine).toBe("godot");
    });

    it("returns a contract-valid ToolExecutionResult", async () => {
        const res = await godotCodeGen.handler(
            { ...baseInvocation, tool_id: "code_gen_godot_gdscript", input: { mechanic: "player_controller" } },
            { getReferences: vi.fn(async () => []), complete: fakeComplete() },
        );
        expect(() => ToolExecutionResultSchema.parse(res)).not.toThrow();
        expect(res.status).toBe("succeeded");
    });
});

describe("code_gen_babylon_ts", () => {
    it("does NOT call getReferences() (KB harvest is frozen for Babylon)", async () => {
        const getReferences = vi.fn(async () => []);
        await babylonCodeGen.handler(
            { ...baseInvocation, tool_id: "code_gen_babylon_ts", input: { mechanic: "load a gltf scene" } },
            {
                getReferences,
                complete: fakeComplete("import { Engine } from '@babylonjs/core';"),
            },
        );
        expect(getReferences).not.toHaveBeenCalled();
    });

    it("returns a contract-valid ToolExecutionResult", async () => {
        const res = await babylonCodeGen.handler(
            { ...baseInvocation, tool_id: "code_gen_babylon_ts", input: { mechanic: "load a gltf scene" } },
            { getReferences: vi.fn(async () => []), complete: fakeComplete("import { Engine } from '@babylonjs/core';") },
        );
        expect(() => ToolExecutionResultSchema.parse(res)).not.toThrow();
    });
});
