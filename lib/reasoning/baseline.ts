/**
 * Genre baseline skeletons for D.1 Intent Interpreter.
 *
 * The Supreme Plan calls for D.1 to fork the `genre_templates` row from
 * Supabase as the draft-plan skeleton. W1 develops OFFLINE against the
 * mocks, so this module holds a tiny built-in baseline that produces a
 * GamePlanSchema-valid skeleton without a network round-trip. When the
 * KB client is wired in (post-W2), `templateSkeleton` can be replaced
 * by a `genre_templates` RPC read — the GamePlan shape it returns is
 * the contract and does not change.
 *
 * The baseline is deliberately minimal: a 3-node world graph, a 3-point
 * pacing curve, one rules object and a single-node execution DAG. D.2
 * Design Planner and D.4 Balance Controller flesh it out.
 */
import type { Engine, Genre, GamePlan } from "../contracts/game-plan.contract.js";

/** The day-1 code-gen tool id per engine (from ToolIdEnum in
 * tool-registry.contract.ts). The baseline DAG's single node dispatches
 * this; the Orchestrator refuses unknown tool ids, so it must be a real
 * ToolId. */
const ENGINE_CODE_GEN_TOOL: Record<Engine, string> = {
    godot: "code_gen_godot_gdscript",
    phaser: "code_gen_phaser_js",
    renpy: "code_gen_renpy_python",
    defold: "code_gen_defold_lua",
    monogame: "code_gen_monogame_csharp",
    love2d: "code_gen_love2d_lua",
    threejs: "code_gen_threejs_ts",
    stride: "code_gen_stride_csharp",
    babylon: "code_gen_babylon_ts",
};

/** Default engine per genre, used when the user does not pin one. */
const GENRE_DEFAULT_ENGINE: Record<Genre, Engine> = {
    browser_arcade: "phaser",
    bullet_hell: "godot",
    card_game: "godot",
    hardcore_platformer: "godot",
    jrpg: "godot",
    metroidvania: "godot",
    mobile_puzzle: "phaser",
    multiplayer_arena: "godot",
    retro_8bit: "love2d",
    roguelike: "godot",
    social_sim: "renpy",
    stride_action: "stride",
    threejs_showcase: "threejs",
    visual_novel: "renpy",
};

/** Default style pack per genre — a REAL style_packs.id (A01-D08), not a
 * free-form string. The previous `${genre}_default` produced ids like
 * "hardcore_platformer_default" that exist in no catalog row, so the
 * match_assets style filter (`p_style_pack = any(style_pack_compat)`) rejected
 * EVERY asset → games fell back to placeholders. These map to the first pack
 * whose `compatible_genres` includes the genre (migration 003 seed). */
const GENRE_DEFAULT_STYLE: Record<Genre, string> = {
    browser_arcade: "A03",
    bullet_hell: "A01",
    card_game: "D08",
    hardcore_platformer: "A01",
    jrpg: "A02",
    metroidvania: "A01",
    mobile_puzzle: "A02",
    multiplayer_arena: "A08",
    retro_8bit: "A03",
    roguelike: "A01",
    social_sim: "A02",
    stride_action: "C03",
    threejs_showcase: "C01",
    visual_novel: "A06",
};

export function defaultStyleFor(genre: Genre): string {
    return GENRE_DEFAULT_STYLE[genre];
}

/** The genre template id the plan was forked from. Mirrors the
 * `genre_templates` primary key convention `<genre>_<engine>`. */
function templateOrigin(genre: Genre, engine: Engine): string {
    return `${genre}_${engine}`;
}

export function defaultEngineFor(genre: Genre): Engine {
    return GENRE_DEFAULT_ENGINE[genre];
}

/** Build a GamePlanSchema-valid skeleton for a genre + engine. The
 * skeleton has a reachable 3-node world graph (start → mid → boss) with
 * no soft-locks, so it passes the D.3 gate unchanged. */
export function templateSkeleton(
    projectId: string,
    genre: Genre,
    engine: Engine,
    title: string,
    difficulty: GamePlan["meta"]["difficulty"] = "balanced",
): GamePlan {
    return {
        plan_version: 1,
        project_id: projectId,
        meta: {
            title,
            genre,
            engine,
            style_pack_id: GENRE_DEFAULT_STYLE[genre],
            template_origin: templateOrigin(genre, engine),
            target_duration_minutes: 30,
            difficulty,
        },
        world_graph: {
            nodes: [
                { id: "start", display_name: "Start", requires: [], grants: [], tags: [] },
                { id: "mid", display_name: "Midpoint", requires: [], grants: [], tags: [] },
                { id: "boss", display_name: "Boss room", requires: [], grants: [], tags: [] },
            ],
            edges: [
                { from: "start", to: "mid", requires: [], bidirectional: true },
                { from: "mid", to: "boss", requires: [], bidirectional: true },
            ],
            entry_node_id: "start",
            starting_inventory: [],
        },
        pacing_curve: [
            { progress: 0, stress: 0.2 },
            { progress: 0.5, stress: 0.5 },
            { progress: 1, stress: 0.9 },
        ],
        rules: { player_hp: 100, enemy_dmg: 10 },
        asset_bindings: [],
        execution_dag: {
            nodes: [
                {
                    id: "player-controller",
                    tool_id: ENGINE_CODE_GEN_TOOL[engine],
                    input: { mechanic: "player_controller", engine },
                    depends_on: [],
                },
            ],
        },
    };
}
