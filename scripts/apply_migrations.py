"""Apply pending Supabase migrations from supabase/migrations/.

Implements the migration sync protocol from CLAUDE.md:
- Local files under supabase/migrations/NNN_*.sql are the source of truth.
- A bookkeeping table public.schema_migrations records what has run.
- Each migration runs inside a single transaction; on failure nothing is
  applied and the script exits non-zero.
- --dry-run (per CLAUDE.md) prints what would be applied without touching
  the database.

Usage:
    python scripts/apply_migrations.py            # apply all pending
    python scripts/apply_migrations.py --dry-run  # just list
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from shared.db import get_connection


MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "supabase" / "migrations"

BOOKKEEPING_DDL = """
create table if not exists public.schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
);
"""


def discover_migrations() -> list[Path]:
    """List migration files sorted by their numeric prefix (NNN_*.sql)."""
    files = sorted(MIGRATIONS_DIR.glob("[0-9][0-9][0-9]_*.sql"))
    return files


def get_applied_versions(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(BOOKKEEPING_DDL)
        conn.commit()
        cur.execute("select version from public.schema_migrations;")
        return {row[0] for row in cur.fetchall()}


def apply_migration(conn, path: Path) -> None:
    version = path.stem
    sql = path.read_text(encoding="utf-8")
    print(f"  applying {version}... ", end="", flush=True)
    with conn.cursor() as cur:
        cur.execute(sql)
        cur.execute(
            "insert into public.schema_migrations (version) values (%s);",
            (version,),
        )
    conn.commit()
    print("ok")


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply pending Supabase migrations.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List pending migrations without applying.",
    )
    args = parser.parse_args()

    all_migrations = discover_migrations()
    if not all_migrations:
        print(f"No migration files found under {MIGRATIONS_DIR}")
        return 0

    with get_connection() as conn:
        applied = get_applied_versions(conn)
        pending = [p for p in all_migrations if p.stem not in applied]

        print(f"Found {len(all_migrations)} migration files.")
        print(f"Already applied: {len(applied)} — {sorted(applied) or '[]'}")
        print(f"Pending: {len(pending)}")

        if not pending:
            print("Nothing to do.")
            return 0

        if args.dry_run:
            print("\nDRY RUN — would apply:")
            for path in pending:
                print(f"  - {path.stem} ({path.stat().st_size} bytes)")
            return 0

        print("\nApplying:")
        for path in pending:
            try:
                apply_migration(conn, path)
            except Exception as exc:
                conn.rollback()
                print(f"\nFAIL on {path.stem}: {type(exc).__name__}: {exc}")
                return 1

    print("\nAll pending migrations applied successfully.")
    return 0


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    sys.exit(main())
