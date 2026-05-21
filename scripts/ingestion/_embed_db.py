"""Embedding + DB primitives for the Fase 5 store stage.

Two responsibilities, intentionally kept separate so the orchestrator
(05_embed_store.py) reads as a flow:

  - EmbeddingClient: batched calls to OpenAI text-embedding-3-small
  - Postgres helpers: idempotent batch INSERTs into code_knowledge,
    code_knowledge_quarantine, game_parameters, and per-repo upsert of
    ingestion_log

We don't use the supabase-py client: the blueprint examples show its
chained `.table().insert().execute()` for clarity, but psycopg2 + raw SQL
gives us batched INSERTs with %s expansion (orders of magnitude faster on
~10k rows), a single connection that survives the whole run, and direct
control over the `vector(1536)` literal serialisation.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Iterable

from openai import OpenAI
from psycopg2.extras import execute_values

# Pricing snapshot: text-embedding-3-small @ $0.02 / 1M input tokens.
EMBED_MODEL = "text-embedding-3-small"
EMBED_DIMS = 1536
EMBED_USD_PER_M = 0.02

# OpenAI accepts up to 2048 inputs per /embeddings call; 100 keeps payloads
# under ~120 KB and stays well below the per-request token cap.
EMBED_BATCH_SIZE = 100

# Database INSERT batch size — 50 rows/INSERT matches the blueprint and is
# the sweet spot for the Supabase pooler (larger batches start hitting
# session_pooler statement size limits in practice).
DB_BATCH_SIZE = 50


# ---- searchable_text -------------------------------------------------------

def build_searchable_text(classification: dict[str, Any], engine: str) -> str:
    """Compose the embedding input string per blueprint §02.6.

    We embed THIS, not the raw code: it captures the chunk's meaning in a
    form whose token distribution matches natural-language queries from the
    downstream tools (e.g. "player controller with wall jump for
    metroidvania godot").
    """
    subs = classification.get("subcategories") or []
    genres = classification.get("genre_tags") or []
    feats = classification.get("key_features") or []
    pats = classification.get("design_patterns") or []
    return (
        f"{classification['one_line_summary']}\n"
        f"Engine: {engine}\n"
        f"Category: {classification['primary_category']}\n"
        f"Subcategories: {', '.join(subs)}\n"
        f"Genres: {', '.join(genres)}\n"
        f"Features: {', '.join(feats)}\n"
        f"Patterns: {', '.join(pats)}\n"
        f"Complexity: {classification['complexity']}"
    )


# ---- engine → language map (for code_knowledge.language NOT NULL) ----------

ENGINE_LANGUAGE: dict[str, str] = {
    "godot":    "gdscript",
    "phaser":   "javascript",
    "renpy":    "python",
    "defold":   "lua",
    "monogame": "csharp",
    "love2d":   "lua",
    "threejs":  "javascript",
    "stride":   "csharp",
}


# ---- category → parameter_group (game_parameters routing) ------------------

CATEGORY_TO_PARAM_GROUP: dict[str, str] = {
    "A01_player_controller": "player_physics",
    "A02_state_machine":     "player_physics",
    "A03_combat":            "combat_stats",
    "A04_enemy_ai":          "enemy_stats",
    "A05_camera":            "camera_settings",
    "C01_progression":       "progression_economy",
    "D02_audio":             "audio_config",
}


def map_param_group(primary_category: str) -> str:
    return CATEGORY_TO_PARAM_GROUP.get(primary_category, "general")


# ---- OpenAI embedding client ----------------------------------------------

@dataclass
class EmbedUsage:
    """Running totals for the embedding portion of the job."""
    requests: int = 0
    input_tokens: int = 0
    cost_usd: float = 0.0


class EmbeddingClient:
    """Batched wrapper around the OpenAI /embeddings endpoint."""

    def __init__(self, api_key: str, model: str = EMBED_MODEL) -> None:
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY missing in environment.")
        self.client = OpenAI(api_key=api_key)
        self.model = model
        self.usage = EmbedUsage()

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """One /embeddings call. Caller must already have batched to ≤2048
        inputs; we don't re-split here so usage telemetry stays accurate."""
        resp = self.client.embeddings.create(model=self.model, input=texts)
        self.usage.requests += 1
        self.usage.input_tokens += resp.usage.total_tokens
        self.usage.cost_usd += resp.usage.total_tokens * EMBED_USD_PER_M / 1_000_000
        return [d.embedding for d in resp.data]


# ---- vector serialisation --------------------------------------------------

def vector_literal(embedding: list[float]) -> str:
    """Render a 1536-dim float list as the textual pgvector literal
    PostgreSQL accepts in INSERTs (we cast with `::vector` in SQL)."""
    return "[" + ",".join(f"{x:.7f}" for x in embedding) + "]"


# ---- INSERT batches --------------------------------------------------------

@dataclass
class StoreRow:
    """One row destined for code_knowledge or code_knowledge_quarantine.
    The helpers below build this from a classified chunk dict."""
    engine: str
    language: str
    primary_category: str
    subcategories: list[str]
    chunk_type: str
    genre_tags: list[str]
    complexity: str
    design_patterns: list[str]
    key_features: list[str]
    quality_score: int
    reusability_score: int
    confidence_score: int
    summary: str
    code: str
    loc: int
    source_repo: str | None
    source_license: str | None
    source_file_paths: list[str]
    scene_context: str | None
    embedding: list[float]


def chunk_to_row(chunk: dict[str, Any], embedding: list[float]) -> StoreRow:
    cl = chunk["classification"]
    return StoreRow(
        engine=chunk["engine"],
        language=ENGINE_LANGUAGE.get(chunk["engine"], "unknown"),
        primary_category=cl["primary_category"],
        subcategories=cl.get("subcategories") or [],
        chunk_type=chunk.get("chunk_type") or "single_mechanic",
        genre_tags=cl.get("genre_tags") or [],
        complexity=cl.get("complexity") or "intermediate",
        design_patterns=cl.get("design_patterns") or [],
        key_features=cl.get("key_features") or [],
        quality_score=int(cl["quality_score"]),
        reusability_score=int(cl["reusability_score"]),
        confidence_score=int(cl["confidence_score"]),
        summary=cl["one_line_summary"],
        code=chunk["code"],
        loc=int(chunk.get("loc") or 0),
        source_repo=chunk.get("source_repo"),
        source_license=None,
        source_file_paths=chunk.get("file_paths") or [],
        scene_context=chunk.get("scene_context"),
        embedding=embedding,
    )


_KB_INSERT = (
    "INSERT INTO public.{table} (engine, language, primary_category, "
    "subcategories, chunk_type, genre_tags, complexity, design_patterns, "
    "key_features, quality_score, reusability_score, confidence_score, "
    "summary, code, loc, source_repo, source_license, source_file_paths, "
    "scene_context, embedding) VALUES %s"
)


def insert_kb_rows(cur, table: str, rows: list[StoreRow]) -> int:
    """Batch INSERT into code_knowledge or code_knowledge_quarantine.
    Returns the count of rows actually sent."""
    if not rows:
        return 0
    values = [
        (r.engine, r.language, r.primary_category, r.subcategories,
         r.chunk_type, r.genre_tags, r.complexity, r.design_patterns,
         r.key_features, r.quality_score, r.reusability_score,
         r.confidence_score, r.summary, r.code, r.loc, r.source_repo,
         r.source_license, r.source_file_paths, r.scene_context,
         vector_literal(r.embedding))
        for r in rows
    ]
    execute_values(cur, _KB_INSERT.format(table=table), values,
                   template="(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,"
                            "%s,%s,%s,%s,%s,%s,%s,%s::vector)",
                   page_size=DB_BATCH_SIZE)
    return len(rows)


_PARAM_INSERT = (
    "INSERT INTO public.game_parameters "
    "(source_repo, engine, genre, parameter_group, parameters, "
    "context, quality_score) VALUES %s"
)


def insert_param_rows(cur, rows: list[tuple]) -> int:
    if not rows:
        return 0
    execute_values(cur, _PARAM_INSERT, rows, page_size=DB_BATCH_SIZE)
    return len(rows)


def build_param_row(chunk: dict[str, Any]) -> tuple | None:
    """Return the game_parameters tuple iff extracted_parameters has values."""
    cl = chunk["classification"]
    params = cl.get("extracted_parameters") or {}
    if not params:
        return None
    genres = cl.get("genre_tags") or []
    return (
        chunk.get("source_repo"),
        chunk["engine"],
        genres[0] if genres else "generic",
        map_param_group(cl["primary_category"]),
        json.dumps(params),
        cl.get("one_line_summary"),
        int(cl["quality_score"]),
    )


# ---- ingestion_log upsert --------------------------------------------------

_INGEST_UPSERT = """
INSERT INTO public.ingestion_log
    (source_url, engine, status, classification_status,
     chunks_produced, embedded_at)
VALUES (%s, %s, 'embedded', %s, %s, now())
ON CONFLICT (source_url) DO UPDATE SET
    status = EXCLUDED.status,
    classification_status = EXCLUDED.classification_status,
    chunks_produced = EXCLUDED.chunks_produced,
    embedded_at = EXCLUDED.embedded_at
"""


def upsert_ingestion_log(cur, per_repo: dict[str, dict[str, Any]]) -> int:
    """Write or refresh one row per source_repo. The status column tracks
    the latest pipeline stage reached; classification_status reflects the
    majority lane (accepted if any accepted chunk exists, else quarantined
    if any quarantined, else rejected)."""
    for source_url, stats in per_repo.items():
        if stats.get("accepted", 0) > 0:
            cs = "accepted"
        elif stats.get("quarantined", 0) > 0:
            cs = "quarantined"
        else:
            cs = "rejected"
        chunks = sum(stats.get(k, 0) for k in
                     ("accepted", "quarantined", "rejected"))
        cur.execute(_INGEST_UPSERT,
                    (source_url, stats["engine"], cs, chunks))
    return len(per_repo)


# ---- idempotence: existing-rows index --------------------------------------

def load_existing_keys(cur, table: str) -> set[tuple[str, str]]:
    """Build a set of (source_repo, first_file_path) keys already present
    in the table. We use this to skip duplicates on a re-run without
    requiring a UNIQUE constraint on the production tables.
    """
    cur.execute(
        f"SELECT source_repo, source_file_paths FROM public.{table} "
        f"WHERE source_repo IS NOT NULL"
    )
    return {(row[0], row[1][0] if row[1] else "")
            for row in cur.fetchall()}


def chunk_dedup_key(chunk: dict[str, Any]) -> tuple[str, str]:
    files = chunk.get("file_paths") or []
    return (chunk.get("source_repo") or "",
            files[0] if files else "")


# ---- batching iterator -----------------------------------------------------

def batched(items: Iterable[Any], n: int) -> Iterable[list[Any]]:
    """Yield successive lists of up to `n` items."""
    buf: list[Any] = []
    for it in items:
        buf.append(it)
        if len(buf) >= n:
            yield buf
            buf = []
    if buf:
        yield buf
