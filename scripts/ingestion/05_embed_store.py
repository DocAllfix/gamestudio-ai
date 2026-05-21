"""Fase 5 — Embedding & Storage.

Reads classified chunks from data/chunks_classified/, generates one
text-embedding-3-small vector per chunk (1536 dim), and writes the
results to four Supabase tables:

  code_knowledge             — chunks with classification_status='accepted'
  code_knowledge_quarantine  — chunks with classification_status='quarantined'
  game_parameters            — one row per chunk whose extracted_parameters
                               sub-dict is non-empty
  ingestion_log              — one row per source_repo summarising lane
                               counts and final 'embedded' status

Idempotent on re-run: an in-memory index of (source_repo, first_file_path)
already in code_knowledge or code_knowledge_quarantine is pre-loaded, and
chunks whose key is present are skipped without re-embedding.

CLI:
    python scripts/ingestion/05_embed_store.py --dry-run
    python scripts/ingestion/05_embed_store.py --engine godot --sample 50
    python scripts/ingestion/05_embed_store.py
    python scripts/ingestion/05_embed_store.py --skip-quarantine
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from tqdm import tqdm

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from scripts.ingestion._embed_db import (  # noqa: E402
    DB_BATCH_SIZE, EMBED_BATCH_SIZE, EmbeddingClient,
    batched, build_param_row, build_searchable_text, chunk_dedup_key,
    chunk_to_row, insert_kb_rows, insert_param_rows, load_existing_keys,
    upsert_ingestion_log,
)
import psycopg2  # noqa: E402

from scripts.shared.db import _load_dsn  # noqa: E402


def _open_conn():
    """Open a fresh psycopg2 connection with autocommit OFF.

    Bypasses get_connection's context manager so the orchestrator owns the
    lifecycle and the reconnect helper can swap the handle without the
    surrounding `with` block closing the new connection prematurely.
    """
    conn = psycopg2.connect(_load_dsn())
    conn.autocommit = False
    return conn
from scripts.shared.taxonomy import ENGINES  # noqa: E402

CHUNKS_CLASSIFIED = REPO_ROOT / "data" / "chunks_classified"
MANIFEST_PATH = REPO_ROOT / "data" / "manifest.json"
REPORT_PATH = REPO_ROOT / "data" / "embed_store_report.json"


def load_license_index() -> dict[str, str]:
    """Map source_repo URL -> SPDX license string, from manifest.json.

    Pre-loaded once so per-row enrichment is O(1). Repos without a
    detectable license in Fase 1 keep value None (we INSERT NULL).
    """
    try:
        m = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    out: dict[str, str] = {}
    for entry in m:
        lic = entry.get("license")
        url = entry.get("url")
        if url and lic:
            out[url] = lic
    return out


def discover_chunks(engine_filter: str | None,
                    include_quarantined: bool) -> list[Path]:
    """List candidate chunk files in stable, deterministic order."""
    if engine_filter:
        roots = [CHUNKS_CLASSIFIED / engine_filter]
    else:
        roots = [d for d in CHUNKS_CLASSIFIED.iterdir() if d.is_dir()]
    accepted_statuses = {"accepted"}
    if include_quarantined:
        accepted_statuses.add("quarantined")
    paths: list[Path] = []
    for root in sorted(roots):
        for f in sorted(root.glob("*/chunk_*.json")):
            try:
                c = json.loads(f.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if c.get("classification_status") in accepted_statuses:
                paths.append(f)
    return paths


def split_by_status(chunks: list[dict[str, Any]]) \
        -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Partition chunks into (accepted, quarantined) lists, preserving
    input order so the embedding batch indexing stays trivially aligned."""
    acc: list[dict[str, Any]] = []
    qua: list[dict[str, Any]] = []
    for c in chunks:
        if c.get("classification_status") == "accepted":
            acc.append(c)
        elif c.get("classification_status") == "quarantined":
            qua.append(c)
    return acc, qua


def dry_run_preview(chunks: list[dict[str, Any]]) -> int:
    if not chunks:
        print("No accepted/quarantined chunks found.")
        return 0
    by_status: Counter[str] = Counter()
    by_engine: Counter[str] = Counter()
    with_params = 0
    for c in chunks:
        by_status[c["classification_status"]] += 1
        by_engine[c["engine"]] += 1
        if (c.get("classification") or {}).get("extracted_parameters"):
            with_params += 1
    sample = chunks[0]
    cl = sample["classification"]
    text = build_searchable_text(cl, sample["engine"])
    print(f"DRY RUN — {len(chunks)} chunks would be embedded + stored")
    print(f"  by status: {dict(by_status)}")
    print(f"  by engine: {dict(by_engine)}")
    print(f"  with extracted_parameters: {with_params}")
    print(f"\nSample searchable_text (first chunk):\n  {sample['engine']} "
          f"{sample['file_paths'][0]}")
    print("  " + "\n  ".join(text.splitlines()))
    return 0


def run(args: argparse.Namespace) -> int:
    paths = discover_chunks(args.engine, include_quarantined=not args.skip_quarantine)
    if args.sample:
        paths = paths[:args.sample]
    print(f"Candidates: {len(paths)} chunk files")
    if not paths:
        return 0

    chunks: list[dict[str, Any]] = []
    for p in paths:
        try:
            chunks.append(json.loads(p.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError):
            continue

    if args.dry_run:
        return dry_run_preview(chunks)

    license_index = load_license_index()
    print(f"License index from manifest.json: {len(license_index)} repos")

    embed_client = EmbeddingClient(api_key=os.getenv("OPENAI_API_KEY", ""))
    started_at = time.time()

    # === IDEMPOTENCE: pre-load existing (source_repo, first_file) ===
    conn = _open_conn()
    conn_ref = [conn]
    cur = conn.cursor()
    existing_kb = load_existing_keys(cur, "code_knowledge")
    existing_q = load_existing_keys(cur, "code_knowledge_quarantine")
    print(f"Already in code_knowledge: {len(existing_kb)} rows; "
          f"in quarantine: {len(existing_q)} rows")

    accepted, quarantined = split_by_status(chunks)
    accepted = [c for c in accepted
                if chunk_dedup_key(c) not in existing_kb]
    quarantined = [c for c in quarantined
                   if chunk_dedup_key(c) not in existing_q]
    print(f"To embed+store: accepted={len(accepted)} "
          f"quarantined={len(quarantined)}")

    totals = {"kb_inserted": 0, "q_inserted": 0, "params_inserted": 0}
    per_repo: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"engine": "", "accepted": 0, "quarantined": 0,
                 "rejected": 0})

    totals["kb_inserted"] += _process_lane(
        conn_ref, accepted, "code_knowledge", embed_client,
        license_index, per_repo, "accepted",
        insert_params=True, totals=totals)

    if not args.skip_quarantine:
        totals["q_inserted"] += _process_lane(
            conn_ref, quarantined, "code_knowledge_quarantine",
            embed_client, license_index, per_repo, "quarantined",
            insert_params=False, totals=totals)

    # ingestion_log: 1 row per repo, status='embedded'
    ing_n = _safe_db_op(conn_ref, upsert_ingestion_log, per_repo)
    _safe_commit(conn_ref)
    print(f"\ningestion_log: upserted {ing_n} repo rows")
    conn_ref[0].close()

    render_summary(totals, embed_client, per_repo, started_at)
    write_report(totals, embed_client, per_repo, started_at, args)
    return 0


def _safe_db_op(conn_ref, op, *args, _attempt: int = 0):
    """Run a DB write op; on OperationalError reconnect and retry.

    `conn_ref` is a single-element list so we can mutate the caller's
    handle when we swap connections. `op` receives (cur, *args). Up to
    3 reconnect attempts before giving up.
    """
    try:
        return op(conn_ref[0].cursor(), *args)
    except (psycopg2.OperationalError, psycopg2.InterfaceError) as exc:
        if _attempt >= 3:
            raise
        print(f"  DB disconnect ({type(exc).__name__}); "
              f"reconnect attempt {_attempt + 1}/3...")
        try:
            conn_ref[0].close()
        except Exception:
            pass
        import time as _t
        _t.sleep(2 ** _attempt)
        conn_ref[0] = _open_conn()
        return _safe_db_op(conn_ref, op, *args, _attempt=_attempt + 1)


def _safe_commit(conn_ref, _attempt: int = 0) -> None:
    """commit() can itself raise OperationalError if the underlying socket
    died between INSERTs. Reconnect-and-retry with the same backoff policy
    as the write helper."""
    try:
        conn_ref[0].commit()
    except (psycopg2.OperationalError, psycopg2.InterfaceError) as exc:
        if _attempt >= 3:
            raise
        print(f"  commit failed ({type(exc).__name__}); "
              f"reconnect attempt {_attempt + 1}/3...")
        try:
            conn_ref[0].close()
        except Exception:
            pass
        import time as _t
        _t.sleep(2 ** _attempt)
        conn_ref[0] = _open_conn()
        # Note: the previous transaction's INSERTs are lost on the dead
        # connection — that's why we keep batches small and use idempotence.
        _safe_commit(conn_ref, _attempt=_attempt + 1)


def _process_lane(conn_ref, chunks: list[dict[str, Any]], table: str,
                  embed_client: EmbeddingClient,
                  license_index: dict[str, str],
                  per_repo: dict[str, dict[str, Any]],
                  status_label: str, insert_params: bool,
                  totals: dict[str, int]) -> int:
    """Embed → row build → INSERT for one lane.

    Commits after every embed-batch (~100 chunks) so a session-pooler
    timeout or transient network error loses at most one batch — the
    next invocation skips already-stored rows via the idempotence key.
    On connection drop the helper reconnects transparently and retries
    the failed batch once. Returns the count of rows actually written.
    """
    if not chunks:
        return 0
    inserted = 0
    bar = tqdm(total=len(chunks), desc=f"{table:<28}", unit="chunk")
    for batch in batched(chunks, EMBED_BATCH_SIZE):
        texts = [build_searchable_text(c["classification"], c["engine"])
                 for c in batch]
        embeddings = embed_client.embed_batch(texts)

        rows = [chunk_to_row(c, e) for c, e in zip(batch, embeddings)]
        for r, c in zip(rows, batch):
            r.source_license = license_index.get(c.get("source_repo") or "")

        for sub in batched(rows, DB_BATCH_SIZE):
            inserted += _safe_db_op(
                conn_ref, lambda cur, rs: insert_kb_rows(cur, table, rs), sub)

        if insert_params:
            param_rows: list[tuple] = []
            for c in batch:
                row = build_param_row(c)
                if row is not None:
                    param_rows.append(row)
            if param_rows:
                for sub in batched(param_rows, DB_BATCH_SIZE):
                    totals["params_inserted"] += _safe_db_op(
                        conn_ref, insert_param_rows, sub)

        for c in batch:
            repo = c.get("source_repo") or ""
            if not repo:
                continue
            per_repo[repo]["engine"] = c["engine"]
            per_repo[repo][status_label] += 1

        _safe_commit(conn_ref)
        bar.update(len(batch))
    bar.close()
    return inserted


def render_summary(totals: dict[str, int], embed_client: EmbeddingClient,
                   per_repo: dict[str, dict[str, Any]],
                   started_at: float) -> None:
    elapsed = time.time() - started_at
    by_engine: Counter[str] = Counter()
    for stats in per_repo.values():
        by_engine[stats["engine"]] += 1
    print("\n" + "=" * 64)
    print("EMBED & STORE SUMMARY")
    print("=" * 64)
    print(f"code_knowledge inserted:           {totals['kb_inserted']}")
    print(f"code_knowledge_quarantine inserted: {totals['q_inserted']}")
    print(f"game_parameters inserted:          {totals['params_inserted']}")
    print(f"Distinct repos updated:            {len(per_repo)}")
    print(f"Embedding requests:                {embed_client.usage.requests}")
    print(f"Embedding input tokens:            "
          f"{embed_client.usage.input_tokens}")
    print(f"Embedding cost USD:                "
          f"${embed_client.usage.cost_usd:.4f}")
    print(f"Elapsed:                           {elapsed/60:.1f} min")
    print("\nRepos per engine:")
    for eng, n in sorted(by_engine.items()):
        print(f"  {eng:<10} {n}")


def write_report(totals: dict[str, int], embed_client: EmbeddingClient,
                 per_repo: dict[str, dict[str, Any]],
                 started_at: float, args: argparse.Namespace) -> None:
    by_engine: Counter[str] = Counter()
    for stats in per_repo.values():
        by_engine[stats["engine"]] += 1
    REPORT_PATH.write_text(json.dumps({
        "elapsed_seconds": round(time.time() - started_at, 1),
        "engine_filter": args.engine,
        "sample_n": args.sample,
        "skip_quarantine": args.skip_quarantine,
        "kb_inserted": totals["kb_inserted"],
        "q_inserted": totals["q_inserted"],
        "params_inserted": totals["params_inserted"],
        "distinct_repos": len(per_repo),
        "by_engine": dict(by_engine),
        "embedding": {
            "requests": embed_client.usage.requests,
            "input_tokens": embed_client.usage.input_tokens,
            "cost_usd": round(embed_client.usage.cost_usd, 4),
        },
    }, indent=2), encoding="utf-8")
    print(f"\nReport: {REPORT_PATH}")


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Fase 5 — embedding generation + Supabase insert")
    ap.add_argument("--engine", choices=ENGINES,
                    help="Restrict to a single engine.")
    ap.add_argument("--sample", type=int,
                    help="Process only the first N chunks (smoke test).")
    ap.add_argument("--dry-run", action="store_true",
                    help="Show what would be done; no API or DB writes.")
    ap.add_argument("--skip-quarantine", action="store_true",
                    help="Skip the code_knowledge_quarantine lane.")
    return run(ap.parse_args())


if __name__ == "__main__":
    sys.exit(main())
