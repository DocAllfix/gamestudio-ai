"""Quality gate — Fase 2 step 1.

Reads the curated manifest (data/manifest.curated.json, falls back to
data/manifest.json) and applies 5 zero-LLM structural checks to every
cloned repo and every sub-directory entry:

  A structure  engine-specific marker files / content (Godot 4 enforced
               via config_version=5; config_version=4 = Godot 3 -> reject)
  B loc        engine code lines in [300, 30000]
  C comments   comment-line ratio >= 0.03
  D plugins    Godot only: <=5 addons/ dirs, <=10 [autoload] entries
  E license    LICENSE/COPYING body matches the permissive whitelist,
               else flagged "unknown" (non-blocking)

Repos scoring >= 3 are copied to data/repos_clean/{engine}/{name}/.
For sub-dir entries the project root is repos_raw/<engine>/
<safe_repo_name(parent_url)>/<subdir_path>; clean copies preserve that
"<parent>__<subdir>" layout.

Writes data/quality_report.json with one record per evaluated entry.

CLI:
    python scripts/ingestion/02_filter.py
    python scripts/ingestion/02_filter.py --dry-run
    python scripts/ingestion/02_filter.py --engine godot --verbose
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.shared.taxonomy import ENGINES
from scripts.ingestion._scrape_helpers import safe_repo_name
from scripts.ingestion._filter_rules import (
    ENGINE_CODE_EXTS,
    COMMENT_PREFIXES,
    LICENSE_BODY_MARKERS,
    LICENSE_FILENAMES,
    MAX_AUTOLOADS,
    MAX_LOC,
    MAX_PLUGINS,
    MIN_LOC,
    STRUCTURE_CHECKS,
    score_repo,
)

DATA_DIR = REPO_ROOT / "data"
REPOS_RAW_DIR = DATA_DIR / "repos_raw"
REPOS_CLEAN_DIR = DATA_DIR / "repos_clean"
CURATED_PATH = DATA_DIR / "manifest.curated.json"
MANIFEST_PATH = DATA_DIR / "manifest.json"
REPORT_PATH = DATA_DIR / "quality_report.json"

MAX_FILES = 6000  # bound the walk on a giant mono-repo subdir
MAX_FILE_BYTES = 5_000_000  # skip files >5MB: minified bundles / generated
                            # blobs, never hand-written source. Reading them
                            # whole caused MemoryError on the first live run.


def load_manifest() -> list[dict[str, Any]]:
    path = CURATED_PATH if CURATED_PATH.exists() else MANIFEST_PATH
    if not path.exists():
        print(f"ERROR: no manifest at {CURATED_PATH} or {MANIFEST_PATH}",
              file=sys.stderr)
        sys.exit(1)
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    print(f"Loaded {len(data)} entries from {path.name}")
    return data


def read_text(p: Path) -> str:
    """Read a text file, skipping oversized blobs. Files above
    MAX_FILE_BYTES are minified/generated and reading them whole blows
    the process heap; an empty string is the right signal (no useful
    source, no content-check hit, no LOC)."""
    try:
        if p.stat().st_size > MAX_FILE_BYTES:
            return ""
        return p.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def iter_lines(p: Path) -> list[str]:
    """Stream a file's lines without loading it whole. Returns [] for
    oversized or unreadable files."""
    try:
        if p.stat().st_size > MAX_FILE_BYTES:
            return []
        with p.open(encoding="utf-8", errors="ignore") as fh:
            return fh.read().splitlines()
    except OSError:
        return []


def project_root(entry: dict[str, Any]) -> Path:
    engine = entry["engine"]
    if entry.get("subdir_path"):
        parent = entry.get("parent_url") or entry.get("url")
        base = REPOS_RAW_DIR / engine / safe_repo_name(parent)
        return base / entry["subdir_path"]
    return REPOS_RAW_DIR / engine / safe_repo_name(entry["url"])


def iter_files(root: Path) -> list[Path]:
    out: list[Path] = []
    for p in root.rglob("*"):
        if len(out) >= MAX_FILES:
            break
        if p.is_file() and ".git" not in p.parts:
            out.append(p)
    return out


def check_structure(root: Path, engine: str,
                    files: list[Path]) -> dict[str, Any]:
    spec = STRUCTURE_CHECKS.get(engine, {})
    names = {p.name.lower() for p in files}
    exts = Counter(p.suffix.lower() for p in files)

    for req in spec.get("required", []):
        if req.lower() not in names:
            return {"ok": False, "reason": f"missing_required:{req}"}

    has_any = spec.get("has_any", [])
    if has_any and not any(exts.get(e, 0) for e in has_any):
        return {"ok": False, "reason": f"no_files:{','.join(has_any)}"}

    # Godot 4 enforcement: EVERY project.godot in the tree must say
    # config_version=5. A repo may contain multiple project.godot files
    # (e.g. a Godot-4 root project alongside a `godot-csharp/` Godot-3
    # sub-version); copying that repo whole leaks Godot-3 code into the
    # clean dataset. So we reject the repo as soon as we see any
    # config_version != 5.
    marker = spec.get("godot4_marker")
    if marker:
        pgs = [p for p in files if p.name.lower() == "project.godot"]
        if not pgs:
            return {"ok": False, "reason": "no_project_godot"}
        for pg in pgs:
            body = read_text(pg)
            if marker not in body:
                cv = re.search(r"config_version=(\d+)", body)
                where = pg.relative_to(root).as_posix()
                return {"ok": False,
                        "reason": f"godot3_or_unknown(config_version={cv.group(1) if cv else '?'} at {where})"}

    min_cf = spec.get("min_code_files")
    if min_cf:
        code_exts = ENGINE_CODE_EXTS.get(engine, set())
        n = sum(exts.get(e, 0) for e in code_exts)
        if n < min_cf:
            return {"ok": False, "reason": f"too_few_code_files({n}<{min_cf})"}

    content_check = spec.get("content_check")
    if content_check:
        targets = [p for p in files if p.suffix.lower() in has_any][:400]
        found = False
        for p in targets:
            body = read_text(p)
            if any(token in body for token in content_check):
                found = True
                break
        if not found:
            return {"ok": False,
                    "reason": f"content_missing:{content_check[0]}"}
    return {"ok": True, "reason": ""}


def count_loc_comments(files: list[Path], engine: str) -> tuple[int, float]:
    code_exts = ENGINE_CODE_EXTS.get(engine, set())
    total = comments = 0
    for p in files:
        ext = p.suffix.lower()
        if ext not in code_exts:
            continue
        prefixes = COMMENT_PREFIXES.get(ext, ("#",))
        for line in iter_lines(p):
            s = line.strip()
            if not s:
                continue
            total += 1
            if s.startswith(prefixes):
                comments += 1
    ratio = (comments / total) if total else 0.0
    return total, round(ratio, 4)


def check_plugins(root: Path, engine: str,
                  files: list[Path]) -> tuple[bool, str]:
    if engine != "godot":
        return True, ""
    addons = root / "addons"
    n_addons = 0
    if addons.is_dir():
        n_addons = sum(1 for d in addons.iterdir() if d.is_dir())
    if n_addons > MAX_PLUGINS:
        return False, f"too_many_addons({n_addons}>{MAX_PLUGINS})"
    pg = next((p for p in files if p.name.lower() == "project.godot"), None)
    if pg:
        body = read_text(pg)
        m = re.search(r"\[autoload\](.*?)(?:\n\[|\Z)", body, re.S)
        if m:
            autoloads = [ln for ln in m.group(1).splitlines()
                         if "=" in ln and not ln.strip().startswith(";")]
            if len(autoloads) > MAX_AUTOLOADS:
                return False, f"too_many_autoloads({len(autoloads)}>{MAX_AUTOLOADS})"
    return True, ""


def detect_license(root: Path, manifest_license: str | None) -> str:
    for p in root.iterdir() if root.is_dir() else []:
        if p.is_file() and p.name.lower() in LICENSE_FILENAMES:
            body = read_text(p).lower()
            for lic, markers in LICENSE_BODY_MARKERS.items():
                if any(m in body for m in markers):
                    return lic
            return "unknown"
    return manifest_license or "unknown"


def evaluate(entry: dict[str, Any], verbose: bool) -> dict[str, Any]:
    engine = entry["engine"]
    root = project_root(entry)
    ident = entry.get("subdir_path") and \
        f"{entry.get('parent_url') or entry['url']}#{entry['subdir_path']}" \
        or entry.get("url")

    if not root.exists():
        return {"repo": ident, "engine": engine, "pass": False,
                "quality_score": 1, "reason_if_failed": "clone_missing",
                "checks": {}}

    files = iter_files(root)
    structure = check_structure(root, engine, files)
    loc, cratio = count_loc_comments(files, engine)
    loc_ok = MIN_LOC <= loc <= MAX_LOC
    plugins_ok, plugins_reason = check_plugins(root, engine, files)
    lic = detect_license(root, entry.get("license"))

    checks = {
        "structure": structure,
        "loc": loc,
        "loc_ok": loc_ok,
        "comment_ratio": cratio,
        "plugins_ok": plugins_ok,
        "plugins_reason": plugins_reason,
        "license": lic,
    }
    score, passed, reason = score_repo(checks)
    rec = {
        "repo": ident,
        "engine": engine,
        "role": entry.get("role"),
        "is_subdir": bool(entry.get("subdir_path")),
        "stars": entry.get("stars", 0),
        "checks": {
            "structure": structure["ok"],
            "structure_reason": structure["reason"],
            "loc": loc,
            "comment_ratio": cratio,
            "plugins": plugins_ok,
            "license": lic,
        },
        "quality_score": score,
        "pass": passed,
        "reason_if_failed": reason,
    }
    if verbose:
        flag = "PASS" if passed else "drop"
        print(f"  [{flag}] s{score} {engine} loc={loc} c={cratio:.0%} "
              f"lic={lic} {ident}{(' :: ' + reason) if reason else ''}")
    return rec


def clean_dest(entry: dict[str, Any]) -> Path:
    engine = entry["engine"]
    if entry.get("subdir_path"):
        parent = entry.get("parent_url") or entry["url"]
        name = safe_repo_name(parent) + "__" + \
            re.sub(r"[^A-Za-z0-9._-]+", "_", entry["subdir_path"])
    else:
        name = safe_repo_name(entry["url"])
    return REPOS_CLEAN_DIR / engine / name


def main() -> int:
    parser = argparse.ArgumentParser(description="Fase 2 structural quality gate.")
    parser.add_argument("--engine", choices=list(ENGINES))
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--dry-run", action="store_true",
                        help="Evaluate + write report, but do NOT copy to repos_clean.")
    args = parser.parse_args()

    manifest = load_manifest()
    entries = [e for e in manifest
               if e.get("clone_status") in ("cloned", "already_cloned", "via_parent")]
    if args.engine:
        entries = [e for e in entries if e.get("engine") == args.engine]
    print(f"Evaluating {len(entries)} entries"
          f"{' (engine=' + args.engine + ')' if args.engine else ''}...\n")

    report: list[dict[str, Any]] = []
    by_engine: dict[str, Counter[str]] = defaultdict(Counter)
    score_dist: Counter[int] = Counter()
    copied = 0

    for i, entry in enumerate(entries, 1):
        rec = evaluate(entry, args.verbose)
        report.append(rec)
        eng = rec["engine"]
        by_engine[eng]["pass" if rec["pass"] else "drop"] += 1
        score_dist[rec["quality_score"]] += 1

        if rec["pass"] and rec["quality_score"] >= 3 and not args.dry_run:
            src = project_root(entry)
            dst = clean_dest(entry)
            if src.exists() and not dst.exists():
                try:
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copytree(src, dst,
                                    ignore=shutil.ignore_patterns(".git"))
                    copied += 1
                except (OSError, shutil.Error) as exc:
                    rec["copy_error"] = str(exc)[:200]
        if i % 200 == 0:
            print(f"  ...{i}/{len(entries)}")

    REPORT_PATH.write_text(
        json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")

    print("\n" + "=" * 60)
    print("QUALITY FILTER SUMMARY")
    print("=" * 60)
    total_pass = sum(1 for r in report if r["pass"])
    print(f"Evaluated: {len(report)} | pass: {total_pass} "
          f"({100*total_pass/max(len(report),1):.0f}%) | "
          f"drop: {len(report)-total_pass}")
    print("\nPer engine (pass / total):")
    for eng in ENGINES:
        if eng in by_engine:
            c = by_engine[eng]
            tot = c["pass"] + c["drop"]
            print(f"  {eng:<10} {c['pass']:>4} / {tot:<4}  "
                  f"({100*c['pass']/tot:.0f}%)")
    print("\nScore distribution:")
    for s in (5, 4, 3, 2, 1):
        print(f"  score {s}: {score_dist.get(s, 0)}")
    if args.dry_run:
        print("\nDRY RUN — repos_clean/ not written.")
    else:
        print(f"\nCopied {copied} repos (score>=3) to {REPOS_CLEAN_DIR}")
    print(f"Report: {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
