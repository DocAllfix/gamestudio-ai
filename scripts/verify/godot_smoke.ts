/**
 * FASE 2 — does the Godot composer output actually BUILD + RUN? Drives the real
 * W3 GodotAdapter against an E2B sandbox: write the composer's files → export
 * Web WASM → headless smoke. Completes the cross-engine proof (Phaser already
 * verified locally). Uses E2B (slow, ~minutes); no LLM, no credits beyond E2B.
 *
 *   npx tsx scripts/verify/godot_smoke.ts
 */
import "dotenv/config";

import { createE2bClient } from "../../lib/runtime/sandbox/real-clients.js";
import { GodotAdapter } from "../../lib/runtime/engines/godot.js";
import { composeFor } from "../../lib/runtime/composer/index.js";
import type { R2Client } from "../../lib/runtime/sandbox/r2.js";
import type { SandboxSession } from "../../lib/runtime/sandbox/e2b.js";
import type { SideScrollerSpec } from "../../lib/contracts/game-spec.contract.js";

const SPEC: SideScrollerSpec = {
    archetype: "side_scroller_platform",
    meta: { project_id: "00000000-0000-4000-8000-000000000000", plan_version: 1, engine: "godot", style_pack_id: "pixel-art-dark", title: "Godot Smoke" },
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

const stubR2: R2Client = {
    putObject: async () => { throw new Error("r2 not used in build+smoke"); },
    getSignedUrl: async () => { throw new Error("r2 not used in build+smoke"); },
};

async function main(): Promise<void> {
    const scene = composeFor(SPEC);
    console.log(`[godot] composer files: ${scene.files.map((f) => f.path).join(", ")}`);

    const adapter = new GodotAdapter({ e2b: createE2bClient(), r2: stubR2, bucket: "" });
    console.log("[godot] booting E2B sandbox…");
    const sandbox = (await adapter.bootSandbox()) as SandboxSession;
    console.log(`[godot] sandbox: ${sandbox.id}`);

    try {
        for (const f of scene.files) await adapter.writeFile(sandbox, f.path, f.content);
        console.log("[godot] files written. Exporting Web WASM (this is the slow part)…");

        const build = await adapter.build(sandbox);
        console.log(`[godot] BUILD exit=${build.exit_code} dur=${(build.duration_ms / 1000).toFixed(0)}s`);
        if (build.exit_code !== 0) {
            console.log("[godot] build stderr:\n" + build.stderr.slice(0, 2500));
            console.log("\nGODOT BUILD: FAIL ❌ (export did not produce the game)");
            process.exitCode = 1;
            return;
        }

        console.log("[godot] export OK. Running headless smoke…");
        const smoke = await adapter.smokeTest(sandbox);
        console.log(`[godot] SMOKE passed=${smoke.passed} crash=${smoke.crash_reason ?? "none"} dur=${(smoke.duration_ms / 1000).toFixed(0)}s`);
        if (!smoke.passed) console.log("[godot] smoke logs:\n" + (smoke.logs ?? "").slice(0, 1500));
        console.log(smoke.passed
            ? "\nGODOT BUILD+SMOKE: PASS ✅ (the composer's .tscn/.gd builds to WASM and runs)"
            : "\nGODOT BUILD+SMOKE: FAIL ❌ (builds but the game is broken)");
        process.exitCode = smoke.passed ? 0 : 1;
    } finally {
        await sandbox.close();
        console.log("[godot] sandbox closed.");
    }
}

main().catch((e) => { console.error("[godot] ERROR:", e instanceof Error ? e.message : e); process.exit(1); });
