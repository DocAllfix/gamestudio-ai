/** code_gen_godot_gdscript — RAG-grounded GDScript generation. */
import { makeCodeGenTool } from "../_codegen.js";

export default makeCodeGenTool({
    id: "code_gen_godot_gdscript",
    name: "Godot (GDScript)",
    kbEngine: "godot",
    language: "gdscript",
    model: "deepseek-chat",
});
