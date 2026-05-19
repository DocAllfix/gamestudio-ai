"""Sample inspector — Fase 1 step 4 (pre-clone content validation).

Picks a stratified sample from data/manifest.curated.json (N per engine,
balanced across role and stars bands), shallow-clones ONLY that sample
into data/repos_sample/, then inspects each clone's real content and
emits a verdict so we can judge dataset quality before committing to the
full ~683-repo clone.

For each sampled repo it reports:
- top-level directory tree + file count per extension
- presence of the engine's anchor file(s) (project.godot config_version=5,
  main.lua with love., *.rpy with `label`, game.project, *.csproj, THREE.)
- total LOC and primary-language LOC
- comment ratio (cheap proxy)
- verdict: usable | thin | asset_only | wrong_engine | engine_unconfirmed

Read-only on the manifest. Writes clones to data/repos_sample/ (gitignored).

CLI:
    python scripts/ingestion/04_sample_inspect.py
    python scripts/ingestion/04_sample_inspect.py --per-engine 4
    python scripts/ingestion/04_sample_inspect.py --engine godot --keep
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.shared.taxonomy import ENGINES
from scripts.ingestion._scrape_helpers import safe_repo_name

CURATED_PATH = REPO_ROOT / "data" / "manifest.curated.json"
SAMPLE_DIR = REPO_ROOT / "data" / "repos_sample"

# Engine anchor checks: (glob, optional content substring required in any match)
ENGINE_ANCHORS: dict[str, list[tuple[str, str | None]]] = {
    "godot":    [("**/project.godot", "config_version=5")],
    "phaser":   [("**/package.json", "phaser"), ("**/*.js", "Phaser."),
                 ("**/*.ts", "Phaser.")],
    "renpy":    [("**/*.rpy", "label ")],
    "defold":   [("**/game.project", None)],
    "monogame": [("**/*.csproj", "MonoGame"), ("**/*.cs", "Microsoft.Xna")],
    "love2d":   [("**/main.lua", "love.")],
    "threejs":  [("**/*.js", "THREE."), ("**/*.ts", "three"),
                 ("**/package.json", "three")],
    "stride":   [("**/*.csproj", None), ("**/*.sdpkg", None)],
}

CODE_EXTS = {
    ".gd", ".cs", ".lua", ".js", ".ts", ".jsx", ".tsx", ".rpy",
    ".py", ".gdshader", ".glsl", ".shader", ".hlsl", ".wgsl",
    # Defold script files are Lua under engine-specific extensions
    ".script", ".gui_script", ".render_script",
    # Godot scenes/resources carry node + signal structure parsers will read
    ".tscn", ".tres",
    # Stride C# shader/asset code
    ".sdsl", ".sdfx",
}
LINE_COMMENT_PREFIXES = ("#", "//", "--", ";")
SAMPLE_CLONE_TIMEOUT = 120


def load_curated() -> list[dict[str, Any]]:
    if not CURATED_PATH.exists():
        print(f"ERROR: {CURATED_PATH} missing. Run 03_curate_manifest.py first.",
              file=sys.stderr)
        sys.exit(1)
    with CURATED_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def stars_band(stars: int) -> str:
    if stars >= 1000:
        return "high"
    if stars >= 200:
        return "mid"
    return "low"


def stratified_sample(entries: list[dict[str, Any]],
                      per_engine: int) -> list[dict[str, Any]]:
    """Pick `per_engine` repos per engine, spreading across role and stars
    band, always including at least one notable if present."""
    by_engine: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for e in entries:
        if e.get("keep", True) and not e.get("subdir_path"):
            by_engine[e["engine"]].append(e)

    sample: list[dict[str, Any]] = []
    for engine in ENGINES:
        pool = by_engine.get(engine, [])
        if not pool:
            continue
        picked: list[dict[str, Any]] = []
        seen_urls: set[str] = set()

        notables = [e for e in pool if e.get("notable")]
        if notables:
            top_notable = max(notables, key=lambda r: r.get("stars", 0))
            picked.append(top_notable)
            seen_urls.add(top_notable["url"])

        # Spread remaining picks across (role, band) buckets, preferring
        # buckets not yet represented.
        buckets: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
        for e in pool:
            key = (e.get("role", "game"), stars_band(e.get("stars", 0)))
            buckets[key].append(e)
        for key in buckets:
            buckets[key].sort(key=lambda r: r.get("stars", 0), reverse=True)

        ordered_keys = sorted(buckets, key=lambda k: -len(buckets[k]))
        ki = 0
        while len(picked) < per_engine and ordered_keys:
            key = ordered_keys[ki % len(ordered_keys)]
            bucket = buckets[key]
            advanced = False
            while bucket:
                cand = bucket.pop(0)
                if cand["url"] not in seen_urls:
                    picked.append(cand)
                    seen_urls.add(cand["url"])
                    advanced = True
                    break
            ki += 1
            if not advanced and all(not b for b in buckets.values()):
                break
        sample.extend(picked[:per_engine])
    return sample


def clone_sample(entry: dict[str, Any]) -> tuple[Path | None, str]:
    engine = entry["engine"]
    url = entry["url"]
    target = SAMPLE_DIR / engine / safe_repo_name(url)
    if target.exists():
        return target, "already_cloned"
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        r = subprocess.run(
            ["git", "clone", "--depth", "1", "--quiet", url, str(target)],
            capture_output=True, text=True, timeout=SAMPLE_CLONE_TIMEOUT,
        )
    except (subprocess.TimeoutExpired, OSError, subprocess.SubprocessError) as exc:
        return None, f"clone_failed({type(exc).__name__})"
    if r.returncode != 0:
        return None, f"clone_failed(rc={r.returncode})"
    return target, "cloned"


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def check_anchor(repo_dir: Path, engine: str) -> tuple[bool, str]:
    for glob, needle in ENGINE_ANCHORS.get(engine, []):
        for match in list(repo_dir.glob(glob))[:50]:
            if not match.is_file():
                continue
            if needle is None:
                return True, f"{match.relative_to(repo_dir).as_posix()}"
            if needle in read_text(match):
                return True, f"{match.relative_to(repo_dir).as_posix()} [{needle}]"
    return False, "no anchor matched"


def scan_code(repo_dir: Path) -> tuple[int, int, dict[str, int]]:
    total_loc = 0
    comment_loc = 0
    ext_counts: Counter[str] = Counter()
    for path in repo_dir.rglob("*"):
        if not path.is_file():
            continue
        ext = path.suffix.lower()
        if ext not in CODE_EXTS:
            continue
        ext_counts[ext] += 1
        for line in read_text(path).splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            total_loc += 1
            if stripped.startswith(LINE_COMMENT_PREFIXES):
                comment_loc += 1
    return total_loc, comment_loc, dict(ext_counts)


def verdict(has_anchor: bool, loc: int, ext_counts: dict[str, int],
            role: str) -> str:
    if loc == 0 and not ext_counts:
        return "asset_only"
    if loc < 300:
        return "thin"
    # Libraries/tools/templates are deliberately engine-agnostic — a missing
    # anchor is expected, not a defect. Their value is the code patterns
    # (state machines, ECS, math) the user explicitly chose to keep.
    if not has_anchor:
        if role in ("library", "tool", "template"):
            return "usable"
        return "engine_unconfirmed"
    return "usable"


def top_level_tree(repo_dir: Path, limit: int = 12) -> str:
    items = sorted(
        (p for p in repo_dir.iterdir() if not p.name.startswith(".git")),
        key=lambda p: (p.is_file(), p.name.lower()),
    )
    names = [p.name + ("/" if p.is_dir() else "") for p in items[:limit]]
    more = "" if len(items) <= limit else f" (+{len(items) - limit} more)"
    return ", ".join(names) + more


def main() -> int:
    parser = argparse.ArgumentParser(description="Clone+inspect a stratified sample.")
    parser.add_argument("--per-engine", type=int, default=4)
    parser.add_argument("--engine", choices=list(ENGINES))
    parser.add_argument("--keep", action="store_true",
                        help="Keep data/repos_sample/ after run (default keeps it).")
    args = parser.parse_args()

    entries = load_curated()
    sample = stratified_sample(entries, args.per_engine)
    if args.engine:
        sample = [e for e in sample if e["engine"] == args.engine]

    print(f"Stratified sample: {len(sample)} repos "
          f"({args.per_engine}/engine) from {len(entries)} curated.\n")

    verdicts: Counter[str] = Counter()
    by_engine_verdict: dict[str, Counter[str]] = defaultdict(Counter)

    for entry in sample:
        engine = entry["engine"]
        slug = entry["url"].replace("https://github.com/", "")
        role = entry.get("role", "?")
        stars = entry.get("stars", 0)
        print(f"--- [{engine}] {slug}  ({stars}*, role={role}, "
              f"src={entry.get('source') or 'api'}"
              f"{', NOTABLE' if entry.get('notable') else ''})")

        repo_dir, clone_status = clone_sample(entry)
        if repo_dir is None:
            print(f"    CLONE FAILED: {clone_status}\n")
            verdicts["clone_failed"] += 1
            by_engine_verdict[engine]["clone_failed"] += 1
            continue

        has_anchor, anchor_info = check_anchor(repo_dir, engine)
        loc, comment_loc, ext_counts = scan_code(repo_dir)
        ratio = (comment_loc / loc) if loc else 0.0
        v = verdict(has_anchor, loc, ext_counts, role)
        verdicts[v] += 1
        by_engine_verdict[engine][v] += 1

        print(f"    tree:    {top_level_tree(repo_dir)}")
        print(f"    anchor:  {'OK' if has_anchor else 'MISS'} -> {anchor_info}")
        print(f"    code:    {loc} LOC, comments {ratio:.1%}, exts={ext_counts}")
        print(f"    VERDICT: {v}\n")

    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print("Overall verdicts:", dict(verdicts))
    print()
    for engine in ENGINES:
        if engine in by_engine_verdict:
            print(f"  {engine:<10} {dict(by_engine_verdict[engine])}")
    usable = verdicts.get("usable", 0)
    total = sum(verdicts.values())
    print(f"\nUsable: {usable}/{total} "
          f"({100 * usable / total:.0f}%)" if total else "no sample")
    print(f"\nSample clones in: {SAMPLE_DIR} (gitignored, safe to delete)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
