/**
 * runtimeBuild — merge-time compatibility bridge (W1 ↔ W3).
 *
 * W1 (reasoning) consumed `runtimeBuild(input)` from `lib/_mocks/runtime.mock`.
 * The real W3 entrypoint is `assemble(input, adapter)` — it needs a *second*
 * argument (the per-engine EngineAdapter), which W1 should not choose.
 *
 * This bridge keeps the `runtimeBuild(input, deps)` call shape and internally:
 * (1) picks the right EngineAdapter from `input.engine`, (2) calls `assemble`.
 *
 * `deps` (E2B/R2 clients) are INJECTED — there is no env default here, because
 * the real clients need the e2b / @aws-sdk SDKs which are not in package.json
 * until Ondata-1. To wire them: activate lib/runtime/sandbox/real-clients.ts.template
 * (see its header), then pass `createRealDeps()` at the call sites.
 */
import type { AssemblerInput, AssemblerOutput, EngineAdapter } from "../contracts/assembly-pipeline.contract.js";
import type { Engine } from "../contracts/game-plan.contract.js";
import type { RuntimeAdapterDeps } from "./engines/_runtime-helpers.js";
import { assemble } from "./assembler/assemble.js";
import { PhaserAdapter } from "./engines/phaser.js";
import { ThreejsAdapter } from "./engines/threejs.js";
import { GodotAdapter } from "./engines/godot.js";
import { DefoldAdapter } from "./engines/defold.js";
import { BabylonAdapter } from "./engines/babylon.js";

/** Map an EngineEnum value to its EngineAdapter instance. */
export function adapterFor(engine: Engine, deps: RuntimeAdapterDeps): EngineAdapter {
    switch (engine) {
        case "phaser":
            return new PhaserAdapter(deps);
        case "threejs":
            return new ThreejsAdapter(deps);
        case "godot":
            return new GodotAdapter(deps);
        case "defold":
            return new DefoldAdapter(deps);
        case "babylon":
            return new BabylonAdapter(deps);
        default:
            // EngineEnum carries non-day-1 engines (renpy/monogame/love2d/stride)
            // that have no adapter yet. The 5 day-1 engines are handled above.
            throw new Error(`runtimeBuild: no day-1 EngineAdapter for engine "${engine}"`);
    }
}

/**
 * Drop-in for the mock `runtimeBuild`, but with explicit deps injection.
 * Picks the adapter from `input.engine` and delegates to the real `assemble`.
 */
export async function runtimeBuild(
    input: AssemblerInput,
    deps: RuntimeAdapterDeps,
): Promise<AssemblerOutput> {
    const adapter = adapterFor(input.engine, deps);
    return assemble(input, adapter);
}
