/**
 * Game Designer — the prompt→rich-design enhancement step (D.1).
 *
 * This is GameSmith's answer to Higgsfield's "Prompt Processor": a thin user
 * brief ("a platformer where you collect coins") is expanded by an LLM into a
 * structured Game Design Document — concrete mechanics, a gameplay loop, mood,
 * win/lose conditions, and per-asset briefs — so the generated game reads as
 * *designed* rather than templated. The doc then drives genre/difficulty
 * selection and seeds every DAG node's input with specific direction.
 *
 * Anti-Hallucination Protocol (CLAUDE.md): the model returns ONLY structured
 * JSON validated against an enum-constrained Zod schema with a confidence
 * score; we never parse free-form prose. On any failure the caller falls back
 * to the deterministic keyword/template path (graceful degradation, like
 * lib/knowledge.ts) — the structural plan never depends on a model response.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { GenreEnum } from "../contracts/game-plan.contract.js";
import { complete } from "../llm/router.js";

/** Difficulty mirrors GamePlanMeta.difficulty so the doc maps straight in. */
const DifficultyEnum = z.enum(["chill", "balanced", "hard", "brutal"]);

/**
 * The structured design the LLM must return. Enum-constrained where it feeds a
 * catalog/contract field; free strings only for human-facing briefs (which are
 * fed to downstream LLM tools, not parsed as categorical data).
 */
export const GameDesignDocSchema = z.object({
    /** An evocative title (not the raw prompt). */
    title: z.string().min(1).max(120),
    /** Inferred genre — constrained to the seeded catalog enum. */
    genre: GenreEnum,
    difficulty: DifficultyEnum,
    /** One-sentence core fantasy / hook. */
    pitch: z.string().min(1).max(280),
    /** 2-5 concrete mechanics (e.g. "double jump", "coin combo multiplier"). */
    mechanics: z.array(z.string().min(1)).min(1).max(6),
    /** The minute-to-minute gameplay loop. */
    gameplay_loop: z.string().min(1).max(400),
    /** Visual mood / palette direction for the art tools. */
    mood: z.string().min(1).max(200),
    /** Win condition and lose/fail condition. */
    win_condition: z.string().min(1).max(200),
    lose_condition: z.string().min(1).max(200),
    /** Brief handed to the sprite tool (protagonist + key visual). */
    protagonist_brief: z.string().min(1).max(200),
    /** Brief handed to the music tool (genre/tempo/instrumentation). */
    music_brief: z.string().min(1).max(200),
    /** Brief handed to code_gen describing the mechanic to implement. */
    code_brief: z.string().min(1).max(400),
    /** Model self-assessed confidence 0-100. Low → caller may distrust it. */
    confidence_score: z.number().int().min(0).max(100),
    /** Escape hatch: true when the brief was too vague/empty to design from. */
    insufficient_brief: z.boolean(),
});
export type GameDesignDoc = z.infer<typeof GameDesignDocSchema>;

const GENRE_VALUES = GenreEnum.options.join(", ");

const SYSTEM = [
    "You are GameSmith's senior game designer. Expand a short user brief into a",
    "tight, buildable design for a small web game — the kind a player calls",
    '"polished", not "a tech demo". Invent specific, fun mechanics; do not just',
    "restate the brief. Keep scope small enough to build and play in one sitting.",
    "",
    "Return ONLY a JSON object with EXACTLY these keys:",
    "- title (string), pitch (string, one sentence)",
    `- genre: one of EXACTLY [${GENRE_VALUES}]`,
    "- difficulty: one of EXACTLY [chill, balanced, hard, brutal]",
    "- mechanics: array of 2-5 short strings",
    "- gameplay_loop, mood, win_condition, lose_condition (strings)",
    "- protagonist_brief, music_brief, code_brief (strings)",
    "- confidence_score: integer 0-100 (NOT 0-10)",
    "- insufficient_brief: boolean (true only if the brief is empty/impossible)",
    "",
    "Use the exact enum spellings above. Do not wrap the JSON in markdown.",
].join("\n");

/**
 * Run the designer on a raw brief. Returns the validated doc, or null on any
 * failure (LLM error, malformed output, or insufficient_brief) so the caller
 * keeps the deterministic fallback. Never throws.
 */
export async function designFromBrief(brief: string): Promise<GameDesignDoc | null> {
    const trimmed = brief.trim();
    if (trimmed.length === 0) return null;

    try {
        const res = await complete({
            // Azure gpt-4.1-mini deployment (the router maps this id → the
            // AZURE_OPENAI_DEPLOYMENT=gpt-4.1-mini fallback). Strong
            // instruction-following + native JSON mode at ~1/10 of Sonnet's
            // cost; design quality is near-Sonnet for this structured task and
            // above deepseek-chat (which we keep for code-gen). NOT gpt-4o-mini.
            model: "gpt-4.1-mini",
            system: SYSTEM,
            user: `User brief:\n${trimmed}`,
            response_schema: GameDesignDocSchema,
            max_tokens: 2048,
            temperature: 0.7, // some creative range; the schema keeps it safe
            trace_id: `game-designer-${randomUUID()}`,
        });

        const parsed = GameDesignDocSchema.safeParse(res.output);
        if (!parsed.success) {
            console.error("game-designer: output failed schema validation", {
                issues: parsed.error.issues.slice(0, 3),
            });
            return null;
        }
        const doc = parsed.data;
        if (doc.insufficient_brief || doc.confidence_score < 30) {
            console.error("game-designer: low-confidence / insufficient brief, falling back", {
                confidence: doc.confidence_score,
                insufficient: doc.insufficient_brief,
            });
            return null;
        }
        return doc;
    } catch (error) {
        console.error("game-designer: LLM call failed, falling back to template path", {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}
