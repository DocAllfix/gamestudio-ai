"""Chunk grooming — pre-Fase 4 pruning of low-signal chunks.

Reads `data/chunks_raw/<engine>/<repo>/chunk_*.json` and drops:
  1. tiny     — loc < 20 (except project_meta / vn_core / inventory where
                brevity is normal)
  2. dup      — chunks with identical `code` content (sha256). Tie-break by
                lexicographic path so the choice is deterministic across runs.
  3. empty    — stripped-of-comments-and-whitespace logic < 30 chars
                (no-op stubs like `def _ready(): pass` or `function init() end`)

Survivors are renumbered `chunk_NNNN.json` per repo for clean sequence.
Dropped chunks move to `data/chunks_dropped/<reason>/<engine>/<repo>/` so we
can audit them later — nothing is permanently deleted.

CLI:
    python scripts/ingestion/03b_groom_chunks.py --dry-run    # default
    python scripts/ingestion/03b_groom_chunks.py --apply      # interactive y/N
    python scripts/ingestion/03b_groom_chunks.py --apply -y   # no prompt
    python scripts/ingestion/03b_groom_chunks.py --engine godot --dry-run
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
from collections import Counter
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CHUNKS_RAW = REPO_ROOT / "data" / "chunks_raw"
CHUNKS_DROPPED = REPO_ROOT / "data" / "chunks_dropped"
REPORT_PATH = REPO_ROOT / "data" / "grooming_report.json"

TINY_LOC_THRESHOLD = 20
EMPTY_LOGIC_THRESHOLD = 30
# Ren'Py screens are often single-purpose UI panels of 5-15 lines — they
# carry the full UI pattern and we keep them by design. Inventory chunks
# (renpy) and vn_core summarise dense metadata in few lines.
TINY_EXEMPT_KINDS = {"project_meta", "vn_core", "inventory", "screen"}

# Strip line-comments per common engine languages.
_COMMENT_PREFIXES = ("#", "//", "--", ";")


def _logic_len(code: str) -> int:
    """Approximate non-comment, non-whitespace character count.

    We strip lines starting with `#`/`//`/`--`/`;` (covers gdscript, lua,
    js/ts, c#, configs) and collapse remaining whitespace. Not perfect for
    block comments but good enough as a stub-detection heuristic.
    """
    chars = 0
    for ln in code.splitlines():
        s = ln.strip()
        if not s or s.startswith(_COMMENT_PREFIXES):
            continue
        # collapse internal whitespace so `def _ready(): pass` counts as ~16
        chars += len(re.sub(r"\s+", " ", s))
    return chars


def _classify_chunk(c: dict[str, Any]) -> str | None:
    """Return drop reason ('tiny', 'empty') or None to keep.

    Dup detection is global (across all chunks) so it lives in the main
    loop, not here.
    """
    kind = c.get("chunk_kind")
    loc = int(c.get("loc", 0))
    if loc < TINY_LOC_THRESHOLD and kind not in TINY_EXEMPT_KINDS:
        return "tiny"
    if _logic_len(c.get("code", "")) < EMPTY_LOGIC_THRESHOLD \
            and kind not in TINY_EXEMPT_KINDS:
        return "empty"
    return None


def _move_to_dropped(src: Path, reason: str) -> None:
    rel = src.relative_to(CHUNKS_RAW)
    dst = CHUNKS_DROPPED / reason / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dst))


def _renumber_repo_dir(repo_dir: Path) -> int:
    """After deletions, rename chunk_*.json files to dense sequential
    chunk_0001.json … chunk_NNNN.json. Returns the new count."""
    files = sorted(repo_dir.glob("chunk_*.json"))
    # First pass to temp names so we don't collide with existing numbers.
    tmp_names: list[Path] = []
    for i, f in enumerate(files, 1):
        tmp = f.with_name(f"__tmp_{i:04d}.json")
        f.rename(tmp)
        tmp_names.append(tmp)
    for i, t in enumerate(tmp_names, 1):
        t.rename(t.with_name(f"chunk_{i:04d}.json"))
    return len(files)


def collect_chunks(engine_filter: str | None) -> list[tuple[Path, dict[str, Any]]]:
    items: list[tuple[Path, dict[str, Any]]] = []
    for engine_dir in sorted(CHUNKS_RAW.iterdir()):
        if not engine_dir.is_dir():
            continue
        if engine_filter and engine_dir.name != engine_filter:
            continue
        for f in sorted(engine_dir.glob("*/chunk_*.json")):
            try:
                items.append((f, json.loads(f.read_text(encoding="utf-8"))))
            except (OSError, json.JSONDecodeError):
                continue
    return items


def plan_drops(items: list[tuple[Path, dict[str, Any]]]) \
        -> dict[str, list[tuple[Path, dict[str, Any]]]]:
    """Return {'tiny': [...], 'empty': [...], 'dup': [...]} for the items
    that should be removed. Dup keeps the lexicographically-first path."""
    plan: dict[str, list[tuple[Path, dict[str, Any]]]] = \
        {"tiny": [], "empty": [], "dup": []}
    seen_hash: dict[str, Path] = {}
    for path, c in items:
        reason = _classify_chunk(c)
        if reason:
            plan[reason].append((path, c))
            continue
        # Dup check only among survivors of tiny/empty so we don't waste
        # cycles hashing trash we're already dropping.
        h = hashlib.sha256((c.get("code") or "").encode(
            "utf-8", errors="ignore")).hexdigest()
        if h in seen_hash:
            # Tie-break: keep the smaller path (already-iterated), drop this.
            plan["dup"].append((path, c))
        else:
            seen_hash[h] = path
    return plan


def render_summary(items: list[tuple[Path, dict[str, Any]]],
                   plan: dict[str, list[tuple[Path, dict[str, Any]]]]) \
        -> dict[str, Any]:
    by_engine_before: Counter[str] = Counter()
    by_engine_drop: dict[str, Counter[str]] = {}
    for _, c in items:
        by_engine_before[c["engine"]] += 1
    for reason, lst in plan.items():
        for _, c in lst:
            by_engine_drop.setdefault(c["engine"], Counter())[reason] += 1

    print("\n" + "=" * 64)
    print("GROOMING PLAN")
    print("=" * 64)
    print(f"Total scanned:    {len(items)}")
    print(f"To drop tiny:     {len(plan['tiny'])}")
    print(f"To drop empty:    {len(plan['empty'])}")
    print(f"To drop dup:      {len(plan['dup'])}")
    total_drop = sum(len(v) for v in plan.values())
    print(f"Total to drop:    {total_drop}  ({100*total_drop/len(items):.1f}%)")
    print(f"Survivors:        {len(items) - total_drop}")
    print()
    print("By engine:")
    print(f"  {'engine':<10} {'before':>7} {'tiny':>6} {'empty':>6} {'dup':>5} {'after':>7} {'drop%':>6}")
    for eng in sorted(by_engine_before):
        d = by_engine_drop.get(eng, Counter())
        drop = d["tiny"] + d["empty"] + d["dup"]
        before = by_engine_before[eng]
        after = before - drop
        pct = 100 * drop / before if before else 0
        print(f"  {eng:<10} {before:>7} {d['tiny']:>6} {d['empty']:>6} "
              f"{d['dup']:>5} {after:>7} {pct:>5.1f}%")
        if pct > 40:
            print(f"  WARNING: {eng} loses >40% — verify the drop reasons")
    return {
        "scanned": len(items),
        "dropped": {"tiny": len(plan["tiny"]),
                    "empty": len(plan["empty"]),
                    "dup": len(plan["dup"])},
        "survivors": len(items) - total_drop,
        "by_engine": {
            eng: {"before": by_engine_before[eng],
                  "dropped": dict(by_engine_drop.get(eng, Counter())),
                  "after": by_engine_before[eng]
                  - sum(by_engine_drop.get(eng, Counter()).values())}
            for eng in sorted(by_engine_before)
        },
    }


def show_examples(plan: dict[str, list[tuple[Path, dict[str, Any]]]],
                  n: int = 4) -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = {}
    print("\nSamples per reason (first {} each):".format(n))
    for reason, lst in plan.items():
        print(f"\n  --- {reason} ---")
        samples: list[dict[str, Any]] = []
        for path, c in lst[:n]:
            head = (c.get("code") or "").splitlines()[:2]
            short_code = " / ".join(line.strip() for line in head)[:100]
            print(f"    [{c['engine']} loc={c.get('loc')} "
                  f"{c.get('heuristic_category')}] {short_code}")
            samples.append({
                "path": path.relative_to(REPO_ROOT).as_posix(),
                "engine": c.get("engine"),
                "loc": c.get("loc"),
                "category": c.get("heuristic_category"),
                "head": short_code,
            })
        out[reason] = samples
    return out


def apply_drops(plan: dict[str, list[tuple[Path, dict[str, Any]]]]) -> int:
    """Move dropped files into chunks_dropped/<reason>/ and renumber the
    survivors so each repo has a dense chunk_0001..N sequence."""
    touched_dirs: set[Path] = set()
    for reason, lst in plan.items():
        for path, _ in lst:
            _move_to_dropped(path, reason)
            touched_dirs.add(path.parent)
    n_renumbered = 0
    for d in touched_dirs:
        if d.exists() and any(d.glob("chunk_*.json")):
            n_renumbered += _renumber_repo_dir(d)
    return n_renumbered


def confirm() -> bool:
    try:
        ans = input("\nApply these drops? type 'yes' to confirm: ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        return False
    return ans == "yes"


def main() -> int:
    ap = argparse.ArgumentParser(description="Chunk grooming pre-Fase 4")
    ap.add_argument("--apply", action="store_true",
                    help="Move dropped chunks to chunks_dropped/ and renumber.")
    ap.add_argument("--dry-run", action="store_true", default=False,
                    help="Default behaviour: scan + report only.")
    ap.add_argument("--engine", help="Restrict to a single engine.")
    ap.add_argument("-y", "--yes", action="store_true",
                    help="Skip the interactive confirmation under --apply.")
    args = ap.parse_args()

    if not CHUNKS_RAW.is_dir():
        print(f"ERROR: {CHUNKS_RAW} missing.", file=sys.stderr)
        return 1

    items = collect_chunks(args.engine)
    if not items:
        print("No chunks found.")
        return 0

    plan = plan_drops(items)
    summary = render_summary(items, plan)
    samples = show_examples(plan)

    report = {**summary, "samples": samples,
              "engine_filter": args.engine,
              "applied": False}

    if args.apply:
        if not args.yes and not confirm():
            print("Aborted. No files were moved.")
            REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
            return 0
        n = apply_drops(plan)
        report["applied"] = True
        report["renumbered_chunks"] = n
        print(f"\nApplied. Renumbered {n} survivor chunk files.")
        print(f"Dropped chunks preserved under {CHUNKS_DROPPED}")
    else:
        print("\nDRY RUN — no files moved. Re-run with --apply to commit.")

    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nReport: {REPORT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
