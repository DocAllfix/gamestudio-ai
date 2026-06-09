/**
 * FASE 2 (D) — the composer's top_down_grid game on the REAL Godot engine (WASM
 * via E2B). Same port + driver as side_scroller, TOP-DOWN semantics (walls, no
 * gravity, 4-dir). Boots E2B, exports Web, presses down-right, screenshots.
 *
 *   npx tsx scripts/verify/godot_topdown_screenshot.ts
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";

import { PNG } from "pngjs";

import { createE2bClient } from "../../lib/runtime/sandbox/real-clients.js";
import { GodotAdapter, GODOT_EXPORT_DIR } from "../../lib/runtime/engines/godot.js";
import { composeFor } from "../../lib/runtime/composer/index.js";
import { buildTopDownRoom } from "../../lib/runtime/composer/sample-level.js";
import { analyzeSprite } from "../../lib/studio/sprite-sheet.js";
import type { R2Client } from "../../lib/runtime/sandbox/r2.js";
import type { SandboxSession } from "../../lib/runtime/sandbox/e2b.js";
import type { TopDownGridSpec } from "../../lib/contracts/game-spec.contract.js";

const PLAYER_ASSET_URL = "https://opengameart.org/sites/default/files/goblin_0.png";
const TILESET_ASSET_URL = "https://opengameart.org/sites/default/files/ground_7.png";
const BG_ASSET_URL = "https://opengameart.org/sites/default/files/landscape_fixed_backgrounds_-_morning.png";

const W = 40, H = 22, TILE = 16;
const SPEC: TopDownGridSpec = {
    archetype: "top_down_grid",
    meta: { project_id: "00000000-0000-4000-8000-000000000000", plan_version: 1, engine: "godot", style_pack_id: "pixel-art-dark", title: "TopDown Godot" },
    world: { width_tiles: W, height_tiles: H, tile_px: TILE, tmj_path: "/project/assets/maps/room.tmj", tileset_slot: "tileset", solid_tiles: buildTopDownRoom({ width: W, height: H }) },
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

const stubR2: R2Client = {
    putObject: async () => { throw new Error("r2 not used"); },
    getSignedUrl: async () => { throw new Error("r2 not used"); },
};

const SHOT_RUNNER = `
const { chromium } = require("playwright");
const http = require("http"); const fs = require("fs"); const path = require("path");
const dir = process.argv[2], out = process.argv[3], PORT = 8733;
const MIME = { ".html":"text/html",".js":"text/javascript",".wasm":"application/wasm",".pck":"application/octet-stream",".png":"image/png" };
const server = http.createServer((req,res)=>{ const f = path.join(dir, req.url==="/"?"index.html":req.url.split("?")[0]); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);res.end();return;} res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream","Cross-Origin-Opener-Policy":"same-origin","Cross-Origin-Embedder-Policy":"require-corp"}); res.end(d); }); });
(async()=>{ let browser; await new Promise(r=>server.listen(PORT,r));
  try{
    browser = await chromium.launch({ args:["--no-sandbox","--disable-dev-shm-usage","--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader"] });
    const page = await browser.newPage({ viewport:{ width:640, height:360 } });
    await page.goto("http://localhost:"+PORT+"/index.html",{ waitUntil:"domcontentloaded", timeout:30000 });
    await page.waitForTimeout(8000);
    try { await page.mouse.click(320, 180); } catch(e) {}
    await page.keyboard.down("ArrowRight"); await page.keyboard.down("ArrowDown");
    await page.waitForTimeout(1800);
    await page.screenshot({ path: out });
    await page.keyboard.up("ArrowRight"); await page.keyboard.up("ArrowDown");
    console.log("SHOT_OK");
  }catch(e){ console.log("SHOT_ERR "+(e&&e.message?e.message:e)); }
  finally{ if(browser) await browser.close().catch(()=>{}); server.close(); }
})();
`;

async function main(): Promise<void> {
    const playerPng = Buffer.from(await (await fetch(PLAYER_ASSET_URL)).arrayBuffer());
    const tilesetPng = Buffer.from(await (await fetch(TILESET_ASSET_URL)).arrayBuffer());
    const bgPng = Buffer.from(await (await fetch(BG_ASSET_URL)).arrayBuffer());
    const png = PNG.sync.read(playerPng, { checkCRC: false });
    const sheet = analyzeSprite({ data: new Uint8ClampedArray(png.data), width: png.width, height: png.height });
    const ps = SPEC.asset_slots.find((s) => s.slot === "player");
    if (ps && sheet.is_sheet) ps.frame = { w: sheet.frame_w, h: sheet.frame_h, count: sheet.frame_count, cols: Math.round(png.width / sheet.frame_w), fps: 8, anchor: { x: 0.5, y: 1 } };
    console.log(`player ${png.width}x${png.height} → ${sheet.is_sheet ? `SHEET ${sheet.frame_w}x${sheet.frame_h}` : "single"}, room ${W}x${H}`);

    const scene = composeFor(SPEC);
    const adapter = new GodotAdapter({ e2b: createE2bClient(), r2: stubR2, bucket: "" });
    console.log("[td] booting sandbox…");
    const sandbox = (await adapter.bootSandbox()) as SandboxSession;
    try {
        for (const f of scene.files) await adapter.writeFile(sandbox, f.path, f.content);
        await sandbox.writeFile("/project/assets/sprites/player.png", playerPng);
        await sandbox.writeFile("/project/assets/sprites/tileset.png", tilesetPng);
        await sandbox.writeFile("/project/assets/sprites/sky.png", bgPng);
        console.log("[td] exporting WASM…");
        const buildRes = await adapter.build(sandbox);
        if (buildRes.exit_code !== 0) { console.log("[td] build FAIL:\n" + buildRes.stderr.slice(0, 1500)); return; }
        console.log("[td] export OK. Rendering + screenshot…");
        await sandbox.writeFile("/project/td-runner.cjs", SHOT_RUNNER);
        const r = await sandbox.runCommand(`NODE_PATH="$(npm root -g)" node /project/td-runner.cjs ${GODOT_EXPORT_DIR} /project/td_shot.png`, 70_000);
        console.log("[td] runner:", (r.stdout || r.stderr).trim().slice(0, 200));
        const out = await sandbox.readFile("/project/td_shot.png");
        writeFileSync("topdown_godot.png", out);
        console.log(`[td] saved topdown_godot.png (${out.length} bytes)`);
    } finally {
        await sandbox.close();
        console.log("[td] sandbox closed.");
    }
}

main().catch((e) => { console.error("[td] ERROR:", e instanceof Error ? e.message : e); process.exit(1); });
