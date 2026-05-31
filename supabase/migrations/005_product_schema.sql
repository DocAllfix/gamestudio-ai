-- ============================================================
-- GAME STUDIO AI — Product Schema for Phase 2 (4-Way Parallel Dev)
-- Supabase PostgreSQL + pgvector
-- Migration 005 — Phase 0 contract phase
--
-- Adds the product tables that the 4 workstreams need:
--   - users               (Clerk-backed user accounts + tier)
--   - projects            (user-owned generated games)
--   - game_plan_versions  (RFC 6902 patch chain per project)
--   - tool_executions     (audit log of every tool invocation by W2)
--   - usage_events        (PostHog mirror + billing analytics)
--   - episodic_memory     (Voyager-style success_score EMA per skill)
--   - build_artifacts     (R2 references for W3 .zip outputs)
--   - hitl_pauses         (human-in-the-loop checkpoints for W4)
--
-- Catalog tables (style_packs, genre_templates, audio_mood_library,
-- reference_games, lora_library) are NOT recreated here — migration
-- 003 already created and seeded them. The product tables below
-- reference them by string FK where appropriate.
--
-- Multi-tenancy: every product table carries `org_id` (nullable).
-- Day-1 alpha treats org_id = user_id (1 user = 1 org). Phase 2 will
-- introduce real org membership and RLS scopes by org membership.
--
-- This migration is committed BEFORE apply per CLAUDE.md migration
-- sync protocol. Apply via scripts/apply_migrations.py.
-- ============================================================

-- ============================================================
-- USERS — mirror of Clerk identities + Game Studio tier
-- ============================================================

create table public.users (
    id uuid primary key default gen_random_uuid(),
    -- Stable Clerk user id (e.g. "user_2abc...").
    clerk_user_id text not null unique,
    email text not null,
    display_name text,
    -- Day-1 single-tenancy: org_id = id of a "user-as-org" record.
    -- Phase 2 multi-tenancy adds a separate orgs table + membership.
    org_id uuid,
    -- One of the 4 day-1 tiers from billing.contract.ts.
    tier text not null default 'free'
        check (tier in ('free', 'creator', 'pro', 'studio')),
    stripe_customer_id text unique,
    -- Quota counters reset monthly via a Trigger.dev cron.
    games_used_this_month int not null default 0,
    quota_period_start timestamptz not null default date_trunc('month', now()),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_users_clerk on public.users (clerk_user_id);
create index idx_users_org on public.users (org_id);
create index idx_users_tier on public.users (tier);

-- ============================================================
-- PROJECTS — one row per generated game
-- ============================================================

create table public.projects (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    org_id uuid,
    title text not null,
    -- One of the 8 supported engines from EngineEnum in
    -- lib/contracts/game-plan.contract.ts.
    engine text not null
        check (engine in ('godot','phaser','renpy','defold',
                          'monogame','love2d','threejs','stride')),
    -- One of the 14 day-1 genres from GenreEnum (mirrors genre_templates).
    genre text not null,
    -- The latest applied Game Plan version pointer (NULL for projects
    -- still in draft before D.1 emits the first plan).
    latest_plan_version int,
    -- Project lifecycle status surfaced in the dashboard.
    status text not null default 'draft'
        check (status in ('draft', 'generating', 'ready', 'published',
                          'failed', 'archived')),
    -- Snapshot of the latest Game Plan (denormalized for fast list
    -- views; authoritative copy lives in game_plan_versions).
    latest_game_plan jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index idx_projects_user on public.projects (user_id);
create index idx_projects_org on public.projects (org_id);
create index idx_projects_status on public.projects (status);
create index idx_projects_engine on public.projects (engine);
create index idx_projects_genre on public.projects (genre);

-- ============================================================
-- GAME_PLAN_VERSIONS — RFC 6902 patch chain
-- ============================================================

create table public.game_plan_versions (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    version_no int not null,
    -- For v1 this is the full plan as a JSONB document.
    -- For v2+ this is null and the chain is reconstructed by applying
    -- patch chain from v1; we still persist the materialized snapshot
    -- in `materialized_plan` to keep queries cheap.
    materialized_plan jsonb not null,
    -- The diff that produced this version from `parent_version_id`.
    -- Null for v1. RFC 6902 op array.
    patch jsonb,
    parent_version_id uuid references public.game_plan_versions(id),
    summary text,
    created_at timestamptz not null default now(),
    unique (project_id, version_no)
);

create index idx_gpv_project on public.game_plan_versions (project_id);
create index idx_gpv_parent on public.game_plan_versions (parent_version_id);

-- ============================================================
-- TOOL_EXECUTIONS — W2 audit + Helicone correlation
-- ============================================================

create table public.tool_executions (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    plan_version int not null,
    -- The tool id (a ToolIdEnum value from
    -- lib/contracts/tool-registry.contract.ts).
    tool_id text not null,
    node_id text not null,
    trace_id text not null,
    -- Shape comes from the tool's specific schema; we keep it JSONB
    -- and trust Zod at the W2 boundary.
    input jsonb not null,
    output jsonb,
    status text not null
        check (status in ('succeeded', 'failed', 'rejected_by_qa')),
    cost_usd numeric(10,6) not null default 0,
    latency_ms int not null default 0,
    -- Self-QA log from the tool (lib/contracts/tool-registry qa_log).
    qa_log jsonb not null default '[]',
    error_message text,
    created_at timestamptz not null default now()
);

create index idx_te_project on public.tool_executions (project_id);
create index idx_te_trace on public.tool_executions (trace_id);
create index idx_te_tool on public.tool_executions (tool_id);
create index idx_te_status on public.tool_executions (status);
create index idx_te_created on public.tool_executions (created_at desc);

-- ============================================================
-- USAGE_EVENTS — analytics mirror (W4 PostHog + billing dashboard)
-- ============================================================

create table public.usage_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    project_id uuid references public.projects(id) on delete cascade,
    -- Mirrors the event_name enum in billing.contract.ts.
    event_name text not null
        check (event_name in (
            'game_started', 'game_completed', 'game_failed',
            'tool_executed', 'plan_refined', 'asset_uploaded',
            'game_exported_itch', 'game_exported_steam',
            'upgrade_clicked', 'downgrade_clicked'
        )),
    metadata jsonb not null default '{}',
    trace_id text not null,
    created_at timestamptz not null default now()
);

create index idx_ue_user on public.usage_events (user_id);
create index idx_ue_event on public.usage_events (event_name);
create index idx_ue_created on public.usage_events (created_at desc);

-- ============================================================
-- EPISODIC_MEMORY — Voyager-style success_score EMA per skill
-- ============================================================

create table public.episodic_memory (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    skill_name text not null,
    -- EMA: new = old * 0.95 + (success ? 1.0 : 0.0) * 0.05.
    success_score numeric(5,4) not null default 0
        check (success_score >= 0 and success_score <= 1),
    times_used int not null default 0,
    last_used_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    unique (user_id, skill_name)
);

create index idx_em_user on public.episodic_memory (user_id);
create index idx_em_score on public.episodic_memory (success_score desc);

-- ============================================================
-- BUILD_ARTIFACTS — W3 R2 .zip references
-- ============================================================

create table public.build_artifacts (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    plan_version int not null,
    engine text not null,
    -- R2 object key (e.g. "artifacts/<project_id>/<artifact_id>.zip").
    r2_object_key text not null,
    size_bytes bigint not null,
    -- Smoke test outcome captured at package time.
    smoke_test_passed boolean,
    smoke_test_log text,
    build_log text,
    created_at timestamptz not null default now()
);

create index idx_ba_project on public.build_artifacts (project_id);
create index idx_ba_engine on public.build_artifacts (engine);

-- ============================================================
-- HITL_PAUSES — human-in-the-loop checkpoint queue
-- ============================================================

create table public.hitl_pauses (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    -- Why the run paused (semantic, surfaced in the W4 modal).
    reason text not null,
    -- Whatever payload the runtime needs to resume; the contract
    -- doesn't constrain this — UI consumes it case-by-case.
    payload jsonb not null,
    resumed_at timestamptz,
    resumed_decision jsonb,
    created_at timestamptz not null default now()
);

create index idx_hp_project on public.hitl_pauses (project_id);
create index idx_hp_open on public.hitl_pauses (project_id) where resumed_at is null;

-- ============================================================
-- RLS — every product table is user-scoped
-- ============================================================

alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.game_plan_versions enable row level security;
alter table public.tool_executions enable row level security;
alter table public.usage_events enable row level security;
alter table public.episodic_memory enable row level security;
alter table public.build_artifacts enable row level security;
alter table public.hitl_pauses enable row level security;

-- Helper function: extract the requesting Clerk user id from JWT.
-- Returns null when the JWT has no clerk_user_id claim (anon access).
create or replace function public.current_clerk_user_id()
returns text
language sql stable
as $$
    select coalesce(
        nullif(current_setting('request.jwt.claims', true), '')::jsonb
            ->>'sub',
        null
    );
$$;

-- Users: a row is visible only to its owner.
create policy users_self_select on public.users
    for select using (clerk_user_id = public.current_clerk_user_id());
create policy users_self_update on public.users
    for update using (clerk_user_id = public.current_clerk_user_id());

-- Projects: owner-only (Phase 2 multitenancy extends to org members).
create policy projects_owner_all on public.projects
    for all using (
        user_id in (
            select id from public.users
            where clerk_user_id = public.current_clerk_user_id()
        )
    );

-- Game plan versions: owner-only via project ownership.
create policy gpv_owner_all on public.game_plan_versions
    for all using (
        project_id in (
            select p.id from public.projects p
            join public.users u on u.id = p.user_id
            where u.clerk_user_id = public.current_clerk_user_id()
        )
    );

-- Tool executions: owner-only via project ownership.
create policy te_owner_all on public.tool_executions
    for all using (
        project_id in (
            select p.id from public.projects p
            join public.users u on u.id = p.user_id
            where u.clerk_user_id = public.current_clerk_user_id()
        )
    );

-- Usage events: owner-only.
create policy ue_owner_all on public.usage_events
    for all using (
        user_id in (
            select id from public.users
            where clerk_user_id = public.current_clerk_user_id()
        )
    );

-- Episodic memory: owner-only.
create policy em_owner_all on public.episodic_memory
    for all using (
        user_id in (
            select id from public.users
            where clerk_user_id = public.current_clerk_user_id()
        )
    );

-- Build artifacts: owner-only via project ownership.
create policy ba_owner_all on public.build_artifacts
    for all using (
        project_id in (
            select p.id from public.projects p
            join public.users u on u.id = p.user_id
            where u.clerk_user_id = public.current_clerk_user_id()
        )
    );

-- HITL pauses: owner-only via project ownership.
create policy hp_owner_all on public.hitl_pauses
    for all using (
        project_id in (
            select p.id from public.projects p
            join public.users u on u.id = p.user_id
            where u.clerk_user_id = public.current_clerk_user_id()
        )
    );

-- ============================================================
-- RPCs — called by W1/W2/W4 from across the parallelism boundary
-- ============================================================

-- record_tool_execution: idempotent persist of a tool call result.
-- Called by W2 when a tool finishes (success or failure).
create or replace function public.record_tool_execution(
    p_project_id uuid,
    p_plan_version int,
    p_tool_id text,
    p_node_id text,
    p_trace_id text,
    p_input jsonb,
    p_output jsonb,
    p_status text,
    p_cost_usd numeric,
    p_latency_ms int,
    p_qa_log jsonb,
    p_error_message text
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_id uuid;
begin
    insert into public.tool_executions (
        project_id, plan_version, tool_id, node_id, trace_id,
        input, output, status, cost_usd, latency_ms, qa_log,
        error_message
    ) values (
        p_project_id, p_plan_version, p_tool_id, p_node_id, p_trace_id,
        p_input, p_output, p_status, p_cost_usd, p_latency_ms,
        coalesce(p_qa_log, '[]'::jsonb), p_error_message
    )
    returning id into v_id;
    return v_id;
end;
$$;

-- check_quota: returns whether a user can still spawn this tool.
-- Called by W1 before dispatching, by W4 before showing the
-- Generate button as enabled.
create or replace function public.check_quota(
    p_clerk_user_id text,
    p_tool_id text,
    p_estimated_cost_usd numeric default 0,
    p_counts_toward_monthly boolean default false
)
returns table (
    allowed boolean,
    reason text,
    games_used_this_month int
)
language plpgsql
security definer
as $$
declare
    v_user public.users%rowtype;
    v_max_per_game numeric;
    v_max_per_month int;
begin
    select * into v_user from public.users
        where clerk_user_id = p_clerk_user_id;
    if not found then
        return query select false, 'account_suspended'::text, 0;
        return;
    end if;

    -- Tier ceilings duplicated from billing.contract.ts TIER_DEFINITIONS.
    -- Keep in sync at the contract level (the contract is the source
    -- of truth; this function is the runtime mirror).
    case v_user.tier
        when 'free'    then v_max_per_game := 1.5;  v_max_per_month := 3;
        when 'creator' then v_max_per_game := 3.0;  v_max_per_month := 15;
        when 'pro'     then v_max_per_game := 5.0;  v_max_per_month := 25;
        when 'studio'  then v_max_per_game := 10.0; v_max_per_month := 99999;
    end case;

    if p_estimated_cost_usd > v_max_per_game then
        return query select false, 'per_game_cost_exceeded'::text,
                            v_user.games_used_this_month;
        return;
    end if;

    if p_counts_toward_monthly
        and v_user.games_used_this_month >= v_max_per_month then
        return query select false, 'monthly_games_exhausted'::text,
                            v_user.games_used_this_month;
        return;
    end if;

    return query select true, null::text, v_user.games_used_this_month;
end;
$$;

-- increment_quota_usage: increments the monthly counter when a game
-- ships. Called by W3 from the Assembler after smoke test passes.
create or replace function public.increment_quota_usage(
    p_clerk_user_id text
)
returns int
language plpgsql
security definer
as $$
declare
    v_new_count int;
begin
    update public.users
       set games_used_this_month = games_used_this_month + 1,
           updated_at = now()
     where clerk_user_id = p_clerk_user_id
    returning games_used_this_month into v_new_count;
    return v_new_count;
end;
$$;

-- update_episodic_memory: applies the Voyager EMA update on a single
-- (user, skill) pair. Used by W1 Episodic Memory module.
create or replace function public.update_episodic_memory(
    p_user_id uuid,
    p_skill_name text,
    p_success boolean
)
returns numeric
language plpgsql
security definer
as $$
declare
    v_new_score numeric;
begin
    insert into public.episodic_memory (user_id, skill_name,
                                        success_score, times_used,
                                        last_used_at)
    values (p_user_id, p_skill_name,
            case when p_success then 0.05 else 0.0 end,
            1, now())
    on conflict (user_id, skill_name) do update
        set success_score = episodic_memory.success_score * 0.95
            + (case when p_success then 1.0 else 0.0 end) * 0.05,
            times_used = episodic_memory.times_used + 1,
            last_used_at = now()
    returning success_score into v_new_score;
    return v_new_score;
end;
$$;

-- apply_game_plan_diff: persists a new game_plan_versions row from a
-- parent + RFC 6902 patch. The patch application itself happens in
-- W1 TS code (lib/game-plan-versioning/diff-backend.ts); this RPC
-- just records the result with optimistic-concurrency checks on
-- parent_version.
create or replace function public.apply_game_plan_diff(
    p_project_id uuid,
    p_parent_version int,
    p_new_version int,
    p_patch jsonb,
    p_materialized_plan jsonb,
    p_summary text
)
returns uuid
language plpgsql
security definer
as $$
declare
    v_parent_id uuid;
    v_id uuid;
    v_current_latest int;
begin
    -- Optimistic concurrency: refuse the patch if the project moved on.
    select latest_plan_version into v_current_latest
      from public.projects where id = p_project_id;
    if v_current_latest is null
        or v_current_latest <> p_parent_version then
        raise exception 'parent_version_mismatch: expected %, found %',
            p_parent_version, v_current_latest;
    end if;

    select id into v_parent_id from public.game_plan_versions
     where project_id = p_project_id and version_no = p_parent_version;

    insert into public.game_plan_versions (
        project_id, version_no, materialized_plan, patch,
        parent_version_id, summary
    ) values (
        p_project_id, p_new_version, p_materialized_plan, p_patch,
        v_parent_id, p_summary
    ) returning id into v_id;

    update public.projects
       set latest_plan_version = p_new_version,
           latest_game_plan = p_materialized_plan,
           updated_at = now()
     where id = p_project_id;

    return v_id;
end;
$$;

-- ============================================================
-- Grants — anon role gets nothing (Clerk service role only)
-- The service_role bypasses RLS; the authenticated role (Supabase
-- proxy) inherits the RLS policies above.
-- ============================================================

grant select, insert, update, delete on public.users to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert on public.game_plan_versions to authenticated;
grant select on public.tool_executions to authenticated;
grant select, insert on public.usage_events to authenticated;
grant select on public.episodic_memory to authenticated;
grant select on public.build_artifacts to authenticated;
grant select, update on public.hitl_pauses to authenticated;

grant execute on function public.record_tool_execution(
    uuid, int, text, text, text, jsonb, jsonb, text,
    numeric, int, jsonb, text
) to authenticated;
grant execute on function public.check_quota(
    text, text, numeric, boolean
) to authenticated;
grant execute on function public.increment_quota_usage(text)
    to authenticated;
grant execute on function public.update_episodic_memory(
    uuid, text, boolean
) to authenticated;
grant execute on function public.apply_game_plan_diff(
    uuid, int, int, jsonb, jsonb, text
) to authenticated;
