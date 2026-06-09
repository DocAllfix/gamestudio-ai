/**
 * FASE 2 (D) — the composer renders a top_down_grid game (jrpg/roguelike). The
 * SAME EngineComposer port + driver, with TOP-DOWN semantics: solid_tiles =
 * walls, no gravity, 4-directional movement. Proves the archetype axis collapses.
 * Two screenshots (spawn + after moving down-right) so you see the walled room +
 * the character walking around the obstacles.
 *
 *   npx tsx scripts/verify/phaser_topdown_screenshot.ts
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { build } from "esbuild";
import { chromium } from "playwright";
import { PNG } from "pngjs";

import { composeFor } from "../../lib/runtime/composer/index.js";
import { buildTopDownRoom } from "../../lib/runtime/composer/sample-level.js";
import { analyzeSprite } from "../../lib/studio/sprite-sheet.js";
import type { TopDownGridSpec } from "../../lib/contracts/game-spec.contract.js";

const W = 40, H = 22, TILE = 16;
const solid = buildTopDownRoom({ width: W, height: H });
const PLAYER_ASSET_URL = "https://opengameart.org/sites/default/files/goblin_0.png";
const TILESET_ASSET_URL = "https://opengameart.org/sites/default/files/ground_7.png";
const BG_ASSET_URL = "https://opengameart.org/sites/default/files/landscape_fixed_backgrounds_-_morning.png";

const SPEC: TopDownGridSpec = {
    archetype: "top_down_grid",
    meta: { project_id: "00000000-0000-4000-8000-000000000000", plan_version: 1, engine: "phaser", style_pack_id: "pixel-art-dark", title: "Top-Down" },
    world: { width_tiles: W, height_tiles: H, tile_px: TILE, tmj_path: "/p/room.tmj", tileset_slot: "tileset", solid_tiles: solid },
    physics: { gravity: 0, jump_velocity: 0, move_speed: 200 },
    player: { spawn_tile: { x: 8, y: 8 }, asset_slot: "player", hitbox_px: { w: 24, h: 30 }, facing: "right" },
    entities: [],
    camera: { zoom: 1, deadzone_px: { w: 80, h: 60 }, follow: "player", clamp_to_world: true },
    parallax: [],
    background: { asset_slot: "sky", fill_mode: "stretch_cover" },
    hud: { elements: [{ type: "label", text: "Explore!" }] },
    goal: { type: "reach_exit", exit_tile: { x: 37, y: 19 } },
    mechanics: { flags: [], delta_script_path: null },
    asset_slots: [
        { slot: "sky", role: "background", binding: null, tile_size: null, frame: null, palette_hex: [], pixel_art: false },
        { slot: "tileset", role: "tileset", binding: null, tile_size: 16, frame: null, palette_hex: [], pixel_art: true },
        { slot: "player", role: "character", binding: null, tile_size: null, frame: null, palette_hex: [], pixel_art: true },
    ],
};

async function bindDataUrl(slot: string, url: string, id: string): Promise<Buffer> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${slot} asset HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const s = SPEC.asset_slots.find((a) => a.slot === slot);
    if (s) {
        s.binding = {
            source: "catalog", slot, asset_library_id: id,
            download_url: `data:image/png;base64,${buf.toString("base64")}`,
            license: "CC0-1.0", attribution_required: false, creator_name: null,
        };
    }
    return buf;
}

async function main(): Promise<void> {
    const playerBuf = await bindDataUrl("player", PLAYER_ASSET_URL, "00000000-0000-4000-8000-000000000001");
    const png = PNG.sync.read(playerBuf, { checkCRC: false });
    const sheet = analyzeSprite({ data: new Uint8ClampedArray(png.data), width: png.width, height: png.height });
    const ps = SPEC.asset_slots.find((s) => s.slot === "player");
    if (ps && sheet.is_sheet) ps.frame = { w: sheet.frame_w, h: sheet.frame_h, count: sheet.frame_count, cols: Math.round(png.width / sheet.frame_w), fps: 8, anchor: { x: 0.5, y: 1 } };
    await bindDataUrl("tileset", TILESET_ASSET_URL, "00000000-0000-4000-8000-000000000010");
    await bindDataUrl("sky", BG_ASSET_URL, "00000000-0000-4000-8000-000000000020");
    console.log(`player ${png.width}x${png.height} → ${sheet.is_sheet ? `SHEET ${sheet.frame_w}x${sheet.frame_h}` : "single"}, room ${W}x${H}`);

    const scene = composeFor(SPEC);
    const mainJs = scene.files.find((f) => f.path.endsWith("main.js"))!.content;
    const dir = join(process.cwd(), ".tmp-td-shot");
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
        await page.screenshot({ path: "topdown_phaser_1.png" });
        await page.keyboard.down("ArrowRight");
        await page.keyboard.down("ArrowDown");
        await page.waitForTimeout(2200);
        await page.screenshot({ path: "topdown_phaser_2.png" });
        await page.keyboard.up("ArrowRight");
        await page.keyboard.up("ArrowDown");
        const state = await page.evaluate(() => (globalThis as unknown as { __GAME_STATE__?: unknown }).__GAME_STATE__ ?? null);
        await browser.close();
        console.log(`crash: ${crash ?? "none"}`);
        console.log(`final state: ${JSON.stringify(state)}`);
        console.log("saved topdown_phaser_1.png + topdown_phaser_2.png");
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
