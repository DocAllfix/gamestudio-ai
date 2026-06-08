/**
 * FASE 2 milestone #2 — a REAL CC0 character in the composed Godot scene.
 *
 * Faithful to production: the composer already references res://assets/sprites/
 * player.png with guarded loading; here we fetch a real CC0 sprite from the
 * enriched catalog and write it to that path (the step the resolver+assembler
 * do in production), then build + screenshot. The red rectangle becomes a real
 * character — rendered by the real Godot WASM engine. Ground/sky stay clean
 * placeholders (a stretched tileset would be the very bug .tmj→TileMap fixes).
 *
 *   npx tsx scripts/verify/godot_real_asset.ts
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";

import { createE2bClient } from "../../lib/runtime/sandbox/real-clients.js";
import { GodotAdapter, GODOT_EXPORT_DIR } from "../../lib/runtime/engines/godot.js";
import { composeFor } from "../../lib/runtime/composer/index.js";
import type { R2Client } from "../../lib/runtime/sandbox/r2.js";
import type { SandboxSession } from "../../lib/runtime/sandbox/e2b.js";
import type { SideScrollerSpec } from "../../lib/contracts/game-spec.contract.js";

/** A real CC0 character from the enriched catalog: boop1.png — "a little boy". */
const PLAYER_ASSET_URL = "https://opengameart.org/sites/default/files/boop1.png";

const SPEC: SideScrollerSpec = {
    archetype: "side_scroller_platform",
    meta: { project_id: "00000000-0000-4000-8000-000000000000", plan_version: 1, engine: "godot", style_pack_id: "pixel-art-dark", title: "Real Asset" },
    world: { width_tiles: 60, height_tiles: 24, tile_px: 16, tmj_path: "/project/assets/maps/level1.tmj", tileset_slot: "tileset" },
    physics: { gravity: 1200, jump_velocity: 450, move_speed: 300 },
    player: { spawn_tile: { x: 3, y: 18 }, asset_slot: "player", hitbox_px: { w: 28, h: 38 }, facing: "right" },
    entities: [],
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
    await page.waitForTimeout(9000);
    await page.screenshot({ path: out });
    console.log("SHOT_OK");
  }catch(e){ console.log("SHOT_ERR "+(e&&e.message?e.message:e)); }
  finally{ if(browser) await browser.close().catch(()=>{}); server.close(); }
})();
`;

async function main(): Promise<void> {
    const scene = composeFor(SPEC);
    console.log(`[asset] fetching real CC0 player: ${PLAYER_ASSET_URL}`);
    const res = await fetch(PLAYER_ASSET_URL);
    if (!res.ok) throw new Error(`fetch player asset: HTTP ${res.status}`);
    const playerPng = Buffer.from(await res.arrayBuffer());
    console.log(`[asset] player sprite: ${playerPng.length} bytes`);

    const adapter = new GodotAdapter({ e2b: createE2bClient(), r2: stubR2, bucket: "" });
    console.log("[asset] booting sandbox…");
    const sandbox = (await adapter.bootSandbox()) as SandboxSession;
    try {
        for (const f of scene.files) await adapter.writeFile(sandbox, f.path, f.content);
        // The resolver+assembler step: write the real asset to the path the
        // composer's controller already loads (res://assets/sprites/player.png).
        await sandbox.writeFile("/project/assets/sprites/player.png", playerPng);
        console.log("[asset] real player.png written into the build. Exporting WASM…");

        const build = await adapter.build(sandbox);
        if (build.exit_code !== 0) { console.log("[asset] build FAIL:\n" + build.stderr.slice(0, 1500)); return; }
        console.log("[asset] export OK. Rendering + screenshot…");
        await sandbox.writeFile("/project/godot-shot-runner.cjs", SHOT_RUNNER);
        const r = await sandbox.runCommand(`NODE_PATH="$(npm root -g)" node /project/godot-shot-runner.cjs ${GODOT_EXPORT_DIR} /project/real_asset_shot.png`, 70_000);
        console.log("[asset] runner:", (r.stdout || r.stderr).trim().slice(0, 200));
        const png = await sandbox.readFile("/project/real_asset_shot.png");
        writeFileSync("composer_godot_real_player.png", png);
        console.log(`[asset] saved composer_godot_real_player.png (${png.length} bytes)`);
    } finally {
        await sandbox.close();
        console.log("[asset] sandbox closed.");
    }
}

main().catch((e) => { console.error("[asset] ERROR:", e instanceof Error ? e.message : e); process.exit(1); });
