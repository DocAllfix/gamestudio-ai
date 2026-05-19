"""GitHub scraper — Fase 1 step 1 of the RAG ingestion pipeline.

For each of the 8 target engines, harvests candidate repositories from
three sources:

1. GitHub API `search/repositories` with engine-specific query strings
   (`SEARCH_QUERIES`) plus `stars >= 20` + `pushed >= PUSHED_FILTERS[engine]`
   + `size <= 100MB`.
2. Curated awesome-list READMEs (`AWESOME_LISTS`): regex-extract every
   `github.com/owner/repo` link.
3. Hardcoded official demo/sample repos (`OFFICIAL_SAMPLES`).

Results are merged into `data/manifest.json` (deduped by URL). Each new
repo that passes the license + language whitelist is then shallow-cloned
into `data/repos_raw/{engine}/{repo_name}/` unless `--skip-clone`.

Quality gates here are intentionally LOOSE — this script captures, the
next phase (`02_filter.py`) culls. Hard fails only: missing/forbidden
license, wrong engine language, repo > 100MB, stars < 20, fork/archived.

CLI:
    python scripts/ingestion/01_scrape.py             # full run, all engines
    python scripts/ingestion/01_scrape.py --dry-run   # show counts only
    python scripts/ingestion/01_scrape.py --engine godot
    python scripts/ingestion/01_scrape.py --skip-clone
"""
from __future__ import annotations

import argparse
import logging
import os
import re
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from tqdm import tqdm

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.shared.taxonomy import ENGINES, PUSHED_FILTERS
from scripts.ingestion._sources import (
    AWESOME_LISTS,
    CURATED_REPOS,
    HARVEST_ORGS,
    NOTABLE_REPOS,
    OFFICIAL_SAMPLES,
    SEARCH_QUERIES,
    SUBDIR_EXPANSIONS,
    TOPIC_QUERIES,
)
from scripts.ingestion._scrape_helpers import (
    MAX_SIZE_KB,
    MIN_STARS,
    GitHubClient,
    entry_from_repo,
    load_manifest,
    passes_basic_filters,
    save_manifest,
    scrape_awesome_list,
)
from scripts.ingestion._clone_phase import (
    clone_phase,
    expand_subdir_phase,
    run_from_curated,
)


DATA_DIR = REPO_ROOT / "data"
REPOS_RAW_DIR = DATA_DIR / "repos_raw"
MANIFEST_PATH = DATA_DIR / "manifest.json"
CURATED_PATH = DATA_DIR / "manifest.curated.json"
LOG_PATH = REPO_ROOT / "scrape_log.txt"


def setup_logging() -> logging.Logger:
    log = logging.getLogger("scrape")
    log.setLevel(logging.INFO)
    log.handlers.clear()
    fh = logging.FileHandler(LOG_PATH, mode="a", encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    log.addHandler(fh)
    return log


def scrape_engine(
    engine: str,
    gh: GitHubClient,
    log: logging.Logger,
    seen_urls: set[str],
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    new_entries: list[dict[str, Any]] = []
    stats = {
        "api_returned": 0, "api_accepted": 0,
        "awesome_found": 0, "awesome_accepted": 0,
        "official_accepted": 0,
        "topic_returned": 0, "topic_accepted": 0,
        "org_returned": 0, "org_accepted": 0,
        "curated_accepted": 0, "notable_accepted": 0,
        "rejected": 0,
    }

    queries = SEARCH_QUERIES.get(engine, [])
    log.info("[%s] starting scrape with %d queries", engine, len(queries))

    for q in tqdm(queries, desc=f"  {engine} API search", leave=False):
        api_q = (
            f"{q} stars:>={MIN_STARS} "
            f"pushed:>={PUSHED_FILTERS[engine]} "
            f"size:<={MAX_SIZE_KB}"
        )
        results = gh.search_repos(api_q)
        stats["api_returned"] += len(results)
        for repo in results:
            ok, reason = passes_basic_filters(repo, engine)
            url = repo.get("html_url")
            if not ok:
                stats["rejected"] += 1
                log.debug("[%s] reject %s: %s", engine, url, reason)
                continue
            if url in seen_urls:
                continue
            seen_urls.add(url)
            stats["api_accepted"] += 1
            new_entries.append(entry_from_repo(repo, engine))

    for topic in tqdm(TOPIC_QUERIES.get(engine, []), desc=f"  {engine} topic search", leave=False):
        results = gh.search_topic(topic, engine)
        stats["topic_returned"] += len(results)
        for repo in results:
            ok, reason = passes_basic_filters(repo, engine)
            url = repo.get("html_url")
            if not ok:
                stats["rejected"] += 1
                log.debug("[%s] reject topic %s: %s", engine, url, reason)
                continue
            if url in seen_urls:
                continue
            seen_urls.add(url)
            stats["topic_accepted"] += 1
            entry = entry_from_repo(repo, engine)
            entry["source"] = "topic"
            new_entries.append(entry)

    for awesome_url in AWESOME_LISTS.get(engine, []):
        pairs = scrape_awesome_list(awesome_url, log)
        stats["awesome_found"] += len(pairs)
        for owner, name in tqdm(list(pairs)[:60], desc=f"  {engine} awesome fetch", leave=False):
            url = f"https://github.com/{owner}/{name}"
            if url in seen_urls:
                continue
            repo = gh.get_repo(owner, name)
            if repo is None:
                continue
            ok, reason = passes_basic_filters(repo, engine)
            if not ok:
                stats["rejected"] += 1
                log.debug("[%s] reject awesome %s: %s", engine, url, reason)
                continue
            seen_urls.add(url)
            stats["awesome_accepted"] += 1
            new_entries.append(entry_from_repo(repo, engine))

    for org in tqdm(HARVEST_ORGS.get(engine, []), desc=f"  {engine} org list", leave=False):
        repos = gh.list_org_repos(org)
        stats["org_returned"] += len(repos)
        for repo in repos:
            ok, reason = passes_basic_filters(repo, engine)
            url = repo.get("html_url")
            if not ok:
                stats["rejected"] += 1
                log.debug("[%s] reject org %s: %s", engine, url, reason)
                continue
            if url in seen_urls:
                continue
            seen_urls.add(url)
            stats["org_accepted"] += 1
            entry = entry_from_repo(repo, engine)
            entry["source"] = "org"
            new_entries.append(entry)

    for owner, name in CURATED_REPOS.get(engine, []):
        url = f"https://github.com/{owner}/{name}"
        if url in seen_urls:
            continue
        repo = gh.get_repo(owner, name)
        if repo is None:
            log.warning("[%s] curated repo not found: %s/%s", engine, owner, name)
            continue
        seen_urls.add(url)
        stats["curated_accepted"] += 1
        entry = entry_from_repo(repo, engine)
        entry["source"] = "curated"
        entry["bypass_filters"] = True
        new_entries.append(entry)

    for owner, name in NOTABLE_REPOS.get(engine, []):
        url = f"https://github.com/{owner}/{name}"
        if url in seen_urls:
            continue
        repo = gh.get_repo(owner, name)
        if repo is None:
            log.warning("[%s] notable repo not found: %s/%s", engine, owner, name)
            continue
        seen_urls.add(url)
        stats["notable_accepted"] += 1
        entry = entry_from_repo(repo, engine)
        entry["source"] = "notable"
        entry["notable"] = True
        entry["bypass_filters"] = True
        new_entries.append(entry)

    for official_url in OFFICIAL_SAMPLES.get(engine, []):
        if official_url in seen_urls:
            continue
        match = re.match(r"https?://github\.com/([^/]+)/([^/]+)/?$", official_url)
        if not match:
            log.warning("[%s] official URL not a top-level repo: %s", engine, official_url)
            continue
        owner, name = match.group(1), match.group(2)
        repo = gh.get_repo(owner, name)
        if repo is None:
            continue
        seen_urls.add(official_url)
        stats["official_accepted"] += 1
        entry = entry_from_repo(repo, engine)
        entry["source"] = "official"
        new_entries.append(entry)

    return new_entries, stats


def print_summary(all_stats: dict[str, dict[str, int]], manifest_before: int) -> int:
    print("\n=== Scrape summary ===")
    grand_total = 0
    accept_keys = ("api_accepted", "topic_accepted", "awesome_accepted",
                   "official_accepted", "org_accepted", "curated_accepted",
                   "notable_accepted")
    for engine, stats in all_stats.items():
        accepted = sum(stats.get(k, 0) for k in accept_keys)
        grand_total += accepted
        print(f"  {engine:<10} api={stats.get('api_accepted', 0):>3}  "
              f"topic={stats.get('topic_accepted', 0):>3}  "
              f"awesome={stats.get('awesome_accepted', 0):>2}  "
              f"official={stats.get('official_accepted', 0):>2}  "
              f"org={stats.get('org_accepted', 0):>3}  "
              f"curated={stats.get('curated_accepted', 0):>2}  "
              f"notable={stats.get('notable_accepted', 0):>2}  "
              f"rejected={stats.get('rejected', 0):>4}  "
              f"=> {accepted} new")
    print(f"  TOTAL new entries: {grand_total}")
    print(f"  Manifest before:   {manifest_before} entries")
    print(f"  Manifest after:    {manifest_before + grand_total} entries")
    return grand_total


def main() -> int:
    parser = argparse.ArgumentParser(description="GitHub scraper for Game Studio AI knowledge base.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show counts without writing manifest or cloning.")
    parser.add_argument("--engine", choices=ENGINES, help="Scrape only one engine.")
    parser.add_argument("--skip-clone", action="store_true",
                        help="Build manifest but do not git clone.")
    parser.add_argument("--expand-subdirs", action="store_true",
                        help="After cloning, walk SUBDIR_EXPANSIONS and append "
                             "synthetic manifest entries for each matching "
                             "sub-directory of curated mono-repos.")
    parser.add_argument("--from-curated", action="store_true",
                        help="Skip scraping. Clone the keep=true entries from "
                             "data/manifest.curated.json (built by "
                             "03_curate_manifest.py) and write clone status "
                             "back to that file.")
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    log = setup_logging()

    if args.from_curated:
        return run_from_curated(CURATED_PATH, REPOS_RAW_DIR, log,
                                args.expand_subdirs, args.dry_run)

    load_dotenv()
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("ERROR: GITHUB_TOKEN not set in .env", file=sys.stderr)
        return 1

    log.info("=== scrape run start (dry_run=%s engine=%s skip_clone=%s)",
             args.dry_run, args.engine, args.skip_clone)

    gh = GitHubClient(token, log)
    manifest = load_manifest(MANIFEST_PATH)
    seen_urls = {e["url"] for e in manifest if e.get("url")}
    log.info("Loaded existing manifest: %d entries", len(manifest))

    engines = [args.engine] if args.engine else ENGINES
    all_new: list[dict[str, Any]] = []
    all_stats: dict[str, dict[str, int]] = {}

    for engine in engines:
        new_entries, stats = scrape_engine(engine, gh, log, seen_urls)
        all_new.extend(new_entries)
        all_stats[engine] = stats
        log.info("[%s] %s", engine, stats)

    grand_total = print_summary(all_stats, len(manifest))

    if args.dry_run:
        print("\nDRY RUN — nothing written, nothing cloned.")
        return 0

    manifest.extend(all_new)
    save_manifest(MANIFEST_PATH, manifest)
    print(f"\nManifest saved: {MANIFEST_PATH}")

    if not args.skip_clone and grand_total > 0:
        print("\nCloning new repos...")
        clone_phase(all_new, REPOS_RAW_DIR, log)
        save_manifest(MANIFEST_PATH, manifest)
        print(f"Manifest updated with clone status: {MANIFEST_PATH}")
        statuses: dict[str, int] = {}
        for e in all_new:
            statuses[e["clone_status"]] = statuses.get(e["clone_status"], 0) + 1
        print(f"Clone status counts: {statuses}")
    elif args.skip_clone:
        print("\n--skip-clone: manifest written, no git clones performed.")

    if args.expand_subdirs:
        expand_subdir_phase(manifest, MANIFEST_PATH, REPOS_RAW_DIR, log, args.dry_run)

    return 0


if __name__ == "__main__":
    sys.exit(main())
