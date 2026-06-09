/**
 * FASE 2 — the composer renders a REAL platformer level (not a flat floor).
 * Builds a GameSpec whose world.solid_tiles is a platformer level (floor +
 * jumpReach-spaced platforms), composes Phaser, and screenshots two frames
 * (spawn + after holding right) so you see the tiled level + platforms + scroll.
 *
 *   npx tsx scripts/verify/phaser_level_screenshot.ts
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { build } from "esbuild";
import { chromium } from "playwright";
import { PNG } from "pngjs";

import { composeFor } from "../../lib/runtime/composer/index.js";
import { buildPlatformerLevel } from "../../lib/runtime/composer/sample-level.js";
import { analyzeSprite } from "../../lib/studio/sprite-sheet.js";
import { DEFAULT_PLATFORMER_PHYSICS } from "../../lib/tools/level/_platformer-physics.js";
import type { SideScrollerSpec } from "../../lib/contracts/game-spec.contract.js";

const W = 40, H = 20, TILE = 16;
const solid = buildPlatformerLevel({ width: W, height: H, tilePx: TILE, physics: DEFAULT_PLATFORMER_PHYSICS });
/** The goblin SHEET that rendered as a scramble — now sliced to one frame. */
const PLAYER_ASSET_URL = "https://opengameart.org/sites/default/files/goblin_0.png";
/** A real CC0 ground tileset — tile 0 (top-left) is grass, replaces the cubes. */
const TILESET_ASSET_URL = "https://opengameart.org/sites/default/files/ground_7.png";

const SPEC: SideScrollerSpec = {
    archetype: "side_scroller_platform",
    meta: { project_id: "00000000-0000-4000-8000-000000000000", plan_version: 1, engine: "phaser", style_pack_id: "pixel-art-dark", title: "Level" },
    world: { width_tiles: W, height_tiles: H, tile_px: TILE, tmj_path: "/p/level.tmj", tileset_slot: "tileset", solid_tiles: solid },
    physics: { gravity: DEFAULT_PLATFORMER_PHYSICS.gravity, jump_velocity: DEFAULT_PLATFORMER_PHYSICS.jump_velocity, move_speed: DEFAULT_PLATFORMER_PHYSICS.move_speed },
    player: { spawn_tile: { x: 2, y: 14 }, asset_slot: "player", hitbox_px: { w: 24, h: 30 }, facing: "right" },
    entities: [],
    camera: { zoom: 1, deadzone_px: { w: 80, h: 60 }, follow: "player", clamp_to_world: true },
    parallax: [],
    background: { asset_slot: "sky", fill_mode: "stretch_cover" },
    hud: { elements: [{ type: "label", text: "Reach the goal!" }] },
    goal: { type: "reach_exit", exit_tile: { x: 37, y: 16 } },
    mechanics: { flags: [], delta_script_path: null },
    asset_slots: [
        { slot: "tileset", role: "tileset", binding: null, tile_size: 16, frame: null, palette_hex: [], pixel_art: true },
        { slot: "player", role: "character", binding: null, tile_size: null, frame: null, palette_hex: [], pixel_art: true },
    ],
};

async function main(): Promise<void> {
    // Bind a real transparent sprite to the player slot (data URL → no CORS in
    // the headless page; in production the assembler writes the file).
    const res0 = await fetch(PLAYER_ASSET_URL);
    if (!res0.ok) throw new Error(`player asset HTTP ${res0.status}`);
    const buf = Buffer.from(await res0.arrayBuffer());
    const dataUrl = `data:image/png;base64,${buf.toString("base64")}`;
    // Detect sheet-vs-single → tell the composer the frame size (problem 1).
    const png = PNG.sync.read(buf, { checkCRC: false });
    const sheet = analyzeSprite({ data: new Uint8ClampedArray(png.data), width: png.width, height: png.height });
    console.log(`player ${png.width}x${png.height} → ${sheet.is_sheet ? `SHEET ${sheet.frame_w}x${sheet.frame_h} (${sheet.frame_count}f)` : "single"}`);
    const playerSlot = SPEC.asset_slots.find((s) => s.slot === "player");
    if (playerSlot) {
        playerSlot.binding = {
            source: "catalog", slot: "player",
            asset_library_id: "00000000-0000-4000-8000-000000000001",
            download_url: dataUrl, license: "CC0-1.0",
            attribution_required: false, creator_name: null,
        };
        if (sheet.is_sheet) {
            playerSlot.frame = { w: sheet.frame_w, h: sheet.frame_h, count: sheet.frame_count, cols: Math.round(png.width / sheet.frame_w), fps: 8, anchor: { x: 0.5, y: 1 } };
        }
    }

    // Bind a real tileset (tile 0 = grass) to the tileset slot → real tiles.
    const resT = await fetch(TILESET_ASSET_URL);
    if (!resT.ok) throw new Error(`tileset asset HTTP ${resT.status}`);
    const tilesetDataUrl = `data:image/png;base64,${Buffer.from(await resT.arrayBuffer()).toString("base64")}`;
    const tilesetSlot = SPEC.asset_slots.find((s) => s.slot === "tileset");
    if (tilesetSlot) {
        tilesetSlot.binding = {
            source: "catalog", slot: "tileset",
            asset_library_id: "00000000-0000-4000-8000-000000000010",
            download_url: tilesetDataUrl, license: "CC0-1.0",
            attribution_required: false, creator_name: null,
        };
    }

    const scene = composeFor(SPEC);
    const mainJs = scene.files.find((f) => f.path.endsWith("main.js"))!.content;
    const dir = join(process.cwd(), ".tmp-level-shot");
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
        await page.screenshot({ path: "level_phaser_1.png" });
        await page.keyboard.down("ArrowRight");
        await page.waitForTimeout(2500);
        await page.screenshot({ path: "level_phaser_2.png" });
        await page.keyboard.up("ArrowRight");
        const state = await page.evaluate(() => (globalThis as unknown as { __GAME_STATE__?: { player_x: number; player_y: number } }).__GAME_STATE__ ?? null);
        await browser.close();
        console.log(`crash: ${crash ?? "none"}`);
        console.log(`final state: ${JSON.stringify(state)}`);
        console.log("saved level_phaser_1.png + level_phaser_2.png");
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
