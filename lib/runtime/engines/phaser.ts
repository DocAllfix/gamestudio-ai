/**
 * Phaser EngineAdapter — Workstream W3.
 *
 * Phaser is browser-native JS/TS, so build / smokeTest / package are the
 * shared BrowserEngineAdapter behaviour (esbuild bundle, headless Chromium
 * smoke runner, zip → R2). `bootSandbox` and `webExport` land in [5-W3]
 * when the full EngineAdapter is wired into the Assembler.
 */
import type { Engine } from "../../contracts/game-plan.contract.js";
import { BrowserEngineAdapter } from "./_browser-adapter.js";

export { SMOKE_RUNNER_PATH } from "./_browser-adapter.js";

export class PhaserAdapter extends BrowserEngineAdapter {
    readonly engine: Engine = "phaser";
}
