"""Manifest analyzer — Fase 1 step 2.

Reads `data/manifest.json` (built by `01_scrape.py`) and reports:

1. Counts per engine, per source (api/topic/org/curated/notable/awesome/official).
2. Genre distribution per engine, inferred from each entry's `topics` and
   `description` against `GENRE_KEYWORDS`. Shows red/yellow/green coverage
   bars against the genres we care about.
3. Top-N stars per engine (the "famous repos" check).
4. License distribution (whitelist vs notable bypass vs unknown).
5. Stars histogram per engine, used to choose the per-engine cutoff in
   `03_curate_manifest.py`.

Read-only — never modifies the manifest. `--dry-run` is implicit.

CLI:
    python scripts/ingestion/02_analyze_manifest.py
    python scripts/ingestion/02_analyze_manifest.py --top 10
    python scripts/ingestion/02_analyze_manifest.py --engine godot
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.shared.taxonomy import ALLOWED_LICENSES, ENGINES, GENRE_TAGS


MANIFEST_PATH = REPO_ROOT / "data" / "manifest.json"

# Genre keywords for description+topics inference. Lowercased.
# Each genre maps to substrings that, if found anywhere in `topics+description`,
# count as "this repo plausibly covers this genre". Imperfect but cheap proxy
# until 03_parse_*.py and 04_classify.py do the real labeling.
GENRE_KEYWORDS: dict[str, list[str]] = {
    "platformer":    ["platformer", "platform game", "jump-and-run", "platforming"],
    "metroidvania":  ["metroidvania", "metroid", "castlevania"],
    "roguelike":     ["roguelike", "rogue-like", "rogue lite", "roguelite"],
    "rpg":           ["rpg", "role playing", "role-playing", "action-rpg", "arpg"],
    "jrpg":          ["jrpg", "japanese rpg"],
    "visual_novel":  ["visual novel", "visual-novel", "vn ", "dating sim",
                      "kinetic novel", "otome"],
    "puzzle":        ["puzzle", "match-3", "match3", "sokoban"],
    "card_game":     ["card game", "card-game", "deckbuilder", "tcg", "ccg"],
    "horror":        ["horror", "scary", "survival horror"],
    "arcade":        ["arcade", "retro game", "8bit", "16bit"],
    "sim":           ["simulation", "sandbox sim", "city builder", "tycoon", "farming"],
    "tower_defense": ["tower defense", "tower-defense", "td game"],
    "racing":        ["racing", "racer game", "kart"],
    "rhythm":        ["rhythm game", "rhythm-game"],
    "stealth":       ["stealth game", "stealth-game"],
    "bullet_hell":   ["bullet hell", "bullet-hell", "shmup", "shoot-em-up", "shooter"],
    "fighting":      ["fighting game", "fighting-game", "beat-em-up", "brawler"],
    "survival":      ["survival game", "survival-game", "crafting", "open-world survival"],
    "sandbox":       ["sandbox", "open world", "open-world", "minecraft"],
}

# Per-engine genre coverage targets (loose proxy). For each genre we want
# at least N repos in that engine to consider it covered.
COVERAGE_THRESHOLDS = {"red": 0, "yellow": 1, "green": 3}


def load_manifest() -> list[dict[str, Any]]:
    if not MANIFEST_PATH.exists():
        print(f"manifest not found at {MANIFEST_PATH}", file=sys.stderr)
        sys.exit(1)
    with MANIFEST_PATH.open(encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        print("manifest is not a list", file=sys.stderr)
        sys.exit(1)
    return data


def repo_text(entry: dict[str, Any]) -> str:
    parts = [entry.get("description") or ""] + (entry.get("topics") or [])
    return " ".join(parts).lower()


def infer_genres(entry: dict[str, Any]) -> set[str]:
    text = repo_text(entry)
    found: set[str] = set()
    for genre, keywords in GENRE_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            found.add(genre)
    return found


def print_section(title: str) -> None:
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")


def report_counts(entries: list[dict[str, Any]]) -> None:
    print_section("1. COUNTS — per engine x source")
    by_engine = Counter(e["engine"] for e in entries)
    by_source: dict[str, Counter[str]] = defaultdict(Counter)
    for e in entries:
        by_source[e["engine"]][e.get("source") or "api"] += 1

    src_order = ("api", "topic", "org", "curated", "notable", "awesome", "official")
    header = f"{'engine':<10} " + " ".join(f"{s:>8}" for s in src_order) + f"  {'TOTAL':>6}"
    print(header)
    print("-" * len(header))
    for engine in ENGINES:
        row = f"{engine:<10} " + " ".join(
            f"{by_source[engine].get(s, 0):>8}" for s in src_order
        ) + f"  {by_engine[engine]:>6}"
        print(row)
    print("-" * len(header))
    total = sum(by_engine.values())
    print(f"{'TOTAL':<10} " + " ".join(
        f"{sum(by_source[e].get(s, 0) for e in ENGINES):>8}" for s in src_order
    ) + f"  {total:>6}")


def report_genre_coverage(entries: list[dict[str, Any]],
                          target_engine: str | None) -> None:
    print_section("2. GENRE COVERAGE — inferred from topics + description")
    by_engine_genre: dict[str, Counter[str]] = defaultdict(Counter)
    no_genre_count: Counter[str] = Counter()
    for e in entries:
        genres = infer_genres(e)
        if not genres:
            no_genre_count[e["engine"]] += 1
            continue
        for g in genres:
            by_engine_genre[e["engine"]][g] += 1

    engines = [target_engine] if target_engine else ENGINES
    for engine in engines:
        counts = by_engine_genre[engine]
        no_genre = no_genre_count[engine]
        total = sum(counts.values()) + no_genre
        print(f"\n{engine.upper()}  (total={total}, no_genre_inferred={no_genre})")
        if not counts:
            print("  (no genre keywords matched any repo)")
            continue
        for genre in sorted(GENRE_KEYWORDS):
            n = counts.get(genre, 0)
            if n >= COVERAGE_THRESHOLDS["green"]:
                bar = f"GREEN {'#' * min(n, 20)}"
            elif n >= COVERAGE_THRESHOLDS["yellow"]:
                bar = f"YELLOW {'#' * n}"
            else:
                bar = "RED ."
            print(f"  {genre:<14} {n:>3}  {bar}")


def report_top_stars(entries: list[dict[str, Any]], top: int,
                     target_engine: str | None) -> None:
    print_section(f"3. TOP {top} BY STARS — per engine")
    by_engine: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for e in entries:
        by_engine[e["engine"]].append(e)
    engines = [target_engine] if target_engine else ENGINES
    for engine in engines:
        sorted_repos = sorted(by_engine[engine],
                              key=lambda r: r.get("stars", 0),
                              reverse=True)
        print(f"\n{engine.upper()}:")
        for repo in sorted_repos[:top]:
            stars = repo.get("stars", 0)
            url = repo.get("url", "?")
            slug = url.replace("https://github.com/", "")
            source = repo.get("source") or "api"
            tag = " [NOTABLE]" if repo.get("notable") else ""
            print(f"  {stars:>5}* {slug:<60} ({source}){tag}")


def report_licenses(entries: list[dict[str, Any]]) -> None:
    print_section("4. LICENSE DISTRIBUTION")
    by_lic: Counter[str] = Counter()
    bypass_none = 0
    for e in entries:
        lic = e.get("license")
        by_lic[lic or "(none)"] += 1
        if lic is None and e.get("bypass_filters"):
            bypass_none += 1
    print(f"{'license':<20} {'count':>6}  {'status':<10}")
    print("-" * 40)
    for lic, count in by_lic.most_common():
        if lic == "(none)":
            status = f"bypass={bypass_none}/{count}"
        elif lic in ALLOWED_LICENSES:
            status = "whitelist"
        else:
            status = "OTHER"
        print(f"{lic:<20} {count:>6}  {status}")


def report_stars_histogram(entries: list[dict[str, Any]]) -> None:
    print_section("5. STARS HISTOGRAM — per engine (to size adaptive cutoffs)")
    buckets = [
        ("<20 (bypass)", lambda s: s < 20),
        ("20-49",        lambda s: 20 <= s < 50),
        ("50-99",        lambda s: 50 <= s < 100),
        ("100-249",      lambda s: 100 <= s < 250),
        ("250-499",      lambda s: 250 <= s < 500),
        ("500-999",      lambda s: 500 <= s < 1000),
        ("1000+",        lambda s: s >= 1000),
    ]
    by_engine_bucket: dict[str, Counter[str]] = defaultdict(Counter)
    for e in entries:
        s = e.get("stars", 0)
        for label, pred in buckets:
            if pred(s):
                by_engine_bucket[e["engine"]][label] += 1
                break

    header = f"{'engine':<10} " + " ".join(
        f"{label.split()[0]:>9}" for label, _ in buckets
    )
    print(header)
    print("-" * len(header))
    for engine in ENGINES:
        cells = " ".join(
            f"{by_engine_bucket[engine].get(label, 0):>9}"
            for label, _ in buckets
        )
        print(f"{engine:<10} {cells}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze the scraped manifest.")
    parser.add_argument("--top", type=int, default=10, help="Top-N stars per engine.")
    parser.add_argument("--engine", choices=list(ENGINES), help="Limit to one engine.")
    args = parser.parse_args()

    entries = load_manifest()
    print(f"Loaded {len(entries)} manifest entries from {MANIFEST_PATH}")
    if args.engine:
        entries = [e for e in entries if e.get("engine") == args.engine]
        print(f"Filtered to engine={args.engine}: {len(entries)} entries")

    report_counts(entries)
    report_genre_coverage(entries, args.engine)
    report_top_stars(entries, args.top, args.engine)
    report_licenses(entries)
    report_stars_histogram(entries)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())

# Re-export so 03_curate_manifest.py and other consumers can import it.
__all__ = ["GENRE_KEYWORDS", "infer_genres", "load_manifest"]
