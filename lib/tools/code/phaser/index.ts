/** code_gen_phaser_js — Phaser 3 JS generation (KB grounding optional). */
import { makeCodeGenTool } from "../_codegen.js";

export default makeCodeGenTool({
    id: "code_gen_phaser_js",
    name: "Phaser 3 (JavaScript)",
    kbEngine: "phaser",
    language: "javascript",
    model: "deepseek-chat",
});
