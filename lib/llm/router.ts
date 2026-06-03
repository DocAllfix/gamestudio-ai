/**
 * LLM Router — the W2-owned adapter of the LlmPort surface.
 *
 * Every Phase-2 LLM call goes through `complete()`: it builds the
 * chat-completions payload, calls an OpenAI-compatible client (Azure AI
 * Foundry primary, OpenRouter as the alternative behind a flag), and
 * Zod-validates the structured output against the caller's
 * `response_schema`. Helicone is intentionally NOT used (maintenance
 * mode — see lib/tools/CLAUDE.md §6).
 *
 * Claude-on-Azure constraint: the chat-completions deployments for
 * `claude-*` reject `temperature` / `top_k` / `thinking`; `top_p` must
 * be 0.99. `buildChatParams()` enforces this and is unit-tested in
 * isolation so the rule can't silently regress.
 *
 * The request/response schemas live here and are re-exported by
 * `lib/_mocks/llm.mock.ts`, keeping the mock a drop-in for the real
 * router (Supreme Plan §07 merge contract).
 */
import OpenAI from "openai";
import { z, type ZodType } from "zod";

// ---- Port schemas (canonical; the mock re-exports these) -----------------

/** Models the router accepts. Mapped to Azure deployment names via
 * `AZURE_DEPLOYMENT_ENV[model]`. Routing policy (≥60% bulk/code →
 * DeepSeek, reasoning → Claude Sonnet) is the caller's decision; the
 * router faithfully dispatches whatever model id it is handed. */
export const ModelIdEnum = z.enum([
    "deepseek-chat", // default cheap (bulk / code)
    "deepseek-reasoner",
    "claude-sonnet-4-7", // reasoning
    "claude-haiku-4-5",
    "gpt-4o-mini",
    "gpt-4o",
    "gemini-2.5-flash",
]);
export type ModelId = z.infer<typeof ModelIdEnum>;

export const LlmCompleteRequestSchema = z.object({
    model: ModelIdEnum,
    system: z.string().optional(),
    user: z.string().min(1),
    response_schema: z.unknown().optional(),
    max_tokens: z.number().int().min(1).max(64000).default(2048),
    temperature: z.number().min(0).max(2).default(0.2),
    trace_id: z.string().min(1),
});
export type LlmCompleteRequest = z.infer<typeof LlmCompleteRequestSchema>;

export const LlmCompleteResponseSchema = z.object({
    trace_id: z.string().min(1),
    model: ModelIdEnum,
    output: z.unknown(),
    cost_usd: z.number().min(0),
    latency_ms: z.number().int().min(0),
    tokens_in: z.number().int().min(0),
    tokens_out: z.number().int().min(0),
    cache_hit: z.boolean(),
});
export type LlmCompleteResponse = z.infer<typeof LlmCompleteResponseSchema>;

// ---- Client surface (injectable for tests) -------------------------------

/** The slice of the OpenAI SDK the router calls. Keeping it a structural
 * interface lets tests pass a fake without a live endpoint. */
export interface ChatClient {
    chat: {
        completions: {
            create(params: ChatParams): Promise<{
                choices: Array<{ message: { content: string | null } }>;
                usage?: { prompt_tokens?: number; completion_tokens?: number };
            }>;
        };
    };
}

export interface ChatParams {
    model: string;
    messages: Array<{ role: "system" | "user"; content: string }>;
    max_tokens: number;
    top_p?: number;
    temperature?: number;
}

export interface CompleteDeps {
    /** Override the underlying client (tests / OpenRouter path). */
    client?: ChatClient;
}

// ---- Payload shaping ------------------------------------------------------

function isClaude(model: ModelId): boolean {
    return model.startsWith("claude-");
}

/** Build the chat-completions params for `model`. For `claude-*` it omits
 * temperature / top_k / thinking and pins top_p=0.99 (Azure constraint);
 * for every other model it forwards the requested temperature. */
export function buildChatParams(
    model: ModelId,
    request: LlmCompleteRequest,
): ChatParams {
    const messages: ChatParams["messages"] = [];
    if (request.system) {
        messages.push({ role: "system", content: request.system });
    }
    messages.push({ role: "user", content: request.user });

    const base: ChatParams = {
        model: azureDeployment(model),
        messages,
        max_tokens: request.max_tokens,
    };

    if (isClaude(model)) {
        return { ...base, top_p: 0.99 };
    }
    return { ...base, temperature: request.temperature };
}

// ---- Azure / OpenRouter client wiring ------------------------------------

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

/** Maps a logical model id to its Azure deployment name. Each model has
 * its own deployment env so the same code path serves gpt / deepseek /
 * claude without branching. Falls back to the model id itself. */
function azureDeployment(model: ModelId): string {
    const envName = `AZURE_OPENAI_DEPLOYMENT_${model.toUpperCase().replace(/[-.]/g, "_")}`;
    return process.env[envName] ?? process.env.AZURE_OPENAI_DEPLOYMENT ?? model;
}

let cachedClient: ChatClient | null = null;
/** Default client: Azure AI Foundry, or OpenRouter when
 * `LLM_ROUTER_PROVIDER=openrouter`. Neither path uses Helicone. */
function defaultClient(): ChatClient {
    if (cachedClient) {
        return cachedClient;
    }
    if (process.env.LLM_ROUTER_PROVIDER === "openrouter") {
        cachedClient = new OpenAI({
            apiKey: requireEnv("OPENROUTER_API_KEY"),
            baseURL: "https://openrouter.ai/api/v1",
        }) as unknown as ChatClient;
    } else {
        cachedClient = new OpenAI({
            apiKey: requireEnv("AZURE_OPENAI_API_KEY"),
            baseURL: requireEnv("AZURE_OPENAI_V1_ENDPOINT"),
            defaultQuery: { "api-version": requireEnv("AZURE_OPENAI_API_VERSION") },
            defaultHeaders: { "api-key": requireEnv("AZURE_OPENAI_API_KEY") },
        }) as unknown as ChatClient;
    }
    return cachedClient;
}

// ---- complete() ----------------------------------------------------------

function parseStructured(content: string, schema: unknown): unknown {
    let json: unknown;
    try {
        json = JSON.parse(content);
    } catch (error) {
        throw new Error(`LLM output was not valid JSON: ${(error as Error).message}`);
    }
    return (schema as ZodType).parse(json);
}

/** Run one chat completion. When `response_schema` is provided the model
 * output is JSON-parsed and validated against it (structured output);
 * otherwise the raw text is returned. */
export async function complete(
    request: LlmCompleteRequest,
    deps: CompleteDeps = {},
): Promise<LlmCompleteResponse> {
    const parsed = LlmCompleteRequestSchema.parse(request);
    const client = deps.client ?? defaultClient();
    const params = buildChatParams(parsed.model, parsed);

    const start = Date.now();
    let completion;
    try {
        completion = await client.chat.completions.create(params);
    } catch (error) {
        console.error({ context: "llm.router.complete", model: parsed.model, trace_id: parsed.trace_id, error });
        throw error;
    }
    const latency_ms = Date.now() - start;

    const content = completion.choices[0]?.message.content ?? "";
    const output = parsed.response_schema
        ? parseStructured(content, parsed.response_schema)
        : content;

    return LlmCompleteResponseSchema.parse({
        trace_id: parsed.trace_id,
        model: parsed.model,
        output,
        cost_usd: 0,
        latency_ms,
        tokens_in: completion.usage?.prompt_tokens ?? 0,
        tokens_out: completion.usage?.completion_tokens ?? 0,
        cache_hit: false,
    });
}
