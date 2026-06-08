-- ============================================================
-- GAME STUDIO AI — Migration 014: sprite-sheet flag
-- Supabase PostgreSQL
--
-- frame_meta count (connected blobs) can't tell a sprite SHEET from a single
-- sprite, so the composer rendered sheets as a scramble. The sprite-sheet
-- detector (lib/studio/sprite-sheet.ts, content-profile periodicity) gives the
-- reliable answer; this catalogs it so the resolver/composer load.spritesheet +
-- one frame for sheets, load.image for singles.
--
-- is_sheet : true when the sprite is a multi-frame sheet (strip/grid).
-- frame_meta (existing jsonb) is overwritten by the backfill with the detector's
-- {w,h,count,layout} — more accurate than the old connected-component count.
--
-- Additive + idempotent. Populated by scripts/enrich/backfill_sprite_sheet.ts.
-- Committed BEFORE apply per the migration sync protocol.
-- ============================================================

alter table public.asset_library_index
    add column if not exists is_sheet boolean;
