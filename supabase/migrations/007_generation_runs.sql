-- ============================================================
-- GAME STUDIO AI — Migration 007: generation_runs (async generation jobs)
-- Supabase PostgreSQL
--
-- The full Hermes loop (intent → design → consistency → balance → execution →
-- E2B build → evaluation) takes minutes — far beyond a Vercel serverless
-- function's limit. So the creator enqueues a Trigger.dev job and the UI polls
-- this table for status. One row per generation attempt.
--
-- status: queued → running → done | failed. `response` holds the validated
-- HermesPlanResponse (jsonb) when done; `error` holds the message when failed.
--
-- Committed BEFORE apply per CLAUDE.md migration sync protocol. Apply via
-- scripts/apply_migrations.py.
-- ============================================================

create table public.generation_runs (
    id uuid primary key default gen_random_uuid(),
    -- Trigger.dev run id (set after enqueue); nullable until dispatched.
    trigger_run_id text unique,
    user_id uuid not null references public.users(id) on delete cascade,
    -- Project the run materializes (nullable until Hermes assigns/creates one).
    project_id uuid references public.projects(id) on delete set null,
    status text not null default 'queued'
        check (status in ('queued', 'running', 'done', 'failed')),
    -- The HermesPlanRequest that started the run (for retry/debug).
    request jsonb not null,
    -- The validated HermesPlanResponse when status='done'.
    response jsonb,
    -- Human-readable failure reason when status='failed'.
    error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index generation_runs_user_idx on public.generation_runs (user_id, created_at desc);
create index generation_runs_status_idx on public.generation_runs (status);

-- Touch updated_at on every status change.
create or replace function public.touch_generation_runs_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger generation_runs_set_updated_at
    before update on public.generation_runs
    for each row execute function public.touch_generation_runs_updated_at();

-- RLS: a user sees only their own runs. The Trigger.dev worker uses the
-- service-role key (bypasses RLS) to write status/response.
alter table public.generation_runs enable row level security;

create policy generation_runs_owner_select on public.generation_runs
    for select using (
        user_id in (select id from public.users where clerk_user_id = auth.jwt()->>'sub')
    );
