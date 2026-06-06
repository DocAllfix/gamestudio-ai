-- Migration 009 — run_traces: full per-step audit of every generation run.
--
-- The source of truth for observability. Every phase of a run (intent /
-- game-designer / each tool / build / smoke / web-export / db-write) writes one
-- ordered row here with its inputs, outputs, status, error, timing and cost —
-- plus the bulky artifacts (generated code, full build stderr, smoke log) that
-- are too big / important to lose. One query reconstructs exactly what happened,
-- in what order, for any run. No more blind debugging.
--
-- Read path: SELECT * FROM run_traces WHERE run_id = ? ORDER BY seq.

create table public.run_traces (
    id uuid primary key default gen_random_uuid(),

    -- The generation_runs row this step belongs to.
    run_id uuid not null references public.generation_runs(id) on delete cascade,
    -- Project (may be null early in the run, before the plan exists).
    project_id uuid,

    -- Monotonic order within the run (0,1,2,...). Lets us replay the timeline.
    seq int not null,

    -- Coarse phase: intent | design | game_designer | reference_games |
    -- consistency | balance | execution | tool | build | smoke | web_export |
    -- evaluation | db_write | llm_call.
    phase text not null,
    -- For phase='tool'/'llm_call': the tool_id / model id. Null otherwise.
    tool_id text,
    -- DAG node id when this step is a tool execution.
    node_id text,
    -- Engine in play (godot/phaser/...), when relevant.
    engine text,

    -- Outcome: started | succeeded | failed | degraded | skipped.
    status text not null
        check (status in ('started', 'succeeded', 'failed', 'degraded', 'skipped')),

    -- Structured input/output of the step (tool input, LLM messages, etc.).
    input jsonb,
    output jsonb,

    -- Bulky text artifacts kept verbatim for audit (nullable).
    generated_code text,   -- the exact code a code_gen produced
    build_log text,        -- full build stdout+stderr
    smoke_log text,        -- smoke runner output / crash_reason

    -- Failure detail.
    error text,

    -- Telemetry.
    latency_ms int,
    cost_usd numeric(10, 6) default 0,

    -- LLM specifics (when phase='llm_call').
    model text,
    prompt_tokens int,
    completion_tokens int,

    created_at timestamptz not null default now()
);

create index run_traces_run_idx on public.run_traces (run_id, seq);
create index run_traces_project_idx on public.run_traces (project_id);
create index run_traces_phase_idx on public.run_traces (phase);
create index run_traces_status_idx on public.run_traces (status);

-- Service-role only (the worker writes; audits run with the service key).
alter table public.run_traces enable row level security;
create policy "run_traces_service_all" on public.run_traces
    for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
