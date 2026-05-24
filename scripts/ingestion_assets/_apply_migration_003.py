"""One-shot migration applicator for 003_asset_library_index.sql.

Reads the migration SQL file and applies it inside a single
transaction. Rolls back on any error so partial schema never lands.

This script is the AUTHORIZED migration applicator per the protocol
documented in CLAUDE.md (Database / Migration Sync Protocol):
the local file is the source of truth, the commit is the
authorization record, this script is the apply mechanism.

CLI:
    python scripts/ingestion_assets/_apply_migration_003.py --dry-run
    python scripts/ingestion_assets/_apply_migration_003.py
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.shared.db import get_connection

MIGRATION = REPO_ROOT / "supabase" / "migrations" / "003_asset_library_index.sql"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true",
                    help="Parse + validate inside a rolled-back transaction.")
    args = ap.parse_args()

    if not MIGRATION.exists():
        print(f"ERROR: migration not found: {MIGRATION}", file=sys.stderr)
        return 1

    sql = MIGRATION.read_text(encoding="utf-8")
    print(f"Migration file: {MIGRATION}")
    print(f"Size: {len(sql)} chars, {sql.count(chr(10))} lines")

    with get_connection() as conn:
        cur = conn.cursor()
        try:
            cur.execute(sql)
        except Exception as exc:
            conn.rollback()
            print(f"\nERROR during migration:\n  {exc}", file=sys.stderr)
            return 2

        if args.dry_run:
            conn.rollback()
            print("\nDRY-RUN: rolled back. Migration parsed cleanly.")
            return 0

        conn.commit()
        # Verify tables landed.
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema='public' AND table_name IN (
                'asset_library_index', 'asset_library_quarantine',
                'style_packs', 'genre_templates', 'reference_games',
                'audio_mood_library', 'lora_library'
            ) ORDER BY table_name
        """)
        landed = [r[0] for r in cur.fetchall()]
        print(f"\nTables created: {len(landed)}/7")
        for t in landed:
            print(f"  {t}")
        cur.execute("""
            SELECT routine_name FROM information_schema.routines
            WHERE routine_schema='public'
              AND routine_name IN ('match_assets', 'match_loras',
                                   'increment_asset_usage')
            ORDER BY routine_name
        """)
        rpcs = [r[0] for r in cur.fetchall()]
        print(f"\nRPCs created: {len(rpcs)}/3")
        for r in rpcs:
            print(f"  {r}")

    print("\nMIGRATION APPLIED SUCCESSFULLY.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
