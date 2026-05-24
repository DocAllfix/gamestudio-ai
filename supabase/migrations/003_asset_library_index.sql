-- ============================================================
-- GAME STUDIO AI — Asset Library + Catalog Schema
-- Supabase PostgreSQL + pgvector
-- Migration 003 — Fase 2 / Gap 7
--
-- Adds the asset side of the RAG defense layer:
--   - asset_library_index: ~150-200k CC0/permissive assets indexed
--     from Kenney, OpenGameArt, Quaternius, KayKit, Poly Haven,
--     Freesound, Sketchfab CC0, Pmndrs Drei, GameAssets.com,
--     CraftPix Freebies, itch.io free, Kenney Audio.
--   - style_packs: 30 curated visual style packs (J.3 blueprint v2).
--   - genre_templates: 14 baseline Game Plans (N.3 blueprint v2).
--   - reference_games: 80 shipped games with moodboard analysis.
--   - audio_mood_library: 12 mood baselines with Suno prompts.
--   - lora_library: ~40 verified LoRA models for sprite/asset gen.
--
-- Anti-corruption guardrails baked into schema:
--   - license whitelist enforced via CHECK constraint
--   - confidence_score >= 85 lane (same as code_knowledge)
--   - source_url UNIQUE prevents cross-source duplication
--   - SHA-256 dedup via content_hash for binary content
-- ============================================================

-- ============================================================
-- TABLE 1: asset_library_index
-- One row per individual asset (sprite/model/audio/font/etc).
-- Embedding type is per-asset (CLIP for image, CLAP for audio,
-- text-embedding-3-small for metadata-only descriptions).
-- ============================================================

create table public.asset_library_index (
    id uuid primary key default gen_random_uuid(),

    -- === IDENTITY ===
    source_library text not null,
    -- kenney | opengameart | quaternius | kaykit | polyhaven |
    -- freesound | kenney_audio | sketchfab_cc0 | craftpix |
    -- itch_free | gameassets_com | pmndrs_drei

    source_url text not null unique,
    -- canonical URL on the source platform (uniqueness prevents
    -- cross-library duplicate ingestion of the same asset)

    download_url text,
    -- direct CDN/file URL to fetch the binary at runtime

    thumbnail_url text,

    content_hash text,
    -- SHA-256 of the binary content, for dedup across libraries
    -- (e.g. same Kenney pack mirrored on GameAssets.com)

    -- === LICENSE (hard-enforced allowlist) ===
    license text not null check (license in (
        'CC0-1.0', 'CC-BY-4.0', 'MIT', 'Apache-2.0',
        'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Zlib',
        'Unlicense', 'OFL-1.1'
    )),
    license_verified_at timestamptz not null default now(),
    attribution_required boolean not null default false,
    creator_name text,

    -- === ASSET TYPE ===
    asset_type text not null check (asset_type in (
        'sprite', 'tileset', 'ui_element', 'icon', 'logo',
        'background', 'concept_art', 'model_3d', 'animation_3d',
        'texture', 'hdri', 'shader', 'particle_effect',
        'audio_bgm', 'audio_sfx', 'audio_voice', 'font'
    )),

    file_format text not null,
    -- png, jpg, svg, gltf, glb, obj, fbx, blend, ogg, mp3, wav,
    -- ttf, otf, glsl, hlsl

    file_size_kb integer,

    -- === DIMENSIONS (per asset type, NULL where N/A) ===
    image_width int,
    image_height int,
    image_color_palette text[] default '{}',  -- dominant hex colors

    audio_duration_s numeric,
    audio_bpm int,
    audio_key text,

    model_triangle_count int,
    model_has_rig boolean,
    model_animation_count int,

    -- === TAXONOMY (semantic search axes) ===
    style_pack_compat text[] not null default '{}',
    -- StylePackId references: A01-A08, B01-B06, C01-C08, D01-D08
    -- (catalog J.3 in blueprint v2)

    genre_affinity text[] not null default '{}',
    -- metroidvania, jrpg, mobile_puzzle, browser_arcade,
    -- card_game, hardcore_platformer, roguelike, threejs_showcase,
    -- multiplayer_arena, social_sim, bullet_hell, retro_8bit, vn

    use_case_tags text[] not null default '{}',
    -- character, enemy, boss, prop, decoration, hud_element,
    -- inventory_icon, achievement, title_screen, cutscene_bg, etc.

    engine_compat text[] not null default '{}',
    -- godot | phaser | renpy | defold | monogame | love2d | threejs | stride

    semantic_description text not null,
    -- LLM-generated description used for embedding

    keywords text[] not null default '{}',

    -- === QUALITY GATES ===
    quality_score smallint not null check (quality_score between 1 and 5),
    -- 5: production-grade, hand-picked
    -- 4: standard CC0 library, fully usable
    -- 3: usable with minor adjustments
    -- 2-1: borderline (quarantine)

    confidence_score smallint not null default 85
        check (confidence_score between 0 and 100),
    -- LLM tagging confidence; >=85 enters production lane

    success_score numeric not null default 0,
    -- Voyager-style episodic boost (incremented when used in a
    -- successful generation post-D6 validation)

    -- === EMBEDDING (multi-modal: text/CLIP/CLAP, kept uniform 1536-d) ===
    embedding_type text not null
        check (embedding_type in ('text', 'clip_image', 'clap_audio')),
    embedding vector(1536),

    -- === USAGE TELEMETRY ===
    times_retrieved int not null default 0,
    times_used_in_generation int not null default 0,

    -- === TIMESTAMPS ===
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Quarantine lane (confidence 60-84) — same shape, no production use.
create table public.asset_library_quarantine (
    like public.asset_library_index including all
);

-- ============================================================
-- TABLE 2: style_packs
-- The 30 curated visual style packs (J.3 in blueprint v2).
-- Seed data populated by 06_seed_catalogs.py.
-- ============================================================

create table public.style_packs (
    id text primary key,
    -- StylePackId: A01-A08, B01-B06, C01-C08, D01-D08

    display_name text not null,
    description text not null,
    group_label text not null check (group_label in (
        'pixel_2d', 'stylized_2d', 'stylized_3d', 'experimental'
    )),

    -- Visual identity
    palette_oklch jsonb,           -- {"primary": "...", "accent": "...", ...}
    palette_hex text[] not null default '{}',
    resolution_suggested int[],    -- [width, height], e.g. [320, 180]

    -- LoRA hints (resolved at runtime via lora_library)
    prompt_modifiers text,
    negative_prompt text,

    -- Post FX (shader-level)
    post_fx jsonb,                 -- {bloom: true, crt: false, ...}

    -- Typography
    font_family_ui text,
    font_family_dialog text,

    -- Asset library filters
    asset_library_filters jsonb,
    -- {kenney_packs: [...], quaternius: [...], opengameart_tags: [...]}

    -- Audio mood affinity
    music_mood_id text,            -- FK to audio_mood_library.id
    sfx_style text,

    -- Reference games
    reference_game_ids text[] not null default '{}',
    reference_artists text[] default '{}',

    -- Compatibility
    compatible_genres text[] not null default '{}',
    compatible_engines text[] not null default '{}',

    created_at timestamptz not null default now()
);

-- ============================================================
-- TABLE 3: genre_templates
-- The 14 day-1 templates (N.3 in blueprint v2). Each entry is
-- a baseline Game Plan that the D.1 Intent Interpreter uses as
-- seed before generating only the delta.
-- ============================================================

create table public.genre_templates (
    id text primary key,
    -- TemplateId: T01..T14

    display_name text not null,
    description text not null,
    tier text not null check (tier in ('wow', 'beta')),
    -- 13 wow + 1 beta (T10 Stride) at day-1

    -- Target
    genre text not null,
    sub_genre text,
    target_engine text not null,
    alt_engines text[] not null default '{}',

    -- Baseline Game Plan fields (serialized for fast retrieval)
    baseline_world_graph jsonb not null,
    -- {zones: [...], edges: [...], gating: [...]}

    baseline_pacing_curve numeric[] not null,
    -- 5 samples [intro, build, mid, climax, end] in 0..1

    baseline_rules jsonb not null,
    -- {hp_range: [..], dmg_range: [..], checkpoint_freq: ..,
    --  duration_minutes: [..]}

    baseline_invariants text[] default '{}',
    -- ASP clauses for soft-lock prevention

    -- Style + audio defaults
    recommended_style_pack_ids text[] not null default '{}',
    recommended_audio_mood_ids text[] not null default '{}',

    -- Reference
    reference_game_ids text[] not null default '{}',
    code_template_repos text[] not null default '{}',
    -- github.com/<owner>/<repo> URLs from FASE_2_RESEARCH_RESULTS

    engine_specific_hints jsonb,
    -- per-engine implementation notes

    created_at timestamptz not null default now()
);

-- ============================================================
-- TABLE 4: reference_games
-- The 80 shipped games for moodboard analysis. Used by D.1 to
-- inject visual references into sprite_gen / background_gen.
-- ============================================================

create table public.reference_games (
    id uuid primary key default gen_random_uuid(),

    title text not null,
    store_url text not null unique,    -- Steam or itch canonical
    cover_url text,
    developer text,
    release_year int,

    -- Mapping to our taxonomy
    style_pack_tags text[] not null default '{}',
    genre_tags text[] not null default '{}',
    engine_compat text[] not null default '{}',

    -- Notable visual features
    notable_features text[] default '{}',

    -- Moodboard analysis (cached from Claude Vision batch)
    moodboard_image_urls text[] default '{}',  -- Steam screenshot URLs
    moodboard_embeddings vector(1536)[],       -- CLIP embeddings
    visual_analysis jsonb,
    -- {detected_palette: [hex,...], composition_pattern: "...",
    --  ui_layout_pattern: "...", notable_visual_elements: [...]}

    analyzed_at timestamptz,
    created_at timestamptz not null default now()
);

-- ============================================================
-- TABLE 5: audio_mood_library
-- 12 mood baselines with Suno prompts pre-curated.
-- ============================================================

create table public.audio_mood_library (
    id text primary key,
    -- MoodId: epic_orchestral | dark_ambient | chiptune_arcade |
    -- lofi_chill | synthwave_neon | orchestral_calm | jazz_noir |
    -- fantasy_celtic | electronic_tense | piano_emotional |
    -- metal_hardcore | tropical_island

    display_name text not null,
    description text not null,

    bpm_min int not null,
    bpm_max int not null,
    key_musical text,
    instruments text[] not null default '{}',

    -- Suno prompts (pre-curated, 3-5 variants per mood)
    suno_prompts text[] not null default '{}',

    -- Layering rules (3-stem dynamic music)
    layering_pattern jsonb,
    -- {layer_1: "...", layer_2_trigger: "...", layer_3_climax: "..."}

    -- SFX bank query templates
    sfx_freesound_queries text[] default '{}',
    sfx_kenney_packs text[] default '{}',

    -- Affinity
    template_ids text[] not null default '{}',
    style_pack_ids text[] not null default '{}',

    created_at timestamptz not null default now()
);

-- ============================================================
-- TABLE 6: lora_library
-- ~40 verified LoRA models for sprite/asset generation
-- (LORA_LIBRARY_EXPANDED.md catalog). Selection engine in D.5.
-- ============================================================

create table public.lora_library (
    id uuid primary key default gen_random_uuid(),

    hf_repo text not null unique,
    -- e.g. nerijs/pixel-art-xl

    display_name text not null,
    license text not null check (license in (
        'apache-2.0', 'mit', 'cc0-1.0', 'cc-by-4.0',
        'creativeml-openrail-m', 'openrail', 'openrail++',
        'bigscience-openrail-m', 'cc-by-sa-4.0'
    )),

    base_model text not null check (base_model in (
        'SDXL-1.0', 'FLUX.1-dev', 'FLUX.1-schnell',
        'SD-1.5', 'SD-2', 'SD-3.5'
    )),

    -- Prompt engineering
    trigger_words text[] not null default '{}',
    recommended_weight numeric not null default 0.8
        check (recommended_weight between 0 and 1.5),
    negative_prompt text,

    -- Mapping
    style_pack_ids text[] not null default '{}',
    asset_types text[] not null default '{}',
    -- sprite | background | icon | logo | character | environment

    genre_affinity text[] not null default '{}',
    tool_affinity text[] not null default '{}',
    -- sprite_gen | ui_gen | background_gen | etc.

    -- Discovery + ranking
    semantic_description text not null,
    embedding vector(1536),

    -- Quality + telemetry
    quality_score smallint not null default 3
        check (quality_score between 1 and 5),
    success_score numeric not null default 0,
    -- Voyager episodic boost

    huggingface_downloads int,
    created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES — asset_library_index hot path
-- ============================================================

create index idx_assets_engine on public.asset_library_index
    using gin (engine_compat);
create index idx_assets_genre on public.asset_library_index
    using gin (genre_affinity);
create index idx_assets_style on public.asset_library_index
    using gin (style_pack_compat);
create index idx_assets_type on public.asset_library_index (asset_type);
create index idx_assets_license on public.asset_library_index (license);
create index idx_assets_quality on public.asset_library_index
    (quality_score desc, confidence_score desc);

-- HNSW for embedding (better recall than IVFFlat at our scale)
create index idx_assets_embedding on public.asset_library_index
    using hnsw (embedding vector_cosine_ops);

-- Reference games visual search
create index idx_refgames_style on public.reference_games
    using gin (style_pack_tags);
create index idx_refgames_genre on public.reference_games
    using gin (genre_tags);

-- LoRA selection engine indexes
create index idx_lora_style on public.lora_library
    using gin (style_pack_ids);
create index idx_lora_assettype on public.lora_library
    using gin (asset_types);
create index idx_lora_base on public.lora_library (base_model);

-- ============================================================
-- RPC 1: match_assets
-- Multi-axis asset retrieval for D.5 Asset Resolver.
-- ============================================================

create or replace function public.match_assets(
    p_query_embedding vector(1536),
    p_asset_type text default null,
    p_style_pack text default null,
    p_genre text default null,
    p_engine text default null,
    p_min_quality smallint default 3,
    p_match_threshold numeric default 0.75,
    p_match_count int default 10
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
        a.quality_score, a.success_score,
        (1 - (a.embedding <=> p_query_embedding))::numeric as similarity
    from public.asset_library_index a
    where
        (p_asset_type is null or a.asset_type = p_asset_type)
        and (p_style_pack is null or p_style_pack = any(a.style_pack_compat))
        and (p_genre is null or p_genre = any(a.genre_affinity))
        and (p_engine is null or p_engine = any(a.engine_compat))
        and a.quality_score >= p_min_quality
        and a.confidence_score >= 85
        and (1 - (a.embedding <=> p_query_embedding)) >= p_match_threshold
    order by
        a.embedding <=> p_query_embedding,
        a.success_score desc,
        a.quality_score desc
    limit p_match_count;
end;
$$;

-- ============================================================
-- RPC 2: match_loras
-- LoRA Selection Engine — 4-step algorithm in D.5.
-- ============================================================

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
    select * from scored
    where rank_score > 0
    order by rank_score desc
    limit p_match_count;
end;
$$;

-- ============================================================
-- RPC 3: increment_asset_usage
-- Episodic memory update — called by D.5 after D.6 validation.
-- ============================================================

create or replace function public.increment_asset_usage(
    p_asset_id uuid,
    p_success boolean
)
returns void
language plpgsql
security definer
as $$
begin
    update public.asset_library_index
    set times_used_in_generation = times_used_in_generation + 1,
        success_score = case when p_success
            then success_score * 0.95 + 1.0 * 0.05
            else success_score * 0.98
        end,
        updated_at = now()
    where id = p_asset_id;
end;
$$;

-- ============================================================
-- VIEW: asset_coverage_per_style
-- Quick health check: how many assets per (style_pack, asset_type).
-- Used by validation script post-ingestion.
-- ============================================================

create or replace view public.asset_coverage_per_style as
select
    sp_id as style_pack_id,
    a.asset_type,
    count(*) as asset_count,
    avg(a.quality_score)::numeric(3,2) as avg_quality
from public.asset_library_index a
cross join unnest(a.style_pack_compat) as sp_id
group by sp_id, a.asset_type
order by sp_id, a.asset_type;

-- ============================================================
-- RLS: read-only public, write only via service role
-- Mirrors the policy already on code_knowledge.
-- ============================================================

alter table public.asset_library_index enable row level security;
alter table public.asset_library_quarantine enable row level security;
alter table public.style_packs enable row level security;
alter table public.genre_templates enable row level security;
alter table public.reference_games enable row level security;
alter table public.audio_mood_library enable row level security;
alter table public.lora_library enable row level security;

create policy "asset_library_index_read" on public.asset_library_index
    for select using (true);
create policy "style_packs_read" on public.style_packs
    for select using (true);
create policy "genre_templates_read" on public.genre_templates
    for select using (true);
create policy "reference_games_read" on public.reference_games
    for select using (true);
create policy "audio_mood_library_read" on public.audio_mood_library
    for select using (true);
create policy "lora_library_read" on public.lora_library
    for select using (true);
