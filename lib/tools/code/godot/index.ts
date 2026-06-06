/** code_gen_godot_gdscript — RAG-grounded GDScript generation. */
import { makeCodeGenTool } from "../_codegen.js";

export default makeCodeGenTool({
    id: "code_gen_godot_gdscript",
    name: "Godot (GDScript)",
    kbEngine: "godot",
    language: "gdscript",
    model: "deepseek-chat",
    // The scaffold mounts this script on the root Node2D scene (main.tscn), so
    // it MUST be valid Godot 4.3 GDScript. The LLM tends to emit Godot 3 APIs
    // and Python-style syntax, which fail to parse / load an empty scene.
    entrypointContract:
        "TARGET: Godot 4.3 GDScript ONLY. This script is the main scene's root " +
        "and MUST start with `extends Node2D`; build the game by creating and " +
        "adding child nodes in `_ready()`, logic in `_process(delta)` / " +
        "`_input(event)`. Never extend RefCounted or Object. " +
        "STRICT Godot 4 rules (Godot 3 APIs do NOT exist and will crash): " +
        "use CharacterBody2D (not KinematicBody2D), Sprite2D (not Sprite), " +
        "node.position/size (not rect_position/rect_size), " +
        "Image.create()/set_pixel without lock()/unlock(), " +
        "@onready/@export annotations, `move_and_slide()` with the `velocity` " +
        "property. SYNTAX: GDScript is NOT Python — never break a line after a " +
        "binary operator (`and`/`or`/`+`); keep each boolean expression on ONE " +
        "line, or wrap the whole expression in parentheses. Use tabs for " +
        "indentation. Draw something visible immediately so the scene is not blank.",
});
