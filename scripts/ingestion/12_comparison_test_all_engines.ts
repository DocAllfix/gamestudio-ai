/**
 * Fase 1ter verification — A/B comparison test across all 8 engines.
 *
 * For each engine, generates the same task TWICE with the same model and
 * hyperparameters: once without KB grounding (path A), once with KB
 * grounding from getReferences() (path B). Both files are then scored by
 * Claude Sonnet 4.6 against 5 engine-specific criteria (0-2 each, total
 * 10). The KB is the only variable.
 *
 * Tasks are chosen to play to each engine's coverage strength so the test
 * measures the upper-bound benefit, not the worst case:
 *   godot    -> player controller (A01, 224 chunks)
 *   phaser   -> physics platformer (A01+B03, 205+84)
 *   renpy    -> dialogue / branching narrative (C03, 122)
 *   defold   -> collection-based scene (E01+E02, 118+86)
 *   monogame -> base Game class + content loading (E01, 250)
 *   love2d   -> game loop state machine (E03, 82)
 *   threejs  -> scene loader / asset pipeline (E01, 250)
 *   stride   -> physics-driven entity (B03, 56)
 *
 * Run:
 *   npx tsx scripts/ingestion/12_comparison_test_all_engines.ts
 *   npx tsx scripts/ingestion/12_comparison_test_all_engines.ts --engine godot
 */
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

import {
  buildReferenceContext,
  getReferences,
} from "../../lib/knowledge.js";
import type { CodeReference } from "../../lib/types.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
loadDotenv({ path: path.join(REPO_ROOT, ".env") });

const OUTPUT_ROOT = path.join(REPO_ROOT, "test_output", "all_engines");
const GENERATOR_MODEL = "gpt-4o";
const EVALUATOR_MODEL = "claude-sonnet-4-6";

interface EngineTest {
  engine: string;
  category: string;
  semanticQuery: string;
  taskPrompt: string;
  codeFenceLang: string;
  fileExt: string;
  criteria: string[];
  evaluatorRubric: string;
}

const TESTS: EngineTest[] = [
  {
    engine: "godot",
    category: "A01_player_controller",
    semanticQuery: "godot 4 platformer player controller coyote time variable jump",
    fileExt: "gd",
    codeFenceLang: "gdscript",
    taskPrompt:
      `Write a Godot 4 CharacterBody2D player controller (.gd) for a precision platformer:
- horizontal acceleration + deceleration with separate "ground" and "air" coefficients
- variable-height jump (cut velocity when jump button released)
- coyote time (≥0.1s grace after walking off a ledge)
- input buffering (≥0.1s pre-jump grace)
- realistic gravity tuned for a 96-frame jump arc
Respond with ONLY GDScript code, no commentary.`,
    criteria: [
      "extends_character_body2d",
      "coyote_time",
      "input_buffer",
      "variable_jump",
      "realistic_numbers",
    ],
    evaluatorRubric:
      `1. extends_character_body2d — file starts with \`extends CharacterBody2D\` and uses \`move_and_slide()\` + \`is_on_floor()\`. 2 = both used idiomatically, 1 = present but used oddly, 0 = absent.
2. coyote_time — explicit timer that allows jump for a window after leaving the floor. 2 = a documented coyote_time variable counted down with delta, 1 = ad-hoc \`was_on_floor\` flag with no timer, 0 = absent.
3. input_buffer — jump-press is remembered for a window so a pre-landing press still triggers a jump. 2 = explicit buffer timer, 1 = simple "just_pressed last frame" ad-hoc, 0 = absent.
4. variable_jump — releasing the jump button mid-air cuts upward velocity. 2 = condition on \`Input.is_action_just_released("jump")\` with velocity.y multiplied by <1.0, 1 = single-height jump only, 0 = no jump.
5. realistic_numbers — gravity, jump_velocity, speed are concrete values in plausible ranges (gravity ~900-1500, jump_velocity ~-300 to -500, speed ~150-400). 2 = all three in range, 1 = one or two, 0 = none / magic numbers like 1.`,
  },
  {
    engine: "phaser",
    category: "A01_player_controller",
    semanticQuery: "phaser 3 arcade physics platformer player jump",
    fileExt: "js",
    codeFenceLang: "javascript",
    taskPrompt:
      `Write a Phaser 3 scene (.js) for a 2D platformer:
- a Phaser.Physics.Arcade.Sprite player with gravity, ground collision, jump
- left/right keyboard movement with separate accel and max velocity
- jump that respects collide-with-floor + a small coyote-time grace
- camera that follows the player with deadzone
Respond with ONLY JavaScript code (Phaser 3.x), no commentary.`,
    criteria: [
      "phaser_scene_class",
      "arcade_physics_setup",
      "input_handling",
      "camera_follow",
      "coyote_or_jump_grace",
    ],
    evaluatorRubric:
      `1. phaser_scene_class — defines a class extending \`Phaser.Scene\` with preload/create/update lifecycle. 2 = all three lifecycle methods + class extends Phaser.Scene, 1 = subset, 0 = absent.
2. arcade_physics_setup — uses \`this.physics.add.sprite\` or arcade-physics body, sets gravity (per-body or world), \`setCollideWorldBounds\`, and a static/tile ground collider. 2 = all four, 1 = subset, 0 = absent.
3. input_handling — keyboard via \`this.input.keyboard.createCursorKeys()\` or addKeys; movement in update() using cursors.left/right and a jump on cursors.up. 2 = idiomatic create+update split, 1 = polling but in wrong lifecycle, 0 = absent.
4. camera_follow — \`this.cameras.main.startFollow(player, ...)\` with at least a lerp or deadzone parameter. 2 = startFollow + deadzone configured, 1 = startFollow only, 0 = absent.
5. coyote_or_jump_grace — at least a hasTouched.down check OR a coyote-time numeric buffer to permit jump shortly after leaving ground. 2 = explicit timer, 1 = blocked.down only, 0 = no jump or no ground check.`,
  },
  {
    engine: "renpy",
    category: "C03_dialogue_narrative",
    semanticQuery: "renpy branching dialogue menu affinity variable",
    fileExt: "rpy",
    codeFenceLang: "renpy",
    taskPrompt:
      `Write a Ren'Py 8 script (.rpy) with:
- two characters defined via \`define\` with distinct colours
- a labelled scene with a branching menu of 3 choices
- each choice updates an \`affinity\` variable (default 0) that persists across saves
- one branch leads to a "good_end" label, another to a "bad_end" label based on affinity
- uses \`default\` for game state variables and \`persistent\` for cross-save unlocks
Respond with ONLY Ren'Py code, no commentary.`,
    criteria: [
      "define_characters",
      "branching_menu",
      "affinity_state",
      "default_and_persistent",
      "branching_ending",
    ],
    evaluatorRubric:
      `1. define_characters — at least two \`define c = Character(...)\` statements with named arguments (e.g. color=). 2 = two characters with distinct color, 1 = one only or no color, 0 = absent.
2. branching_menu — a \`menu:\` block inside a label with 3+ choices, each leading to different behaviour. 2 = three or more distinct branches, 1 = fewer or all collapse, 0 = no menu.
3. affinity_state — an \`affinity\` (or equivalent) variable mutated by \`$\` statements inside menu choices. 2 = at least three distinct mutations, 1 = one or two, 0 = absent.
4. default_and_persistent — uses BOTH \`default affinity = 0\` (per-save) AND \`persistent.<flag>\` (cross-save) appropriately. 2 = both, with persistent being for an unlock/flag-not-affinity, 1 = only one mechanism, 0 = neither.
5. branching_ending — at least two distinct ending labels reachable based on affinity comparison. 2 = if/elif on affinity routing to good_end + bad_end (and possibly neutral), 1 = single ending or no comparison, 0 = absent.`,
  },
  {
    engine: "defold",
    category: "E01_project_structure",
    semanticQuery: "defold collection game.script lifecycle msg.post",
    fileExt: "script",
    codeFenceLang: "lua",
    taskPrompt:
      `Write a Defold game.script (.script, Lua) for a top-down shooter level:
- init() acquires input focus and posts a "level_start" message to the spawner
- on_message handles "enemy_killed" and "player_died" messages
- on_input handles WASD movement and SPACE to fire, posting "fire" to a weapon component
- update(self, dt) does nothing heavy; movement deltas are accumulated via input
- uses self.score and self.health as component state
Respond with ONLY Lua code in Defold's component style, no commentary.`,
    criteria: [
      "defold_lifecycle",
      "msg_post_idiom",
      "input_focus",
      "on_input_actions",
      "component_state",
    ],
    evaluatorRubric:
      `1. defold_lifecycle — defines \`init(self)\`, \`on_message(self, message_id, message, sender)\`, \`on_input(self, action_id, action)\`, \`update(self, dt)\`. 2 = all four present and correctly signatured, 1 = three of four, 0 = missing on_message or on_input.
2. msg_post_idiom — uses \`msg.post("#component_or_url", "name")\` with hash-style identifiers. 2 = at least two msg.post calls with proper URL syntax, 1 = one only or wrong syntax, 0 = absent.
3. input_focus — calls \`msg.post(".", "acquire_input_focus")\` in init. 2 = present in init, 1 = present but misplaced, 0 = absent.
4. on_input_actions — branches on \`action_id == hash("move_up")\` (or similar) for WASD and \`hash("fire")\` for space. 2 = at least 5 action_id branches matching WASD+fire, 1 = fewer, 0 = no on_input or no branching.
5. component_state — \`self.score\` and \`self.health\` initialised in init and mutated on messages. 2 = both fields initialised and at least one mutated, 1 = one field, 0 = absent.`,
  },
  {
    engine: "monogame",
    category: "E01_project_structure",
    semanticQuery: "monogame Game1 ContentManager LoadContent SpriteBatch",
    fileExt: "cs",
    codeFenceLang: "csharp",
    taskPrompt:
      `Write a MonoGame Game1.cs class for a 2D top-down adventure:
- inherits from Microsoft.Xna.Framework.Game with GraphicsDeviceManager and SpriteBatch
- Initialize() sets a 1280x720 backbuffer
- LoadContent() loads a player Texture2D from Content
- Update(GameTime) handles WASD movement using Keyboard.GetState() with delta-time motion
- Draw(GameTime) clears to CornflowerBlue, opens SpriteBatch, draws the player, ends SpriteBatch
Respond with ONLY C# code, no commentary.`,
    criteria: [
      "monogame_game_inheritance",
      "graphics_setup",
      "content_loading",
      "update_input_dt",
      "draw_spritebatch",
    ],
    evaluatorRubric:
      `1. monogame_game_inheritance — class inherits from \`Microsoft.Xna.Framework.Game\` (or \`using Microsoft.Xna.Framework; class Game1 : Game\`). 2 = correct, with constructor calling base, 1 = inheritance but no base constructor, 0 = absent.
2. graphics_setup — \`GraphicsDeviceManager _graphics\` field, PreferredBackBufferWidth=1280, PreferredBackBufferHeight=720, ApplyChanges in Initialize. 2 = all four, 1 = subset, 0 = absent.
3. content_loading — \`SpriteBatch\` created in LoadContent, \`Content.Load<Texture2D>("player")\` (or similar) called there. 2 = both, 1 = one, 0 = absent.
4. update_input_dt — \`Update(GameTime gameTime)\` reads \`Keyboard.GetState()\` and moves the player using \`gameTime.ElapsedGameTime.TotalSeconds\` (or .TotalMilliseconds) — frame-rate-independent. 2 = both keys and dt-scaled motion, 1 = keys but no dt, 0 = no input or no Update.
5. draw_spritebatch — \`GraphicsDevice.Clear(Color.CornflowerBlue)\`, \`_spriteBatch.Begin()\`, draw with position, \`_spriteBatch.End()\`. 2 = all four in order, 1 = subset, 0 = absent.`,
  },
  {
    engine: "love2d",
    category: "E03_game_flow",
    semanticQuery: "love2d main.lua love.update love.draw state machine menu game",
    fileExt: "lua",
    codeFenceLang: "lua",
    taskPrompt:
      `Write a LÖVE 11.x main.lua with a state machine:
- three states: "menu", "play", "gameover"
- love.load() initialises state = "menu" and a font
- love.update(dt) only updates physics when state == "play"
- love.draw() dispatches to draw_menu / draw_play / draw_gameover based on state
- love.keypressed(key) handles "return" to go menu -> play, "escape" to exit, and "r" to restart from gameover
Respond with ONLY Lua code for LÖVE 11.x, no commentary.`,
    criteria: [
      "love_lifecycle_callbacks",
      "state_constant",
      "state_dispatch",
      "keypressed_transitions",
      "dt_in_update",
    ],
    evaluatorRubric:
      `1. love_lifecycle_callbacks — defines \`function love.load()\`, \`function love.update(dt)\`, \`function love.draw()\`, \`function love.keypressed(key)\`. 2 = all four, 1 = three, 0 = fewer.
2. state_constant — a \`state\` (or \`game_state\`) variable holding "menu"/"play"/"gameover" as values. 2 = all three string values used somewhere, 1 = only two, 0 = absent.
3. state_dispatch — love.draw branches on state to call separate draw functions OR has at least 2 if/elseif arms keyed on state. 2 = three branches with three distinct render bodies, 1 = two branches, 0 = no dispatch.
4. keypressed_transitions — at least three key->state transitions handled (return for menu->play, escape for quit, r for gameover->menu/play). 2 = all three, 1 = two, 0 = fewer.
5. dt_in_update — \`love.update(dt)\` uses \`dt\` to advance something only when state == "play". 2 = dt used and gated by state, 1 = dt used but not gated, 0 = no dt or no gating.`,
  },
  {
    engine: "threejs",
    category: "E01_project_structure",
    semanticQuery: "three.js scene PerspectiveCamera WebGLRenderer animate loop",
    fileExt: "js",
    codeFenceLang: "javascript",
    taskPrompt:
      `Write a Three.js (r150+) scene boot in JavaScript (.js):
- THREE.Scene with fog, THREE.PerspectiveCamera (fov 75), THREE.WebGLRenderer attached to document.body
- a DirectionalLight + AmbientLight
- a textured ground plane and a single mesh (box or sphere) at origin
- animate() loop using requestAnimationFrame, rotating the mesh and calling renderer.render(scene, camera)
- window resize handler that updates camera aspect + renderer size
Respond with ONLY JavaScript code (browser, no Node), no commentary.`,
    criteria: [
      "scene_camera_renderer",
      "lighting_setup",
      "ground_plus_mesh",
      "raf_animate_loop",
      "resize_handler",
    ],
    evaluatorRubric:
      `1. scene_camera_renderer — \`new THREE.Scene()\`, \`new THREE.PerspectiveCamera(75, ...)\`, \`new THREE.WebGLRenderer({...})\` with renderer attached to document.body via appendChild. 2 = all four, 1 = three, 0 = fewer.
2. lighting_setup — at least one DirectionalLight AND one AmbientLight added to the scene. 2 = both, 1 = one, 0 = none.
3. ground_plus_mesh — a ground plane (PlaneGeometry with rotation -PI/2 on x) AND a separate mesh. 2 = both with materials assigned, 1 = one, 0 = neither.
4. raf_animate_loop — \`function animate(){ requestAnimationFrame(animate); ...; renderer.render(scene, camera); }\` with at least one mesh rotation updated each frame. 2 = both raf recursion and rotation, 1 = raf without rotation, 0 = no loop.
5. resize_handler — \`window.addEventListener('resize', ...)\` updating camera.aspect AND renderer.setSize. 2 = both updates, 1 = one, 0 = absent.`,
  },
  {
    engine: "stride",
    category: "B03_physics_collision",
    semanticQuery: "stride3d RigidbodyComponent collider trigger physics",
    fileExt: "cs",
    codeFenceLang: "csharp",
    taskPrompt:
      `Write a Stride C# SyncScript for a physics-driven pickup:
- attached to an entity with a RigidbodyComponent + sphere collider set as trigger
- in Start(), subscribes to the rigidbody.Collisions stream
- on collision with the player entity, applies +1 to a "score" variable and disables the entity
- uses CancellationTokenSource for the collision listening task
- the script is a public class : SyncScript with public Update() override
Respond with ONLY C# code (Stride.Engine namespace), no commentary.`,
    criteria: [
      "syncscript_inheritance",
      "rigidbody_access",
      "collision_listening",
      "score_state",
      "entity_disable",
    ],
    evaluatorRubric:
      `1. syncscript_inheritance — class declared \`public class Pickup : SyncScript\` with \`public override void Update()\`. 2 = both, 1 = SyncScript but no Update or Update without override, 0 = no SyncScript inheritance.
2. rigidbody_access — gets RigidbodyComponent via \`Entity.Get<RigidbodyComponent>()\` (or similar). 2 = stored as field on Start, used later, 1 = retrieved but not used, 0 = absent.
3. collision_listening — uses \`foreach (var collision in rigidbody.NewCollisions())\` inside an async task or processes \`rigidbody.Collisions\`. 2 = async task with CancellationToken + Collisions stream, 1 = sync iteration in Update, 0 = no collision handling.
4. score_state — a \`score\` (int) field incremented inside the collision handler. 2 = field declared + incremented, 1 = local variable only, 0 = absent.
5. entity_disable — \`Entity.EnableAll(false)\` or removing the entity from the scene after pickup. 2 = present and gated by collision match, 1 = present but unconditional, 0 = absent.`,
  },
];

interface OpenAIChatResponse {
  choices: { message: { content: string } }[];
}

async function callGenerator(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GENERATOR_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 2500,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`OpenAI ${resp.status}: ${body.slice(0, 300)}`);
  }
  const data = (await resp.json()) as OpenAIChatResponse;
  return stripCodeFences(data.choices?.[0]?.message?.content ?? "");
}

function stripCodeFences(text: string): string {
  const m = text.match(/```(?:[a-zA-Z]+)?\s*\n([\s\S]*?)\n```/);
  return (m ? m[1] : text).trim();
}

interface AnthropicResponse {
  content: { type: string; text: string }[];
}

async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: EVALUATOR_MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Claude ${resp.status}: ${body.slice(0, 500)}`);
  }
  const data = (await resp.json()) as AnthropicResponse;
  return data.content?.[0]?.text ?? "";
}

type CritScore = 0 | 1 | 2;
type Scores = Record<string, CritScore>;

interface Evaluation {
  file_a: Scores;
  file_b: Scores;
}

function parseEvaluation(raw: string, criteria: string[]): Evaluation {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON object: ${raw.slice(0, 200)}`);
  const parsed = JSON.parse(match[0]);
  for (const file of ["file_a", "file_b"] as const) {
    if (!parsed[file]) throw new Error(`Missing ${file}`);
    for (const k of criteria) {
      const v = parsed[file][k];
      if (v !== 0 && v !== 1 && v !== 2) {
        throw new Error(`${file}.${k} must be 0|1|2, got ${v}`);
      }
    }
  }
  return parsed as Evaluation;
}

function sumScores(s: Scores, criteria: string[]): number {
  return criteria.reduce((acc, k) => acc + (s[k] ?? 0), 0);
}

function countWins(a: Scores, b: Scores, criteria: string[]): number {
  let wins = 0;
  for (const k of criteria) if ((b[k] ?? 0) > (a[k] ?? 0)) wins += 1;
  return wins;
}

interface EngineResult {
  engine: string;
  task: string;
  refs_count: number;
  a_score: number;
  b_score: number;
  wins: number;
  verdict: string;
  ev: Evaluation;
}

async function runOne(test: EngineTest): Promise<EngineResult> {
  const dir = path.join(OUTPUT_ROOT, test.engine);
  await fs.mkdir(dir, { recursive: true });
  const fileA = path.join(dir, `without_kb.${test.fileExt}`);
  const fileB = path.join(dir, `with_kb.${test.fileExt}`);

  console.log(`\n=== [${test.engine}] ${test.category} ===`);
  console.log(`[A] generating without KB ...`);
  const codeA = await callGenerator(test.taskPrompt);
  await fs.writeFile(fileA, codeA, "utf-8");

  console.log(`[B] querying KB (engine=${test.engine} cat=${test.category}) ...`);
  const refs = await getReferences({
    engine: test.engine,
    category: test.category,
    minQuality: 2,
    semanticQuery: test.semanticQuery,
    maxResults: 5,
  });
  console.log(`[B] retrieved ${refs.length} reference chunks`);

  const context = buildReferenceContext(refs, []);
  const enriched = `${context}\n\n=== TASK ===\n${test.taskPrompt}`;
  console.log(`[B] generating with KB (prompt ${enriched.length} chars) ...`);
  const codeB = await callGenerator(enriched);
  await fs.writeFile(fileB, codeB, "utf-8");

  const evalPrompt =
    `You are evaluating two ${test.engine} implementations against five criteria. Score each file on a 0-2 scale (0 absent/broken, 1 present-but-shallow, 2 well-implemented).\n\nCRITERIA:\n${test.evaluatorRubric}\n\nRespond with VALID JSON ONLY, no preamble, no markdown fence:\n{"file_a":{${test.criteria.map((c) => `"${c}":0|1|2`).join(",")}},"file_b":{...}}\n\n=== FILE A (without KB) ===\n\`\`\`${test.codeFenceLang}\n${codeA}\n\`\`\`\n\n=== FILE B (with KB) ===\n\`\`\`${test.codeFenceLang}\n${codeB}\n\`\`\`\n`;
  console.log(`[EVAL] calling ${EVALUATOR_MODEL} ...`);
  const raw = await callClaude(evalPrompt);
  const ev = parseEvaluation(raw, test.criteria);

  const a = sumScores(ev.file_a, test.criteria);
  const b = sumScores(ev.file_b, test.criteria);
  const wins = countWins(ev.file_a, ev.file_b, test.criteria);
  const verdict =
    wins >= 3
      ? `KB wins (${wins}/5)`
      : b > a
      ? `KB scores higher (+${b - a}) but wins only ${wins}/5`
      : b === a
      ? `tie`
      : `KB worse (-${a - b})`;
  console.log(`[${test.engine}] A=${a}/10 B=${b}/10 wins=${wins}/5  ${verdict}`);

  return {
    engine: test.engine,
    task: test.category,
    refs_count: refs.length,
    a_score: a,
    b_score: b,
    wins,
    verdict,
    ev,
  };
}

async function writeSummary(results: EngineResult[]): Promise<void> {
  const lines: string[] = [];
  lines.push("# All-Engines Comparison Test — Fase 1ter Verification");
  lines.push("");
  lines.push(`Generator: ${GENERATOR_MODEL} @ T=0.2 (identical for both paths).`);
  lines.push(`Evaluator: ${EVALUATOR_MODEL}, 5 criteria 0-2.`);
  lines.push(`Gate: KB wins if it beats the baseline on ≥3/5 criteria.`);
  lines.push("");
  lines.push("| Engine | Task | KB refs | A | B | Δ | Wins | Verdict |");
  lines.push("|---|---|---:|---:|---:|---:|---:|---|");
  for (const r of results) {
    const delta = r.b_score - r.a_score;
    const deltaStr = delta > 0 ? `**+${delta}**` : delta < 0 ? `${delta}` : "0";
    lines.push(
      `| ${r.engine} | ${r.task} | ${r.refs_count} | ${r.a_score}/10 | ${r.b_score}/10 | ${deltaStr} | ${r.wins}/5 | ${r.verdict} |`,
    );
  }
  const totalA = results.reduce((s, r) => s + r.a_score, 0);
  const totalB = results.reduce((s, r) => s + r.b_score, 0);
  const totalWins = results.reduce((s, r) => s + r.wins, 0);
  const engines_won = results.filter((r) => r.wins >= 3).length;
  lines.push("");
  lines.push(`**Aggregate**: A=${totalA}, B=${totalB}, Δ=${totalB - totalA >= 0 ? "+" : ""}${totalB - totalA}, total criteria won by B=${totalWins}/${results.length * 5}, engines passing gate=${engines_won}/${results.length}.`);
  await fs.writeFile(
    path.join(OUTPUT_ROOT, "SUMMARY.md"),
    lines.join("\n"),
    "utf-8",
  );
  console.log(`\n[SUMMARY] wrote ${path.join(OUTPUT_ROOT, "SUMMARY.md")}`);
}

async function main(): Promise<number> {
  const engineFilter = process.argv.includes("--engine")
    ? process.argv[process.argv.indexOf("--engine") + 1]
    : null;
  const tests = engineFilter
    ? TESTS.filter((t) => t.engine === engineFilter)
    : TESTS;
  if (tests.length === 0) {
    console.error(`No test for engine="${engineFilter}"`);
    return 1;
  }
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  const results: EngineResult[] = [];
  for (const t of tests) {
    try {
      const r = await runOne(t);
      results.push(r);
    } catch (e) {
      console.error(`[${t.engine}] FAILED:`, e);
    }
  }
  if (results.length > 0) await writeSummary(results);
  console.log("\n=== DONE ===");
  for (const r of results) {
    console.log(`  ${r.engine.padEnd(10)} A=${r.a_score} B=${r.b_score} Δ${r.b_score - r.a_score >= 0 ? "+" : ""}${r.b_score - r.a_score} wins=${r.wins}/5  ${r.verdict}`);
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error("[FATAL]", err);
    process.exit(2);
  },
);
