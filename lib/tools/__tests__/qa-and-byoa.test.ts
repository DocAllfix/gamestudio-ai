/**
 * code_validator / project_validator (engine-specific static checks) and
 * byoa_analyzer (Vision over a user image → palette/style for style pack).
 * The vision call is injected; validators are pure.
 */
import { describe, expect, it, vi } from "vitest";

import codeValidator from "../qa/code-validator/index.js";
import projectValidator from "../qa/project-validator/index.js";
import byoaAnalyzer from "../extras/byoa-analyzer/index.js";
import { ToolExecutionResultSchema } from "../../contracts/tool-registry.contract.js";

const base = {
    node_id: "n1",
    project_id: "00000000-0000-4000-8000-000000000000",
    plan_version: 1,
    trace_id: "trace_qa",
};

describe("code_validator", () => {
    it("passes balanced source and returns a contract-valid result", async () => {
        const res = await codeValidator.handler({
            ...base,
            tool_id: "code_validator",
            input: { engine: "godot", code: "func _ready():\n\tprint(\"hi\")\n" },
        });
        expect(() => ToolExecutionResultSchema.parse(res)).not.toThrow();
        expect(res.status).toBe("succeeded");
    });

    it("rejects unbalanced braces via qa_log", async () => {
        const res = await codeValidator.handler({
            ...base,
            tool_id: "code_validator",
            input: { engine: "threejs", code: "function f() { return 1;" },
        });
        expect(res.status).toBe("rejected_by_qa");
        expect(res.qa_log.some((q) => !q.passed)).toBe(true);
    });
});

describe("project_validator", () => {
    it("flags a missing required entrypoint file", async () => {
        const res = await projectValidator.handler({
            ...base,
            tool_id: "project_validator",
            input: { engine: "godot", files: ["scenes/player.tscn"] },
        });
        expect(res.status).toBe("rejected_by_qa");
    });

    it("passes when the required entrypoint is present", async () => {
        const res = await projectValidator.handler({
            ...base,
            tool_id: "project_validator",
            input: { engine: "godot", files: ["project.godot", "scenes/player.tscn"] },
        });
        expect(res.status).toBe("succeeded");
    });
});

describe("byoa_analyzer", () => {
    it("returns a palette/style descriptor from the vision call", async () => {
        const analyze = vi.fn(async () => ({
            trace_id: "trace_qa",
            model: "gpt-4o" as const,
            output: { palette: ["#112233", "#445566"], style_descriptor: "dark pixel" },
            cost_usd: 0,
            latency_ms: 1,
            tokens_in: 1,
            tokens_out: 1,
            cache_hit: false,
        }));
        const res = await byoaAnalyzer.handler(
            { ...base, tool_id: "byoa_analyzer", input: { image_url: "https://example.com/x.png" } },
            { complete: analyze },
        );
        expect(() => ToolExecutionResultSchema.parse(res)).not.toThrow();
        expect(res.output?.palette).toEqual(["#112233", "#445566"]);
    });
});
