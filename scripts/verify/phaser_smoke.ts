/**
 * FASE 2 verification — does the Phaser composer output actually RUN?
 *
 * Local, free, deterministic (no E2B, no LLM, no credits): take the scene the
 * composer emits for a hardcoded GameSpec, esbuild-bundle it, load it in a
 * headless Chromium (Playwright), and check it boots without console errors and
 * publishes window.__GAME_STATE__ (the playable-gate signal). Converts the
 * tracer bullet from "structurally correct" to "actually runs".
 *
 *   npx tsx scripts/verify/phaser_smoke.ts
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { build } from "esbuild";
import { chromium } from "playwright";

import { composeFor } from "../../lib/runtime/composer/index.js";
import type { SideScrollerSpec } from "../../lib/contracts/game-spec.contract.js";

const SPEC: SideScrollerSpec = {
    archetype: "side_scroller_platform",
    meta: { project_id: "00000000-0000-4000-8000-000000000000", plan_version: 1, engine: "phaser", style_pack_id: "pixel-art-dark", title: "Smoke" },
    world: { width_tiles: 60, height_tiles: 24, tile_px: 16, tmj_path: "/project/assets/maps/level1.tmj", tileset_slot: "tileset" },
    physics: { gravity: 1200, jump_velocity: 450, move_speed: 300 },
    player: { spawn_tile: { x: 2, y: 20 }, asset_slot: "player", hitbox_px: { w: 28, h: 38 }, facing: "right" },
    entities: [{ id: "coin-1", kind: "pickup", tile: { x: 30, y: 18 }, asset_slot: "coin", patrol_tiles: [], grants: [] }],
    camera: { zoom: 1, deadzone_px: { w: 80, h: 60 }, follow: "player", clamp_to_world: true },
    parallax: [],
    background: { asset_slot: "sky", fill_mode: "stretch_cover" },
    hud: { elements: [{ type: "label", text: "Reach the goal!" }] },
    goal: { type: "reach_exit", exit_tile: { x: 58, y: 20 } },
    mechanics: { flags: [], delta_script_path: null },
    asset_slots: [
        { slot: "tileset", role: "tileset", binding: null, tile_size: 16, frame: null, palette_hex: [], pixel_art: true },
        { slot: "player", role: "character", binding: null, tile_size: null, frame: null, palette_hex: [], pixel_art: true },
    ],
};

async function main(): Promise<void> {
    const scene = composeFor(SPEC);
    const mainJs = scene.files.find((f) => f.path.endsWith("main.js"));
    if (!mainJs) throw new Error("composer emitted no main.js");

    // Write inside the project so esbuild resolves `phaser` from node_modules.
    const dir = join(process.cwd(), ".tmp-composer-smoke");
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "main.js"), mainJs.content);

    try {
        await build({
            entryPoints: [join(dir, "src", "main.js")],
            bundle: true,
            format: "iife",
            platform: "browser",
            outfile: join(dir, "bundle.js"),
            logLevel: "silent",
        });
        const bundle = readFileSync(join(dir, "bundle.js"), "utf-8");
        console.log(`[smoke] bundle built: ${(bundle.length / 1024).toFixed(0)} KB`);

        const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
        const page = await browser.newPage();
        let crash: string | null = null;
        const logs: string[] = [];
        page.on("console", (m) => {
            if (m.type() === "error" && !crash) crash = "console.error: " + m.text().slice(0, 240);
            if (m.text().startsWith("__GS__")) logs.push(m.text());
        });
        page.on("pageerror", (e) => { if (!crash) crash = "pageerror: " + String(e.message).slice(0, 240); });

        await page.setContent("<!doctype html><html><body><div id=\"game\"></div></body></html>");
        await page.addScriptTag({ content: bundle });
        await page.waitForTimeout(4000);
        const state = await page.evaluate(() => (globalThis as unknown as { __GAME_STATE__?: unknown }).__GAME_STATE__ ?? null);
        await browser.close();

        console.log(`[smoke] frames observed (__GS__): ${logs.length}`);
        console.log(`[smoke] __GAME_STATE__: ${JSON.stringify(state)}`);
        console.log(`[smoke] crash: ${crash ?? "none"}`);

        const st = state as { player_alive?: boolean } | null;
        const passed = crash === null && st !== null && st.player_alive === true && logs.length > 0;
        console.log(passed ? "\nPHASER SMOKE: PASS ✅ (the composer's scene boots and runs)" : "\nPHASER SMOKE: FAIL ❌");
        process.exitCode = passed ? 0 : 1;
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
