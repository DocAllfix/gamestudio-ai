/**
 * Tests for webExport() on all 5 day-1 adapters ([5-W3]).
 *
 * webExport returns a WebBuildArtifact: an iframe_url served from R2, the
 * bundle size, a browser|pwa target, and mobile_apk_url (non-null only for
 * Defold's day-1 native .apk). Browser engines ≈ identity of the build;
 * godot/defold = WASM export. Driven by the fake sandbox + e2b/r2 mocks.
 */
import { describe, expect, it } from "vitest";

import { e2bMock, r2Mock } from "../../../_mocks/baas.mock.js";
import { makeFakeSandbox } from "./_fake-sandbox.js";
import { PhaserAdapter } from "../phaser.js";
import { ThreejsAdapter } from "../threejs.js";
import { BabylonAdapter } from "../babylon.js";
import { GodotAdapter } from "../godot.js";
import { DefoldAdapter } from "../defold.js";

const deps = { e2b: e2bMock, r2: r2Mock, bucket: "game-builds" };

/** A sandbox whose `du -sb` reports a non-zero byte count. */
/** A sandbox whose web dirs hold real files, so webExport's listFiles/
 * readFile walk + R2 upload produce a non-zero bundle. Pre-populates the
 * browser dir (/project/dist) and the godot/defold web dirs. */
function sizedSandbox() {
    const sbx = makeFakeSandbox([{ match: "test -f", exit_code: 0 }]);
    for (const dir of ["/project/dist", "/project/build/web", "/project/build/html5"]) {
        void sbx.writeFile(`${dir}/index.html`, "<!doctype html><title>game</title>");
        void sbx.writeFile(`${dir}/bundle.js`, "console.log('game')");
    }
    return sbx;
}

const browserAdapters = [
    ["phaser", new PhaserAdapter(deps)],
    ["threejs", new ThreejsAdapter(deps)],
    ["babylon", new BabylonAdapter(deps)],
] as const;

describe("webExport() — browser-native engines", () => {
    for (const [name, adapter] of browserAdapters) {
        it(`${name}: returns a WebBuildArtifact with a non-empty iframe_url, target=browser, no apk`, async () => {
            const art = await adapter.webExport(sizedSandbox());
            expect(art.iframe_url.length).toBeGreaterThan(0);
            expect(art.iframe_url).toMatch(/^https?:\/\//);
            expect(art.target).toBe("browser");
            expect(art.mobile_apk_url).toBeNull();
            expect(art.bundle_size_bytes).toBeGreaterThan(0);
        });
    }
});

describe("webExport() — godot (WASM)", () => {
    it("returns a non-empty iframe_url, no apk", async () => {
        const art = await new GodotAdapter(deps).webExport(sizedSandbox());
        expect(art.iframe_url.length).toBeGreaterThan(0);
        expect(art.mobile_apk_url).toBeNull();
    });
});

describe("webExport() — defold (WASM + native .apk)", () => {
    it("returns a non-empty iframe_url AND a non-null mobile_apk_url", async () => {
        // The .apk exists (test -f → 0) and the html5 web dir holds files.
        const sandbox = makeFakeSandbox([{ match: "test -f", exit_code: 0 }]);
        void sandbox.writeFile("/project/build/html5/index.html", "<!doctype html>");
        void sandbox.writeFile("/project/build/html5/game.js", "init()");
        const art = await new DefoldAdapter(deps).webExport(sandbox);
        expect(art.iframe_url.length).toBeGreaterThan(0);
        expect(art.mobile_apk_url).not.toBeNull();
        expect(art.mobile_apk_url).toMatch(/^https?:\/\//);
    });
});

describe("bootSandbox() — all 5 adapters", () => {
    for (const [name, adapter] of [
        ...browserAdapters,
        ["godot", new GodotAdapter(deps)],
        ["defold", new DefoldAdapter(deps)],
    ] as const) {
        it(`${name}: boots a sandbox with an id`, async () => {
            const sbx = await adapter.bootSandbox();
            expect(sbx.id).toMatch(/^sbx_mock_/);
            await sbx.close();
        });
    }
});
