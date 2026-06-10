/**
 * FASE 3.2 E2E — the PRODUCTION composer pipeline, end to end in E2B.
 * Exercises the real seam: composeForRun (GameSpec + resolved assets via
 * resolveSlots) → tool_outputs (gamespec.json + asset url-refs) →
 * scaffoldProject (the gamespec branch) → write to sandbox (url-ref → res://) →
 * Godot WASM build → screenshot. No LLM (design args are hardcoded); resolveSlots
 * hits the real catalog. Proves a composed run renders a real game on the
 * production path, not the tracer.
 *
 *   npx tsx scripts/verify/composer_pipeline_e2e.ts "haunted forest"
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";

import { createE2bClient } from "../../lib/runtime/sandbox/real-clients.js";
import { GodotAdapter, GODOT_EXPORT_DIR } from "../../lib/runtime/engines/godot.js";
import { composeForRun } from "../../lib/runtime/composer/compose-for-run.js";
import { scaffoldProject } from "../../lib/runtime/assembler/scaffold.js";
import type { R2Client } from "../../lib/runtime/sandbox/r2.js";
import type { SandboxSession } from "../../lib/runtime/sandbox/e2b.js";

const stubR2: R2Client = {
    putObject: async () => { throw new Error("r2 not used"); },
    getSignedUrl: async () => { throw new Error("r2 not used"); },
};

const SHOT_RUNNER = `
const { chromium } = require("playwright");
const http = require("http"); const fs = require("fs"); const path = require("path");
const dir = process.argv[2], out = process.argv[3], PORT = 8732;
const MIME = { ".html":"text/html",".js":"text/javascript",".wasm":"application/wasm",".pck":"application/octet-stream",".png":"image/png" };
const server = http.createServer((req,res)=>{ const f = path.join(dir, req.url==="/"?"index.html":req.url.split("?")[0]); fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);res.end();return;} res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream","Cross-Origin-Opener-Policy":"same-origin","Cross-Origin-Embedder-Policy":"require-corp"}); res.end(d); }); });
(async()=>{ let browser; await new Promise(r=>server.listen(PORT,r));
  try{
    browser = await chromium.launch({ args:["--no-sandbox","--disable-dev-shm-usage","--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader"] });
    const page = await browser.newPage({ viewport:{ width:640, height:360 } });
    await page.goto("http://localhost:"+PORT+"/index.html",{ waitUntil:"domcontentloaded", timeout:30000 });
    await page.waitForTimeout(8000);
    try { await page.mouse.click(320, 180); } catch(e) {}
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(1500);
    await page.screenshot({ path: out });
    await page.keyboard.up("ArrowRight");
    console.log("SHOT_OK");
  }catch(e){ console.log("SHOT_ERR "+(e&&e.message?e.message:e)); }
  finally{ if(browser) await browser.close().catch(()=>{}); server.close(); }
})();
`;

async function main(): Promise<void> {
    const theme = process.argv.slice(2).join(" ") || "haunted forest";
    console.log(`\n[e2e] composeForRun (genre=hardcore_platformer, godot, theme="${theme}")…`);
    const { spec, assetFiles } = await composeForRun({ genre: "hardcore_platformer", engine: "godot", theme, title: "Pipeline Test", difficulty: "hard" });
    console.log(`[e2e] archetype=${spec.archetype}, resolved=${assetFiles.length} assets`);
    for (const a of assetFiles) console.log(`        ${a.path} ← ${a.content.split("/").pop()}`);

    // The exact tool_outputs the execution layer hands the Assembler.
    const toolOutputs = {
        compose: {
            tool_id: "compose_gamespec",
            files: [
                { path: "gamespec.json", content: JSON.stringify(spec), encoding: "utf-8" as const },
                ...assetFiles,
            ],
        },
    };
    const projectFiles = scaffoldProject("godot", toolOutputs);
    console.log(`[e2e] scaffoldProject → ${projectFiles.length} files (composed: ${projectFiles.some((f) => f.path.endsWith("main.tscn")) ? "yes" : "NO"})`);

    const adapter = new GodotAdapter({ e2b: createE2bClient(), r2: stubR2, bucket: "" });
    console.log("[e2e] booting sandbox…");
    const sandbox = (await adapter.bootSandbox()) as SandboxSession;
    try {
        // Mirror assemble.ts: utf-8 → write string; url-ref → fetch bytes → write.
        for (const f of projectFiles) {
            if (f.encoding === "url-ref") {
                try {
                    const r = await fetch(f.content);
                    if (!r.ok) throw new Error(`HTTP ${r.status}`);
                    await sandbox.writeFile(f.path, Buffer.from(await r.arrayBuffer()));
                    console.log(`        fetched ${f.path}`);
                } catch (e) {
                    console.log(`        skip ${f.path} (${e instanceof Error ? e.message : e}) → placeholder`);
                }
            } else {
                await adapter.writeFile(sandbox, f.path, f.content);
            }
        }
        console.log("[e2e] exporting WASM…");
        const build = await adapter.build(sandbox);
        if (build.exit_code !== 0) { console.log("[e2e] build FAIL:\n" + build.stderr.slice(0, 1500)); return; }
        console.log("[e2e] export OK. Rendering + screenshot…");
        await sandbox.writeFile("/project/shot-runner.cjs", SHOT_RUNNER);
        const r = await sandbox.runCommand(`NODE_PATH="$(npm root -g)" node /project/shot-runner.cjs ${GODOT_EXPORT_DIR} /project/shot.png`, 70_000);
        console.log("[e2e] runner:", (r.stdout || r.stderr).trim().slice(0, 200));
        const png = await sandbox.readFile("/project/shot.png");
        writeFileSync("composer_pipeline_e2e.png", png);
        console.log(`[e2e] saved composer_pipeline_e2e.png (${png.length} bytes)`);
    } finally {
        await sandbox.close();
        console.log("[e2e] sandbox closed.");
    }
}

main().catch((e) => { console.error("[e2e] ERROR:", e instanceof Error ? e.message : e); process.exit(1); });
