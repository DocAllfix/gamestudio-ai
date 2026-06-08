/**
 * has_alpha backfill — verify, one sprite at a time, whether its background is
 * transparent (so it can go in-game with no box). Decodes each sprite and
 * measures the fraction of BORDER pixels that are transparent; has_alpha = that
 * fraction > 0.5 (the background is alpha). Writes both to asset_library_index
 * (migration 012). Incremental (has_alpha IS NULL).
 *
 *   npx tsx scripts/enrich/backfill_has_alpha.ts --dry-run --limit 20
 *   npx tsx scripts/enrich/backfill_has_alpha.ts            # all sprites
 */
import "dotenv/config";

import { PNG } from "pngjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const MAX_BYTES = 12_000_000;
const MAX_PIXELS = 6_000_000;

function parseArgs(argv: string[]): { dryRun: boolean; limit: number | null } {
    const limIdx = argv.indexOf("--limit");
    return { dryRun: argv.includes("--dry-run"), limit: limIdx >= 0 && argv[limIdx + 1] ? Number.parseInt(argv[limIdx + 1], 10) : null };
}

function sanitizePng(buf: Buffer): Buffer {
    const iend = buf.indexOf("IEND", 0, "ascii");
    return iend === -1 ? buf : buf.subarray(0, iend + 8);
}

/** Fraction of border pixels with alpha below `aT` — i.e. a transparent bg. */
function borderTransparentFraction(data: Buffer, w: number, h: number, aT = 16): number {
    let total = 0, trans = 0;
    const at = (x: number, y: number) => data[(y * w + x) * 4 + 3];
    for (let x = 0; x < w; x++) { total += 2; if (at(x, 0) < aT) trans++; if (at(x, h - 1) < aT) trans++; }
    for (let y = 1; y < h - 1; y++) { total += 2; if (at(0, y) < aT) trans++; if (at(w - 1, y) < aT) trans++; }
    return total > 0 ? trans / total : 0;
}

function client(): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

async function fetchPng(url: string): Promise<{ data: Buffer; width: number; height: number } | null> {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return null;
    const buf = sanitizePng(Buffer.from(await res.arrayBuffer()));
    const png = PNG.sync.read(buf, { checkCRC: false });
    if (png.width * png.height > MAX_PIXELS) return null;
    return { data: png.data, width: png.width, height: png.height };
}

async function main(): Promise<void> {
    const { dryRun, limit } = parseArgs(process.argv.slice(2));
    const supabase = client();
    let q = supabase
        .from("asset_library_index")
        .select("id, download_url")
        .eq("asset_type", "sprite").eq("file_format", "png").ilike("download_url", "%.png")
        .is("has_alpha", null);
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { id: string; download_url: string }[];
    console.log(`[has_alpha] ${rows.length} sprites${dryRun ? " (DRY RUN)" : ""}`);

    let withAlpha = 0, solid = 0, skipped = 0, failed = 0;
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
            const img = await fetchPng(row.download_url);
            if (!img) { skipped++; continue; }
            const frac = borderTransparentFraction(img.data, img.width, img.height);
            const has_alpha = frac > 0.5;
            if (has_alpha) withAlpha++; else solid++;
            if (dryRun) {
                if (i < 20) console.log(`  ${has_alpha ? "ALPHA" : "solid"}  border_trans=${(frac * 100).toFixed(0)}%  ${row.download_url.split("/").pop()}`);
            } else {
                const { error: upErr } = await supabase.from("asset_library_index")
                    .update({ has_alpha, transparent_fraction: frac }).eq("id", row.id);
                if (upErr) throw new Error(upErr.message);
            }
        } catch (err) {
            failed++;
            console.error({ context: "has_alpha.row", id: row.id, error: String(err).slice(0, 120) });
        }
        if ((i + 1) % 50 === 0) console.log(`[has_alpha] ${i + 1}/${rows.length}…`);
        await sleep(80);
    }
    console.log(`[has_alpha] done — has_alpha=${withAlpha} solid_bg=${solid} skipped=${skipped} failed=${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
