/**
 * Per-engine project scaffold.
 *
 * The code_gen tools emit a single gameplay file ({code, filename}); the
 * level / sprite / audio tools emit structured data or asset URLs. None of
 * them emit a *buildable project* — the file tree each EngineAdapter.build()
 * expects (project.godot + export_presets for Godot, an index.html entry for
 * the browser engines, game.project for Defold). This module is the missing
 * seam between "tools produced outputs" and "the adapter can build": it takes
 * the raw tool outputs for a run and returns the complete, build-ready file
 * tree the assembler writes into the sandbox.
 *
 * Kept deterministic and dependency-free: given the same tool outputs it
 * always produces the same tree, so a failed build is reproducible.
 */
import type { AssemblerInput } from "../../contracts/assembly-pipeline.contract.js";
import type { Engine } from "../../contracts/game-plan.contract.js";
import { GODOT_FALLBACK_GAME } from "./_godot-fallback.js";

/** One file to write into the sandbox FS. */
export interface ScaffoldFile {
    path: string;
    content: string;
    encoding: "utf-8" | "base64" | "url-ref";
}

type ToolOutputs = AssemblerInput["tool_outputs"];

/**
 * The single piece of generated gameplay code for a run. The code_gen tools
 * return {code, filename}; we surface it through the node's files[] (see
 * execution.ts → toToolOutputs). The scaffold wraps this into the engine
 * project.
 */
interface ExtractedCode {
    /** The gameplay source the LLM generated. */
    code: string;
    /** Asset files (sprites, audio) the resolver/tools produced, as url-refs
     * or inline. Written verbatim alongside the project. */
    assets: ScaffoldFile[];
}

/** code_gen node ids start with this prefix (see dag-builder). */
const CODE_NODE_PREFIX = "code_gen";

/**
 * Pull the gameplay code + asset files out of the raw tool outputs. The code
 * lives in the code_gen node's single file; everything else is treated as an
 * asset to copy through. Falls back to an empty stub if no code_gen ran so the
 * build fails with a clear "empty game" rather than a missing-file error.
 */
function extract(toolOutputs: ToolOutputs): ExtractedCode {
    let code = "";
    const assets: ScaffoldFile[] = [];

    for (const [nodeId, node] of Object.entries(toolOutputs)) {
        const isCode =
            nodeId.startsWith(CODE_NODE_PREFIX) ||
            node.tool_id.startsWith(CODE_NODE_PREFIX);
        if (isCode) {
            // code_gen emits exactly one file: its content is the source.
            const file = node.files[0];
            if (file && typeof file.content === "string") code = file.content;
            continue;
        }
        for (const f of node.files) {
            assets.push({
                path: f.path,
                content: f.content,
                encoding: f.encoding,
            });
        }
    }

    return { code, assets };
}

// ---- Browser engines (Phaser / Three.js / Babylon) -----------------------
//
// build() runs `esbuild <entry> --bundle --outfile=dist/bundle.js`, then
// package()/webExport() serve dist/. The entry holds the generated code; we
// add the dist/index.html that loads the bundle so the artifact is playable
// in an iframe (build alone only emits bundle.js).

const BROWSER_INDEX_HTML = (title: string): string =>
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>html,body{margin:0;height:100%;background:#0E0F12;overflow:hidden}canvas{display:block;margin:0 auto}</style>
</head>
<body>
<div id="game"></div>
<script src="./bundle.js"></script>
</body>
</html>
`;

function browserScaffold(
    entryPath: string,
    code: string,
    assets: ScaffoldFile[],
): ScaffoldFile[] {
    return [
        { path: entryPath, content: code, encoding: "utf-8" },
        {
            path: "/project/dist/index.html",
            content: BROWSER_INDEX_HTML("GameSmith"),
            encoding: "utf-8",
        },
        ...assets,
    ];
}

// ---- Godot ----------------------------------------------------------------
//
// `godot --headless --export-release "Web"` needs project.godot, an
// export_presets.cfg with a "Web" preset, and a main scene. The generated
// GDScript is the main scene's script.

// Pre-register the input actions generated games commonly use. The LLM calls
// Input.is_action_pressed("jump"/"retry"/...) for actions that otherwise don't
// exist in the InputMap → flood of "action doesn't exist" USER ERRORs and a
// game that can't be controlled. Registering them here (plus the built-in ui_*)
// makes those calls valid regardless of what the LLM chose. Godot 4 .cfg input
// event format.
const GODOT_INPUT = `[input]

move_left={
"deadzone": 0.5,
"events": [Object(InputEventKey,"physical_keycode":4194319),Object(InputEventKey,"physical_keycode":65)]
}
move_right={
"deadzone": 0.5,
"events": [Object(InputEventKey,"physical_keycode":4194321),Object(InputEventKey,"physical_keycode":68)]
}
move_up={
"deadzone": 0.5,
"events": [Object(InputEventKey,"physical_keycode":4194320),Object(InputEventKey,"physical_keycode":87)]
}
move_down={
"deadzone": 0.5,
"events": [Object(InputEventKey,"physical_keycode":4194322),Object(InputEventKey,"physical_keycode":83)]
}
jump={
"deadzone": 0.5,
"events": [Object(InputEventKey,"physical_keycode":32),Object(InputEventKey,"physical_keycode":4194320)]
}
shoot={
"deadzone": 0.5,
"events": [Object(InputEventKey,"physical_keycode":4194309),Object(InputEventKey,"physical_keycode":74)]
}
action={
"deadzone": 0.5,
"events": [Object(InputEventKey,"physical_keycode":4194309)]
}
retry={
"deadzone": 0.5,
"events": [Object(InputEventKey,"physical_keycode":82)]
}
restart={
"deadzone": 0.5,
"events": [Object(InputEventKey,"physical_keycode":82)]
}
pause={
"deadzone": 0.5,
"events": [Object(InputEventKey,"physical_keycode":4194305)]
}
`;

// Turn OFF warnings-as-errors. The LLM keeps writing valid-but-warned GDScript
// (untyped `var x = expr`, etc.) that Godot, with the default
// treat_warnings_as_errors, rejects as a Parse Error — burning a self-heal
// retry per variable. These are WARNINGS, not real errors; disabling the
// as-errors gate (and the noisiest declaration warnings) kills the whole class
// at once without masking genuine parse/runtime errors. Shared by the scaffold
// build and the validator so both see the same rules.
export const GODOT_DEBUG_GDSCRIPT = `[debug]

gdscript/warnings/treat_warnings_as_errors=false
gdscript/warnings/untyped_declaration=0
gdscript/warnings/inferred_declaration=0
gdscript/warnings/unsafe_method_access=0
gdscript/warnings/unsafe_property_access=0
gdscript/warnings/unsafe_cast=0
gdscript/warnings/unsafe_call_argument=0
`;

const GODOT_PROJECT = `; Engine configuration, GameSmith scaffold.
config_version=5

[application]
config/name="GameSmith Game"
run/main_scene="res://main.tscn"
config/features=PackedStringArray("4.3", "GL Compatibility")

${GODOT_INPUT}
[rendering]
renderer/rendering_method="gl_compatibility"

${GODOT_DEBUG_GDSCRIPT}`;

const GODOT_MAIN_TSCN = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://main.gd" id="1"]

[node name="Main" type="Node2D"]
script = ExtResource("1")
`;

const GODOT_EXPORT_PRESETS = `[preset.0]

name="Web"
platform="Web"
runnable=true
export_filter="all_resources"
include_filter=""
exclude_filter=""
export_path="build/web/index.html"

[preset.0.options]

variant/extensions_support=false
variant/thread_support=false
vram_texture_compression/for_desktop=true
html/export_icon=true
`;

/**
 * Deterministic Godot 3 → 4 sanitizer. The LLM keeps emitting Godot-3 APIs and
 * near-misses that won't parse in Godot 4 (proven via harness traces:
 * `onready var` without @, KinematicBody2D, Sprite, .rect_position, Color.red).
 * Fixing the known patterns here, before validation, removes the dominant class
 * of parse errors instantly — what's left goes to the self-heal + doc-API loop.
 * Order matters (longer/more-specific patterns first).
 */
const GODOT_3_TO_4: ReadonlyArray<[RegExp, string | ((m: string, ...g: string[]) => string)]> = [
    // Annotations: `onready`/`export` became `@onready`/`@export` (skip if
    // already prefixed with @).
    [/(^|\n)(\s*)onready\s+var/g, "$1$2@onready var"],
    [/(^|\n)(\s*)export(\s*\([^)]*\))?\s+var/g, "$1$2@export var"],
    // Renamed nodes/classes.
    [/\bKinematicBody2D\b/g, "CharacterBody2D"],
    [/\bKinematicBody\b/g, "CharacterBody3D"],
    [/\bSprite\.new\(\)/g, "Sprite2D.new()"],
    [/\b(class_name\s+\w+\s*,\s*)?\bSprite\b(?!2D|3D)/g, "Sprite2D"],
    [/\bPosition2D\b/g, "Marker2D"],
    [/\bArea\b(?!2D|3D)/g, "Area3D"],
    [/\bYSort\b/g, "Node2D"],
    // Renamed properties.
    [/\.rect_position\b/g, ".position"],
    [/\.rect_size\b/g, ".size"],
    [/\.rect_scale\b/g, ".scale"],
    // Color constants: Color.red → Color.RED (lowercase x11 names dropped).
    [/\bColor\.([a-z][a-z_]+)\b/g, (_m, n: string) => `Color.${n.toUpperCase()}`],
    // Coroutines: yield(x,"sig") → await x.sig (best-effort common form).
    [/\byield\s*\(\s*([^,]+?)\s*,\s*["']([^"']+)["']\s*\)/g, "await $1.$2"],
    // Image: removed lock()/unlock().
    [/(^|\n)\s*\w+\.(lock|unlock)\(\)\s*(?=\n)/g, "$1"],
    // instance() → instantiate().
    [/\.instance\(\)/g, ".instantiate()"],
    // Typed inference: Godot 4 treats "Cannot infer type" as an error under
    // warnings-as-errors. `var x = expr` (no type, plain `=`) → `var x := expr`
    // so the type is inferred. Deterministic fix here = one fewer LLM retry.
    // Only bare `var name = ` (not `:=`, not `var name: Type =`, not `const`).
    [/(^|\n)(\s*)var\s+([A-Za-z_]\w*)\s*=\s*(?!=)/g, "$1$2var $3 := "],
];

export function sanitizeGodot4(code: string): string {
    let out = code;
    for (const [re, rep] of GODOT_3_TO_4) {
        out = typeof rep === "string" ? out.replace(re, rep) : out.replace(re, rep);
    }
    return out;
}

/**
 * Guarantee the main script extends Node2D (main.tscn mounts it on a Node2D
 * node). The code_gen LLM often omits `extends` or extends the wrong base
 * (e.g. RefCounted), which makes Godot refuse to instance the script onto the
 * scene node → the scene loads empty (grey screen). We normalize the first
 * `extends` line, or prepend one when absent.
 */
function ensureGodotExtendsNode2D(rawCode: string): string {
    const code = sanitizeGodot4(rawCode);
    const trimmed = code.trimStart();
    if (/^extends\s+Node2D\b/m.test(trimmed)) return code;
    if (/^\s*extends\s+\w+/m.test(trimmed)) {
        return trimmed.replace(/^\s*extends\s+\w+.*$/m, "extends Node2D");
    }
    return `extends Node2D\n\n${code}`;
}

/** A game needs a _ready() to build its scene; anything without one (empty
 * string from a failed code_gen, or a bare `extends Node2D`) renders a grey
 * empty scene. Treat that as "no game" → substitute the guaranteed template. */
function godotCodeOrFallback(code: string): string {
    return /func\s+_ready\s*\(/.test(code) ? code : GODOT_FALLBACK_GAME;
}

function godotScaffold(code: string, assets: ScaffoldFile[]): ScaffoldFile[] {
    return [
        { path: "/project/project.godot", content: GODOT_PROJECT, encoding: "utf-8" },
        { path: "/project/main.gd", content: ensureGodotExtendsNode2D(godotCodeOrFallback(code)), encoding: "utf-8" },
        { path: "/project/main.tscn", content: GODOT_MAIN_TSCN, encoding: "utf-8" },
        {
            path: "/project/export_presets.cfg",
            content: GODOT_EXPORT_PRESETS,
            encoding: "utf-8",
        },
        ...assets,
    ];
}

// ---- Defold ---------------------------------------------------------------
//
// `bob.jar ... build bundle` needs game.project pointing at a bootstrap
// collection, the collection, and the gameplay .script.

const DEFOLD_GAME_PROJECT = `[bootstrap]
main_collection = /main/main.collectionc

[project]
title = GameSmith Game
`;

const DEFOLD_MAIN_COLLECTION = `name: "main"
instances {
  id: "game"
  prototype: "/main/game.go"
}
`;

const DEFOLD_GAME_GO = `components {
  id: "script"
  component: "/main/main.script"
}
`;

function defoldScaffold(code: string, assets: ScaffoldFile[]): ScaffoldFile[] {
    return [
        { path: "/project/game.project", content: DEFOLD_GAME_PROJECT, encoding: "utf-8" },
        { path: "/project/main/main.collection", content: DEFOLD_MAIN_COLLECTION, encoding: "utf-8" },
        { path: "/project/main/game.go", content: DEFOLD_GAME_GO, encoding: "utf-8" },
        { path: "/project/main/main.script", content: code, encoding: "utf-8" },
        ...assets,
    ];
}

/**
 * Build the full, build-ready file tree for an engine from a run's tool
 * outputs. The assembler writes the returned files into the sandbox before
 * calling adapter.build().
 */
export function scaffoldProject(
    engine: Engine,
    toolOutputs: ToolOutputs,
): ScaffoldFile[] {
    const { code, assets } = extract(toolOutputs);

    switch (engine) {
        case "phaser":
        case "threejs":
            return browserScaffold("/project/src/main.js", code, assets);
        case "babylon":
            return browserScaffold("/project/src/main.ts", code, assets);
        case "godot":
            return godotScaffold(code, assets);
        case "defold":
            return defoldScaffold(code, assets);
        default:
            // EngineEnum carries non-day-1 engines (renpy/monogame/love2d/
            // stride) with no adapter; runtime-build rejects them upstream.
            throw new Error(`no scaffold for engine "${engine}"`);
    }
}
