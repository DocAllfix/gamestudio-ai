/**
 * Asset enrichment backfill — runs the deterministic Studio detectors over the
 * CC0 catalog and persists the enriched fields the GameSpec asset slot declares
 * (docs/FASE0_GAMESPEC_DESIGN.md §4 / migration 011). This is FASE 1 Priorità 1,
 * the "sblocca il composer" prerequisite: without populated tile_size / palette /
 * frame metadata the composer has no coherent assets to place.
 *
 * Pipeline per row: fetch PNG → decode to RGBA (pngjs) → run the detectors by
 * asset_type (lib/studio, the SAME pure functions the on-demand Studio UI uses)
 * → UPDATE asset_library_index. Incremental: only rows with enriched_at IS NULL.
 *
 * Scope: PNG only (the detector-relevant set — sprites/tilesets need alpha).
 * Non-PNG / un-decodable rows are skipped (left for a later pass), never marked
 * enriched, so a re-run retries them.
 *
 *   npx tsx scripts/enrich/backfill_assets.ts --dry-run --limit 10
 *   npx tsx scripts/enrich/backfill_assets.ts --limit 200
 *   npx tsx scripts/enrich/backfill_assets.ts            # whole pending catalog
 */
import "dotenv/config";

import { PNG } from "pngjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { detectTileSize, type ImageRGBA } from "../../lib/studio/tile-size.js";
import { extractPalette } from "../../lib/studio/palette.js";
import { analyzeFrames } from "../../lib/studio/frame-analyzer.js";

interface AssetRow {
    id: string;
    download_url: string | null;
    asset_type: string;
    file_format: string;
}

interface EnrichmentPatch {
    image_width: number;
    image_height: number;
    image_color_palette: string[];
    pixel_art: boolean;
    tile_size: number | null;
    frame_meta: { w: number; h: number; count: number; fps: number; anchor: { x: number; y: number } } | null;
    enriched_at: string;
}

const TILESET_TYPES = new Set(["tileset"]);
const SPRITE_TYPES = new Set(["sprite"]);

function parseArgs(argv: string[]): { dryRun: boolean; limit: number | null } {
    const dryRun = argv.includes("--dry-run");
    const limIdx = argv.indexOf("--limit");
    const limit = limIdx >= 0 && argv[limIdx + 1] ? Number.parseInt(argv[limIdx + 1], 10) : null;
    return { dryRun, limit };
}

function client(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    return createClient(url, key, { auth: { persistSession: false } });
}

async function fetchImage(url: string): Promise<ImageRGBA> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const png = PNG.sync.read(buf); // throws on non-PNG / corrupt
    return { data: new Uint8ClampedArray(png.data), width: png.width, height: png.height };
}

/** Run the detectors relevant to this asset_type and build the DB patch. */
function enrich(row: AssetRow, img: ImageRGBA): EnrichmentPatch {
    const palette = extractPalette(img, { colors: 8 });
    // Pixel-art hint: low-resolution raster art (sprites/tilesets) gets nearest
    // filtering. A coarse but useful default the Studio/composer can override.
    const pixel_art = img.width <= 256 && img.height <= 256;

    let tile_size: number | null = null;
    if (TILESET_TYPES.has(row.asset_type)) {
        tile_size = detectTileSize(img).tile_size;
    }

    let frame_meta: EnrichmentPatch["frame_meta"] = null;
    if (SPRITE_TYPES.has(row.asset_type)) {
        const fa = analyzeFrames(img);
        if (fa.count > 0) {
            frame_meta = { w: fa.frame_w, h: fa.frame_h, count: fa.count, fps: fa.fps, anchor: fa.anchor };
        }
    }

    return {
        image_width: img.width,
        image_height: img.height,
        image_color_palette: palette,
        pixel_art,
        tile_size,
        frame_meta,
        enriched_at: new Date().toISOString(),
    };
}

async function main(): Promise<void> {
    const { dryRun, limit } = parseArgs(process.argv.slice(2));
    const supabase = client();

    let q = supabase
        .from("asset_library_index")
        .select("id, download_url, asset_type, file_format")
        .is("enriched_at", null)
        .eq("file_format", "png")
        .ilike("download_url", "%.png");
    if (limit) q = q.limit(limit);

    const { data, error } = await q;
    if (error) throw new Error(`query failed: ${error.message}`);
    const rows = (data ?? []) as AssetRow[];

    console.log(`[backfill] ${rows.length} candidate PNG rows${dryRun ? " (DRY RUN — no writes)" : ""}`);

    let enriched = 0;
    let skipped = 0;
    let failed = 0;
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.download_url) {
            skipped++;
            continue;
        }
        try {
            const img = await fetchImage(row.download_url);
            const patch = enrich(row, img);
            if (dryRun) {
                console.log(
                    `[dry] ${row.id} ${row.asset_type} ${img.width}x${img.height} ` +
                        `palette=${patch.image_color_palette.length} tile_size=${patch.tile_size} ` +
                        `frames=${patch.frame_meta?.count ?? "-"}`,
                );
            } else {
                const { error: upErr } = await supabase
                    .from("asset_library_index")
                    .update(patch)
                    .eq("id", row.id);
                if (upErr) throw new Error(`update: ${upErr.message}`);
            }
            enriched++;
        } catch (err) {
            failed++;
            console.error({ context: "backfill.row", id: row.id, url: row.download_url, error: String(err) });
        }
        if ((i + 1) % 25 === 0) console.log(`[backfill] ${i + 1}/${rows.length}…`);
    }

    console.log(`[backfill] done — enriched=${enriched} skipped=${skipped} failed=${failed}`);
}

main().catch((err) => {
    console.error({ context: "backfill.main", error: String(err) });
    process.exit(1);
});
