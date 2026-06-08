-- ============================================================
-- GAME STUDIO AI — Migration 012: sprite transparency flags
-- Supabase PostgreSQL
--
-- The product rule: an in-game character must NEVER show its background box.
-- A well-made sprite already ships with a transparent (alpha) background; a
-- catalog scan found ~64% already are, ~23% have a solid bg, and of those almost
-- all are "risky" for deterministic bg-removal. So the guarantee lives at
-- SELECTION, not removal: the resolver serves only transparent sprites for
-- character slots. This adds the verified signal it filters on:
--   - transparent_fraction : fraction of BORDER pixels that are transparent
--     (the background is alpha); computed per sprite by decoding the image.
--   - has_alpha            : transparent_fraction > 0.5 → background is
--     transparent → safe to place in-game with no box.
--
-- Additive + idempotent. Populated by scripts/enrich/backfill_has_alpha.ts.
-- Committed BEFORE apply per the migration sync protocol.
-- ============================================================

alter table public.asset_library_index
    add column if not exists has_alpha boolean,
    add column if not exists transparent_fraction real;

-- The resolver's hot path: "give me transparent sprites" for character slots.
create index if not exists idx_assets_has_alpha
    on public.asset_library_index (asset_type, has_alpha)
    where has_alpha = true;
