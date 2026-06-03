/**
 * Tests for lib/llm/embed.ts.
 *
 * Mirrors the lib/knowledge.ts embedding pattern (text-embedding-3-small,
 * 1536 dims). The OpenAI client is injected so no network is hit.
 */
import { describe, expect, it, vi } from "vitest";

import { embed, type EmbedClient } from "../embed.js";

function fakeEmbedClient(vector: number[]): EmbedClient {
    return {
        embeddings: {
            create: vi.fn(async () => ({ data: [{ embedding: vector }] })),
        },
    };
}

describe("embed", () => {
    it("returns the embedding vector from the client", async () => {
        const vec = new Array<number>(1536).fill(0.1);
        const res = await embed("hello", { client: fakeEmbedClient(vec) });
        expect(res).toHaveLength(1536);
        expect(res[0]).toBe(0.1);
    });

    it("throws on empty input", async () => {
        await expect(embed("", { client: fakeEmbedClient([]) })).rejects.toThrow();
    });

    it("requests the text-embedding-3-small model", async () => {
        const client = fakeEmbedClient(new Array<number>(1536).fill(0));
        await embed("x", { client });
        const create = client.embeddings.create as ReturnType<typeof vi.fn>;
        expect(create.mock.calls[0][0].model).toBe("text-embedding-3-small");
    });
});
