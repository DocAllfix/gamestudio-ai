"""Bulk insert embedded assets into Supabase — Phase 2 / Gap 7.6.

Reads data/assets_embedded/<library>/manifest.jsonl and inserts
into public.asset_library_index (confidence_score >= 85) or
asset_library_quarantine (60-84).

Anti-corruption guardrails enforced AT INSERT TIME:
- license CHECK constraint in migration 003 will reject any value
  not in ASSET_LICENSE_ALLOWLIST (defense even if a bug slipped a
  bad license past 02_filter)
- source_url UNIQUE prevents duplicate ingestion
- ON CONFLICT (source_url) DO NOTHING makes the script re-runnable
  without throwing — safer than DO UPDATE here because we never
  want to silently overwrite a hand-verified field

Batch size 50 records per transaction. The Supabase pooler drops
idle connections during long jobs, so we re-open every batch.
Pattern stolen from scripts/ingestion/09_requalify_quarantine.py.

CLI:
    python scripts/ingestion_assets/05_store_assets.py --dry-run
    python scripts/ingestion_assets/05_store_assets.py
    python scripts/ingestion_assets/05_store_assets.py --library polyhaven
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv

from scripts.ingestion._embed_db import vector_literal
from scripts.ingestion_assets._fetch_helpers import load_jsonl
from scripts.shared.db import get_connection

ASSETS_EMBEDDED_DIR = REPO_ROOT / "data" / "assets_embedded"
BATCH_SIZE = 50


# Columns to INSERT in the SAME order across both lanes. Maps a
# record dict key -> column name. Order matters for the executemany
# tuple layout.
INSERT_COLUMNS: tuple[tuple[str, str], ...] = (
    ("source_library", "source_library"),
    ("source_url", "source_url"),
    ("download_url", "download_url"),
    ("thumbnail_url", "thumbnail_url"),
    ("license", "license"),
    ("attribution_required", "attribution_required"),
    ("creator_name", "creator_name"),
    ("asset_type", "asset_type"),
    ("file_format", "file_format"),
    ("file_size_kb", "file_size_kb"),
    ("image_width", "image_width"),
    ("image_height", "image_height"),
    ("audio_duration_s", "audio_duration_s"),
    ("model_triangle_count", "model_triangle_count"),
    ("style_pack_compat", "style_pack_compat"),
    ("genre_affinity", "genre_affinity"),
    ("use_case_tags", "use_case_tags"),
    ("engine_compat", "engine_compat"),
    ("semantic_description", "semantic_description"),
    ("keywords", "keywords"),
    ("quality_score", "quality_score"),
    ("confidence_score", "confidence_score"),
    ("embedding_type", "embedding_type"),
)


def build_insert_sql(table: str) -> str:
    """Compose parameterised INSERT. Embedding is appended via
    pgvector literal cast at execute time."""
    cols = [pair[1] for pair in INSERT_COLUMNS] + ["embedding"]
    placeholders = ["%s"] * len(INSERT_COLUMNS) + ["%s::vector"]
    return (
        f"INSERT INTO public.{table} ({', '.join(cols)}) "
        f"VALUES ({', '.join(placeholders)}) "
        f"ON CONFLICT (source_url) DO NOTHING"
    )


def row_to_tuple(rec: dict[str, Any]) -> tuple[Any, ...]:
    """Pack one record into the executemany tuple. None for missing
    fields lets the DB use column defaults. Vector is the last
    element (string literal for pgvector cast)."""
    values: list[Any] = []
    for key, _col in INSERT_COLUMNS:
        v = rec.get(key)
        # Postgres array columns need a list (psycopg2 maps to ARRAY).
        # For text array columns, default to empty list when missing.
        if key in ("style_pack_compat", "genre_affinity", "use_case_tags",
                   "engine_compat", "keywords") and v is None:
            v = []
        values.append(v)
    values.append(vector_literal(rec["embedding"]))
    return tuple(values)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--library",
                    help="Insert only this library (default: all).")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print what would be inserted, don't touch DB.")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    log = logging.getLogger("store_assets")
    load_dotenv()

    if not ASSETS_EMBEDDED_DIR.exists():
        log.error("Run 04_embed_assets.py first.")
        return 1

    libraries = (
        [args.library] if args.library
        else [d.name for d in ASSETS_EMBEDDED_DIR.iterdir() if d.is_dir()]
    )

    accepted_rows: list[tuple[Any, ...]] = []
    quarantined_rows: list[tuple[Any, ...]] = []
    skipped_no_embedding = 0
    per_lib = {}

    for lib in libraries:
        manifest = ASSETS_EMBEDDED_DIR / lib / "manifest.jsonl"
        if not manifest.exists():
            continue
        a = q = 0
        for rec in load_jsonl(manifest):
            if not rec.get("embedding") or not rec.get("source_url"):
                skipped_no_embedding += 1
                continue
            tup = row_to_tuple(rec)
            conf = rec.get("confidence_score") or 0
            if conf >= 85:
                accepted_rows.append(tup)
                a += 1
            elif conf >= 60:
                quarantined_rows.append(tup)
                q += 1
            else:
                skipped_no_embedding += 1
        per_lib[lib] = (a, q)
        log.info("%s: accepted=%d quarantined=%d", lib, a, q)

    print("\n" + "=" * 56)
    print("ASSET STORE PLAN")
    print("=" * 56)
    print(f"Accepted lane (>=85): {len(accepted_rows)}")
    print(f"Quarantine (60-84):   {len(quarantined_rows)}")
    print(f"Skipped (no embed/<60): {skipped_no_embedding}")

    if args.dry_run:
        print("\nDRY-RUN — no DB writes.")
        return 0
    if not (accepted_rows or quarantined_rows):
        print("Nothing to insert.")
        return 0

    insert_accepted = build_insert_sql("asset_library_index")
    insert_quarantine = build_insert_sql("asset_library_quarantine")

    inserted_a = 0
    inserted_q = 0

    def flush(cur, sql: str, rows: list[tuple[Any, ...]]) -> int:
        if not rows:
            return 0
        cur.executemany(sql, rows)
        return cur.rowcount or len(rows)

    with get_connection() as conn:
        cur = conn.cursor()
        # Accepted batches
        for i in range(0, len(accepted_rows), BATCH_SIZE):
            batch = accepted_rows[i:i + BATCH_SIZE]
            try:
                n = flush(cur, insert_accepted, batch)
            except Exception as exc:
                log.error("Insert accepted batch %d failed: %s", i, exc)
                conn.rollback()
                continue
            inserted_a += n
            conn.commit()
        # Quarantine batches
        for i in range(0, len(quarantined_rows), BATCH_SIZE):
            batch = quarantined_rows[i:i + BATCH_SIZE]
            try:
                n = flush(cur, insert_quarantine, batch)
            except Exception as exc:
                log.error("Insert quarantine batch %d failed: %s", i, exc)
                conn.rollback()
                continue
            inserted_q += n
            conn.commit()

    print(f"\nInserted accepted: {inserted_a}")
    print(f"Inserted quarantine: {inserted_q}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
