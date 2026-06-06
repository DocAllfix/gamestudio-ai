-- Migration 010 — engine_api_docs: official engine API reference, per symbol.
--
-- The code_gen LLM keeps mis-targeting engine versions (Godot 3 vs 4 APIs:
-- Color.red vs RED, KinematicBody2D vs CharacterBody2D, missing methods).
-- Example gameplay code (code_knowledge) doesn't teach the correct API; the
-- *official docs*, classified per symbol, do. This table holds one row per API
-- symbol (a class, or a method/constant/member) so the self-heal loop can,
-- given a parse error naming `Color`/`get_path_to`, fetch that exact symbol's
-- doc and inject it for a grounded fix.
--
-- Lookup paths: exact symbol match (engine + symbol) for error-driven RAG, and
-- pgvector similarity for fuzzy queries.

create extension if not exists vector;

create table public.engine_api_docs (
    id uuid primary key default gen_random_uuid(),

    -- Engine + version this doc belongs to (e.g. godot/4.3).
    engine text not null,
    version text not null,

    -- The class this symbol lives on (e.g. "Color", "Node2D").
    class_name text not null,
    -- The specific symbol; equals class_name for a class-level row, else the
    -- member name (e.g. "RED", "get_path_to").
    symbol text not null,
    -- What kind of symbol: class | method | constant | member | constructor | signal.
    kind text not null
        check (kind in ('class', 'method', 'constant', 'member', 'constructor', 'signal', 'operator')),

    -- Human-readable signature (e.g. "get_path_to(node: Node) -> NodePath").
    signature text,
    -- The doc text (brief + description), cleaned of BBCode-ish markup.
    content text not null,

    -- Embedding for similarity search (text-embedding-3-small = 1536 dims).
    embedding vector(1536),

    created_at timestamptz not null default now()
);

-- Exact-symbol lookup (the primary path for error-driven retrieval).
create index engine_api_docs_symbol_idx on public.engine_api_docs (engine, symbol);
create index engine_api_docs_class_idx on public.engine_api_docs (engine, class_name);
-- One row per (engine, version, class, symbol, kind).
create unique index engine_api_docs_unique_idx
    on public.engine_api_docs (engine, version, class_name, symbol, kind);

-- Vector index for fuzzy queries (ivfflat, cosine).
create index engine_api_docs_embedding_idx on public.engine_api_docs
    using ivfflat (embedding vector_cosine_ops) with (lists = 100);

alter table public.engine_api_docs enable row level security;
create policy "engine_api_docs_read" on public.engine_api_docs
    for select using (true);
create policy "engine_api_docs_service_write" on public.engine_api_docs
    for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- RPC: fetch docs for a set of symbols named in a compiler error. Exact match
-- first (engine + symbol in the list), most relevant kinds first.
create or replace function public.lookup_api_symbols(
    p_engine text,
    p_symbols text[]
)
returns table (
    class_name text,
    symbol text,
    kind text,
    signature text,
    content text
)
language sql stable as $$
    select d.class_name, d.symbol, d.kind, d.signature, d.content
    from public.engine_api_docs d
    where d.engine = p_engine
      and d.symbol = any(p_symbols)
    order by
        case d.kind when 'class' then 0 when 'constant' then 1 when 'method' then 2 else 3 end
    limit 12;
$$;
