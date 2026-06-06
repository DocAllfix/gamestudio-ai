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
    "gpt-4.1-mini", // Azure deployment (design enhancement); ≠ gpt-4o-mini
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
    response_format?: { type: "json_object" };
}

export interface CompleteDeps {
    /** Override the underlying client (tests / OpenRouter path). */
    client?: ChatClient;
    /** Optional tracer: when present, every LLM call is recorded (prompt,
     * response, model, tokens, latency, error) for audit + Langfuse. */
    tracer?: {
        record(step: {
            phase: "llm_call";
            status: "succeeded" | "failed";
            tool_id?: string;
            input?: unknown;
            output?: unknown;
            model?: string;
            latency_ms?: number;
            prompt_tokens?: number;
            completion_tokens?: number;
            error?: string;
        }): Promise<void>;
    };
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
    viaOpenRouter = false,
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
    // JSON mode: force a JSON object so the model returns parseable JSON (no
    // prose preamble like "Looking at the requirements..."). Available for
    // non-Claude on Azure AND for Claude on OpenRouter (OpenRouter supports it);
    // only Claude-on-Azure can't take it.
    if (request.response_schema && (!isClaude(model) || viaOpenRouter)) {
        base.response_format = { type: "json_object" };
    }

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

let cachedOpenRouter: ChatClient | null = null;
/** OpenRouter client for models Azure doesn't host (Claude). Lets us route
 * claude-* to OpenRouter while keeping gpt/deepseek on Azure. */
function openRouterClient(): ChatClient {
    if (cachedOpenRouter) return cachedOpenRouter;
    cachedOpenRouter = new OpenAI({
        apiKey: requireEnv("OPENROUTER_API_KEY"),
        baseURL: "https://openrouter.ai/api/v1",
    }) as unknown as ChatClient;
    return cachedOpenRouter;
}

/** Map our model id to the OpenRouter model slug. */
function openRouterModel(model: ModelId): string {
    switch (model) {
        case "claude-sonnet-4-7": return "anthropic/claude-sonnet-4";
        case "claude-haiku-4-5": return "anthropic/claude-3.5-haiku";
        default: return model;
    }
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
        // The Azure "v1" OpenAI-compatible base. Prefer an explicit
        // AZURE_OPENAI_V1_ENDPOINT, else derive it from AZURE_OPENAI_ENDPOINT
        // (.../openai/v1) so we don't need a separate env on every deploy.
        const base = process.env.AZURE_OPENAI_V1_ENDPOINT
            ?? requireEnv("AZURE_OPENAI_ENDPOINT").replace(/\/+$/, "") + "/openai/v1";
        cachedClient = new OpenAI({
            apiKey: requireEnv("AZURE_OPENAI_API_KEY"),
            baseURL: base,
            defaultQuery: { "api-version": requireEnv("AZURE_OPENAI_API_VERSION") },
            defaultHeaders: { "api-key": requireEnv("AZURE_OPENAI_API_KEY") },
        }) as unknown as ChatClient;
    }
    return cachedClient;
}

// ---- complete() ----------------------------------------------------------

/** Strip a ```json … ``` (or bare ```) markdown fence some models wrap JSON
 * in, leaving the raw JSON text. No fence → returned unchanged. */
function stripCodeFence(raw: string): string {
    const t = raw.trim();
    if (!t.startsWith("```")) return t;
    return t
        .replace(/^```(?:json)?\s*\n?/i, "")
        .replace(/\n?```\s*$/, "")
        .trim();
}

/** The ambient run tracer set by the orchestrator (withTracer), or null.
 * Lazy import so the router has no hard dependency on observability. */
async function ambientTracer(): Promise<CompleteDeps["tracer"] | null> {
    try {
        const { currentTracer } = await import("../observability/context.js");
        return (currentTracer() as CompleteDeps["tracer"]) ?? null;
    } catch {
        return null;
    }
}

/** Flatten any thrown value into a short, inspect-safe string. OpenAI/Azure
 * SDK errors carry nested objects with getters that can crash util.inspect. */
function safeErr(error: unknown): string {
    if (error instanceof Error) {
        const status = (error as { status?: number }).status;
        const code = (error as { code?: string }).code;
        return [error.name, status && `status=${status}`, code && `code=${code}`, error.message]
            .filter(Boolean)
            .join(" ");
    }
    try {
        return String(error);
    } catch {
        return "unprintable error";
    }
}

function parseStructured(content: string, schema: unknown): unknown {
    const stripped = stripCodeFence(content);
    let json: unknown;
    try {
        json = JSON.parse(stripped);
    } catch {
        // Fallback: some models (Claude) prepend prose ("Looking at the
        // requirements...") before the JSON. Extract the outermost {...} object
        // and parse that, so we don't waste a whole retry on a preamble.
        const first = stripped.indexOf("{");
        const last = stripped.lastIndexOf("}");
        if (first >= 0 && last > first) {
            try {
                json = JSON.parse(stripped.slice(first, last + 1));
            } catch (error) {
                throw new Error(`LLM output was not valid JSON: ${(error as Error).message}`);
            }
        } else {
            throw new Error("LLM output was not valid JSON: no JSON object found");
        }
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
    // Claude isn't on Azure: route claude-* to OpenRouter (when configured)
    // while gpt/deepseek stay on the default Azure client. Explicit deps.client
    // (tests) always wins.
    const useOpenRouter =
        isClaude(parsed.model) &&
        process.env.LLM_ROUTER_PROVIDER !== "openrouter" &&
        !!process.env.OPENROUTER_API_KEY;
    const client = deps.client ?? (useOpenRouter ? openRouterClient() : defaultClient());
    const params = buildChatParams(parsed.model, parsed, useOpenRouter);
    if (useOpenRouter) params.model = openRouterModel(parsed.model);
    // Use the explicit tracer, else the ambient run tracer (set by the
    // orchestrator via withTracer) so every LLM call is audited without
    // threading a tracer through every call site.
    const tracer = deps.tracer ?? (await ambientTracer());

    const start = Date.now();
    let completion;
    try {
        completion = await client.chat.completions.create(params);
    } catch (error) {
        // Log a flat, inspect-safe summary. Passing the raw OpenAI/Azure error
        // object to console.error can crash util.inspect (TypeError reading
        // 'value'), which would mask the real error and kill the run.
        console.error(
            `llm.router.complete failed model=${parsed.model} trace=${parsed.trace_id}: ` +
            safeErr(error),
        );
        await tracer?.record({
            phase: "llm_call",
            status: "failed",
            tool_id: parsed.trace_id,
            model: parsed.model,
            input: { system: parsed.system, user: parsed.user },
            latency_ms: Date.now() - start,
            error: safeErr(error),
        });
        throw error;
    }
    const latency_ms = Date.now() - start;

    const content = completion.choices[0]?.message.content ?? "";
    const output = parsed.response_schema
        ? parseStructured(content, parsed.response_schema)
        : content;

    await tracer?.record({
        phase: "llm_call",
        status: "succeeded",
        tool_id: parsed.trace_id,
        model: parsed.model,
        input: { system: parsed.system, user: parsed.user },
        output,
        latency_ms,
        prompt_tokens: completion.usage?.prompt_tokens,
        completion_tokens: completion.usage?.completion_tokens,
    });

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
