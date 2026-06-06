/**
 * Shared factory for the code_gen tools.
 *
 * Each engine tool is the same pipeline with engine-specific knobs:
 *   1. (optional) getReferences() for RAG grounding — Babylon opts out
 *      because its Phase-1 KB harvest is frozen; it injects curated
 *      grounding text instead.
 *   2. build a grounded prompt and call the router (lib/llm/router.ts).
 *   3. wrap the generated code in a ToolExecutionResult.
 *
 * The KB client and router are injected so each tool is testable without
 * Supabase/Azure; the defaults wire the real `getReferences` + `complete`.
 */
import { z } from "zod";

import {
    ToolInputBaseSchema,
    ToolOutputBaseSchema,
    type ToolId,
    type ToolInvocation,
} from "../../contracts/tool-registry.contract.js";
import { buildReferenceContext } from "../../knowledge.js";
import type { CodeReference, ReferenceQuery } from "../../types.js";
import type { LlmCompleteRequest, LlmCompleteResponse, ModelId } from "../../llm/router.js";
import { makeResult, type Tool } from "../_shared.js";

export const CodeGenInputSchema = ToolInputBaseSchema.extend({
    /** The mechanic / feature to generate code for. */
    mechanic: z.string().min(1),
    /** Optional extra context appended to the prompt. */
    context: z.string().optional(),
});
export type CodeGenInput = z.infer<typeof CodeGenInputSchema>;

export const CodeGenOutputSchema = ToolOutputBaseSchema.extend({
    code: z.string().min(1),
    language: z.string().min(1),
    filename: z.string().min(1),
    notes: z.string().default(""),
});
export type CodeGenOutput = z.infer<typeof CodeGenOutputSchema>;

/** Shape the router is asked to return for a code_gen call. */
const GeneratedCodeSchema = z.object({
    code: z.string().min(1),
    language: z.string().min(1),
    filename: z.string().min(1),
    notes: z.string().default(""),
});

export interface CodeGenDeps {
    getReferences(query: ReferenceQuery): Promise<CodeReference[]>;
    complete(request: LlmCompleteRequest): Promise<LlmCompleteResponse>;
}

export interface EngineConfig {
    id: ToolId;
    name: string;
    /** KB engine key for getReferences; null disables KB harvest (Babylon). */
    kbEngine: string | null;
    language: string;
    model: ModelId;
    /** Curated grounding text injected when kbEngine is null. */
    curatedGrounding?: string;
    /** Engine entrypoint contract: how the generated code must match the
     * scaffold (e.g. Godot's main.gd is the root Node2D scene script). Without
     * this the LLM picks an incompatible base class and the scene fails to
     * instance. */
    entrypointContract?: string;
}

function defaultDeps(): CodeGenDeps {
    return {
        async getReferences(query) {
            const { getReferences } = await import("../../knowledge.js");
            return getReferences(query);
        },
        async complete(request) {
            const { complete } = await import("../../llm/router.js");
            return complete(request);
        },
    };
}

export function makeCodeGenTool(config: EngineConfig): Tool<CodeGenDeps> {
    async function handler(invocation: ToolInvocation, deps: CodeGenDeps = defaultDeps()) {
        const start = Date.now();
        const input = CodeGenInputSchema.parse({
            ...invocation.input,
            project_id: invocation.project_id,
            plan_version: invocation.plan_version,
            trace_id: invocation.trace_id,
        });

        let grounding = config.curatedGrounding ?? "";
        if (config.kbEngine) {
            const refs = await deps.getReferences({
                engine: config.kbEngine,
                semanticQuery: input.mechanic,
            });
            grounding = buildReferenceContext(refs, []);
        }

        const system =
            `You are an expert ${config.name} engineer. Generate idiomatic, runnable ` +
            `${config.language} for the requested mechanic. ` +
            (config.entrypointContract ? config.entrypointContract + " " : "") +
            `Return JSON: {code, language, filename, notes}.`;
        const user =
            (grounding ? grounding + "\n\n" : "") +
            `Mechanic: ${input.mechanic}` +
            (input.context ? `\nContext: ${input.context}` : "");

        const completion = await deps.complete({
            model: config.model,
            system,
            user,
            response_schema: GeneratedCodeSchema,
            max_tokens: 4096,
            temperature: 0.2,
            trace_id: invocation.trace_id,
        });

        const generated = GeneratedCodeSchema.parse(completion.output);
        const output: CodeGenOutput = {
            trace_id: invocation.trace_id,
            cost_usd: completion.cost_usd,
            latency_ms: completion.latency_ms,
            qa_log: [],
            ...generated,
        };

        return makeResult({
            invocation: { tool_id: config.id, node_id: invocation.node_id, trace_id: invocation.trace_id },
            output,
            qa_log: [{ check: "non_empty_code", passed: generated.code.length > 0, detail: null }],
            cost_usd: completion.cost_usd,
            latency_ms: Date.now() - start,
        });
    }

    return {
        id: config.id,
        name: config.name,
        description: `Generates ${config.language} for ${config.name} grounded in ${config.kbEngine ? "the RAG knowledge base" : "curated in-prompt examples"}.`,
        category: "code",
        inputSchema: CodeGenInputSchema,
        outputSchema: CodeGenOutputSchema,
        estimatedCostUsd: 0.01,
        estimatedDurationSeconds: 8,
        handler,
    };
}
