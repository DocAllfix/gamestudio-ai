"""Direct Postgres connection helpers for the Supabase project.

Used by the migration applicator and any ad-hoc admin script that needs
to run DDL or service-role-only queries. The Supabase REST/RPC client is
not enough for migrations: it only speaks to PostgREST, not to the SQL
engine directly.

Connection details come from `.env`:
    SUPABASE_DB_HOST   — pooler hostname (region-specific)
    SUPABASE_DB_PORT   — 5432 for session pooler, 6543 for transaction
    SUPABASE_DB_USER   — postgres.<project-ref>
    SUPABASE_DB_PASSWORD
    SUPABASE_DB_NAME   — postgres
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Iterator

import psycopg2
from psycopg2.extensions import connection as PgConnection
from dotenv import load_dotenv


def _load_dsn() -> str:
    load_dotenv()
    required = (
        "SUPABASE_DB_HOST",
        "SUPABASE_DB_PORT",
        "SUPABASE_DB_USER",
        "SUPABASE_DB_PASSWORD",
        "SUPABASE_DB_NAME",
    )
    missing = [name for name in required if not os.environ.get(name)]
    if missing:
        raise RuntimeError(
            f"Missing required Supabase DB env vars: {', '.join(missing)}. "
            "Check .env against .env.example."
        )
    return (
        f"host={os.environ['SUPABASE_DB_HOST']} "
        f"port={os.environ['SUPABASE_DB_PORT']} "
        f"dbname={os.environ['SUPABASE_DB_NAME']} "
        f"user={os.environ['SUPABASE_DB_USER']} "
        f"password={os.environ['SUPABASE_DB_PASSWORD']} "
        "sslmode=require"
    )


@contextmanager
def get_connection() -> Iterator[PgConnection]:
    """Yields a psycopg2 connection with autocommit OFF.

    The caller is expected to wrap their work in an explicit transaction;
    migrations especially must be all-or-nothing.
    """
    conn = psycopg2.connect(_load_dsn())
    try:
        yield conn
    finally:
        conn.close()
