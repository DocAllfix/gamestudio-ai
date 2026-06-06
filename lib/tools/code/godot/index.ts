/** code_gen_godot_gdscript — RAG-grounded GDScript generation. */
import { makeCodeGenTool } from "../_codegen.js";

export default makeCodeGenTool({
    id: "code_gen_godot_gdscript",
    name: "Godot (GDScript)",
    kbEngine: "godot",
    language: "gdscript",
    model: "deepseek-chat",
    // The scaffold mounts this script on the root Node2D scene (main.tscn), so
    // it MUST start with `extends Node2D` and build the game by adding child
    // nodes in _ready() (do NOT extend RefCounted/Object, or Godot refuses to
    // instance it onto the Node2D and the scene loads empty).
    entrypointContract:
        "This script is the main scene's root script and MUST start with " +
        "`extends Node2D`. Build the whole game from here: create and add child " +
        "nodes (sprites, UI, player) in `_ready()`, drive logic in `_process(delta)` " +
        "and `_input(event)`. Never extend RefCounted or Object.",
});
