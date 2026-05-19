"""Clone and sub-directory expansion phases for the harvester.

Split out of 01_scrape.py to keep that file under the 400-line CLAUDE.md
cap. Covers:
- clone_phase: shallow-clone a list of manifest entries
- expand_subdir_phase: append synthetic subdir entries for mono-repos
- run_from_curated: the --from-curated path (clone only keep=true entries
  from data/manifest.curated.json)
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Any

from tqdm import tqdm

from scripts.ingestion._scrape_helpers import (
    clone_repo,
    expand_subdirs,
    load_manifest,
    safe_repo_name,
    save_manifest,
)
from scripts.ingestion._sources import SUBDIR_EXPANSIONS


def clone_phase(
    entries: list[dict[str, Any]],
    repos_raw_dir: Path,
    log: logging.Logger,
) -> None:
    for entry in tqdm(entries, desc="  clone"):
        if entry.get("clone_status") not in (None, "pending"):
            continue
        engine = entry["engine"]
        url = entry["url"]
        target = repos_raw_dir / engine / safe_repo_name(url)
        entry["clone_status"] = clone_repo(url, target, log)


def expand_subdir_phase(
    manifest: list[dict[str, Any]],
    manifest_path: Path,
    repos_raw_dir: Path,
    log: logging.Logger,
    dry_run: bool,
) -> None:
    """Walk SUBDIR_EXPANSIONS for every parent repo already cloned and append
    one synthetic entry per matching sub-directory. Idempotent: entries that
    already carry subdir_path are skipped as parents."""
    synth_entries: list[dict[str, Any]] = []
    match_counts: dict[str, int] = {}
    for entry in list(manifest):
        parent_url = entry.get("url")
        if not parent_url or entry.get("subdir_path"):
            continue
        pattern = SUBDIR_EXPANSIONS.get(parent_url)
        if not pattern:
            continue
        repo_dir = repos_raw_dir / entry["engine"] / safe_repo_name(parent_url)
        synth = expand_subdirs(entry, repo_dir, pattern, log)
        match_counts[parent_url] = len(synth)
        synth_entries.extend(synth)
    print("\n=== Subdir expansion ===")
    for url, n in match_counts.items():
        print(f"  {n:>4} matches  {url}  (pattern={SUBDIR_EXPANSIONS[url]})")
    print(f"  TOTAL synthetic entries: {len(synth_entries)}")
    if not dry_run:
        manifest.extend(synth_entries)
        save_manifest(manifest_path, manifest)
        print(f"Manifest extended: {manifest_path}")


def run_from_curated(
    curated_path: Path,
    repos_raw_dir: Path,
    log: logging.Logger,
    expand: bool,
    dry_run: bool,
) -> int:
    """Clone the keep=true entries from data/manifest.curated.json."""
    if not curated_path.exists():
        print(f"ERROR: {curated_path} not found. Run 03_curate_manifest.py first.",
              file=sys.stderr)
        return 1
    curated = load_manifest(curated_path)
    to_clone = [e for e in curated if e.get("keep", True)]
    pending = [e for e in to_clone if e.get("clone_status") in (None, "pending")]
    print(f"Curated manifest: {len(curated)} entries, "
          f"{len(to_clone)} keep=true, {len(pending)} pending clone.")
    log.info("=== from-curated run: %d to clone, %d pending",
             len(to_clone), len(pending))

    if dry_run:
        print("\nDRY RUN — would clone the pending entries above, nothing done.")
        if expand:
            # Subdir expansion only reads already-cloned parents, so it is
            # meaningful (and side-effect-free) to preview match counts here.
            expand_subdir_phase(curated, curated_path, repos_raw_dir, log,
                                dry_run=True)
        return 0

    clone_phase(pending, repos_raw_dir, log)
    save_manifest(curated_path, curated)
    statuses: dict[str, int] = {}
    for e in to_clone:
        statuses[e.get("clone_status")] = statuses.get(e.get("clone_status"), 0) + 1
    print(f"\nClone status counts: {statuses}")
    print(f"Curated manifest updated: {curated_path}")

    if expand:
        expand_subdir_phase(curated, curated_path, repos_raw_dir, log, dry_run)
    return 0
