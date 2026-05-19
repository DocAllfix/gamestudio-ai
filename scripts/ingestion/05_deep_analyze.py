"""Deep content analyzer — Fase 1 step 5.

Walks every CLONED repo under data/repos_raw/ (the keep=true curated set)
and inspects real on-disk content, not just GitHub metadata. Produces:

1. Per-repo content record: engine anchor present?, total LOC, primary
   language LOC, comment ratio, file-extension breakdown, has-tests,
   has-readme, project depth (sub-projects), content verdict.
2. A "respect score" ranking — a transparent composite of community
   signal (log stars) + content health (LOC in the sweet band, comment
   ratio, anchor present, not asset-only) — to surface the repos that
   are universally well-regarded AND substantive, per engine.
3. Dataset health: per-engine usable %, genre coverage from the real
   tree, and the list of repos that should be reviewed (thin/asset/
   engine_unconfirmed).

Read-only. Writes a JSON report to data/deep_analysis.json and prints a
human summary. Run AFTER 01_scrape.py --from-curated has cloned repos.

CLI:
    python scripts/ingestion/05_deep_analyze.py
    python scripts/ingestion/05_deep_analyze.py --engine godot --top 15
"""
from __future__ import annotations

import argparse
import json
import math
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
REPOS_RAW_DIR = REPO_ROOT / "data" / "repos_raw"
REPORT_PATH = REPO_ROOT / "data" / "deep_analysis.json"

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
    ".gd", ".cs", ".lua", ".js", ".ts", ".jsx", ".tsx", ".rpy", ".py",
    ".gdshader", ".glsl", ".shader", ".hlsl", ".wgsl",
    ".script", ".gui_script", ".render_script", ".tscn", ".tres",
    ".sdsl", ".sdfx",
}
LINE_COMMENT_PREFIXES = ("#", "//", "--", ";", "*")

GENRE_KEYWORDS: dict[str, list[str]] = {
    "platformer": ["platformer", "platform"], "metroidvania": ["metroidvania"],
    "roguelike": ["roguelike", "roguelite"], "rpg": ["rpg", "role-playing"],
    "visual_novel": ["visual novel", "visual-novel", "otome", "dating sim"],
    "puzzle": ["puzzle", "match-3"], "shooter": ["shooter", "shmup", "bullet"],
    "horror": ["horror"], "racing": ["racing", "kart"],
    "tower_defense": ["tower defense", "tower-defense"],
    "fighting": ["fighting", "brawler"], "sim": ["simulation", "tycoon"],
    "card": ["card game", "deckbuild"], "survival": ["survival", "crafting"],
    "arcade": ["arcade", "retro"], "sandbox": ["sandbox", "open world"],
    "rhythm": ["rhythm"], "stealth": ["stealth"],
}

MAX_FILES_SCANNED = 4000  # cap per repo so a 6k-file mono-repo is bounded


def load_curated() -> list[dict[str, Any]]:
    if not CURATED_PATH.exists():
        print(f"ERROR: {CURATED_PATH} missing.", file=sys.stderr)
        sys.exit(1)
    with CURATED_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def check_anchor(repo_dir: Path, engine: str) -> bool:
    for glob, needle in ENGINE_ANCHORS.get(engine, []):
        for match in list(repo_dir.glob(glob))[:40]:
            if not match.is_file():
                continue
            if needle is None or needle in read_text(match):
                return True
    return False


def scan_repo(repo_dir: Path) -> dict[str, Any]:
    total_loc = comment_loc = scanned = 0
    ext_counts: Counter[str] = Counter()
    has_tests = has_readme = False
    project_markers = 0
    for path in repo_dir.rglob("*"):
        if scanned >= MAX_FILES_SCANNED:
            break
        if not path.is_file():
            continue
        low = path.name.lower()
        if low.startswith("readme"):
            has_readme = True
        if "test" in path.parts[-2:][0].lower() if len(path.parts) > 1 else False:
            has_tests = True
        if low in ("project.godot", "game.project") or low.endswith(".csproj"):
            project_markers += 1
        ext = path.suffix.lower()
        if ext not in CODE_EXTS:
            continue
        scanned += 1
        ext_counts[ext] += 1
        for line in read_text(path).splitlines():
            s = line.strip()
            if not s:
                continue
            total_loc += 1
            if s.startswith(LINE_COMMENT_PREFIXES):
                comment_loc += 1
    return {
        "loc": total_loc,
        "comment_ratio": round(comment_loc / total_loc, 4) if total_loc else 0.0,
        "ext_counts": dict(ext_counts.most_common(8)),
        "has_tests": has_tests,
        "has_readme": has_readme,
        "project_markers": project_markers,
    }


def content_verdict(anchor: bool, scan: dict[str, Any], role: str) -> str:
    if scan["loc"] == 0 and not scan["ext_counts"]:
        return "asset_only"
    if scan["loc"] < 300:
        return "thin"
    if not anchor and role == "game":
        return "engine_unconfirmed"
    return "usable"


def respect_score(entry: dict[str, Any], scan: dict[str, Any],
                  anchor: bool) -> float:
    """Transparent composite, 0-100. Community signal is log-damped so a
    100k-star engine does not crush everything; content health rewards the
    1k-30k LOC sweet band, a 3%+ comment ratio, a present anchor, tests,
    and readme."""
    stars = max(entry.get("stars", 0), 0)
    community = min(math.log10(stars + 1) / 5.0, 1.0) * 45  # up to 45 pts

    loc = scan["loc"]
    if 1000 <= loc <= 30000:
        loc_pts = 25.0
    elif 300 <= loc < 1000 or 30000 < loc <= 80000:
        loc_pts = 15.0
    elif loc >= 80000:
        loc_pts = 8.0
    else:
        loc_pts = 2.0

    cr = scan["comment_ratio"]
    comment_pts = 12.0 if cr >= 0.03 else (6.0 if cr >= 0.01 else 0.0)
    anchor_pts = 10.0 if anchor else 0.0
    extra = (4.0 if scan["has_tests"] else 0.0) + \
            (2.0 if scan["has_readme"] else 0.0) + \
            (2.0 if entry.get("notable") else 0.0)
    return round(community + loc_pts + comment_pts + anchor_pts + extra, 1)


def main() -> int:
    parser = argparse.ArgumentParser(description="Deep content analysis of cloned repos.")
    parser.add_argument("--engine", choices=list(ENGINES))
    parser.add_argument("--top", type=int, default=12)
    args = parser.parse_args()

    curated = load_curated()
    repos = [e for e in curated
             if not e.get("subdir_path")
             and e.get("clone_status") in ("cloned", "already_cloned")]
    if args.engine:
        repos = [e for e in repos if e["engine"] == args.engine]

    print(f"Deep-analyzing {len(repos)} cloned repos "
          f"(subdir entries excluded; they share a parent clone)...\n")

    records: list[dict[str, Any]] = []
    by_engine_verdict: dict[str, Counter[str]] = defaultdict(Counter)
    by_engine_genre: dict[str, Counter[str]] = defaultdict(Counter)

    for i, entry in enumerate(repos, 1):
        engine = entry["engine"]
        repo_dir = REPOS_RAW_DIR / engine / safe_repo_name(entry["url"])
        if not repo_dir.exists():
            by_engine_verdict[engine]["missing_clone"] += 1
            continue
        anchor = check_anchor(repo_dir, engine)
        scan = scan_repo(repo_dir)
        role = entry.get("role", "game")
        verdict = content_verdict(anchor, scan, role)
        score = respect_score(entry, scan, anchor)
        by_engine_verdict[engine][verdict] += 1

        blob = " ".join(
            [(entry.get("description") or "").lower()]
            + [t.lower() for t in (entry.get("topics") or [])]
        )
        for g, kws in GENRE_KEYWORDS.items():
            if any(k in blob for k in kws):
                by_engine_genre[engine][g] += 1

        records.append({
            "url": entry["url"], "engine": engine, "role": role,
            "stars": entry.get("stars", 0), "source": entry.get("source"),
            "notable": bool(entry.get("notable")),
            "anchor": anchor, "verdict": verdict,
            "respect_score": score, **scan,
        })
        if i % 100 == 0:
            print(f"  ...{i}/{len(repos)}")

    REPORT_PATH.write_text(
        json.dumps(records, indent=2, sort_keys=True), encoding="utf-8")

    print("\n" + "=" * 64)
    print("DATASET HEALTH — content verdict per engine (cloned repos)")
    print("=" * 64)
    for engine in ENGINES:
        if engine in by_engine_verdict:
            v = by_engine_verdict[engine]
            tot = sum(v.values())
            usable = v.get("usable", 0)
            print(f"  {engine:<10} {usable}/{tot} usable "
                  f"({100*usable/tot:.0f}%)  {dict(v)}")

    print("\n" + "=" * 64)
    print(f"TOP {args.top} BY RESPECT SCORE — universally regarded + substantive")
    print("=" * 64)
    engines = [args.engine] if args.engine else ENGINES
    for engine in engines:
        eng_recs = sorted(
            [r for r in records if r["engine"] == engine],
            key=lambda r: r["respect_score"], reverse=True,
        )
        if not eng_recs:
            continue
        print(f"\n{engine.upper()}:")
        for r in eng_recs[: args.top]:
            slug = r["url"].replace("https://github.com/", "")
            tag = " [NOTABLE]" if r["notable"] else ""
            print(f"  {r['respect_score']:>5}  {r['stars']:>6}*  "
                  f"{r['loc']:>7} LOC  c{r['comment_ratio']*100:>4.0f}%  "
                  f"{r['verdict']:<18} {slug}{tag}")

    print("\n" + "=" * 64)
    print("GENRE COVERAGE (from description+topics of cloned repos)")
    print("=" * 64)
    for engine in engines:
        g = by_engine_genre.get(engine)
        if not g:
            continue
        cov = ", ".join(f"{k}:{v}" for k, v in g.most_common())
        print(f"  {engine:<10} {cov}")

    print(f"\nFull per-repo report: {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
