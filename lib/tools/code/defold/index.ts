/** code_gen_defold_lua — RAG-grounded Defold Lua generation. */
import { makeCodeGenTool } from "../_codegen.js";

export default makeCodeGenTool({
    id: "code_gen_defold_lua",
    name: "Defold (Lua)",
    kbEngine: "defold",
    language: "lua",
    model: "deepseek-chat",
});
