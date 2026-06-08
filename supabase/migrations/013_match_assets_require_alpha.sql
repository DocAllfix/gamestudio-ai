-- ============================================================
-- GAME STUDIO AI — Migration 013: match_assets honours has_alpha
-- Supabase PostgreSQL
--
-- Enforces "no in-game character shows a background box" at the resolver: a new
-- p_require_alpha flag (default false → existing callers unchanged) makes the
-- RPC return ONLY transparent sprites, and the result now carries has_alpha.
-- Filtering inside the RPC (before the LIMIT) means transparent candidates are
-- found, not dropped by a post-filter. The resolver passes p_require_alpha=true
-- for sprite/character slots (migration 012 populated has_alpha).
--
-- Replaces the function from migration 003 (DROP + CREATE: the RETURNS TABLE
-- gains a column, which CREATE OR REPLACE can't do). Body otherwise identical.
-- Additive in behaviour; committed BEFORE apply per the sync protocol.
-- ============================================================

drop function if exists public.match_assets(vector, text, text, text, text, smallint, numeric, integer);

create or replace function public.match_assets(
    p_query_embedding vector(1536),
    p_asset_type text default null,
    p_style_pack text default null,
    p_genre text default null,
    p_engine text default null,
    p_min_quality smallint default 3,
    p_match_threshold numeric default 0.75,
    p_match_count int default 10,
    p_require_alpha boolean default false
)
returns table (
    id uuid,
    source_url text,
    download_url text,
    license text,
    asset_type text,
    semantic_description text,
    quality_score smallint,
    success_score numeric,
    has_alpha boolean,
    similarity numeric
)
language plpgsql
security definer
as $$
begin
    return query
    select
        a.id, a.source_url, a.download_url, a.license,
        a.asset_type, a.semantic_description,
        a.quality_score, a.success_score, a.has_alpha,
        (1 - (a.embedding <=> p_query_embedding))::numeric as similarity
    from public.asset_library_index a
    where
        (p_asset_type is null or a.asset_type = p_asset_type)
        and (p_style_pack is null or p_style_pack = any(a.style_pack_compat))
        and (p_genre is null or p_genre = any(a.genre_affinity))
        and (p_engine is null or p_engine = any(a.engine_compat))
        and a.quality_score >= p_min_quality
        and a.confidence_score >= 85
        and (not p_require_alpha or a.has_alpha is true)
        and (1 - (a.embedding <=> p_query_embedding)) >= p_match_threshold
    order by
        a.embedding <=> p_query_embedding,
        a.success_score desc,
        a.quality_score desc
    limit p_match_count;
end;
$$;
