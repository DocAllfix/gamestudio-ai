"""Targeted clone for ONLY the Fase 2 Resource Hunt entries.

WHY a targeted script vs `01_scrape.py --from-curated`:
- The manifest has 683 pre-Fase-2 entries marked clone_status="pending"
  whose repos_raw was deleted to free disk. --from-curated would try
  to re-clone all of them (~30GB), which is what we don't want.
- We only need the 31 verified Fase 2 repos cloned. This script
  scopes to them via URL match on the FASE2_URLS list.

Idempotent:
- If target dir exists on disk → skip ("already_cloned")
- Persists clone_status back into manifest.curated.json
- Re-runnable: only attempts entries still pending

Disk safety:
- Aborts if free disk < 8GB before next clone
- Logs cumulative size after each clone
"""
from __future__ import annotations

import argparse
import json
import logging
import shutil
import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.ingestion._scrape_helpers import clone_repo, safe_repo_name

CURATED_PATH = REPO_ROOT / "data" / "manifest.curated.json"
REPOS_RAW = REPO_ROOT / "data" / "repos_raw"
MIN_FREE_GB = 8

# The 31 Fase 2 URLs injected via _inject_curated_fase2.py.
FASE2_URLS: set[str] = {
    "https://github.com/EladKarni/godot4-2d-platformer-template",
    "https://github.com/GreenCloversGames/Scalable-Platformer-Template",
    "https://github.com/bitbrain/pandora",
    "https://github.com/newold3/Godot-RPG-Creator",
    "https://github.com/tuananhcn/Turn-Base-RPG",
    "https://github.com/Ziden/godot-turn-based-rpg",
    "https://github.com/krazyjakee/DungeonTemplateLibrary-Godot",
    "https://github.com/statico/godot-roguelike-example",
    "https://github.com/RGonzalezTech/Friendslop-Template",
    "https://github.com/heroiclabs/nakama-project-template",
    "https://github.com/code-forge-temple/local-llm-npc",
    "https://github.com/nthnn/noko",
    "https://github.com/af009/fuku",
    "https://github.com/glennDittmann/godot-pixel-art-template",
    "https://github.com/MaxiimPetrov/Divine-Retribution-8-bit-Project",
    "https://github.com/ahopness/GodotRetro",
    "https://github.com/remarkablegames/phaser-platformer",
    "https://github.com/remarkablegames/renpy-template",
    "https://github.com/Lerg/match3swipe",
    "https://github.com/endrealm/Monogame-Platformer-Example",
    "https://github.com/jlauener/MonoPunk",
    "https://github.com/DreamyStranger/MonoGame-Platformer",
    "https://github.com/Cod-e-Codes/CardGame",
    "https://github.com/heisenberg23911/CardGame",
    "https://github.com/srijan-paul/bullet_hell",
    "https://github.com/pmndrs/postprocessing",
    "https://github.com/N8python/n8ao",
    "https://github.com/FarazzShaikh/THREE-CustomShaderMaterial",
    "https://github.com/Ameobea/three-good-godrays",
    "https://github.com/gkjohnson/three-gpu-pathtracer",
    "https://github.com/squarefeet/ShaderParticleEngine",
}


def free_gb() -> float:
    return shutil.disk_usage(REPO_ROOT.drive + "\\").free / (1024 ** 3)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0,
                    help="Cap clones this run (0 = all pending).")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    log = logging.getLogger(__name__)

    curated = json.loads(CURATED_PATH.read_text(encoding="utf-8"))
    entries = curated if isinstance(curated, list) else curated.get("entries", [])

    targets = [e for e in entries if e.get("url") in FASE2_URLS]
    pending = [e for e in targets if e.get("clone_status") in (None, "pending")]
    on_disk = []
    for e in pending:
        eng = e.get("engine") or "unknown"
        slug = safe_repo_name(e.get("url") or "")
        if (REPOS_RAW / eng / slug).exists():
            on_disk.append(e)

    print(f"Fase 2 entries in curated: {len(targets)}")
    print(f"Pending (manifest):        {len(pending)}")
    print(f"Already on disk:           {len(on_disk)}")
    to_clone = [e for e in pending if e not in on_disk]
    print(f"To clone now:              {len(to_clone)}\n")
    print(f"Free disk: {free_gb():.1f} GB (min required: {MIN_FREE_GB} GB)\n")

    if args.dry_run:
        for e in to_clone[: args.limit or 1000]:
            print(f"  WOULD CLONE: {e.get('url')} (size_kb={e.get('size_kb')})")
        return 0

    cloned_now = 0
    failed = 0
    for e in to_clone:
        if args.limit and cloned_now >= args.limit:
            print(f"Hit --limit={args.limit}, stopping.")
            break
        if free_gb() < MIN_FREE_GB:
            print(f"ABORT: free disk {free_gb():.1f} GB < {MIN_FREE_GB} GB")
            break

        url = e.get("url") or ""
        eng = e.get("engine") or "unknown"
        slug = safe_repo_name(url)
        target = REPOS_RAW / eng / slug

        # Mark on-disk entries as "cloned" without touching network.
        if target.exists():
            e["clone_status"] = "cloned"
            print(f"  [skip-exists] {url}")
            continue

        print(f"  [clone {cloned_now+1}/{len(to_clone)}] {url}")
        status = clone_repo(url, target, log)
        e["clone_status"] = status
        if status in ("cloned", "already_cloned"):
            cloned_now += 1
        else:
            failed += 1
            print(f"    FAIL status={status}")

        # Persist after each clone so partial runs are durable.
        CURATED_PATH.write_text(
            json.dumps(curated, indent=2, ensure_ascii=False),
            encoding="utf-8")
        time.sleep(0.5)  # be polite

    # Sync on-disk discoveries (entries already on disk before this run)
    for e in on_disk:
        e["clone_status"] = "cloned"
    CURATED_PATH.write_text(
        json.dumps(curated, indent=2, ensure_ascii=False),
        encoding="utf-8")

    print(f"\nDone. cloned_now={cloned_now} failed={failed} "
          f"on_disk_pre={len(on_disk)} free_disk={free_gb():.1f}GB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
