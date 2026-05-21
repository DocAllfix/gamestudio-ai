/**
 * Fase 7 — A/B comparison test: code generation WITHOUT vs WITH the KB.
 *
 * The single task is a Godot 4 metroidvania player controller. Path A
 * gets only the task prompt; path B gets the same prompt enriched with
 * grounding from the Knowledge Base (full-recipe chunks, single-mechanic
 * snippets, real numerical parameters). Both paths call the same model
 * with identical hyperparameters so the KB is the only variable.
 *
 * The output is scored by Claude Sonnet 4.6 against 5 binary criteria
 * (coyote_time, input_buffer, variable_jump, accel/decel curves,
 * realistic numbers). The blueprint §04.3 says the Dataset Boost is
 * validated if file B beats file A on >=3/5 criteria.
 *
 * Run:
 *   npx tsx scripts/ingestion/08_comparison_test.ts
 */
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

import {
  buildReferenceContext,
  getReferenceParameters,
  getReferences,
} from "../../lib/knowledge.js";
import type { CodeReference, ParameterReference } from "../../lib/types.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
loadDotenv({ path: path.join(REPO_ROOT, ".env") });

const TEST_OUTPUT_DIR = path.join(REPO_ROOT, "test_output");
const FILE_A_PATH = path.join(TEST_OUTPUT_DIR, "without_kb.rpy");
const FILE_B_PATH = path.join(TEST_OUTPUT_DIR, "with_kb.rpy");
const REPORT_PATH = path.join(TEST_OUTPUT_DIR, "COMPARISON_REPORT.md");

const GENERATOR_MODEL = "gpt-4o";
const EVALUATOR_MODEL = "claude-sonnet-4-6";

const TASK_PROMPT = `Generate a complete inventory system in Ren'Py for a visual novel / dating sim with:
- Item definitions: id, display name, description, icon path, rarity (common/uncommon/rare/legendary), stackable flag, max_stack, category (key_item/consumable/gift)
- Player inventory: add_item, remove_item, has_item, get_count helpers; persistent across save/load
- Item screen: scrollable grid showing icons grouped by category, with quantity badges; clicking an item shows its tooltip (name + description + rarity colour)
- Gift system: NPCs accept specific gift items and react with affinity changes
- Integration with the standard Ren'Py screen language and persistent variables

Respond with ONLY the Ren'Py code (.rpy syntax), no commentary. Use idiomatic Ren'Py 8.x patterns.`;

interface OpenAIChatResponse {
  choices: { message: { content: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
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
  const content = data.choices?.[0]?.message?.content ?? "";
  return stripCodeFences(content);
}

function stripCodeFences(text: string): string {
  // DeepSeek wraps code in ```<lang> ... ``` despite "ONLY code".
  // Strip the wrapping fence if present, leaving the bare code.
  const m = text.match(/```(?:gdscript|gd|renpy|rpy|python)?\s*\n([\s\S]*?)\n```/);
  return (m ? m[1] : text).trim();
}

interface AnthropicResponse {
  content: { type: string; text: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
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

// Criteria scored 0-2 (absent / present-but-shallow / well-implemented) so
// the evaluation discriminates between two competent files. Blueprint
// §04.3 keeps "B beats A on >=3/5 criteria" as the gate, but at a finer
// granularity the comparison reveals KB-driven quality differences that
// a pure 0/1 rubric flattens.
type CritScore = 0 | 1 | 2;

interface Scores {
  idiomatic_renpy: CritScore;
  data_model: CritScore;
  screen_ui: CritScore;
  persistence: CritScore;
  gift_integration: CritScore;
}

interface Evaluation {
  file_a: Scores;
  file_b: Scores;
}

function parseEvaluation(raw: string): Evaluation {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`No JSON object in evaluator reply: ${raw.slice(0, 200)}`);
  const parsed = JSON.parse(match[0]);
  const keys: (keyof Scores)[] = [
    "idiomatic_renpy",
    "data_model",
    "screen_ui",
    "persistence",
    "gift_integration",
  ];
  for (const file of ["file_a", "file_b"] as const) {
    if (!parsed[file]) throw new Error(`Missing ${file} in evaluator reply`);
    for (const k of keys) {
      const v = parsed[file][k];
      if (v !== 0 && v !== 1 && v !== 2) {
        throw new Error(`${file}.${k} must be 0|1|2, got ${v}`);
      }
    }
  }
  return parsed as Evaluation;
}

function sumScore(s: Scores): number {
  return s.idiomatic_renpy + s.data_model + s.screen_ui + s.persistence
    + s.gift_integration;
}

function countWins(a: Scores, b: Scores): number {
  let wins = 0;
  const keys: (keyof Scores)[] = [
    "idiomatic_renpy", "data_model", "screen_ui",
    "persistence", "gift_integration",
  ];
  for (const k of keys) if (b[k] > a[k]) wins += 1;
  return wins;
}

function renderScoreTable(ev: Evaluation): string {
  const a = ev.file_a, b = ev.file_b;
  const rows: [string, CritScore, CritScore][] = [
    ["1. Idiomatic Ren'Py (define/default/screen syntax)", a.idiomatic_renpy, b.idiomatic_renpy],
    ["2. Data model (Item class w/ rarity, category, stackable)", a.data_model, b.data_model],
    ["3. Inventory screen UI (grid, badges, tooltips)", a.screen_ui, b.screen_ui],
    ["4. Persistence (saved across game save/load)", a.persistence, b.persistence],
    ["5. Gift system integration (NPC affinity)", a.gift_integration, b.gift_integration],
  ];
  const lines = [
    "| # | Criterion | File A (no KB) | File B (with KB) | Δ |",
    "|---|---|:-:|:-:|:-:|",
  ];
  for (const [name, aScore, bScore] of rows) {
    const delta = bScore - aScore;
    const marker = delta > 0 ? `**+${delta}**` : delta < 0 ? `${delta}` : "0";
    lines.push(`| ${name} | ${aScore}/2 | ${bScore}/2 | ${marker} |`);
  }
  lines.push(`| **TOTAL** | | **${sumScore(a)}/10** | **${sumScore(b)}/10** | **${sumScore(b) - sumScore(a) >= 0 ? "+" : ""}${sumScore(b) - sumScore(a)}** |`);
  return lines.join("\n");
}

async function generateWithoutKB(): Promise<string> {
  console.log("[A] generating without KB ...");
  const code = await callGenerator(TASK_PROMPT);
  await fs.writeFile(FILE_A_PATH, code, "utf-8");
  console.log(`[A] wrote ${FILE_A_PATH} (${code.length} chars)`);
  return code;
}

async function generateWithKB(): Promise<{
  code: string;
  refs: CodeReference[];
  params: ParameterReference[];
}> {
  console.log("[B] querying KB ...");
  // Ren'Py inventory: this is the deeper test of KB value. General-purpose
  // LLMs have limited Ren'Py training data, while we have 127 Ren'Py chunks
  // (incl. an explicit `inventory` chunk_kind built by the Fase 1 heuristic).
  const fullRecipe = await getReferences({
    engine: "renpy",
    category: "C02_inventory",
    chunkType: "full_recipe",
    minQuality: 2,
    semanticQuery: TASK_PROMPT,
    maxResults: 2,
  });
  const singles = await getReferences({
    engine: "renpy",
    minQuality: 2,
    semanticQuery: "ren'py inventory item screen with rarity and tooltip",
    maxResults: 3,
  });
  // No game_parameters lane for Ren'Py inventory (no numeric DNA needed
  // for a turn-based menu); pass an empty list so the report renders.
  const params: ParameterReference[] = [];
  const allRefs = [...fullRecipe, ...singles];
  console.log(
    `[B] retrieved ${fullRecipe.length} full_recipe + ${singles.length} single_mechanic + ${params.length} param sets`,
  );

  const context = buildReferenceContext(allRefs, params);
  const enriched = `${context}\n\n=== TASK ===\n${TASK_PROMPT}`;
  console.log(`[B] generating with KB (prompt ${enriched.length} chars) ...`);
  const code = await callGenerator(enriched);
  await fs.writeFile(FILE_B_PATH, code, "utf-8");
  console.log(`[B] wrote ${FILE_B_PATH} (${code.length} chars)`);
  return { code, refs: allRefs, params };
}

const EVALUATOR_PROMPT_TEMPLATE = `You are evaluating two Ren'Py inventory implementations against five criteria. Score each file on a 0-2 scale:
  0 = absent or broken
  1 = present but shallow / incomplete (e.g. minimal stub, missing helpers)
  2 = well implemented (idiomatic Ren'Py 8.x, complete enough to drop into a real VN)

CRITERIA:
1. idiomatic_renpy — uses Ren'Py top-level statements correctly: \`define\`/\`default\` for variables, \`screen <name>:\` blocks for UI, \`init python:\` blocks for class definitions, \`persistent.\` for save-spanning state.
   2 only if at least 3 of these constructs are used appropriately and the code is recognisable as Ren'Py (not Python with Ren'Py-flavoured comments).
2. data_model — Item has a structured representation (Python class or dict template) including: id, name, description, rarity (with multiple levels), stackable flag, max_stack, category.
   2 only if EVERY listed field is present and rarity is a typed value (enum / string with documented levels), not just a free string.
3. screen_ui — an actual Ren'Py \`screen\` block renders the inventory: scrollable grid (vbox/hbox/grid/viewport), quantity badges, tooltip on hover/click, rarity colour cue.
   2 only if all four UI features (grid, badge, tooltip, rarity-coloured) appear in the screen definition.
4. persistence — inventory survives save/load and game restart: uses default (per-save) for game state, persistent. for cross-save state (e.g. unlocked items), or a documented serialise/deserialise.
   2 only if both the design intent and the actual mechanism are present (not just a comment saying "this saves").
5. gift_integration — there is a gift-giving function/flow tying inventory items to NPC affinity: a give_gift(npc, item) entry point that consumes the item, applies an affinity delta, and triggers an NPC reaction.
   2 only if NPC, item, and affinity delta are all parameters of an actual function (not just a TODO).

Respond with VALID JSON ONLY, no preamble, no markdown fence:
{"file_a":{"idiomatic_renpy":0|1|2,"data_model":0|1|2,"screen_ui":0|1|2,"persistence":0|1|2,"gift_integration":0|1|2},"file_b":{...}}

=== FILE A (without KB) ===
\`\`\`renpy
{code_a}
\`\`\`

=== FILE B (with KB) ===
\`\`\`renpy
{code_b}
\`\`\`
`;

async function evaluate(codeA: string, codeB: string): Promise<Evaluation> {
  console.log(`[EVAL] calling ${EVALUATOR_MODEL} ...`);
  const prompt = EVALUATOR_PROMPT_TEMPLATE
    .replace("{code_a}", codeA)
    .replace("{code_b}", codeB);
  const raw = await callClaude(prompt);
  console.log(`[EVAL] reply length: ${raw.length} chars`);
  return parseEvaluation(raw);
}

async function writeReport(
  ev: Evaluation,
  codeA: string,
  codeB: string,
  refs: CodeReference[],
  params: ParameterReference[],
): Promise<void> {
  const a = sumScore(ev.file_a), b = sumScore(ev.file_b);
  const delta = b - a;
  const wins = countWins(ev.file_a, ev.file_b);
  // Blueprint §04.3 gate: File B beats File A on >=3 criteria (B[k] > A[k]).
  const verdict = wins >= 3
    ? `✅ Dataset Boost CONFIRMED — File B wins on ${wins}/5 criteria.`
    : delta > 0
    ? `⚠️ File B scores higher (+${delta}) but only wins on ${wins}/5 criteria; blueprint gate requires >=3.`
    : delta === 0
    ? "❌ Tie — both files reach the same score; KB did not differentiate."
    : "❌ File A (without KB) outscored File B — investigate KB quality / retrieval.";

  const refLines = refs.map((r) =>
    `- **${r.summary}** (${r.source_repo ?? "unknown"}, Q${r.quality_score}/5, features: ${r.key_features.join(", ") || "none"})`
  ).join("\n");
  const paramLines = params.map((p) =>
    `- ${p.source_repo ?? "unknown"} (Q${p.quality_score}/5): ${Object.keys(p.parameters).slice(0, 6).join(", ")}${Object.keys(p.parameters).length > 6 ? ", ..." : ""}`
  ).join("\n");

  const md = `# Dataset Boost — Comparison Report (Fase 7)

**Task**: Ren'Py 8 inventory system (item data model with rarity/category,
add/remove helpers, scrollable screen with badges and tooltips, persistence
across save/load, gift-giving integration tied to NPC affinity).

**Generator**: \`${GENERATOR_MODEL}\` at temperature 0.2 — same model and
hyperparameters for both files. The only variable is the KB grounding
injected into File B's prompt.

**Evaluator**: \`${EVALUATOR_MODEL}\` (Anthropic API direct), 5 binary
criteria, structured JSON output.

## Scores

${renderScoreTable(ev)}

**Δ (B − A)**: ${delta >= 0 ? "+" : ""}${delta}

## Verdict

${verdict}

## KB grounding used for File B

**${refs.length} reference chunk(s)** injected:
${refLines || "_(none)_"}

**${params.length} parameter set(s)** injected:
${paramLines || "_(none)_"}

## File A — without_kb.rpy

\`\`\`renpy
${codeA}
\`\`\`

## File B — with_kb.rpy

\`\`\`renpy
${codeB}
\`\`\`
`;
  await fs.writeFile(REPORT_PATH, md, "utf-8");
  console.log(`[REPORT] wrote ${REPORT_PATH}`);
}

async function main(): Promise<number> {
  await fs.mkdir(TEST_OUTPUT_DIR, { recursive: true });

  const codeA = await generateWithoutKB();
  const { code: codeB, refs, params } = await generateWithKB();
  const ev = await evaluate(codeA, codeB);

  const a = sumScore(ev.file_a), b = sumScore(ev.file_b);
  const wins = countWins(ev.file_a, ev.file_b);
  console.log("\n=== RESULT ===");
  console.log(`File A (no KB): ${a}/10`);
  console.log(`File B (KB):    ${b}/10`);
  console.log(`Delta:          ${b - a >= 0 ? "+" : ""}${b - a}`);
  console.log(`B wins on:      ${wins}/5 criteria  (gate: >=3)`);

  await writeReport(ev, codeA, codeB, refs, params);
  return wins >= 3 ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error("[FATAL]", err);
    process.exit(2);
  },
);
