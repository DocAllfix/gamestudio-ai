/**
 * Scene composer driver (FASE 2). Dispatches on `spec.archetype`, derives the
 * engine-agnostic SceneInit, and calls the EngineComposer primitives in the
 * fixed order (docs/FASE0_GAMESPEC_DESIGN.md §3). The same driver runs every
 * engine adapter — only `finalize()` differs per engine.
 *
 * `composeScene(spec, composer)` is the contract surface; `composeFor(spec)`
 * picks the right adapter from `spec.meta.engine` and runs it.
 */
import type {
    ComposedScene,
    EngineComposer,
    SceneInit,
} from "../../contracts/engine-composer.contract.js";
import type { GameSpec } from "../../contracts/game-spec.contract.js";
import { makeGodotComposer } from "./godot.js";
import { makePhaserComposer } from "./phaser.js";

/** Default render viewport (the GameSpec describes the world, not the window). */
const DEFAULT_VIEWPORT = { width: 640, height: 360 };

export function composeScene(spec: GameSpec, composer: EngineComposer): ComposedScene {
    if (spec.archetype !== "side_scroller_platform") {
        throw new Error(`composer: archetype "${spec.archetype}" not implemented yet (FASE 2 covers side_scroller_platform)`);
    }

    const init: SceneInit = {
        meta: spec.meta,
        assetSlots: spec.asset_slots,
        gravity: spec.physics.gravity,
        pixelArt: spec.asset_slots.some((s) => s.pixel_art),
        viewport: DEFAULT_VIEWPORT,
    };

    composer.beginScene(init);
    composer.addBackground(spec.background);
    composer.addParallax(spec.parallax);
    composer.addTileMap(spec.world);
    composer.addPlayer(spec.player, spec.physics, spec.mechanics);
    for (const entity of spec.entities) composer.addEntity(entity);
    composer.addCamera(spec.camera, spec.world);
    composer.addHud(spec.hud);
    composer.addGoal(spec.goal);
    return composer.finalize();
}

/** Pick the engine adapter from the spec and compose. */
export function composeFor(spec: GameSpec): ComposedScene {
    switch (spec.meta.engine) {
        case "godot":
            return composeScene(spec, makeGodotComposer());
        case "phaser":
            return composeScene(spec, makePhaserComposer());
        default:
            throw new Error(`composer: no adapter for engine "${spec.meta.engine}" (FASE 2 = godot + phaser)`);
    }
}
