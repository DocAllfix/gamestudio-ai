-- ============================================================
-- Migration 002 — fix search_code_knowledge to accept NULL p_engine
--
-- Bug in 001: the WHERE clause uses `ck.engine = p_engine` without
-- a NULL guard, so passing NULL to filter "any engine" returns zero
-- rows. The other filter params already have `(p_X is null or ...)`
-- patterns; this aligns engine with the same convention so the RPC
-- supports the cross-engine queries that lib/knowledge.ts and the
-- Phase 2 frontend tools need.
--
-- Re-creating the function is idempotent (CREATE OR REPLACE) and
-- preserves the existing signature, so all callers and indexes stay
-- intact.
-- ============================================================

create or replace function search_code_knowledge(
    p_engine text default null,
    p_category text default null,
    p_genres text[] default null,
    p_features text[] default null,
    p_complexity text default null,
    p_chunk_type text default null,
    p_min_quality int default 3,
    p_min_confidence int default 85,
    p_query_embedding vector(1536) default null,
    p_limit int default 5
)
returns table (
    id uuid,
    engine text,
    primary_category text,
    subcategories text[],
    chunk_type text,
    genre_tags text[],
    key_features text[],
    complexity text,
    quality_score smallint,
    reusability_score smallint,
    confidence_score smallint,
    summary text,
    code text,
    source_repo text,
    source_license text,
    similarity float
)
language plpgsql
as $$
begin
    return query
    select
        ck.id,
        ck.engine,
        ck.primary_category,
        ck.subcategories,
        ck.chunk_type,
        ck.genre_tags,
        ck.key_features,
        ck.complexity,
        ck.quality_score,
        ck.reusability_score,
        ck.confidence_score,
        ck.summary,
        ck.code,
        ck.source_repo,
        ck.source_license,
        case
            when p_query_embedding is not null
            then 1 - (ck.embedding <=> p_query_embedding)
            else 1.0
        end as similarity
    from public.code_knowledge ck
    where
        (p_engine is null or ck.engine = p_engine)
        and (p_category is null or ck.primary_category = p_category)
        and (p_genres is null or ck.genre_tags && p_genres)
        and (p_features is null or ck.key_features && p_features)
        and (p_complexity is null or ck.complexity = p_complexity)
        and (p_chunk_type is null or ck.chunk_type = p_chunk_type)
        and ck.quality_score >= p_min_quality
        and ck.confidence_score >= p_min_confidence
    order by
        case
            when p_query_embedding is not null
            then ck.embedding <=> p_query_embedding
            else 0
        end asc,
        ck.quality_score desc,
        ck.reusability_score desc
    limit p_limit;
end;
$$;
