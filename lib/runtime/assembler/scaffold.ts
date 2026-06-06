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

const GODOT_PROJECT = `; Engine configuration, GameSmith scaffold.
config_version=5

[application]
config/name="GameSmith Game"
run/main_scene="res://main.tscn"
config/features=PackedStringArray("4.3", "GL Compatibility")

[rendering]
renderer/rendering_method="gl_compatibility"
`;

const GODOT_MAIN_TSCN = `[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://main.gd" id="1"]

[node name="Main" type="Node2D"]
script = ExtResource("1")
`;

const GODOT_EXPORT_PRESETS = `[preset.0]

name="Web"
platform="Web"
runnable=true
export_path="build/web/index.html"

[preset.0.options]

variant/extensions_support=false
vram_texture_compression/for_desktop=true
html/export_icon=true
`;

function godotScaffold(code: string, assets: ScaffoldFile[]): ScaffoldFile[] {
    return [
        { path: "/project/project.godot", content: GODOT_PROJECT, encoding: "utf-8" },
        { path: "/project/main.gd", content: code, encoding: "utf-8" },
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
