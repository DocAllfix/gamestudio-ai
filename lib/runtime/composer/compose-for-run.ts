/**
 * Production entry for the composer pipeline (FASE 3.2 DAG integration). The
 * DAG's `compose` node calls this to build a renderable GameSpec for a real run,
 * reusing the prompt→GameSpec pieces (designToGameSpec + resolveSlots) so a
 * composed run uses the SAME asset selection as the tracer — on the production
 * path, not in a script.
 *
 * Returns the spec PLUS the asset url-ref files the assembler fetches into the
 * project's res:// paths (the Godot composer loads res://assets/sprites/<slot>.png).
 * Takes plain args (not the reasoning GameDesignDoc) to keep the runtime layer
 * free of a backwards dependency on lib/reasoning.
 */
import { PNG } from "pngjs";

import type { Engine, Genre } from "../../contracts/game-plan.contract.js";
import type { SideScrollerSpec, TopDownGridSpec } from "../../contracts/game-spec.contract.js";
import { analyzeSprite } from "../../studio/sprite-sheet.js";
import { designToGameSpec, resolveSlots } from "./from-prompt.js";

export interface ComposedAssetFile {
    path: string;
    content: string;
    encoding: "url-ref";
}

type Spec = SideScrollerSpec | TopDownGridSpec;

/** Set the player slot's frame (a sheet → ONE frame) by fetching + analyzing the
 * resolved sprite. Best-effort: a single sprite (the preferred case) needs no
 * frame, and a failed fetch/decode leaves it whole. */
async function setPlayerFrame(spec: Spec): Promise<void> {
    const slot = spec.asset_slots.find((s) => s.slot === "sprite_gen");
    if (!slot?.binding || slot.binding.source !== "catalog") return;
    try {
        const res = await fetch(slot.binding.download_url);
        if (!res.ok) return;
        const buf = Buffer.from(await res.arrayBuffer());
        const png = PNG.sync.read(buf, { checkCRC: false });
        const sheet = analyzeSprite({ data: new Uint8ClampedArray(png.data), width: png.width, height: png.height });
        if (sheet.is_sheet) {
            slot.frame = { w: sheet.frame_w, h: sheet.frame_h, count: sheet.frame_count, cols: Math.round(png.width / sheet.frame_w), fps: 8, anchor: { x: 0.5, y: 1 } };
        }
    } catch {
        /* no frame → the composer loads the whole image */
    }
}

/** Build the GameSpec + asset files for a run. `theme` (design mood) drives the
 * catalog selection; `genre` picks the archetype; difficulty tunes speed. */
export async function composeForRun(args: {
    genre: Genre;
    engine: Engine;
    theme: string;
    title: string;
    difficulty: "easy" | "normal" | "hard";
}): Promise<{ spec: Spec; assetFiles: ComposedAssetFile[] }> {
    const spec = designToGameSpec(
        { genre: args.genre, title: args.title.slice(0, 60), theme: args.theme.slice(0, 60), difficulty: args.difficulty },
        args.engine,
    );
    await resolveSlots(spec, args.theme);
    await setPlayerFrame(spec);
    // Each resolved slot → a url-ref at the res:// path the Godot composer loads
    // (res://assets/sprites/<slot>.png = /project/assets/sprites/<slot>.png). The
    // assembler fetches + validates these into the sandbox.
    const assetFiles = spec.asset_slots.flatMap((s): ComposedAssetFile[] =>
        s.binding && s.binding.source === "catalog"
            ? [{ path: `/project/assets/sprites/${s.slot}.png`, content: s.binding.download_url, encoding: "url-ref" }]
            : [],
    );
    return { spec, assetFiles };
}
