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
    /** The generated level the game must be built ON (reachable AbstractLayout:
     * cells, entry/spawn, exit/goal, size). When present the code MUST use it
     * instead of inventing a level. */
    level_layout: z.unknown().optional(),
    /** Placed entities (enemies/pickups with coords) to spawn. */
    entities: z.unknown().optional(),
    /** Resolved asset urls (sprite/audio) to use instead of placeholders. */
    assets: z.record(z.unknown()).optional(),
    /** Playtester feedback from a previous failed pass (regeneration loop):
     * the specific playability problem to fix this time. */
    playtest_feedback: z.string().optional(),
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
    /** Optional self-heal: validate generated code (e.g. `godot --check-only`
     * in the sandbox) and return parse/compile errors, or null when valid.
     * When present, the handler retries with the errors fed back to the LLM. */
    validateCode?(args: { engine: string; code: string }): Promise<string | null>;
    /** Optional: given a compiler error, return official API docs for the
     * symbols it names (the root-cause grounding for version-mismatch errors). */
    lookupApiDocs?(engine: string, errorText: string): Promise<string>;
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
        async validateCode(args) {
            // Dynamic import keeps the tool layer free of a static runtime dep.
            const { validateCode } = await import("../../runtime/code-validator.js");
            return validateCode(args);
        },
        async lookupApiDocs(engine, errorText) {
            const { lookupApiDocsForError } = await import("../../runtime/code-validator.js");
            return lookupApiDocsForError(engine, errorText);
        },
    };
}

/** Summarize the generated level + entities + assets into a compact brief the
 * LLM must build the game ON (instead of inventing a tiny level). Returns ""
 * when there's no level (non-spatial genres / missing upstream). */
function describeLevel(layout: unknown, entities: unknown, assets: Record<string, unknown> | undefined): string {
    const lines: string[] = [];
    const l = layout as {
        width?: number; height?: number; tile_px?: number;
        cells?: string[][]; entry?: { x: number; y: number }; exit?: { x: number; y: number };
    } | undefined;

    if (l?.cells && l.width && l.height) {
        const tile = l.tile_px ?? 16;
        lines.push(
            `BUILD THE GAME ON THIS GENERATED LEVEL (do NOT invent your own level). ` +
            `Grid ${l.width}x${l.height} cells, ${tile}px each → world size ` +
            `${l.width * tile}x${l.height * tile} px.`,
        );
        if (l.entry) lines.push(`Player START (entry) at cell (${l.entry.x}, ${l.entry.y}) → place the player there.`);
        if (l.exit) lines.push(`GOAL/EXIT at cell (${l.exit.x}, ${l.exit.y}) → reaching it = win.`);
        // Compact row map so the LLM can lay out platforms/walls/hazards.
        const legend = "legend: .=empty #=wall =floor P=platform ^=hazard E=exit S=entry o=pickup x=enemy";
        const sym: Record<string, string> = {
            empty: ".", wall: "#", floor: "_", platform: "P", hazard: "^",
            exit: "E", entry: "S", pickup_slot: "o", enemy_slot: "x", door: "D", decor: ",",
        };
        const rows = l.cells.slice(0, 24).map((row) => row.slice(0, 64).map((c) => sym[c] ?? "?").join(""));
        lines.push(legend + "\nMAP:\n" + rows.join("\n"));
        lines.push(
            `Create solid ground/platforms where the map shows _/P (CharacterBody2D/StaticBody2D), ` +
            `walls at #, hazards at ^. The level is wider than the screen — add a Camera2D that ` +
            `follows the player so it never leaves the view.`,
        );
    }

    const ents = entities as Array<{ kind?: string; x?: number; y?: number }> | undefined;
    if (Array.isArray(ents) && ents.length > 0) {
        const summary = ents.slice(0, 20).map((e) => `${e.kind}@(${e.x},${e.y})`).join(", ");
        lines.push(`Place these entities (cell coords): ${summary}.`);
    }

    if (assets && (assets.sprite || assets.audio)) {
        // The assembler fetches these URLs into the project before building, so
        // reference them by their in-project res:// path (a WASM build can't load
        // an external URL at runtime). Paths mirror assetPath() in execution.ts.
        if (assets.sprite) {
            lines.push(
                `PLAYER SPRITE: use the texture at "res://assets/sprites/sprite_gen.png" for the ` +
                `player via a Sprite2D, NOT a ColorRect. The texture is large (~1024px) so you MUST ` +
                `scale it down to the player's gameplay size (~48px tall). Do exactly this:\n` +
                `\tvar tex := load("res://assets/sprites/sprite_gen.png") as Texture2D\n` +
                `\tif tex:\n` +
                `\t\tvar spr := Sprite2D.new()\n` +
                `\t\tspr.texture = tex\n` +
                `\t\tspr.scale = Vector2.ONE * (48.0 / float(tex.get_height()))  # fit to ~48px tall\n` +
                `\t\tplayer.add_child(spr)\n` +
                `\telse:\n` +
                `\t\t# fallback to a ColorRect if the texture is missing\n` +
                `\t\tpass\n` +
                `Make the player's CollisionShape2D match that ~48px size, not the raw texture size.`,
            );
        }
        if (assets.audio) {
            lines.push(`BACKGROUND MUSIC: play "res://assets/audio/bgm_gen.ogg" via an AudioStreamPlayer (if it loads).`);
        }
    }

    return lines.join("\n");
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
        const levelBrief = describeLevel(input.level_layout, input.entities, input.assets);
        const user =
            (grounding ? grounding + "\n\n" : "") +
            (input.playtest_feedback
                ? `IMPORTANT — a previous version of this game FAILED playtesting: ` +
                  `${input.playtest_feedback}\nFix this specific problem in the new version.\n\n`
                : "") +
            `Mechanic: ${input.mechanic}` +
            (input.context ? `\nContext: ${input.context}` : "") +
            (levelBrief ? `\n\n${levelBrief}` : "");

        // Generate, then (when a validator is wired) self-heal: validate the
        // code and, on parse/compile errors, feed them back to the LLM and
        // retry. The LLM repeatedly mis-targets engine versions; validating
        // against the real toolchain is the only reliable guarantee.
        // 3 is enough with Claude + JSON mode (usually valid by attempt 1-2);
        // each attempt now reuses one warm sandbox, so retries are cheap.
        const MAX_HEAL = deps.validateCode ? 3 : 1;
        let userMsg = user;
        let generated!: z.infer<typeof GeneratedCodeSchema>;
        let totalCost = 0;
        const healLog: { check: string; passed: boolean; detail: string | null }[] = [];

        let generationFailed = false;
        for (let attempt = 1; attempt <= MAX_HEAL; attempt++) {
            // A truncated/invalid JSON response throws here; don't let it kill
            // the whole node — log and retry (the next attempt often succeeds).
            try {
                const completion = await deps.complete({
                    model: config.model,
                    system,
                    user: userMsg,
                    response_schema: GeneratedCodeSchema,
                    // Game scripts + the gold-example imitation run long; 4096
                    // cut the JSON mid-string ("Unterminated string"). 8192
                    // fits a full file with margin.
                    max_tokens: 8192,
                    temperature: 0.2,
                    trace_id: `${invocation.trace_id}:gen${attempt}`,
                });
                generated = GeneratedCodeSchema.parse(completion.output);
                totalCost += completion.cost_usd;
                generationFailed = false;
            } catch (genErr) {
                generationFailed = true;
                healLog.push({ check: "generation", passed: false, detail: `attempt ${attempt}: ${(genErr as Error).message.slice(0, 120)}` });
                if (attempt === MAX_HEAL) break;
                continue; // retry generation
            }

            if (!deps.validateCode) break;
            const errors = await deps.validateCode({ engine: config.kbEngine ?? config.id, code: generated.code });
            if (!errors) {
                healLog.push({ check: "code_validates", passed: true, detail: `attempt ${attempt}` });
                break;
            }
            healLog.push({ check: "code_validates", passed: false, detail: `attempt ${attempt}: ${errors.slice(0, 160)}` });
            if (attempt === MAX_HEAL) break;
            // Root-cause grounding: most retries fail on engine-API mistakes
            // (Godot `Color.red` vs `RED`, wrong method signatures). Look up the
            // OFFICIAL docs for the exact symbols named in the error and inject
            // their real signatures/constants — far more reliable than example
            // code or the model's guess. Best-effort.
            let errorGrounding = "";
            if (deps.lookupApiDocs && config.kbEngine) {
                try {
                    errorGrounding = await deps.lookupApiDocs(config.kbEngine, errors);
                } catch { /* grounding is optional */ }
            }
            // Feed the exact compiler errors (+ the authoritative API docs) back.
            userMsg =
                `${user}\n\nYour previous ${config.language} did NOT compile in ` +
                `${config.name}. Fix these EXACT errors and return the full corrected file:\n` +
                `${errors.slice(0, 1500)}` +
                (errorGrounding
                    ? `\n\nAuthoritative ${config.name} API for the symbols above ` +
                      `(use these EXACT names/signatures):\n${errorGrounding.slice(0, 2500)}`
                    : "");
        }

        // Self-heal loop done: close the reused validator sandbox (best-effort).
        if (deps.validateCode) {
            try {
                const { closeValidatorSandbox } = await import("../../runtime/code-validator.js");
                await closeValidatorSandbox();
            } catch { /* best-effort */ }
        }

        // Every attempt failed to even produce parseable code → fail cleanly
        // (the gate treats a missing code_gen as not playable).
        if (generationFailed || !generated) {
            return makeResult({
                invocation: { tool_id: config.id, node_id: invocation.node_id, trace_id: invocation.trace_id },
                output: null,
                qa_log: healLog,
                error_message: `code generation failed after ${MAX_HEAL} attempts`,
                cost_usd: totalCost,
                latency_ms: Date.now() - start,
            });
        }

        const output: CodeGenOutput = {
            trace_id: invocation.trace_id,
            cost_usd: totalCost,
            latency_ms: Date.now() - start,
            qa_log: healLog,
            ...generated,
        };

        return makeResult({
            invocation: { tool_id: config.id, node_id: invocation.node_id, trace_id: invocation.trace_id },
            output,
            qa_log: [
                { check: "non_empty_code", passed: generated.code.length > 0, detail: null },
                ...healLog,
            ],
            cost_usd: totalCost,
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
