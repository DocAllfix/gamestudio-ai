/**
 * Three.js EngineAdapter — Workstream W3.
 *
 * Browser-native like Phaser, so it inherits the shared
 * BrowserEngineAdapter behaviour (esbuild bundle, headless Chromium smoke
 * runner, zip → R2). `bootSandbox` and `webExport` land in [5-W3].
 */
import type { Engine } from "../../contracts/game-plan.contract.js";
import { BrowserEngineAdapter } from "./_browser-adapter.js";

export { SMOKE_RUNNER_PATH } from "./_browser-adapter.js";

export class ThreejsAdapter extends BrowserEngineAdapter {
    readonly engine: Engine = "threejs";
}
