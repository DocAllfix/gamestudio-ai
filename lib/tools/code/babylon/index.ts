/**
 * code_gen_babylon_ts — Babylon.js TypeScript generation.
 *
 * NO KB harvest (kbEngine: null): the Phase-1 ingestion is frozen and
 * never covered Babylon. Grounding comes from BABYLON_GROUNDING, the
 * curated canonical snippets transcribed from the official docs.
 */
import { makeCodeGenTool } from "../_codegen.js";
import { BABYLON_GROUNDING } from "./_grounding.js";

export default makeCodeGenTool({
    id: "code_gen_babylon_ts",
    name: "Babylon.js (TypeScript)",
    kbEngine: null,
    language: "typescript",
    model: "deepseek-chat",
    curatedGrounding: BABYLON_GROUNDING,
});
