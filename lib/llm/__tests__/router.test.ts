/**
 * Tests for the real LLM router (lib/llm/router.ts).
 *
 * The router is the W2-owned adapter of the LlmPort surface. The mock
 * (lib/_mocks/llm.mock.ts) mirrors it; these tests pin the real
 * behavior the mock promises plus the Azure/Claude payload rules.
 *
 * No network: the OpenAI-compatible client is injected as a fake.
 */
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
    complete,
    buildChatParams,
    LlmCompleteResponseSchema,
    type ChatClient,
} from "../router.js";

/** Minimal fake of the OpenAI-compatible chat client the router calls. */
function fakeClient(content: string, usage = { prompt_tokens: 10, completion_tokens: 5 }): ChatClient {
    return {
        chat: {
            completions: {
                create: vi.fn(async () => ({
                    choices: [{ message: { content } }],
                    usage,
                })),
            },
        },
    };
}

describe("buildChatParams", () => {
    it("omits temperature/top_k/thinking and pins top_p=0.99 for claude models", () => {
        const params = buildChatParams("claude-sonnet-4-7", {
            model: "claude-sonnet-4-7",
            user: "hi",
            max_tokens: 100,
            temperature: 0.7,
            trace_id: "t1",
        });
        expect(params).not.toHaveProperty("temperature");
        expect(params).not.toHaveProperty("top_k");
        expect(params).not.toHaveProperty("thinking");
        expect(params.top_p).toBe(0.99);
    });

    it("keeps temperature for non-claude models", () => {
        const params = buildChatParams("deepseek-chat", {
            model: "deepseek-chat",
            user: "hi",
            max_tokens: 100,
            temperature: 0.7,
            trace_id: "t1",
        });
        expect(params.temperature).toBe(0.7);
    });
});

describe("complete", () => {
    it("returns a response that response_schema.parse() accepts", async () => {
        const schema = z.object({ greeting: z.string() });
        const client = fakeClient(JSON.stringify({ greeting: "hello" }));

        const res = await complete(
            {
                model: "deepseek-chat",
                user: "say hi as json",
                response_schema: schema,
                max_tokens: 100,
                temperature: 0.2,
                trace_id: "t1",
            },
            { client },
        );

        const envelope = LlmCompleteResponseSchema.parse(res);
        expect(() => schema.parse(envelope.output)).not.toThrow();
        expect((envelope.output as { greeting: string }).greeting).toBe("hello");
    });

    it("returns raw text when no response_schema is given", async () => {
        const client = fakeClient("just text");
        const res = await complete(
            { model: "deepseek-chat", user: "hi", max_tokens: 100, temperature: 0.2, trace_id: "t2" },
            { client },
        );
        expect(res.output).toBe("just text");
    });

    it("does not send temperature for claude-* in the actual call payload", async () => {
        const client = fakeClient("ok");
        await complete(
            { model: "claude-sonnet-4-7", user: "hi", max_tokens: 100, temperature: 0.9, trace_id: "t3" },
            { client },
        );
        const createMock = client.chat.completions.create as ReturnType<typeof vi.fn>;
        const payload = createMock.mock.calls[0][0];
        expect(payload).not.toHaveProperty("temperature");
        expect(payload.top_p).toBe(0.99);
    });
});
