-- ============================================================
-- GAME STUDIO AI — Migration 015: sprite vision classification
-- Supabase PostgreSQL
--
-- The catalog is heterogeneous: single sprites, animation sheets, multi-object
-- packs, and non-asset junk (screenshots, palettes). A vision LLM (gpt-4o-mini,
-- strict JSON-schema enum) classifies each sprite so the resolver can ROUTE it:
--   sprite_kind = single | animation_sheet | object_pack | non_asset
--                 (single/sheet → usable; pack → segment; non_asset → drop)
--   perspective = side | top_down | front | isometric | unknown
--                 (matched to the GameSpec archetype: side_scroller→side, etc.)
-- vision_meta holds the rest (depicts, is_directional, subject, confidence,
-- model). Validated at ~85-90% with a safe "unknown" escape hatch; enums are
-- enforced at write time by the structured-output JSON schema (Anti-Hallucination
-- Protocol), so no free-form strings reach these columns.
--
-- Additive + idempotent. Populated by scripts/research/vision_backfill.py.
-- Committed BEFORE apply per the migration sync protocol.
-- ============================================================

alter table public.asset_library_index add column if not exists sprite_kind text;
alter table public.asset_library_index add column if not exists perspective text;
alter table public.asset_library_index add column if not exists vision_meta jsonb;
