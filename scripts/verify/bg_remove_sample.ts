/**
 * Background remover — before/after on a REAL CC0 sprite. Fetch boop1.png, run
 * removeBackground, report precision stats (did it touch the subject?), and
 * write upscaled comparison PNGs: _before (original) and _after (cleaned,
 * composited over MAGENTA so the now-transparent background is visible).
 *
 *   npx tsx scripts/verify/bg_remove_sample.ts
 */
import { writeFileSync } from "node:fs";

import { PNG } from "pngjs";

import { removeBackground } from "../../lib/studio/bg-remove.js";

const URL = process.argv[2] ?? "https://opengameart.org/sites/default/files/boop1.png";
const LABEL = (URL.split("/").pop() ?? "sprite").replace(/\.png.*$/i, "");
const SCALE = 8;

function upscaleOverMagenta(data: Uint8ClampedArray, w: number, h: number, opaqueOnly: boolean): Buffer {
    const png = new PNG({ width: w * SCALE, height: h * SCALE });
    for (let y = 0; y < h * SCALE; y++) {
        for (let x = 0; x < w * SCALE; x++) {
            const sx = Math.floor(x / SCALE), sy = Math.floor(y / SCALE);
            const si = (sy * w + sx) * 4;
            const di = (y * (w * SCALE) + x) * 4;
            const a = data[si + 3];
            if (opaqueOnly && a < 128) {
                png.data[di] = 255; png.data[di + 1] = 0; png.data[di + 2] = 255; png.data[di + 3] = 255; // magenta
            } else {
                png.data[di] = data[si]; png.data[di + 1] = data[si + 1]; png.data[di + 2] = data[si + 2]; png.data[di + 3] = 255;
            }
        }
    }
    return PNG.sync.write(png);
}

async function main(): Promise<void> {
    const res = await fetch(URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
    const img = { data: new Uint8ClampedArray(png.data), width: png.width, height: png.height };
    console.log(`sprite: ${img.width}x${img.height}`);

    const opaqueBefore = countOpaque(img.data);
    const out = removeBackground(img, { tolerance: 24 });

    const opaqueAfter = countOpaque(out.data);
    // Precision: of the pixels removed, how many sit in the central 50% box?
    // ~0 means we only cleared the border background, not the subject.
    const removedCentral = countRemovedInCenter(img.data, out.data, img.width, img.height);

    console.log(`bg colour detected: rgb(${out.bgColor.join(",")})`);
    console.log(`border uniformity: ${(out.borderUniformity * 100).toFixed(0)}%`);
    console.log(`interiorRemoved: ${out.interiorRemoved}  →  risky: ${out.risky}  →  applied: ${out.applied}`);
    console.log(`opaque pixels: ${opaqueBefore} → ${opaqueAfter}  (flood removed ${out.removed})`);
    console.log(`removed inside the central 50% box: ${removedCentral}`);

    writeFileSync(`${LABEL}_before.png`, upscaleOverMagenta(img.data, img.width, img.height, false));
    writeFileSync(`${LABEL}_after.png`, upscaleOverMagenta(out.data, img.width, img.height, true));
    console.log(`saved ${LABEL}_before.png + ${LABEL}_after.png (after = over magenta to show transparency)`);
}

function countOpaque(d: Uint8ClampedArray): number {
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 128) n++;
    return n;
}
function countRemovedInCenter(before: Uint8ClampedArray, after: Uint8ClampedArray, w: number, h: number): number {
    const x0 = Math.floor(w * 0.25), x1 = Math.ceil(w * 0.75), y0 = Math.floor(h * 0.25), y1 = Math.ceil(h * 0.75);
    let n = 0;
    for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
            const i = (y * w + x) * 4;
            if (before[i + 3] >= 128 && after[i + 3] < 128) n++;
        }
    }
    return n;
}

main().catch((e) => { console.error(e); process.exit(1); });
