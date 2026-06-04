/**
 * D.1 Intent Interpreter (PARTE D.1).
 *
 * Turns a raw user brief into a first-pass Game Plan. It does NOT
 * validate consistency (D.3) or balance (D.4) — it only produces a
 * GamePlanSchema-valid `draft_plan` plus a human rationale for the
 * Creator Mode UI.
 *
 * Engine selection: `forced_engine` wins; otherwise the genre's default
 * engine. Genre is inferred from the brief with a keyword heuristic and
 * falls back to `hardcore_platformer` when nothing matches.
 *
 * LLM access goes through the W2 router seam. During parallelism that
 * is `../_mocks/llm.mock` (swapped for `../llm/router` at the W1 merge,
 * when W2 is already on main). The LLM only writes the rationale prose;
 * the plan structure is deterministic so the DONE gate
 * (GamePlanSchema.parse) never depends on a model response.
 */
import { randomUUID } from "node:crypto";

import {
    type IntentInterpreter,
    type IntentInterpreterInput,
    type IntentInterpreterOutput,
    IntentInterpreterInputSchema,
} from "../contracts/reasoning-engine.contract.js";
import {
    type Engine,
    type Genre,
    GenreEnum,
} from "../contracts/game-plan.contract.js";
import { complete } from "../_mocks/llm.mock.js";
import { defaultEngineFor, templateSkeleton } from "./baseline.js";

/** Keyword → genre cues, checked in order. First match wins. Kept tiny:
 * the production path layers an LLM classification on top, this only
 * needs to give a sensible deterministic default offline. */
const GENRE_CUES: ReadonlyArray<[Genre, readonly string[]]> = [
    ["visual_novel", ["visual novel", "dating sim", "branching story"]],
    ["jrpg", ["jrpg", "turn-based rpg", "party rpg"]],
    ["metroidvania", ["metroidvania", "interconnected map"]],
    ["bullet_hell", ["bullet hell", "danmaku", "shmup"]],
    ["roguelike", ["roguelike", "roguelite", "permadeath"]],
    ["card_game", ["card game", "deckbuilder", "deck builder"]],
    ["mobile_puzzle", ["puzzle", "match-3", "match three"]],
    ["multiplayer_arena", ["arena", "multiplayer pvp", "moba"]],
    ["social_sim", ["life sim", "social sim", "farming sim"]],
    ["browser_arcade", ["browser", "arcade", "endless runner"]],
    ["retro_8bit", ["8bit", "8-bit", "retro"]],
    ["threejs_showcase", ["3d showcase", "webgl", "three.js"]],
    ["hardcore_platformer", ["platformer", "jumping", "precision platform"]],
];

function inferGenre(prompt: string): Genre {
    const haystack = prompt.toLowerCase();
    for (const [genre, cues] of GENRE_CUES) {
        if (cues.some((cue) => haystack.includes(cue))) return genre;
    }
    return GenreEnum.enum.hardcore_platformer;
}

/** First non-empty line of the brief, trimmed to the title length cap. */
function deriveTitle(prompt: string): string {
    const firstLine = prompt.split("\n")[0]?.trim() ?? "";
    const candidate = firstLine.length > 0 ? firstLine : "Untitled Game";
    return candidate.slice(0, 120);
}

async function writeRationale(
    prompt: string,
    genre: Genre,
    engine: Engine,
    forced: boolean,
): Promise<string> {
    try {
        const res = await complete({
            model: "deepseek-chat",
            user:
                `Brief: ${prompt}\n` +
                `Chosen genre: ${genre}, engine: ${engine}` +
                (forced ? " (engine pinned by the user)." : "."),
            system:
                "You are the Intent Interpreter. In 1-2 sentences explain " +
                "why this genre and engine fit the brief.",
            max_tokens: 2048,
            temperature: 0.2,
            trace_id: `intent-${randomUUID()}`,
        });
        if (typeof res.output === "string" && res.output.trim().length > 0) {
            return res.output;
        }
    } catch (error) {
        // Graceful degradation (cf. lib/knowledge.ts): never fail the
        // proposal on an LLM hiccup — fall back to a templated rationale.
        console.error({ context: "intent.writeRationale", genre, engine, error });
    }
    const engineReason = forced
        ? `you pinned ${engine}`
        : `${engine} is the standard fit for ${genre}`;
    return `Picked ${genre} from the brief; ${engineReason}.`;
}

export const intentInterpreter: IntentInterpreter = {
    async propose(
        rawInput: IntentInterpreterInput,
    ): Promise<IntentInterpreterOutput> {
        const input = IntentInterpreterInputSchema.parse(rawInput);

        const genre = inferGenre(input.user_prompt);
        const engine: Engine = input.forced_engine ?? defaultEngineFor(genre);
        const title = deriveTitle(input.user_prompt);

        const draftPlan = templateSkeleton(randomUUID(), genre, engine, title);
        const rationale = await writeRationale(
            input.user_prompt,
            genre,
            engine,
            input.forced_engine !== undefined,
        );

        return {
            draft_plan: draftPlan,
            rationale,
            memory: input.memory,
        };
    },
};
