-- ============================================================
-- GAME STUDIO AI — Knowledge Base Schema
-- Supabase PostgreSQL + pgvector
-- Migration 001 — Phase 0.5-db
--
-- Builds on docs/SUPREME_RAG_BLUEPRINT.md §03 and adds the RAG
-- defense layer from docs/MASTER_EXECUTION_PLAN.md §01:
--   - confidence_score on code_knowledge (gate: >=85 accept)
--   - code_knowledge_quarantine (60-84 chunks, identical schema)
--   - classification_status on ingestion_log
--   - search_code_knowledge accepts p_min_confidence
--   - increment_retrieval_count for usage telemetry
-- ============================================================

create extension if not exists vector;

-- ============================================================
-- TABLE 1: code_knowledge
-- The accepted, vector-indexed knowledge base. One row per chunk
-- (confidence_score >= 85). The 60-84 lane lives in *_quarantine.
-- ============================================================

create table public.code_knowledge (
    id uuid primary key default gen_random_uuid(),

    -- === IDENTITY ===
    engine text not null,
    -- godot | phaser | renpy | defold | monogame | love2d | threejs | stride

    language text not null,
    -- gdscript | javascript | typescript | python | lua | csharp | glsl

    -- === TAXONOMY ===
    primary_category text not null,
    subcategories text[] not null default '{}',
    chunk_type text not null check (chunk_type in ('full_recipe', 'single_mechanic', 'structural_pattern')),

    -- === SEARCH METADATA ===
    genre_tags text[] not null default '{}',
    complexity text not null default 'intermediate',
    design_patterns text[] not null default '{}',
    key_features text[] not null default '{}',

    -- === QUALITY GATES ===
    quality_score smallint not null check (quality_score between 1 and 5),
    reusability_score smallint not null check (reusability_score between 1 and 5),
    confidence_score smallint not null default 85 check (confidence_score between 0 and 100),

    -- === CONTENT ===
    summary text not null,
    code text not null,
    loc int not null default 0,

    -- === PROVENANCE ===
    source_repo text,
    source_license text,
    source_file_paths text[] not null default '{}',
    scene_context text,

    -- === VECTOR ===
    embedding vector(1536),

    -- === USAGE TELEMETRY ===
    times_retrieved int not null default 0,
    positive_feedback int not null default 0,
    negative_feedback int not null default 0,

    -- === TIMESTAMPS ===
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ============================================================
-- TABLE 2: code_knowledge_quarantine
-- Identical schema to code_knowledge — holds chunks with
-- confidence_score in [60, 84] for manual review (MASTER §01.4).
-- ============================================================

create table public.code_knowledge_quarantine (
    id uuid primary key default gen_random_uuid(),

    engine text not null,
    language text not null,

    primary_category text not null,
    subcategories text[] not null default '{}',
    chunk_type text not null check (chunk_type in ('full_recipe', 'single_mechanic', 'structural_pattern')),

    genre_tags text[] not null default '{}',
    complexity text not null default 'intermediate',
    design_patterns text[] not null default '{}',
    key_features text[] not null default '{}',

    quality_score smallint not null check (quality_score between 1 and 5),
    reusability_score smallint not null check (reusability_score between 1 and 5),
    confidence_score smallint not null default 85 check (confidence_score between 0 and 100),

    summary text not null,
    code text not null,
    loc int not null default 0,

    source_repo text,
    source_license text,
    source_file_paths text[] not null default '{}',
    scene_context text,

    embedding vector(1536),

    times_retrieved int not null default 0,
    positive_feedback int not null default 0,
    negative_feedback int not null default 0,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ============================================================
-- TABLE 3: game_parameters
-- Numeric values extracted from real games — the "DNA of game feel".
-- ============================================================

create table public.game_parameters (
    id uuid primary key default gen_random_uuid(),

    source_repo text,
    engine text not null,
    genre text not null,

    parameter_group text not null,
    -- player_physics | combat_stats | enemy_stats | progression_economy |
    -- camera_settings | audio_config | spawn_config | difficulty_curve

    parameters jsonb not null,
    context text,

    quality_score smallint not null check (quality_score between 1 and 5),

    created_at timestamptz not null default now()
);

-- ============================================================
-- TABLE 4: ingestion_log
-- One row per processed repo. classification_status tracks the
-- 3-lane gate outcome from confidence_gate.py.
-- ============================================================

create table public.ingestion_log (
    id uuid primary key default gen_random_uuid(),

    source_url text not null unique,
    engine text not null,

    status text not null default 'pending',
    -- pending | scraped | filtered_out | parsed | classified | embedded | error

    classification_status text,
    -- accepted | quarantined | rejected — set after the confidence gate

    stars int,
    license text,
    loc int,
    comment_ratio real,
    quality_score_structural smallint,

    chunks_produced int default 0,
    error_message text,

    scraped_at timestamptz,
    parsed_at timestamptz,
    classified_at timestamptz,
    embedded_at timestamptz,

    created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES — code_knowledge (hot path for getReferences())
-- ============================================================

create index idx_ck_engine on public.code_knowledge (engine);
create index idx_ck_category on public.code_knowledge (primary_category);
create index idx_ck_chunk_type on public.code_knowledge (chunk_type);
create index idx_ck_complexity on public.code_knowledge (complexity);
create index idx_ck_quality on public.code_knowledge (quality_score desc);
create index idx_ck_confidence on public.code_knowledge (confidence_score desc);

create index idx_ck_genres on public.code_knowledge using gin (genre_tags);
create index idx_ck_features on public.code_knowledge using gin (key_features);
create index idx_ck_subcategories on public.code_knowledge using gin (subcategories);
create index idx_ck_patterns on public.code_knowledge using gin (design_patterns);

-- HNSW is preferred over IVFFlat for <1M rows: no training, incremental updates.
create index idx_ck_embedding on public.code_knowledge
    using hnsw (embedding vector_cosine_ops)
    with (m = 16, ef_construction = 64);

-- ============================================================
-- INDEXES — code_knowledge_quarantine
-- Same B-tree + GIN coverage as code_knowledge so the manual review
-- queries are fast. No HNSW: quarantine is not vector-searched.
-- ============================================================

create index idx_ckq_engine on public.code_knowledge_quarantine (engine);
create index idx_ckq_category on public.code_knowledge_quarantine (primary_category);
create index idx_ckq_chunk_type on public.code_knowledge_quarantine (chunk_type);
create index idx_ckq_complexity on public.code_knowledge_quarantine (complexity);
create index idx_ckq_quality on public.code_knowledge_quarantine (quality_score desc);
create index idx_ckq_confidence on public.code_knowledge_quarantine (confidence_score desc);

create index idx_ckq_genres on public.code_knowledge_quarantine using gin (genre_tags);
create index idx_ckq_features on public.code_knowledge_quarantine using gin (key_features);
create index idx_ckq_subcategories on public.code_knowledge_quarantine using gin (subcategories);
create index idx_ckq_patterns on public.code_knowledge_quarantine using gin (design_patterns);

-- ============================================================
-- INDEXES — game_parameters, ingestion_log
-- ============================================================

create index idx_gp_engine_genre on public.game_parameters (engine, genre);
create index idx_gp_group on public.game_parameters (parameter_group);

create index idx_il_status on public.ingestion_log (status);
create index idx_il_engine on public.ingestion_log (engine);

-- ============================================================
-- RPC: search_code_knowledge
-- Hybrid filter + vector search. p_min_confidence (default 85)
-- enforces the RAG defense gate at query time, complementing the
-- write-time split into code_knowledge vs code_knowledge_quarantine.
-- ============================================================

create or replace function search_code_knowledge(
    p_engine text,
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
        ck.engine = p_engine
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

-- ============================================================
-- RPC: get_reference_parameters
-- ============================================================

create or replace function get_reference_parameters(
    p_engine text,
    p_genre text,
    p_parameter_group text,
    p_min_quality int default 3,
    p_limit int default 5
)
returns table (
    id uuid,
    source_repo text,
    parameters jsonb,
    context text,
    quality_score smallint
)
language plpgsql
as $$
begin
    return query
    select
        gp.id,
        gp.source_repo,
        gp.parameters,
        gp.context,
        gp.quality_score
    from public.game_parameters gp
    where
        gp.engine = p_engine
        and gp.genre = p_genre
        and gp.parameter_group = p_parameter_group
        and gp.quality_score >= p_min_quality
    order by gp.quality_score desc
    limit p_limit;
end;
$$;

-- ============================================================
-- RPC: increment_retrieval_count
-- Bumps times_retrieved for a batch of ids in one round-trip so
-- the tool layer can update telemetry after every getReferences().
-- ============================================================

create or replace function increment_retrieval_count(p_ids uuid[])
returns void
language plpgsql
as $$
begin
    update public.code_knowledge
    set times_retrieved = times_retrieved + 1
    where id = any(p_ids);
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- service_role bypasses RLS. anon/authenticated get read-only on
-- code_knowledge and game_parameters; ingestion_log and the
-- quarantine table stay service-role-only (no policy = no access).
-- ============================================================

alter table public.code_knowledge enable row level security;
alter table public.code_knowledge_quarantine enable row level security;
alter table public.game_parameters enable row level security;
alter table public.ingestion_log enable row level security;

create policy "code_knowledge_read" on public.code_knowledge
    for select using (true);

create policy "game_parameters_read" on public.game_parameters
    for select using (true);
