/**
 * Universal Game State contract — the bridge that lets one Playtester judge
 * ANY generated game, regardless of engine or genre.
 *
 * Every generated game exposes its live state the same way: it keeps a JSON
 * object on `window.__GAME_STATE__` (and accepts inputs via `window.__GAME_
 * INPUT__(action)`). The fields are deliberately generic — they describe a game
 * in the abstract (is the player alive? on screen? what's the score? is the
 * goal reached? is it over?), so a platformer, a puzzle, a shooter and a visual
 * novel all report through the SAME shape. The Playtester reads this, acts
 * toward the design's declared goal, and decides if the game is completable —
 * no genre-specific code anywhere.
 *
 * The code_gen tool is told to populate this in `_process`; the self-heal loop
 * validates it (same as it validates the code), so it isn't fragile.
 */
import { z } from "zod";

export const GameStateSchema = z.object({
    /** Is the player/avatar present and active? false = dead/removed/lost. */
    player_alive: z.boolean(),
    /** Is the player within the visible playfield? false = fell off / off-screen
     * (the universal version of "player ran out of the level"). */
    player_on_screen: z.boolean(),
    /** Player position in world units (for stuck/out-of-bounds detection). */
    player_x: z.number(),
    player_y: z.number(),
    /** Current score / progress counter (genre-agnostic). */
    score: z.number().default(0),
    /** Has the win/goal condition been met this session? */
    goal_reached: z.boolean().default(false),
    /** Is the game over (win OR lose)? */
    game_over: z.boolean().default(false),
    /** Seconds since the game started (for stuck / too-fast detection). */
    elapsed_seconds: z.number().min(0).default(0),
    /** Free-form status the game wants to surface (e.g. "on platform",
     * "fell", "reached exit"). One short string. */
    status: z.string().max(120).default(""),
});
export type GameState = z.infer<typeof GameStateSchema>;

/** The actions the Playtester can send, mapped to the registered InputMap.
 * Universal verbs; a game ignores the ones it doesn't use. */
export const PlaytestActionEnum = z.enum([
    "move_left",
    "move_right",
    "move_up",
    "move_down",
    "jump",
    "shoot",
    "action",
    "wait",
]);
export type PlaytestAction = z.infer<typeof PlaytestActionEnum>;

/** The Playtester's structured judgement of a game. */
export const PlaytestJudgementSchema = z.object({
    /** Is the game actually playable AND able to progress toward its goal? */
    playable: z.boolean(),
    /** Specific, actionable reason — fed back to regeneration on failure
     * (e.g. "player fell off-screen at 1.2s and never recovered"). */
    reason: z.string().min(1),
    /** Confidence 0-100 (Anti-Hallucination Protocol). */
    confidence: z.number().int().min(0).max(100),
});
export type PlaytestJudgement = z.infer<typeof PlaytestJudgementSchema>;

/** Window globals the generated game must define so the Playtester can drive
 * it. Documented here so the code_gen prompt and the runner agree. */
export const GAME_STATE_GLOBAL = "__GAME_STATE__"; // window.__GAME_STATE__: GameState
export const GAME_INPUT_GLOBAL = "__GAME_INPUT__"; // window.__GAME_INPUT__(action: PlaytestAction)
