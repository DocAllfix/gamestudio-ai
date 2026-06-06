/** code_gen_phaser_js — Phaser 3 JS generation (KB grounding optional). */
import { makeCodeGenTool } from "../_codegen.js";

export default makeCodeGenTool({
    id: "code_gen_phaser_js",
    name: "Phaser 3 (JavaScript)",
    kbEngine: "phaser",
    language: "javascript",
    // Claude Sonnet (via OpenRouter) for reliable, complex game code — same as
    // Godot; deepseek emitted too many broken games.
    model: "claude-sonnet-4-7",
});
