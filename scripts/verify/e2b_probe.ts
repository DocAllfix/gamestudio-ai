/**
 * E2B sandbox probe — cheap confirmation the build toolchain is live BEFORE
 * committing to a slow Godot WASM build. Boots the W3 template sandbox and
 * checks the binaries the Godot adapter relies on (godot + export templates +
 * node + esbuild). Read-only; ~30-60s; minimal E2B usage.
 *
 *   npx tsx scripts/verify/e2b_probe.ts
 */
import "dotenv/config";

import { createE2bClient } from "../../lib/runtime/sandbox/real-clients.js";
import { bootSandbox } from "../../lib/runtime/sandbox/e2b.js";

async function main(): Promise<void> {
    console.log(`E2B_API_KEY: ${process.env.E2B_API_KEY ? "set" : "MISSING"}`);
    console.log(`E2B_TEMPLATE_ID: ${process.env.E2B_TEMPLATE_ID ?? "MISSING (will use bare image)"}`);

    const e2b = createE2bClient();
    console.log("[probe] booting sandbox…");
    const sbx = await bootSandbox(e2b);
    console.log(`[probe] sandbox booted: ${sbx.id}`);

    const checks = [
        "godot --version",
        "node --version",
        "esbuild --version",
        "ls /root/.local/share/godot/export_templates/ 2>/dev/null || echo NO_TEMPLATES_DIR",
        "test -f /opt/coi-serviceworker.js && echo COI_OK || echo NO_COI",
    ];
    try {
        for (const cmd of checks) {
            const r = await sbx.runCommand(cmd);
            const out = (r.stdout || r.stderr).trim().replace(/\n/g, " ").slice(0, 180);
            console.log(`$ ${cmd}\n   exit=${r.exit_code}  ${out}`);
        }
    } finally {
        await sbx.close();
        console.log("[probe] sandbox closed.");
    }
}

main().catch((e) => { console.error("[probe] FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
