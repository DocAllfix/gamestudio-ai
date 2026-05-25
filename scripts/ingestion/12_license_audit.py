"""License audit + cleanup for code_knowledge (Fase RAG-1).

Re-verifies every chunk whose source_license is NULL / 'NOASSERTION' /
'unknown' / '' against the repo's real LICENSE (local clone, then GitHub
Licenses API, then raw HTTP for GitLab). Then:

    resolved -> permissive allowlist : UPDATE source_license in place
    resolved -> copyleft/forbidden   : MOVE chunk to code_knowledge_quarantine
    unresolved                       : MOVE chunk to code_knowledge_quarantine

CLAUDE.md forbids GPL/proprietary/unknown in the production KB because RAG
retrieval reproduces chunks near-verbatim into generated games. This script
is the gate that removes the ~1.4k ambiguous chunks before any new ingestion.

No LLM: license detection is deterministic (see _license_resolver.py).
Idempotent: a clean re-run finds zero dirty rows and changes nothing.

ROLLBACK: every run writes data/license_audit_backup_<utc>.json with one
record per touched chunk {id, source_repo, old_license, action, new_license}.
To undo, re-INSERT the quarantined ids back into code_knowledge from the
quarantine table and restore old_license from the backup. (Restore code is
not pre-written — YAGNI; the backup carries everything needed.)

CLI:
    python scripts/ingestion/12_license_audit.py             # dry-run
    python scripts/ingestion/12_license_audit.py --apply
    python scripts/ingestion/12_license_audit.py --apply --engine renpy
    python scripts/ingestion/12_license_audit.py --apply --limit 5   # repos
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv

from scripts.shared.db import get_connection
from scripts.ingestion._license_resolver import (
    canonical_repo_url, is_forbidden, resolve_license,
)

REPOS_RAW = REPO_ROOT / "data" / "repos_raw"
DIRTY_PREDICATE = (
    "source_license IS NULL OR source_license IN ('NOASSERTION','unknown','')"
)

# Columns shared by code_knowledge and code_knowledge_quarantine. Both tables
# carry the identical chunk shape, so a move is INSERT ... SELECT of these.
MOVE_COLUMNS = (
    "id", "engine", "language", "primary_category", "subcategories",
    "chunk_type", "genre_tags", "complexity", "design_patterns",
    "key_features", "quality_score", "reusability_score", "confidence_score",
    "summary", "code", "loc", "source_repo", "source_license",
    "source_file_paths", "scene_context", "embedding", "times_retrieved",
    "positive_feedback", "negative_feedback", "created_at", "updated_at",
)


def _fetch_dirty_repos(cur, engine: str | None) -> dict[str, int]:
    """Return {source_repo: chunk_count} for all dirty chunks."""
    sql = f"SELECT source_repo, COUNT(*) FROM code_knowledge WHERE ({DIRTY_PREDICATE})"
    params: list[object] = []
    if engine:
        sql += " AND engine=%s"
        params.append(engine)
    sql += " GROUP BY source_repo"
    cur.execute(sql, params)
    return {row[0]: row[1] for row in cur.fetchall()}


def _move_to_quarantine(cur, source_repo: str) -> int:
    """Copy this repo's dirty chunks into quarantine, then delete from main.

    Returns the number of chunks moved. ON CONFLICT DO NOTHING keeps the move
    idempotent if a chunk id is somehow already quarantined.
    """
    cols = ", ".join(MOVE_COLUMNS)
    cur.execute(
        f"INSERT INTO code_knowledge_quarantine ({cols}) "
        f"SELECT {cols} FROM code_knowledge "
        f"WHERE source_repo=%s AND ({DIRTY_PREDICATE}) "
        f"ON CONFLICT (id) DO NOTHING",
        (source_repo,))
    cur.execute(
        f"DELETE FROM code_knowledge "
        f"WHERE source_repo=%s AND ({DIRTY_PREDICATE})",
        (source_repo,))
    return cur.rowcount


def _update_license(cur, source_repo: str, spdx: str) -> int:
    """Set source_license=spdx for this repo's dirty chunks. Returns rowcount."""
    cur.execute(
        f"UPDATE code_knowledge SET source_license=%s, updated_at=now() "
        f"WHERE source_repo=%s AND ({DIRTY_PREDICATE})",
        (spdx, source_repo))
    return cur.rowcount


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true",
                    help="Persist changes. Default is dry-run.")
    ap.add_argument("--engine", help="Restrict to one engine.")
    ap.add_argument("--limit", type=int, default=0,
                    help="Cap number of distinct repos processed (0=all).")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    log = logging.getLogger("license_audit")
    load_dotenv()
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        log.warning("GITHUB_TOKEN not set — GitHub API resolver disabled")

    backup: dict[str, object] = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "applied": bool(args.apply),
        "engine_filter": args.engine,
        "records": [],
    }
    records: list[dict[str, object]] = []
    tally: dict[str, int] = defaultdict(int)

    # Stage 1 — short DB session: collect the dirty list, then close.
    # The Supabase pooler drops connections idle through the network-bound
    # resolver loop, so we never hold a session across that work.
    with get_connection() as conn:
        cur = conn.cursor()
        dirty = _fetch_dirty_repos(cur, args.engine)
    repos = sorted(dirty.items(), key=lambda kv: -kv[1])
    if args.limit > 0:
        repos = repos[: args.limit]
    log.info("dirty repos: %d, dirty chunks: %d",
             len(dirty), sum(dirty.values()))

    # Stage 2 — pure network: resolve every repo's license offline of DB.
    plan: list[tuple[str, int, str, str | None, str]] = []  # (repo, count, action, new_license, canon)
    for source_repo, count in repos:
        resolution = resolve_license(source_repo, REPOS_RAW, token, log)
        canon = canonical_repo_url(source_repo)
        if resolution is None:
            action, new_license = "quarantine_unresolvable", None
            tally["quarantine_unresolvable"] += count
        elif is_forbidden(resolution):
            action, new_license = f"quarantine_{resolution}", None
            tally["quarantine_forbidden"] += count
        else:
            action, new_license = "relabel", resolution
            tally["relabel"] += count
        plan.append((source_repo, count, action, new_license, canon))
        records.append({
            "source_repo": source_repo, "canonical": canon,
            "chunk_count": count, "action": action,
            "new_license": new_license,
        })
        log.info("%-26s %5d chunks  %-22s %s",
                 action, count, new_license or "-", canon)

    # Stage 3 — short DB session: apply (or skip) every planned action, then
    # take the post-change counts.
    with get_connection() as conn:
        cur = conn.cursor()
        if args.apply:
            for source_repo, _count, action, new_license, _canon in plan:
                if action.startswith("quarantine_"):
                    _move_to_quarantine(cur, source_repo)
                elif action == "relabel":
                    assert new_license is not None
                    _update_license(cur, source_repo, new_license)
            conn.commit()
            log.info("committed")
        cur.execute("SELECT COUNT(*) FROM code_knowledge")
        post_main = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM code_knowledge_quarantine")
        post_quar = cur.fetchone()[0]

    backup["records"] = records
    backup["tally"] = dict(tally)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_path = REPO_ROOT / "data" / f"license_audit_backup_{stamp}.json"
    backup_path.write_text(
        json.dumps(backup, indent=2, default=str), encoding="utf-8")

    print()
    print(f"=== License audit ({'APPLIED' if args.apply else 'DRY-RUN'}) ===")
    for k in ("relabel", "quarantine_forbidden", "quarantine_unresolvable"):
        print(f"  {k:28} {tally.get(k, 0)} chunks")
    print(f"  code_knowledge after:      {post_main}")
    print(f"  quarantine after:          {post_quar}")
    print(f"  backup: {backup_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
