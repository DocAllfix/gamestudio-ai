/**
 * FASE 3 Part 2 — prompt → game, end to end. The LLM (gpt-4.1-mini, OpenAI router
 * path) turns a one-line idea into a compact design brief; a deterministic step
 * expands it to a GameSpec; the composer renders it; we screenshot the running
 * Phaser game. The LLM never writes a line of engine code — it produces DATA.
 *
 *   npx tsx scripts/verify/prompt_to_game.ts "a hard ninja platformer in a dark forest"
 */
import "dotenv/config";

process.env.LLM_ROUTER_PROVIDER = "openai"; // route reasoning to the user's OpenAI credit

import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { build } from "esbuild";
import { chromium } from "playwright";
import { PNG } from "pngjs";

import { composeFor } from "../../lib/runtime/composer/index.js";
import { proposeDesign, designToGameSpec, resolveSlots } from "../../lib/runtime/composer/from-prompt.js";
import { analyzeSprite } from "../../lib/studio/sprite-sheet.js";
import type { SideScrollerSpec, TopDownGridSpec } from "../../lib/contracts/game-spec.contract.js";

/** Fetch each resolved catalog asset → a data URL (no CORS in the headless page;
 * in production the assembler writes the real file). Unloadable → unbound, so the
 * composer uses a placeholder. */
async function localizeAssets(spec: SideScrollerSpec | TopDownGridSpec): Promise<void> {
    for (const slot of spec.asset_slots) {
        const binding = slot.binding;
        if (!binding || binding.source !== "catalog") continue;
        try {
            const res = await fetch(binding.download_url);
            if (!res.ok) { slot.binding = null; continue; }
            const buf = Buffer.from(await res.arrayBuffer());
            binding.download_url = `data:image/png;base64,${buf.toString("base64")}`;
            if (slot.slot === "sprite_gen") {
                try {
                    const png = PNG.sync.read(buf, { checkCRC: false });
                    const sheet = analyzeSprite({ data: new Uint8ClampedArray(png.data), width: png.width, height: png.height });
                    if (sheet.is_sheet) slot.frame = { w: sheet.frame_w, h: sheet.frame_h, count: sheet.frame_count, cols: Math.round(png.width / sheet.frame_w), fps: 8, anchor: { x: 0.5, y: 1 } };
                } catch { /* non-PNG or odd sheet → load whole image, no frame */ }
            }
        } catch { slot.binding = null; }
    }
}

async function main(): Promise<void> {
    const prompt = process.argv.slice(2).join(" ") || "a hard ninja platformer in a dark forest";
    console.log(`\nPROMPT: "${prompt}"`);
    console.log("→ asking gpt-4.1-mini for a design brief…");
    const brief = await proposeDesign(prompt);
    console.log("→ brief:", JSON.stringify(brief));
    const spec = designToGameSpec(brief, "phaser");
    const outFile = `prompt_game_${brief.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "game"}.png`;
    console.log(`→ GameSpec: archetype=${spec.archetype}, level ${spec.world.width_tiles}x${spec.world.height_tiles}, move_speed=${spec.physics.move_speed}`);

    console.log(`→ resolving assets from the catalog by theme "${brief.theme}"…`);
    await resolveSlots(spec, brief.theme);
    const resolved = spec.asset_slots
        .map((s) => (s.binding && s.binding.source === "catalog" ? `${s.slot}#${s.binding.asset_library_id.slice(0, 8)}` : null))
        .filter((x): x is string => x !== null);
    console.log(`→ resolved: ${resolved.join("  ") || "(none → placeholders)"}`);
    await localizeAssets(spec);
    const scene = composeFor(spec);
    const mainJs = scene.files.find((f) => f.path.endsWith("main.js"))!.content;
    const dir = join(process.cwd(), ".tmp-prompt-shot");
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "main.js"), mainJs);
    try {
        await build({ entryPoints: [join(dir, "src", "main.js")], bundle: true, format: "iife", platform: "browser", outfile: join(dir, "bundle.js"), logLevel: "silent" });
        const bundle = readFileSync(join(dir, "bundle.js"), "utf-8");
        const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
        const page = await browser.newPage();
        await page.setViewportSize({ width: 640, height: 360 });
        let crash: string | null = null;
        page.on("console", (m) => { if (m.type() === "error" && !crash) crash = m.text().slice(0, 200); });
        page.on("pageerror", (e) => { if (!crash) crash = String(e.message).slice(0, 200); });
        await page.setContent('<!doctype html><html><body style="margin:0"><div id="game"></div></body></html>');
        await page.addScriptTag({ content: bundle });
        await page.waitForTimeout(1500);
        await page.keyboard.down("ArrowRight");
        await page.keyboard.down("ArrowDown");
        await page.waitForTimeout(700); // stop mid-level so the player stays in view (not at the goal)
        await page.screenshot({ path: outFile });
        await page.keyboard.up("ArrowRight");
        await page.keyboard.up("ArrowDown");
        await browser.close();
        console.log(`→ crash: ${crash ?? "none"} — saved ${outFile}\n`);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

main().catch((e) => { console.error("ERROR:", e instanceof Error ? e.message : e); process.exit(1); });
