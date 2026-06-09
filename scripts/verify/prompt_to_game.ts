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
import { proposeDesign, designToGameSpec } from "../../lib/runtime/composer/from-prompt.js";
import { analyzeSprite } from "../../lib/studio/sprite-sheet.js";
import type { SideScrollerSpec, TopDownGridSpec } from "../../lib/contracts/game-spec.contract.js";

const ASSETS: Record<string, string> = {
    sprite_gen: "https://opengameart.org/sites/default/files/goblin_0.png",
    tileset: "https://opengameart.org/sites/default/files/ground_7.png",
    background: "https://opengameart.org/sites/default/files/landscape_fixed_backgrounds_-_morning.png",
};

async function bindAssets(spec: SideScrollerSpec | TopDownGridSpec): Promise<void> {
    for (const slot of spec.asset_slots) {
        const url = ASSETS[slot.slot];
        if (!url) continue;
        const res = await fetch(url);
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        slot.binding = {
            source: "catalog", slot: slot.slot, asset_library_id: "00000000-0000-4000-8000-000000000001",
            download_url: `data:image/png;base64,${buf.toString("base64")}`, license: "CC0-1.0",
            attribution_required: false, creator_name: null,
        };
        if (slot.slot === "sprite_gen") {
            const png = PNG.sync.read(buf, { checkCRC: false });
            const sheet = analyzeSprite({ data: new Uint8ClampedArray(png.data), width: png.width, height: png.height });
            if (sheet.is_sheet) slot.frame = { w: sheet.frame_w, h: sheet.frame_h, count: sheet.frame_count, cols: Math.round(png.width / sheet.frame_w), fps: 8, anchor: { x: 0.5, y: 1 } };
        }
    }
}

async function main(): Promise<void> {
    const prompt = process.argv.slice(2).join(" ") || "a hard ninja platformer in a dark forest";
    console.log(`\nPROMPT: "${prompt}"`);
    console.log("→ asking gpt-4.1-mini for a design brief…");
    const brief = await proposeDesign(prompt);
    console.log("→ brief:", JSON.stringify(brief));
    const spec = designToGameSpec(brief, "phaser");
    console.log(`→ GameSpec: archetype=${spec.archetype}, level ${spec.world.width_tiles}x${spec.world.height_tiles}, move_speed=${spec.physics.move_speed}`);

    await bindAssets(spec);
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
        await page.waitForTimeout(2200);
        await page.screenshot({ path: "prompt_game.png" });
        await page.keyboard.up("ArrowRight");
        await page.keyboard.up("ArrowDown");
        await browser.close();
        console.log(`→ crash: ${crash ?? "none"} — saved prompt_game.png\n`);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

main().catch((e) => { console.error("ERROR:", e instanceof Error ? e.message : e); process.exit(1); });
