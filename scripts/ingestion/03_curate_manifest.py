"""Manifest curator — Fase 1 step 3.

Reads `data/manifest.json` and writes:
- `data/manifest.json` — same file with `keep: true|false` set on every entry
- `data/manifest.curated.json` — only the kept entries (the clone target)

Decisions per entry, in priority order:

1. **Always keep** if `notable=True` or `bypass_filters=True` or
   `source in {curated, notable, official, awesome}`. Hand-vetted entries
   are protected.

2. **Adaptive stars cutoff** by engine:
   - large ecosystems (godot, phaser, threejs, love2d): >=30 stars
   - medium (defold, monogame): >=20 stars
   - niche (renpy, stride): >=10 stars (precious in scarce ecosystems)
   Below threshold and not in step 1 -> drop.

3. **Dedup mono-repo size bloat**: if size_kb > 50 MB AND not curated/notable,
   drop. The repo is likely full of binary assets; the sub-directory expansion
   path captures the value of the few mono-repos we want to keep.

4. **Drop low-signal repos**: empty description AND no topics AND
   stars < cutoff*2 -> drop. They are usually abandoned tests.

Read inputs and writes outputs in `data/`. `--dry-run` reports the decision
counts without writing files.

CLI:
    python scripts/ingestion/03_curate_manifest.py --dry-run
    python scripts/ingestion/03_curate_manifest.py
    python scripts/ingestion/03_curate_manifest.py --engine godot --dry-run
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.shared.taxonomy import ENGINES


MANIFEST_PATH = REPO_ROOT / "data" / "manifest.json"
CURATED_PATH = REPO_ROOT / "data" / "manifest.curated.json"

STARS_CUTOFFS: dict[str, int] = {
    "godot":    30,
    "phaser":   30,
    "threejs":  30,
    "love2d":   30,
    "defold":   20,
    "monogame": 20,
    "renpy":    10,
    "stride":   10,
}

ALWAYS_KEEP_SOURCES = {"curated", "notable", "official"}
MAX_REPO_SIZE_KB = 50_000  # 50 MB — drops asset-heavy mono-repos

# Copyleft licenses CLAUDE.md forbids. CC-BY-4.0 is attribution-only and kept.
FORBIDDEN_LICENSES = {
    "GPL-2.0", "GPL-3.0", "AGPL-3.0", "LGPL-2.1", "LGPL-3.0",
    "GPL-2.0-only", "GPL-3.0-only", "AGPL-3.0-only",
}

# Repos that are catalogs/awesome-lists, not code. Dropped unless notable.
NON_CODE_NAME_MARKERS = ("awesome-", "-awesome", "awesome_", "cheat-sheet",
                         "cheatsheet", "-list", "uno-list")

LIBRARY_MARKERS = ("library", "framework", "engine", "plugin", "addon",
                   "toolkit", "sdk", "wrapper", "binding", "extension",
                   "middleware", "ecs ", " ecs", "renderer")
TOOL_MARKERS = ("editor", "tool", "cli", "generator", "exporter",
                "importer", "pipeline", "devtool", "inspector", "debugger")
TEMPLATE_MARKERS = ("template", "starter", "boilerplate", "scaffold")


def classify_role(entry: dict[str, Any]) -> str:
    """Best-effort role tag (game / library / tool / template / engine).

    Proxy from name + description + topics. The Phase-3 parsers and
    Phase-4 classifier do the authoritative labeling; this only helps
    downstream pick chunk_type (a library -> structural_pattern).
    """
    name = (entry.get("url") or "").rsplit("/", 1)[-1].lower()
    text = " ".join(
        [name, (entry.get("description") or "").lower()]
        + [t.lower() for t in (entry.get("topics") or [])]
    )
    if any(m in text for m in TEMPLATE_MARKERS):
        return "template"
    if any(m in text for m in TOOL_MARKERS):
        return "tool"
    if any(m in text for m in LIBRARY_MARKERS):
        return "library"
    return "game"


def reason_for_drop(entry: dict[str, Any]) -> str | None:
    """Return None if entry should be kept, else a reason string."""
    # Forbidden copyleft is dropped even for notable/bypass (legal hard rule).
    lic = entry.get("license")
    if lic in FORBIDDEN_LICENSES:
        return f"forbidden_license({lic})"

    name = (entry.get("url") or "").rsplit("/", 1)[-1].lower()
    if any(m in name for m in NON_CODE_NAME_MARKERS) and not entry.get("notable"):
        return "non_code_catalog"

    if entry.get("notable") or entry.get("bypass_filters"):
        return None
    source = entry.get("source") or "api"
    if source in ALWAYS_KEEP_SOURCES:
        return None

    engine = entry.get("engine") or ""
    cutoff = STARS_CUTOFFS.get(engine, 20)
    stars = entry.get("stars", 0)

    if stars < cutoff:
        return f"stars<{cutoff}"

    if (entry.get("size_kb") or 0) > MAX_REPO_SIZE_KB:
        return f"size>{MAX_REPO_SIZE_KB}KB"

    desc = (entry.get("description") or "").strip()
    topics = entry.get("topics") or []
    if not desc and not topics and stars < cutoff * 2:
        return "low_signal_no_desc_no_topics"

    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Curate the scraped manifest before cloning.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Report decisions without writing files.")
    parser.add_argument("--engine", choices=list(ENGINES),
                        help="Limit report to one engine.")
    args = parser.parse_args()

    if not MANIFEST_PATH.exists():
        print(f"manifest not found at {MANIFEST_PATH}", file=sys.stderr)
        return 1

    with MANIFEST_PATH.open(encoding="utf-8") as f:
        manifest = json.load(f)
    if not isinstance(manifest, list):
        print("manifest is not a list", file=sys.stderr)
        return 1

    kept: list[dict[str, Any]] = []
    drop_reasons: dict[str, Counter[str]] = defaultdict(Counter)
    kept_by_engine: Counter[str] = Counter()
    role_counts: Counter[str] = Counter()
    seen_norm_urls: set[str] = set()

    for entry in manifest:
        engine = entry.get("engine") or "?"
        entry["role"] = classify_role(entry)

        norm = (entry.get("url") or "").rstrip("/").lower()
        if entry.get("subdir_path"):
            norm = f"{norm}#{entry['subdir_path']}"
        if norm and norm in seen_norm_urls:
            entry["keep"] = False
            entry["drop_reason"] = "duplicate_url"
            drop_reasons[engine]["duplicate_url"] += 1
            continue

        reason = reason_for_drop(entry)
        if reason is None:
            entry["keep"] = True
            if norm:
                seen_norm_urls.add(norm)
            kept.append(entry)
            kept_by_engine[engine] += 1
            role_counts[entry["role"]] += 1
        else:
            entry["keep"] = False
            entry["drop_reason"] = reason
            drop_reasons[engine][reason] += 1

    print(f"Input manifest: {len(manifest)} entries")
    print(f"Kept:           {len(kept)} entries  ({100 * len(kept) / max(len(manifest), 1):.1f}%)")
    print(f"Dropped:        {len(manifest) - len(kept)} entries")
    print()
    print("Per-engine results:")
    header = f"  {'engine':<10} {'before':>7} {'kept':>5} {'pct':>5}  cutoff"
    print(header)
    print("  " + "-" * (len(header) - 2))
    by_engine_total: Counter[str] = Counter(e["engine"] for e in manifest)
    engines = [args.engine] if args.engine else ENGINES
    for engine in engines:
        before = by_engine_total[engine]
        after = kept_by_engine[engine]
        pct = (100 * after / before) if before else 0
        cutoff = STARS_CUTOFFS.get(engine, 20)
        print(f"  {engine:<10} {before:>7} {after:>5} {pct:>4.0f}%  stars>={cutoff}")

    print("\nKept by role (proxy classification):")
    for role, n in role_counts.most_common():
        print(f"  {role:<10} {n:>5}")

    print("\nDrop reasons (count per engine):")
    for engine in engines:
        reasons = drop_reasons[engine]
        if not reasons:
            continue
        print(f"  {engine}:")
        for reason, count in reasons.most_common():
            print(f"    {count:>5}  {reason}")

    print()
    if args.dry_run:
        print("DRY RUN — no files written.")
        return 0

    with MANIFEST_PATH.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, sort_keys=True, ensure_ascii=False)
    with CURATED_PATH.open("w", encoding="utf-8") as f:
        json.dump(kept, f, indent=2, sort_keys=True, ensure_ascii=False)
    print(f"Manifest annotated:  {MANIFEST_PATH}")
    print(f"Curated manifest:    {CURATED_PATH}  ({len(kept)} entries)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
