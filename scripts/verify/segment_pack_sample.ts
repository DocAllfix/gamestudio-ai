/**
 * Pack segmenter — verify on REAL object_pack sprites the vision backfill tagged.
 * Downloads each, runs segmentPack, draws the bounding boxes, and flattens onto a
 * dark background so the cut is visible.
 *
 *   npx tsx scripts/verify/segment_pack_sample.ts
 */
import { writeFileSync } from "node:fs";

import { PNG } from "pngjs";

import { segmentPack } from "../../lib/studio/segment.js";

const URLS: Array<[string, string]> = [
    ["weapons", "https://opengameart.org/sites/default/files/PracticeIII.png"],
    ["monsters", "https://opengameart.org/sites/default/files/characters_14.png"],
    ["humanoids", "https://opengameart.org/sites/default/files/Woman%20template.png"],
    ["skeletons", "https://opengameart.org/sites/default/files/super_random_sprites.png"],
];
const COLORS = [[255, 80, 80], [80, 200, 255], [120, 255, 120], [255, 220, 60], [230, 120, 255], [255, 150, 40], [120, 255, 220], [255, 120, 180]];

function drawBox(png: PNG, x: number, y: number, w: number, h: number, c: number[]): void {
    const set = (px: number, py: number) => {
        if (px < 0 || py < 0 || px >= png.width || py >= png.height) return;
        const i = (py * png.width + px) * 4;
        png.data[i] = c[0]; png.data[i + 1] = c[1]; png.data[i + 2] = c[2]; png.data[i + 3] = 255;
    };
    for (let t = 0; t < 2; t++) {
        for (let px = x; px < x + w; px++) { set(px, y + t); set(px, y + h - 1 - t); }
        for (let py = y; py < y + h; py++) { set(x + t, py); set(x + w - 1 - t, py); }
    }
}

async function main(): Promise<void> {
    for (const [name, url] of URLS) {
        try {
            const res = await fetch(url);
            if (!res.ok) { console.log(`${name}: HTTP ${res.status}`); continue; }
            const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()), { checkCRC: false });
            const regs = segmentPack({ data: new Uint8ClampedArray(png.data), width: png.width, height: png.height });
            regs.forEach((r, i) => drawBox(png, r.x, r.y, r.w, r.h, COLORS[i % COLORS.length]));

            const out = new PNG({ width: png.width, height: png.height });
            for (let i = 0; i < png.width * png.height; i++) {
                const a = png.data[i * 4 + 3] / 255;
                for (let k = 0; k < 3; k++) out.data[i * 4 + k] = Math.round(png.data[i * 4 + k] * a + 40 * (1 - a));
                out.data[i * 4 + 3] = 255;
            }
            writeFileSync(`seg_${name}.png`, PNG.sync.write(out));
            const sizes = regs.slice(0, 10).map((r) => `${r.w}x${r.h}`).join(" ");
            console.log(`${name}: ${png.width}x${png.height} → ${regs.length} regions  [${sizes}${regs.length > 10 ? " …" : ""}]`);
        } catch (e) {
            console.log(`${name}: fail ${String(e).slice(0, 60)}`);
        }
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
