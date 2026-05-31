-- Migration 004 — fix match_loras AmbiguousColumn on rank_score
--
-- Discovery: scripts/ingestion_assets/08_test_asset_queries.py test T08
-- failed with:
--     AmbiguousColumn: column reference "rank_score" is ambiguous
--     LINE 16:     where rank_score > 0
-- PostgreSQL's planner cannot tell whether the `rank_score` inside the
-- WHERE clause refers to the CTE's computed column or to the function's
-- RETURNS-TABLE column of the same name (functions expose their output
-- columns into the body's scope, so the collision is real).
--
-- Fix: qualify the WHERE with the CTE alias explicitly. Idempotent —
-- CREATE OR REPLACE replaces the broken body in place.
--
-- This migration is additive (no schema change, no data migration), so
-- it can be applied any time after 003 without an ordering constraint.

create or replace function public.match_loras(
    p_style_pack text,
    p_asset_type text,
    p_genre text default null,
    p_base_model_preferred text default null,
    p_match_count int default 3
)
returns table (
    id uuid,
    hf_repo text,
    base_model text,
    trigger_words text[],
    recommended_weight numeric,
    negative_prompt text,
    quality_score smallint,
    success_score numeric,
    rank_score numeric
)
language plpgsql
security definer
as $$
begin
    return query
    with scored as (
        select
            l.id, l.hf_repo, l.base_model, l.trigger_words,
            l.recommended_weight, l.negative_prompt,
            l.quality_score, l.success_score,
            (case when p_style_pack = any(l.style_pack_ids) then 0.40 else 0.0 end
             + case when p_genre is not null and p_genre = any(l.genre_affinity) then 0.35 else 0.0 end
             + (l.quality_score::numeric / 5.0) * 0.15
             + least(l.success_score / 10.0, 1.0) * 0.10
             + case when p_base_model_preferred is not null and l.base_model = p_base_model_preferred then 0.05 else 0.0 end
            ) as rank_score
        from public.lora_library l
        where p_asset_type = any(l.asset_types)
    )
    select scored.id, scored.hf_repo, scored.base_model, scored.trigger_words,
           scored.recommended_weight, scored.negative_prompt,
           scored.quality_score, scored.success_score, scored.rank_score
    from scored
    where scored.rank_score > 0
    order by scored.rank_score desc
    limit p_match_count;
end;
$$;
