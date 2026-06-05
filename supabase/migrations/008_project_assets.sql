-- ============================================================
-- GAME STUDIO AI — Migration 008: project_assets (personal Studio library)
-- Supabase PostgreSQL
--
-- The Asset Studio lets a user generate/curate assets that live in their own
-- library, independent of the global CC0 catalog (asset_library_index). These
-- feed generation: the resolver prefers a user's project_assets before catalog
-- or generative (AssetBinding source='user_prepared', migration-paired with the
-- contract proposal in lib/contracts/game-plan.contract.ts).
--
-- Scoped per user; optionally tied to a project (null = library-wide, reusable
-- across the user's games — the bidirectional library⇄game vision).
--
-- Committed BEFORE apply per CLAUDE.md migration sync protocol. Apply via
-- scripts/apply_migrations.py.
-- ============================================================

create table public.project_assets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    -- Null = belongs to the user's library at large (reusable across games).
    project_id uuid references public.projects(id) on delete set null,
    -- Mirrors asset_library_index.asset_type values.
    asset_type text not null
        check (asset_type in (
            'sprite', 'tileset', 'model_3d', 'material',
            'audio_bgm', 'audio_sfx', 'audio_voice', 'font', 'image'
        )),
    -- R2 URL of the asset the user generated/uploaded/refined.
    url text not null,
    -- Style coherence: which style pack this asset belongs to (nullable).
    style_pack_id text,
    -- How it was produced, for provenance + the resolver.
    origin text not null default 'studio'
        check (origin in ('studio', 'uploaded', 'extracted')),
    license text not null default 'user-owned',
    -- Free-form: dims, palette, source tool, slot hint, prompt, etc.
    metadata jsonb not null default '{}'::jsonb,
    -- Soft favourite flag for the library UI.
    favorite boolean not null default false,
    created_at timestamptz not null default now()
);

create index project_assets_user_idx on public.project_assets (user_id, created_at desc);
create index project_assets_type_idx on public.project_assets (user_id, asset_type);
create index project_assets_project_idx on public.project_assets (project_id);

-- RLS: a user sees and manages only their own library. The worker/server uses
-- the service-role key (bypasses RLS) when binding assets into a plan.
alter table public.project_assets enable row level security;

create policy project_assets_owner_all on public.project_assets
    for all using (
        user_id in (select id from public.users where clerk_user_id = auth.jwt()->>'sub')
    )
    with check (
        user_id in (select id from public.users where clerk_user_id = auth.jwt()->>'sub')
    );
