/**
 * Smoke tests for the 5 BaaS/contract mocks.
 *
 * The goal is to catch the most common failure mode: a mock that
 * silently returns a shape the contract rejects. Each test invokes
 * the mock with a real-shaped input and lets Zod validate the
 * returned object via the contract schema.
 */
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";

import { invokeTool, invokeToolBatch } from "../tools.mock.js";
import { complete, embed } from "../llm.mock.js";
import { runHermesPlan } from "../orchestrator.mock.js";
import { runtimeBuild, pushToItch } from "../runtime.mock.js";
import { clerkMock, stripeMock, r2Mock, e2bMock, triggerMock, posthogMock } from "../baas.mock.js";

import { ToolExecutionResultSchema } from "../../contracts/tool-registry.contract.js";
import { LlmCompleteResponseSchema } from "../llm.mock.js";
import { HermesPlanResponseSchema } from "../../contracts/reasoning-engine.contract.js";
import { AssemblerOutputSchema, ItchPackagerOutputSchema } from "../../contracts/assembly-pipeline.contract.js";

describe("tools.mock", () => {
    it("invokeTool returns a contract-valid succeeded envelope", async () => {
        const res = await invokeTool({
            tool_id: "code_gen_godot_gdscript",
            input: { mechanic: "player_controller" },
            node_id: "n1",
            project_id: "00000000-0000-4000-8000-000000000000",
            plan_version: 1,
            trace_id: "trace_1",
        });
        const parsed = ToolExecutionResultSchema.parse(res);
        expect(parsed.status).toBe("succeeded");
        expect(parsed.qa_log[0]?.passed).toBe(true);
    });

    it("invokeToolBatch fans out", async () => {
        const results = await invokeToolBatch([
            {
                tool_id: "sprite_gen",
                input: {},
                node_id: "n1",
                project_id: "00000000-0000-4000-8000-000000000000",
                plan_version: 1,
                trace_id: "trace_a",
            },
            {
                tool_id: "bgm_gen",
                input: {},
                node_id: "n2",
                project_id: "00000000-0000-4000-8000-000000000000",
                plan_version: 1,
                trace_id: "trace_b",
            },
        ]);
        expect(results).toHaveLength(2);
    });
});

describe("llm.mock", () => {
    it("complete returns a shape-conformant response", async () => {
        const res = await complete({
            model: "deepseek-chat",
            user: "hello",
            trace_id: "t1",
            max_tokens: 100,
            temperature: 0.2,
        });
        const parsed = LlmCompleteResponseSchema.parse(res);
        expect(parsed.model).toBe("deepseek-chat");
        expect(parsed.cost_usd).toBe(0);
    });

    it("embed returns a 1536-dim vector", async () => {
        const vec = await embed("test");
        expect(vec).toHaveLength(1536);
    });

    it("embed throws on empty input", async () => {
        await expect(embed("")).rejects.toThrow();
    });
});

describe("orchestrator.mock", () => {
    it("runHermesPlan returns a contract-valid response", async () => {
        const res = await runHermesPlan({
            user_id: "u_1",
            project_id: null,
            user_prompt: "make a metroidvania",
            moodboard_image_urls: [],
            reference_game_ids: [],
        });
        const parsed = HermesPlanResponseSchema.parse(res);
        expect(parsed.overall_passed).toBe(true);
        expect(parsed.final_plan.meta.engine).toBe("godot");
    });
});

describe("runtime.mock", () => {
    it("runtimeBuild returns a contract-valid AssemblerOutput with smoke result", async () => {
        const res = await runtimeBuild({
            project_id: "00000000-0000-4000-8000-000000000000",
            plan_version: 1,
            engine: "godot",
            tool_outputs: {},
            run_smoke_test: true,
        });
        const parsed = AssemblerOutputSchema.parse(res);
        expect(parsed.smoke_test.ran).toBe(true);
    });

    it("pushToItch returns a contract-valid ItchPackagerOutput", async () => {
        const res = await pushToItch({
            artifact_id: "00000000-0000-4000-8000-000000000000",
            target_url: "https://itch.io/u/dev/game",
            channel: "html5",
            butler_api_key: "fake",
        });
        const parsed = ItchPackagerOutputSchema.parse(res);
        expect(parsed.pushed).toBe(true);
    });
});

describe("baas.mock", () => {
    it("clerkMock returns a fake user", () => {
        const u = clerkMock.currentUser();
        expect(u.id).toMatch(/^user_/);
        expect(clerkMock.isAuthenticated()).toBe(true);
    });

    it("stripeMock createCheckoutSession returns a URL", async () => {
        const s = await stripeMock.createCheckoutSession({
            userId: "u_1",
            priceId: "price_1",
            successUrl: "https://example.com/ok",
            cancelUrl: "https://example.com/ko",
        });
        expect(s.url).toMatch(/^https?:\/\//);
    });

    it("r2Mock putObject + getSignedUrl roundtrip", async () => {
        await r2Mock.putObject({ bucket: "b", key: "k", body: "data" });
        const url = await r2Mock.getSignedUrl({ bucket: "b", key: "k", expiresIn: 60 });
        expect(url).toContain("b/k");
    });

    it("e2bMock writeFile throws on empty path", async () => {
        const sbx = await e2bMock.createSandbox();
        await expect(e2bMock.writeFile(sbx, "", "x")).rejects.toThrow();
        await sbx.close();
    });

    it("triggerMock run returns a runId", async () => {
        const r = await triggerMock.run("my-task", { foo: "bar" });
        expect(r.runId).toMatch(/^run_mock_/);
    });

    it("posthogMock.capture is a no-op without errors", () => {
        expect(() => posthogMock.capture("test", {})).not.toThrow();
    });
});
