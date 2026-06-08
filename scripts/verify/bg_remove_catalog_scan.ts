/**
 * Catalog scan — how many sprites actually NEED background removal, and how many
 * are risky? A well-made sprite already ships with alpha; bg-removal only fixes
 * LOW-QUALITY catalog assets. This quantifies that, on real data.
 *
 * Per sprite: already_transparent (has alpha → no action) / cleaned (solid bg,
 * safe) / risky (solid bg but removal would ruin the subject) / no_uniform_bg.
 *
 *   npx tsx scripts/verify/bg_remove_catalog_scan.ts [limit=150]
 */
import "dotenv/config";

import { PNG } from "pngjs";
import { createClient } from "@supabase/supabase-js";

import { removeBackground } from "../../lib/studio/bg-remove.js";
import type { ImageRGBA } from "../../lib/studio/tile-size.js";

const LIMIT = Number.parseInt(process.argv[2] ?? "150", 10);
const MAX_BYTES = 12_000_000;
const MAX_PIXELS = 6_000_000;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function sanitizePng(buf: Buffer): Buffer {
    const iend = buf.indexOf("IEND", 0, "ascii");
    return iend === -1 ? buf : buf.subarray(0, iend + 8);
}

type Category = "already_transparent" | "cleaned" | "risky" | "no_uniform_bg";

function categorize(img: ImageRGBA): Category {
    let trans = 0;
    const n = img.width * img.height;
    for (let i = 0; i < n; i++) if (img.data[i * 4 + 3] < 16) trans++;
    if (trans / n > 0.05) return "already_transparent";
    const r = removeBackground(img, { tolerance: 24 });
    if (r.risky) return "risky";
    if (!r.applied) return "no_uniform_bg";
    return "cleaned";
}

async function main(): Promise<void> {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data, error } = await supabase
        .from("asset_library_index")
        .select("id, download_url")
        .eq("asset_type", "sprite").eq("file_format", "png").ilike("download_url", "%.png")
        .not("enriched_at", "is", null)
        .limit(LIMIT);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { id: string; download_url: string }[];
    console.log(`[scan] ${rows.length} sprites`);

    const tally: Record<string, number> = { already_transparent: 0, cleaned: 0, risky: 0, no_uniform_bg: 0, fetch_fail: 0, decode_fail: 0, too_large: 0 };
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
            const res = await fetch(row.download_url, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) { tally.fetch_fail++; continue; }
            if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) { tally.too_large++; continue; }
            const buf = sanitizePng(Buffer.from(await res.arrayBuffer()));
            let png;
            try { png = PNG.sync.read(buf, { checkCRC: false }); } catch { tally.decode_fail++; continue; }
            if (png.width * png.height > MAX_PIXELS) { tally.too_large++; continue; }
            tally[categorize({ data: new Uint8ClampedArray(png.data), width: png.width, height: png.height })]++;
        } catch { tally.fetch_fail++; }
        if ((i + 1) % 25 === 0) console.log(`[scan] ${i + 1}/${rows.length}…`);
        await sleep(80);
    }

    const ok = tally.already_transparent + tally.cleaned + tally.risky + tally.no_uniform_bg;
    console.log("\n=== RESULTS ===");
    for (const k of ["already_transparent", "cleaned", "risky", "no_uniform_bg"]) {
        const v = tally[k];
        console.log(`  ${k.padEnd(20)} ${String(v).padStart(4)}  ${ok ? ((v / ok) * 100).toFixed(0) : 0}%`);
    }
    console.log(`  (errors: fetch_fail=${tally.fetch_fail} decode_fail=${tally.decode_fail} too_large=${tally.too_large})`);
    const needsWork = tally.cleaned + tally.risky;
    console.log(`\n  → ${ok ? ((tally.already_transparent / ok) * 100).toFixed(0) : 0}% already clean (have alpha) · ${ok ? ((needsWork / ok) * 100).toFixed(0) : 0}% have a solid bg`);
    console.log(`  → of solid-bg: ${needsWork ? ((tally.cleaned / needsWork) * 100).toFixed(0) : 0}% auto-cleanable, ${needsWork ? ((tally.risky / needsWork) * 100).toFixed(0) : 0}% RISKY (manual)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
