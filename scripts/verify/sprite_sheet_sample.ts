/**
 * Sprite-sheet detector — verify on REAL catalog sprites, one by one. The goblin
 * (a sheet that rendered as a scramble) must read as a SHEET; a single 16x16
 * character must read as single.
 *
 *   npx tsx scripts/verify/sprite_sheet_sample.ts
 */
import { PNG } from "pngjs";

import { analyzeSprite } from "../../lib/studio/sprite-sheet.js";

const URLS = [
    "https://opengameart.org/sites/default/files/goblin_0.png",         // was the scramble
    "https://opengameart.org/sites/default/files/pixilart-drawing_1_2.png", // Adem 16x16 single
    "https://opengameart.org/sites/default/files/howl_0.png",            // "wolf animation"
    "https://opengameart.org/sites/default/files/farmera1.png",          // farmer
    "https://opengameart.org/sites/default/files/whisp.png",             // single wisp
    "https://opengameart.org/sites/default/files/cat_0.png",
];

async function main(): Promise<void> {
    for (const url of URLS) {
        try {
            const res = await fetch(url);
            if (!res.ok) { console.log(`HTTP ${res.status}  ${url.split("/").pop()}`); continue; }
            const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()), { checkCRC: false });
            const r = analyzeSprite({ data: new Uint8ClampedArray(png.data), width: png.width, height: png.height });
            const tag = r.is_sheet ? `SHEET ${r.layout} ${r.frame_count}f ${r.frame_w}x${r.frame_h}` : "single";
            console.log(`${png.width}x${png.height}  ${tag.padEnd(28)} conf=${r.confidence}%  ${url.split("/").pop()}`);
        } catch (e) {
            console.log(`fail ${String(e).slice(0, 50)}  ${url.split("/").pop()}`);
        }
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
