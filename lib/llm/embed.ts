/**
 * Text embedding helper.
 *
 * Reuses the lib/knowledge.ts pattern: a single OpenAI embeddings call
 * with `text-embedding-3-small` (1536 dims), so query embeddings here
 * land in the same vector space as the Phase-1 stored chunks. The client
 * is injectable for tests; production lazily constructs it from
 * `OPENAI_API_KEY`.
 */
import OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-small";

/** The slice of the OpenAI SDK `embed()` needs. */
export interface EmbedClient {
    embeddings: {
        create(params: { model: string; input: string }): Promise<{
            data: Array<{ embedding: number[] }>;
        }>;
    };
}

export interface EmbedDeps {
    client?: EmbedClient;
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

let cachedClient: EmbedClient | null = null;
function defaultClient(): EmbedClient {
    if (cachedClient === null) {
        cachedClient = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") }) as unknown as EmbedClient;
    }
    return cachedClient;
}

/** Embed `input` into a 1536-dim vector. Throws on empty input (an empty
 * string is always a caller bug, not a degradable condition). */
export async function embed(input: string, deps: EmbedDeps = {}): Promise<number[]> {
    if (input.length === 0) {
        throw new Error("embed: input must be non-empty");
    }
    const client = deps.client ?? defaultClient();
    const response = await client.embeddings.create({ model: EMBEDDING_MODEL, input });
    const embedding = response.data[0]?.embedding;
    if (!embedding) {
        throw new Error("embed: no embedding returned");
    }
    return embedding;
}
