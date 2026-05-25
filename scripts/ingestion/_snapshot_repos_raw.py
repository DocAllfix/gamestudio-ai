"""Pre-cleanup snapshot of data/repos_raw/.

Before we wipe ~16.6 GB of cloned repos that are either (a) already
ingested into Supabase or (b) zombie-rejected leftovers from the
phase-1ter filter hardening, we save a durable record of every URL on
disk. This is the restore path:

  - 'ingested_in_supabase': the chunks live in code_knowledge /
    code_knowledge_quarantine / ingestion_log. Source code is NOT
    needed for the Reasoning Engine. If an offline copy is required
    later, re-clone the URL stored here.

  - 'zombie_rejected_or_unprocessed': cloned during the phase-1
    aggressive harvest but never reached ingestion_log (the quality
    filter dropped them, or the run was interrupted, or the filter
    rules tightened after the clone). If a future filter pass wants
    a second chance, re-clone from these URLs.

Output: data/cleanup_snapshot_repos_raw_<UTC>.json (large, gitignored)
        docs/CLEANUP_LEDGER.md (small index, committed)

CLI:
    python scripts/ingestion/_snapshot_repos_raw.py
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv

from scripts.shared.db import get_connection
from scripts.ingestion._scrape_helpers import safe_repo_name

REPOS_RAW = REPO_ROOT / "data" / "repos_raw"

# Fresh FASE-3 clones we are deliberately NOT deleting. They are unprocessed
# AND we still need them on disk for the in-progress harvest expansion.
FASE3_KEEP = frozenset({
    "jsfehler__entroponaut",
    "shawna-p__mysterious-messenger",
})


def parent_url(u: str) -> str:
    return u.split("__", 1)[0] if u else u


def main() -> int:
    load_dotenv(REPO_ROOT / ".env")

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT source_repo FROM code_knowledge")
        main_urls = [r[0] for r in cur.fetchall()]
        cur.execute("SELECT DISTINCT source_repo FROM code_knowledge_quarantine")
        quar_urls = [r[0] for r in cur.fetchall()]
        cur.execute("SELECT source_url FROM ingestion_log WHERE status='embedded'")
        log_urls = [r[0] for r in cur.fetchall()]

    processed_parents = (
        {safe_repo_name(parent_url(u)) for u in main_urls}
        | {safe_repo_name(parent_url(u)) for u in quar_urls}
        | {safe_repo_name(parent_url(u)) for u in log_urls}
    )
    print(f"Processed parents (any of 3 tables): {len(processed_parents)}")

    # Both manifests, curated overrides manifest.json (richer metadata).
    mc = json.loads((REPO_ROOT / "data" / "manifest.curated.json").read_text(encoding="utf-8"))
    mj = json.loads((REPO_ROOT / "data" / "manifest.json").read_text(encoding="utf-8"))
    by_safe: dict[str, dict] = {}
    for source_name, lst in (("manifest.json", mj), ("manifest.curated.json", mc)):
        for e in lst:
            url = e.get("url")
            if not url:
                continue
            by_safe[safe_repo_name(url)] = {**e, "_source_manifest": source_name}
    print(f"Manifest entries mappable to safe_name: {len(by_safe)}")

    ingested: list[dict] = []
    zombie: list[dict] = []
    unknown_no_manifest: list[dict] = []

    for engine_dir in sorted(REPOS_RAW.iterdir()):
        if not engine_dir.is_dir():
            continue
        engine = engine_dir.name
        for sub in sorted(engine_dir.iterdir()):
            if not sub.is_dir() or sub.name in FASE3_KEEP:
                continue
            m = by_safe.get(sub.name)
            entry = {
                "engine": engine,
                "safe_name": sub.name,
                "url": m.get("url") if m else None,
                "license": (m or {}).get("license"),
                "stars": (m or {}).get("stars"),
                "pushed_at": (m or {}).get("pushed_at"),
                "language": (m or {}).get("language"),
                "role": (m or {}).get("role"),
                "topics": (m or {}).get("topics"),
                "manifest_source": (m or {}).get("_source_manifest"),
            }
            if sub.name in processed_parents:
                ingested.append(entry)
            elif m:
                zombie.append(entry)
            else:
                unknown_no_manifest.append(entry)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    snapshot = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "purpose": (
            "Pre-cleanup snapshot of data/repos_raw/. The deletion frees "
            "disk while preserving the URL + metadata of every cloned "
            "repo, so a future operator can re-clone on demand."
        ),
        "counts": {
            "ingested_in_supabase": len(ingested),
            "zombie_rejected_or_unprocessed": len(zombie),
            "unknown_no_manifest_record": len(unknown_no_manifest),
            "fase3_kept_on_disk": sorted(FASE3_KEEP),
        },
        "how_to_restore": {
            "ingested_in_supabase": (
                "Chunks already live in code_knowledge / "
                "code_knowledge_quarantine and ingestion_log on Supabase. "
                "Source code is NOT needed at runtime for the Reasoning "
                "Engine (it queries the DB, not the disk). If an offline "
                "copy is wanted later, git clone the URL stored in "
                "ingested_in_supabase[].url."
            ),
            "zombie_rejected_or_unprocessed": (
                "Cloned during the phase-1 aggressive harvest. They never "
                "produced an ingestion_log row, so the quality filter "
                "either rejected them post-clone or the pipeline was "
                "interrupted. To revive with a different filter policy: "
                "re-add the URL to scripts/ingestion/_sources.py "
                "CURATED_REPOS (or to one of the SEARCH_QUERIES) and "
                "re-run 01_scrape.py followed by the rest of the pipeline. "
                "Most will likely fail the same filter again unless "
                "scripts/ingestion/_filter_rules.py changes."
            ),
            "unknown_no_manifest_record": (
                "Should be empty in practice. If any appear they are "
                "stale clones with no provenance — discard, no restore "
                "path possible."
            ),
        },
        "ingested_in_supabase": sorted(
            ingested, key=lambda x: (x["engine"], x["safe_name"])),
        "zombie_rejected_or_unprocessed": sorted(
            zombie, key=lambda x: (x["engine"], x["safe_name"])),
        "unknown_no_manifest_record": sorted(
            unknown_no_manifest, key=lambda x: (x["engine"], x["safe_name"])),
    }

    data_path = REPO_ROOT / "data" / f"cleanup_snapshot_repos_raw_{stamp}.json"
    data_path.write_text(
        json.dumps(snapshot, indent=2, ensure_ascii=False), encoding="utf-8")

    # Slim sidecar committed to docs/: just the URLs + engine + license, no
    # metadata bulk. This is the durable artefact — survives a `data/` wipe.
    sidecar = REPO_ROOT / "docs" / "CLEANUP_LEDGER_URLS.json"
    sidecar.write_text(json.dumps({
        "generated_at": snapshot["generated_at"],
        "schema": [
            "engine — one of {godot, phaser, renpy, defold, monogame, "
            "love2d, threejs, stride}",
            "url — git-clonable URL (github.com or gitlab.com)",
            "license — best-known license at clone time (may be stale)",
        ],
        "ingested_in_supabase": [
            {"engine": r["engine"], "url": r["url"], "license": r["license"]}
            for r in snapshot["ingested_in_supabase"] if r["url"]
        ],
        "zombie_rejected_or_unprocessed": [
            {"engine": r["engine"], "url": r["url"], "license": r["license"]}
            for r in snapshot["zombie_rejected_or_unprocessed"] if r["url"]
        ],
    }, indent=2, ensure_ascii=False), encoding="utf-8")

    # Ledger committed to docs/ — short index pointing at the JSON. Why a
    # ledger and not the JSON itself: the JSON is ~700KB of URLs (gitignored
    # under data/), but the LEDGER is a 1-page summary the reader can scan
    # in a future session to remember why this happened.
    counts_ing = Counter(e["engine"] for e in ingested)
    counts_zom = Counter(e["engine"] for e in zombie)
    ledger = REPO_ROOT / "docs" / "CLEANUP_LEDGER.md"
    lines = [
        "# Cleanup ledger — data/repos_raw/ trim",
        "",
        f"_Generated {stamp} by `scripts/ingestion/_snapshot_repos_raw.py`._",
        "",
        "## Context",
        "",
        "Free local disk was at 3 GB on 2026-05-25. `data/repos_raw/`",
        "held 16.6 GB of cloned repos — most either already in Supabase or",
        "rejected zombies from the phase-1ter filter hardening. We snapshot",
        "every URL + metadata to `data/cleanup_snapshot_repos_raw_*.json`",
        "(gitignored, large) and then wipe the directory except for two",
        "FASE-3 clones still in progress.",
        "",
        "## Counts",
        "",
        f"- **Ingested in Supabase:** {len(ingested)} repos "
        "(safe to delete — chunks already in DB)",
        f"- **Zombie / rejected / unprocessed:** {len(zombie)} repos "
        "(safe to delete — never produced an `ingestion_log` row)",
        f"- **Unknown / no manifest record:** {len(unknown_no_manifest)} repos",
        f"- **Kept on disk for in-progress FASE 3:** "
        f"{', '.join(sorted(FASE3_KEEP))}",
        "",
        "## Per-engine breakdown",
        "",
        "| Engine | Ingested | Zombie |",
        "|---|---|---|",
    ]
    for eng in sorted(set(counts_ing) | set(counts_zom)):
        lines.append(
            f"| `{eng}` | {counts_ing.get(eng, 0)} | {counts_zom.get(eng, 0)} |")
    lines += [
        "",
        "## How to restore",
        "",
        "Two snapshot files exist (use either):",
        "",
        "- **`docs/CLEANUP_LEDGER_URLS.json`** — slim, committed, "
        f"survives a `data/` wipe ({len(ingested) + len(zombie)} URLs, "
        "engine + license only).",
        f"- **`data/cleanup_snapshot_repos_raw_{stamp}.json`** — full, "
        "gitignored, includes stars / topics / pushed_at / role.",
        "",
        "From either file:",
        "",
        "- **Ingested repos:** the chunks are already in `code_knowledge` /",
        "  `code_knowledge_quarantine`. The Reasoning Engine reads Supabase,",
        "  not the disk — no restore needed for normal use. If an offline",
        "  copy is wanted: `git clone <ingested_in_supabase[i].url>`.",
        "- **Zombie repos:** re-add the URL to",
        "  `scripts/ingestion/_sources.py` `CURATED_REPOS` and re-run the",
        "  pipeline. Most will fail the same filter again unless rules in",
        "  `scripts/ingestion/_filter_rules.py` have changed.",
        "- **Unknown repos:** no restore path; discard.",
        "",
        "## Why repos were zombied (root cause)",
        "",
        "Commit `8cd9449 feat(phase-1ter): harden quality filter` tightened",
        "the structural gate (`MIN_LOC=300`, `MIN_COMMENT_RATIO=0.03`, LOC",
        "bypass list) AFTER the initial broad `phase-1` harvest had already",
        "cloned ~700 repos. The harden run reprocessed only a subset, leaving",
        f"the rest ({len(zombie)} of them) cloned but never logged. Subsequent",
        "harvest commits (`phase-1bis`, `phase-1ter`, `phase-1quater`) added",
        "a few hand-picked repos each but never came back to re-evaluate the",
        "early bulk.",
        "",
    ]
    ledger.write_text("\n".join(lines), encoding="utf-8")

    print()
    print("=== Snapshot written ===")
    print(f"  full data:  {data_path}  "
          f"({data_path.stat().st_size / 1024:.1f} KB, gitignored)")
    print(f"  ledger:     {ledger}  (committed)")
    print()
    print(f"  ingested_in_supabase:           {len(ingested)}")
    print(f"  zombie_rejected_or_unprocessed: {len(zombie)}")
    print(f"  unknown_no_manifest_record:     {len(unknown_no_manifest)}")
    print()
    print("=== Zombie by engine (the ones a future re-process would re-clone) ===")
    for eng, n in counts_zom.most_common():
        print(f"  {eng:10}  {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
