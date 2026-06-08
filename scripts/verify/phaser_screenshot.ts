/**
 * FASE 2 — capture real screenshots of the composer's Phaser scene running in
 * headless Chromium. Two shots: at spawn, then after holding "right" so the
 * player moves and the camera scrolls (proves it PLAYS, not just renders).
 * Placeholder rectangles (the fixture's asset slots are unbound) — shows the
 * COMPOSITION, not final art.
 *
 *   npx tsx scripts/verify/phaser_screenshot.ts
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { build } from "esbuild";
import { chromium } from "playwright";

import { composeFor } from "../../lib/runtime/composer/index.js";
import type { SideScrollerSpec } from "../../lib/contracts/game-spec.contract.js";

const SPEC: SideScrollerSpec = {
    archetype: "side_scroller_platform",
    meta: { project_id: "00000000-0000-4000-8000-000000000000", plan_version: 1, engine: "phaser", style_pack_id: "pixel-art-dark", title: "Shot" },
    world: { width_tiles: 60, height_tiles: 24, tile_px: 16, tmj_path: "/project/assets/maps/level1.tmj", tileset_slot: "tileset" },
    physics: { gravity: 1200, jump_velocity: 450, move_speed: 300 },
    player: { spawn_tile: { x: 2, y: 18 }, asset_slot: "player", hitbox_px: { w: 28, h: 38 }, facing: "right" },
    entities: [{ id: "coin-1", kind: "pickup", tile: { x: 18, y: 20 }, asset_slot: "coin", patrol_tiles: [], grants: [] }],
    camera: { zoom: 1, deadzone_px: { w: 80, h: 60 }, follow: "player", clamp_to_world: true },
    parallax: [],
    background: { asset_slot: "sky", fill_mode: "stretch_cover" },
    hud: { elements: [{ type: "label", text: "Reach the goal!" }] },
    goal: { type: "reach_exit", exit_tile: { x: 56, y: 20 } },
    mechanics: { flags: [], delta_script_path: null },
    asset_slots: [
        { slot: "tileset", role: "tileset", binding: null, tile_size: 16, frame: null, palette_hex: [], pixel_art: true },
        { slot: "player", role: "character", binding: null, tile_size: null, frame: null, palette_hex: [], pixel_art: true },
    ],
};

async function main(): Promise<void> {
    const scene = composeFor(SPEC);
    const mainJs = scene.files.find((f) => f.path.endsWith("main.js"))!.content;

    const dir = join(process.cwd(), ".tmp-composer-shot");
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "main.js"), mainJs);
    try {
        await build({ entryPoints: [join(dir, "src", "main.js")], bundle: true, format: "iife", platform: "browser", outfile: join(dir, "bundle.js"), logLevel: "silent" });
        const bundle = readFileSync(join(dir, "bundle.js"), "utf-8");

        const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
        const page = await browser.newPage();
        await page.setViewportSize({ width: 640, height: 360 });
        await page.setContent("<!doctype html><html><body style=\"margin:0\"><div id=\"game\"></div></body></html>");
        await page.addScriptTag({ content: bundle });

        await page.waitForTimeout(1200);
        await page.screenshot({ path: "composer_phaser_1_spawn.png" });
        console.log("[shot] composer_phaser_1_spawn.png");

        // Hold "right" so the player walks and the camera scrolls.
        await page.keyboard.down("ArrowRight");
        await page.waitForTimeout(2200);
        await page.screenshot({ path: "composer_phaser_2_moving.png" });
        await page.keyboard.up("ArrowRight");
        console.log("[shot] composer_phaser_2_moving.png");

        const state = await page.evaluate(() => (globalThis as unknown as { __GAME_STATE__?: { player_x: number } }).__GAME_STATE__ ?? null);
        console.log(`[shot] final state: ${JSON.stringify(state)}`);
        await browser.close();
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
