"""Inject Fase 2 Resource Hunt curated repos into manifest.json.

Reads the new (owner, repo) tuples already added to CURATED_REPOS in
_sources.py and fetches authoritative metadata via gh CLI (license,
stars, size, topics, default_branch). Each entry is marked
`source=curated, bypass_filters=False, source_license_verified=true`.

WHY a one-shot script vs re-running 01_scrape.py:
- 01_scrape.py re-runs ALL SEARCH_QUERIES (slow, GitHub rate-limited).
- We only need to inject ~30 entries with verified licenses.
- Idempotent: re-running on same manifest skips entries already present.

After this script, run:
    python scripts/ingestion/03_curate_manifest.py
    python scripts/ingestion/01_scrape.py --from-curated  # only clones
    # then 02_filter -> 03_parse_<engine> -> 03b_groom -> 04_classify
    # -> 05_embed_store -> 11_apply_caps

CLI:
    python scripts/ingestion/_inject_curated_fase2.py --dry-run
    python scripts/ingestion/_inject_curated_fase2.py
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MANIFEST_PATH = REPO_ROOT / "data" / "manifest.json"

# The 31 new repos added to CURATED_REPOS in _sources.py by Fase 2.
# Each tuple: (engine, owner, repo, expected_license_spdx).
# License is what we verified via `gh api repos/{r}/license` on 2026-05-24.
# Discrepancies between gh API and file LICENSE are noted (ahopness).
FASE2_CURATED: list[tuple[str, str, str, str]] = [
    # godot
    ("godot", "EladKarni", "godot4-2d-platformer-template", "MIT"),
    ("godot", "GreenCloversGames", "Scalable-Platformer-Template", "MIT"),
    ("godot", "bitbrain", "pandora", "MIT"),
    ("godot", "newold3", "Godot-RPG-Creator", "MIT"),
    ("godot", "tuananhcn", "Turn-Base-RPG", "MIT"),
    ("godot", "Ziden", "godot-turn-based-rpg", "MIT"),
    ("godot", "krazyjakee", "DungeonTemplateLibrary-Godot", "MIT"),
    ("godot", "statico", "godot-roguelike-example", "MIT"),
    ("godot", "RGonzalezTech", "Friendslop-Template", "MIT"),
    ("godot", "heroiclabs", "nakama-project-template", "Apache-2.0"),
    ("godot", "code-forge-temple", "local-llm-npc", "CC-BY-4.0"),
    ("godot", "nthnn", "noko", "MIT"),
    ("godot", "af009", "fuku", "MIT"),
    ("godot", "glennDittmann", "godot-pixel-art-template", "MIT"),
    ("godot", "MaxiimPetrov", "Divine-Retribution-8-bit-Project", "MIT"),
    # ahopness: gh API returns NOASSERTION but file LICENSE is CC0-1.0
    # (verified by reading the file content on 2026-05-24).
    ("godot", "ahopness", "GodotRetro", "CC0-1.0"),
    # phaser
    ("phaser", "remarkablegames", "phaser-platformer", "MIT"),
    # renpy
    ("renpy", "remarkablegames", "renpy-template", "MIT"),
    # defold
    ("defold", "Lerg", "match3swipe", "MIT"),
    # monogame
    ("monogame", "endrealm", "Monogame-Platformer-Example", "MIT"),
    ("monogame", "jlauener", "MonoPunk", "MIT"),
    ("monogame", "DreamyStranger", "MonoGame-Platformer", "MIT"),
    # love2d
    ("love2d", "Cod-e-Codes", "CardGame", "MIT"),
    ("love2d", "heisenberg23911", "CardGame", "MIT"),
    ("love2d", "srijan-paul", "bullet_hell", "MIT"),
    # threejs
    ("threejs", "pmndrs", "postprocessing", "Zlib"),
    ("threejs", "N8python", "n8ao", "CC0-1.0"),
    ("threejs", "FarazzShaikh", "THREE-CustomShaderMaterial", "MIT"),
    # Ameobea: gh API returns NOASSERTION but the LICENSE file is zlib
    # (file head: "zlib License"). Verified out-of-band on 2026-05-24.
    ("threejs", "Ameobea", "three-good-godrays", "Zlib"),
    ("threejs", "gkjohnson", "three-gpu-pathtracer", "MIT"),
    ("threejs", "squarefeet", "ShaderParticleEngine", "MIT"),
]


def gh_repo_metadata(owner: str, repo: str) -> dict[str, object] | None:
    """Fetch repo metadata via gh CLI. Returns None on failure."""
    try:
        result = subprocess.run(
            ["gh", "api", f"repos/{owner}/{repo}",
             "--jq", "{stars: .stargazers_count, size: .size, "
                     "topics: .topics, pushed_at: .pushed_at, "
                     "language: .language, default_branch: .default_branch, "
                     "license_spdx: .license.spdx_id, html_url: .html_url}"],
            capture_output=True, text=True, timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        print(f"  gh-error {owner}/{repo}: {exc}", file=sys.stderr)
        return None
    if result.returncode != 0:
        print(f"  gh-fail {owner}/{repo}: {result.stderr[:120]}",
              file=sys.stderr)
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        print(f"  json-fail {owner}/{repo}: {exc}", file=sys.stderr)
        return None


SIZE_CAP_KB = 100_000  # Pietra cap; entries above this need bypass_filters
                       # because their value (verified license + topic match)
                       # is higher than the binary-asset bloat penalty.


def build_entry(engine: str, owner: str, repo: str,
                verified_license: str, meta: dict[str, object]) -> dict[str, object]:
    """Compose manifest entry. Trust verified_license over gh API
    license field (the latter is NOASSERTION for some valid cases).

    Oversized repos (size_kb > SIZE_CAP_KB) get bypass_filters=True:
    they were hand-verified valuable (e.g. pmndrs/postprocessing 261MB
    is THE EffectComposer pipeline). Without bypass, the size guard in
    passes_basic_filters drops them. Their license is already verified
    out-of-band so the license bypass is safe.
    """
    size_kb = meta.get("size") or 0
    is_oversized = isinstance(size_kb, int) and size_kb > SIZE_CAP_KB
    return {
        "url": meta.get("html_url") or f"https://github.com/{owner}/{repo}",
        "engine": engine,
        "stars": meta.get("stars") or 0,
        "license": verified_license,
        "license_source": "fase2_gh_verified_2026_05_24",
        "size_kb": size_kb,
        "topics": meta.get("topics") or [],
        "pushed_at": meta.get("pushed_at"),
        "language": meta.get("language"),
        "default_branch": meta.get("default_branch") or "main",
        "clone_status": "pending",
        "scraped_at": datetime.now(timezone.utc).isoformat(),
        "source": "curated",
        "notable": False,
        # bypass for oversized hand-verified repos. Normal-size entries
        # still go through the regular filter for sanity.
        "bypass_filters": is_oversized,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true",
                    help="Show what would be added without writing.")
    args = ap.parse_args()

    if not MANIFEST_PATH.exists():
        print(f"ERROR: manifest not found at {MANIFEST_PATH}", file=sys.stderr)
        return 1

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    # manifest can be a list or {entries: [...]}; normalize
    if isinstance(manifest, dict):
        entries_list = manifest.get("entries", [])
    else:
        entries_list = manifest

    existing_urls = {(e.get("url") or "").lower().rstrip("/")
                     for e in entries_list}

    to_add: list[dict[str, object]] = []
    skipped_present = 0
    for engine, owner, repo, lic in FASE2_CURATED:
        url = f"https://github.com/{owner}/{repo}".lower()
        if url in existing_urls:
            print(f"  SKIP (already in manifest): {owner}/{repo}")
            skipped_present += 1
            continue
        meta = gh_repo_metadata(owner, repo)
        if meta is None:
            print(f"  SKIP (gh metadata failed): {owner}/{repo}")
            continue
        entry = build_entry(engine, owner, repo, lic, meta)
        to_add.append(entry)
        print(f"  + {engine:9} {owner}/{repo} [{lic}] "
              f"stars={entry['stars']} size_kb={entry['size_kb']}")
        time.sleep(0.2)  # be polite to GitHub API

    print(f"\nSummary: +{len(to_add)} new, {skipped_present} already present, "
          f"{len(FASE2_CURATED) - len(to_add) - skipped_present} failed")

    if args.dry_run:
        print("DRY-RUN: not writing manifest.")
        return 0

    entries_list.extend(to_add)
    if isinstance(manifest, dict):
        manifest["entries"] = entries_list
    else:
        manifest = entries_list

    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False),
                             encoding="utf-8")
    print(f"WROTE: {MANIFEST_PATH} (+{len(to_add)} entries)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
