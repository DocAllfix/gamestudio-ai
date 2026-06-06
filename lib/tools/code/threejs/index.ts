/** code_gen_threejs_ts — Three.js TypeScript generation. */
import { makeCodeGenTool } from "../_codegen.js";

export default makeCodeGenTool({
    id: "code_gen_threejs_ts",
    name: "Three.js (TypeScript)",
    kbEngine: "threejs",
    language: "typescript",
    // Claude Sonnet (via OpenRouter) for reliable complex code — same as Godot.
    model: "claude-sonnet-4-7",
});
