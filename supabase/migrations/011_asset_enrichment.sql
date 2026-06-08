-- ============================================================
-- GAME STUDIO AI — Migration 011: asset enrichment columns
-- Supabase PostgreSQL
--
-- FASE 1 (Studio detection/enrichment), Priorità 1 — "sblocca il composer".
-- The deterministic Studio detectors (lib/studio/{tile-size,palette,
-- frame-analyzer}.ts) run over the catalog and persist the enriched fields the
-- GameSpec asset slot declares (docs/FASE0_GAMESPEC_DESIGN.md §4), so the scene
-- composer has coherent assets to place.
--
-- Additive + idempotent. Palette already has a home (image_color_palette,
-- migration 003 line 80) and is reused; this adds only what was missing:
--   - tile_size   : detected tileset grid (px); NULL when N/A or low confidence
--   - frame_meta  : {w,h,count,fps,anchor:{x,y}} from the frame analyzer; NULL
--                   for non-sprite assets
--   - pixel_art   : nearest-neighbour filtering hint (Godot texture_filter /
--                   Phaser pixelArt)
--   - enriched_at : when the detectors last ran (incremental-backfill marker)
--
-- Committed BEFORE apply per CLAUDE.md migration sync protocol. Apply via
-- scripts/apply_migrations.py.
-- ============================================================

alter table public.asset_library_index
    add column if not exists tile_size int,
    add column if not exists frame_meta jsonb,
    add column if not exists pixel_art boolean,
    add column if not exists enriched_at timestamptz;

-- Partial index for the backfill: quickly find production-lane rows not yet
-- enriched (enriched_at is null) so re-runs are incremental, not full scans.
create index if not exists idx_assets_unenriched
    on public.asset_library_index (id)
    where enriched_at is null;
