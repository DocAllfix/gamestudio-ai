/**
 * Execution DAG builder (D.2 structural design).
 *
 * Turns a genre + engine into a FULL execution DAG that orchestrates the real
 * tools — not the 1-node code-gen skeleton from baseline.ts. The node set and
 * dependencies follow the per-genre pipeline (docs/research map-gen plan):
 *
 *   2D spatial:  asset_resolver → sprite_gen → level_layout_2d → tilemap_populate
 *                → entity_placement → (bgm_gen, sfx_gen) → code_gen → [build]
 *   3D spatial:  asset_resolver → heightmap_gen → level_layout_3d
 *                → entity_placement → (bgm_gen, sfx_gen) → code_gen → [build]
 *   non-spatial (card/visual_novel): sprite_gen → (bgm_gen, voice_gen) → code_gen
 *
 * Every tool_id here is a real, registered ToolId. The Orchestrator dispatches
 * them; dispatchSafe degrades a node that fails so the DAG still completes.
 */
import type { Engine, Genre } from "../contracts/game-plan.contract.js";
import type { GameDesignDoc } from "./game-designer.js";

export interface DagNode {
  id: string;
  tool_id: string;
  input: Record<string, unknown>;
  depends_on: string[];
}

const ENGINE_CODE_GEN: Record<Engine, string> = {
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

type Spatiality = "2d" | "3d" | "non_spatial";

/** How each genre lays out its world. */
const GENRE_SPATIALITY: Record<Genre, Spatiality> = {
  browser_arcade: "2d",
  bullet_hell: "2d",
  card_game: "non_spatial",
  hardcore_platformer: "2d",
  jrpg: "2d",
  metroidvania: "2d",
  mobile_puzzle: "2d",
  multiplayer_arena: "2d",
  retro_8bit: "2d",
  roguelike: "2d",
  social_sim: "non_spatial",
  stride_action: "3d",
  threejs_showcase: "3d",
  visual_novel: "non_spatial",
};

/** True for 3D-native engines (drives 2d-vs-3d when genre is ambiguous). */
const ENGINE_IS_3D: Partial<Record<Engine, boolean>> = {
  threejs: true,
  babylon: true,
  stride: true,
};

function spatialityFor(genre: Genre, engine: Engine): Spatiality {
  const base = GENRE_SPATIALITY[genre];
  // A 2D genre on a 3D-only engine becomes 3D (and vice-versa is left as 2D).
  if (base === "2d" && ENGINE_IS_3D[engine]) return "3d";
  return base;
}

/**
 * Build the full DAG. `style_pack_id` threads style coherence through every
 * asset node; `difficulty` tunes entity placement.
 */
export function buildExecutionDag(args: {
  genre: Genre;
  engine: Engine;
  style_pack_id: string;
  difficulty: string;
  tier?: string;
  /** D.1 enhancement output. When present its briefs replace the generic
   * "${genre} ..." node inputs with specific direction. */
  design?: GameDesignDoc | null;
}): { nodes: DagNode[] } {
  const { genre, engine, style_pack_id, difficulty, design } = args;
  const tier = args.tier ?? "free";
  const codeGen = ENGINE_CODE_GEN[engine];
  const spatiality = spatialityFor(genre, engine);
  const common = { style_pack_id, genre, engine, tier };
  // Per-asset briefs from the design doc, with generic fallbacks. The code
  // brief also carries mechanics + loop so code_gen builds the real game.
  const heroDesc = design?.protagonist_brief ?? `${genre} main character`;
  const musicDesc = design?.music_brief ?? `${genre} soundtrack`;
  const codeBrief = design?.code_brief ?? "core_loop";
  const codeContext = design
    ? `${design.pitch} Mechanics: ${design.mechanics.join(", ")}. Loop: ${design.gameplay_loop}. Win: ${design.win_condition}. Lose: ${design.lose_condition}.`
    : undefined;
  const nodes: DagNode[] = [];

  if (spatiality === "non_spatial") {
    // No level geometry: characters + audio + code.
    nodes.push({ id: "hero-sprite", tool_id: "sprite_gen", input: { description: heroDesc, ...common }, depends_on: [] });
    nodes.push({ id: "music", tool_id: "bgm_gen", input: { description: musicDesc, ...common }, depends_on: [] });
    if (genre === "visual_novel" || genre === "social_sim") {
      nodes.push({ id: "voice", tool_id: "voice_gen", input: { description: "narration line", ...common }, depends_on: [] });
    }
    nodes.push({ id: "game-code", tool_id: codeGen, input: { mechanic: codeBrief, context: codeContext, engine }, depends_on: ["hero-sprite", "music"] });
    return { nodes };
  }

  if (spatiality === "3d") {
    nodes.push({ id: "terrain-heightmap", tool_id: "heightmap_gen", input: { width: 256, height: 256, ...common }, depends_on: [] });
    nodes.push({ id: "level", tool_id: "level_layout_3d", input: { size: "m", ...common }, depends_on: ["terrain-heightmap"] });
    nodes.push({ id: "enemies", tool_id: "entity_placement", input: { difficulty, ...common }, depends_on: ["level"] });
    nodes.push({ id: "hero-model", tool_id: "model_3d_gen", input: { description: heroDesc, ...common }, depends_on: [] });
    nodes.push({ id: "music", tool_id: "bgm_gen", input: { description: musicDesc, ...common }, depends_on: [] });
    nodes.push({ id: "sfx", tool_id: "sfx_gen", input: { description: "action sfx", ...common }, depends_on: [] });
    nodes.push({ id: "game-code", tool_id: codeGen, input: { mechanic: codeBrief, context: codeContext, engine }, depends_on: ["level", "enemies", "hero-model", "music", "sfx"] });
    return { nodes };
  }

  // 2D spatial — the default rich pipeline. level→tilemap→entity pass data
  // along their edges; execution.ts wires each parent's output into the child
  // input (layout→tilemap.layout, tilemap→entity.tilemap). `node` is the
  // world-graph node level expands; execution injects the real one.
  nodes.push({ id: "hero-sprite", tool_id: "sprite_gen", input: { description: heroDesc, ...common }, depends_on: [] });
  nodes.push({ id: "level", tool_id: "level_layout_2d", input: { size: "m", difficulty, ...common }, depends_on: [] });
  nodes.push({ id: "tilemap", tool_id: "tilemap_populate", input: { ...common }, depends_on: ["level"] });
  nodes.push({ id: "enemies", tool_id: "entity_placement", input: { difficulty, ...common }, depends_on: ["tilemap"] });
  nodes.push({ id: "music", tool_id: "bgm_gen", input: { description: musicDesc, ...common }, depends_on: [] });
  nodes.push({ id: "sfx", tool_id: "sfx_gen", input: { description: "jump/hit sfx", ...common }, depends_on: [] });
  nodes.push({ id: "game-code", tool_id: codeGen, input: { mechanic: codeBrief, context: codeContext, engine }, depends_on: ["hero-sprite", "tilemap", "enemies", "music", "sfx"] });
  return { nodes };
}
