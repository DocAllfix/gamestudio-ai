/**
 * Default `rotMap` — wraps rot-js Map generators behind the StrategyDeps.rotMap
 * interface. Dynamic import so rot-js is only loaded when the real procedural
 * path runs (tests inject a fake rotMap and never touch rot-js).
 *
 * rot-js API: new ROT.Map.<Gen>(w, h); map.create((x,y,value)=>{}) with value
 * 0=floor 1=wall; map.getRooms() returns rooms with getCenter() -> [x,y].
 * ROT.RNG.setSeed(seed) makes generation deterministic (the regenerate loop
 * varies the seed).
 */
import type { RotMapResult, RotMapSpec } from "./_strategies.js";

export async function rotMapDefault(spec: RotMapSpec): Promise<RotMapResult> {
    const ROT = await import("rot-js");
    ROT.RNG.setSeed(spec.seed);

    const w = spec.width;
    const h = spec.height;

    let gen:
        | InstanceType<typeof ROT.Map.Digger>
        | InstanceType<typeof ROT.Map.Uniform>
        | InstanceType<typeof ROT.Map.Cellular>
        | InstanceType<typeof ROT.Map.EllerMaze>;

    switch (spec.strategy) {
        case "rotjs_digger":
            gen = new ROT.Map.Digger(w, h);
            break;
        case "rotjs_cellular": {
            const cell = new ROT.Map.Cellular(w, h);
            cell.randomize(Math.min(Math.max(spec.density, 0.1), 0.9));
            // a few smoothing generations produce natural caves
            for (let i = 0; i < 4; i++) cell.create();
            gen = cell;
            break;
        }
        case "rotjs_maze":
            gen = new ROT.Map.EllerMaze(w, h);
            break;
        case "rotjs_uniform":
        default:
            gen = new ROT.Map.Uniform(w, h, { roomDugPercentage: spec.density });
            break;
    }

    const floor: boolean[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => false));
    gen.create((x: number, y: number, value: number) => {
        if (y >= 0 && y < h && x >= 0 && x < w) {
            floor[y]![x] = value === 0; // 0 = floor (walkable)
        }
    });

    // Room centers as anchors (Digger/Uniform). Cellular/Maze have none → scan.
    const anchors: { x: number; y: number }[] = [];
    const maybeRooms = gen as { getRooms?: () => { getCenter: () => [number, number] }[] };
    if (typeof maybeRooms.getRooms === "function") {
        for (const room of maybeRooms.getRooms()) {
            const [cx, cy] = room.getCenter();
            anchors.push({ x: cx, y: cy });
        }
    }

    return { floor, anchors };
}
