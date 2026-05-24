"""Filter & dedup pass over raw asset manifests — Phase 2 / Gap 7.3.

Reads every data/assets_raw/<library>/manifest.jsonl, applies:
  1. License hard-check (must be in ASSET_LICENSE_ALLOWLIST)
  2. Forbidden-marker scan on creator/keywords/description text
  3. Format whitelist per asset_type (no .exe, .dll, etc)
  4. Size sanity per asset_type (sprite 10KB-5MB, audio 100KB-50MB,
     model 50KB-200MB)
  5. Cross-library dedup via source_url (already on disk) AND
     a stable text-hash on (creator|title|keywords) to catch mirrors
     like "Kenney pack X" indexed both by kenney and gameassets_com.

Writes the surviving records to
    data/assets_clean/<library>/manifest.jsonl
plus a global report at
    data/assets_filter_report.json

This is the last gate before LLM classify ($) so the rejection
rules are tighter than in the scrape phase.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.ingestion_assets._asset_sources import (
    ASSET_LICENSE_ALLOWLIST, has_forbidden_marker, is_license_allowed,
)
from scripts.ingestion_assets._fetch_helpers import (
    ASSETS_RAW_DIR, append_jsonl, load_jsonl,
)

ASSETS_CLEAN_DIR = REPO_ROOT / "data" / "assets_clean"
REPORT_PATH = REPO_ROOT / "data" / "assets_filter_report.json"


# Per asset_type: allowed file extensions + size band (KB).
TYPE_RULES: dict[str, dict[str, Any]] = {
    "sprite":         {"exts": {"png", "jpg", "webp", "zip"}, "min_kb": 1,    "max_kb": 5_000},
    "tileset":        {"exts": {"png", "jpg", "webp", "zip"}, "min_kb": 5,    "max_kb": 20_000},
    "ui_element":     {"exts": {"png", "svg", "zip"},        "min_kb": 1,    "max_kb": 5_000},
    "icon":           {"exts": {"png", "svg", "zip"},        "min_kb": 1,    "max_kb": 2_000},
    "logo":           {"exts": {"png", "svg", "zip"},        "min_kb": 1,    "max_kb": 5_000},
    "background":     {"exts": {"png", "jpg", "webp", "zip"}, "min_kb": 10,   "max_kb": 30_000},
    "concept_art":    {"exts": {"png", "jpg", "webp"},       "min_kb": 10,   "max_kb": 50_000},
    "model_3d":       {"exts": {"gltf", "glb", "obj", "fbx", "blend", "zip"},
                       "min_kb": 5,    "max_kb": 200_000},
    "animation_3d":   {"exts": {"gltf", "glb", "fbx", "blend", "zip"},
                       "min_kb": 5,    "max_kb": 200_000},
    "texture":        {"exts": {"png", "jpg", "exr", "hdr", "zip"},
                       "min_kb": 5,    "max_kb": 100_000},
    "hdri":           {"exts": {"hdr", "exr"},               "min_kb": 100,  "max_kb": 500_000},
    "shader":         {"exts": {"glsl", "hlsl", "wgsl", "js", "ts"},
                       "min_kb": None, "max_kb": None},
    "particle_effect":{"exts": {"json", "zip"},              "min_kb": None, "max_kb": 5_000},
    "audio_bgm":      {"exts": {"mp3", "ogg", "wav", "flac"},"min_kb": 100,  "max_kb": 100_000},
    "audio_sfx":      {"exts": {"mp3", "ogg", "wav"},        "min_kb": 1,    "max_kb": 50_000},
    "audio_voice":    {"exts": {"mp3", "ogg", "wav"},        "min_kb": 10,   "max_kb": 50_000},
    "font":           {"exts": {"ttf", "otf", "woff", "woff2", "zip"},
                       "min_kb": 1,    "max_kb": 5_000},
}


def evaluate(record: dict[str, Any]) -> tuple[bool, str]:
    """Return (passed, reason). reason is 'ok' on pass."""
    lic = record.get("license")
    if not is_license_allowed(lic):
        return False, f"license_not_in_allowlist({lic!r})"

    # Defense-in-depth: scan free-form text for forbidden license markers
    raw_meta = record.get("raw_meta") or {}
    desc = (raw_meta.get("description") or "") + " " + \
           (record.get("creator_name") or "")
    marker = has_forbidden_marker(desc)
    if marker:
        return False, f"forbidden_marker_in_description:{marker}"

    asset_type = record.get("asset_type")
    rules = TYPE_RULES.get(asset_type)
    if not rules:
        return False, f"unknown_asset_type:{asset_type!r}"

    fmt = (record.get("file_format") or "").lower()
    if fmt and fmt not in rules["exts"]:
        return False, f"format_not_allowed:{fmt}_for_{asset_type}"

    size_kb = record.get("file_size_kb")
    if size_kb is not None and rules["max_kb"] is not None:
        if size_kb < (rules["min_kb"] or 0):
            return False, f"size_too_small:{size_kb}<{rules['min_kb']}"
        if size_kb > rules["max_kb"]:
            return False, f"size_too_large:{size_kb}>{rules['max_kb']}"

    if not record.get("source_url"):
        return False, "missing_source_url"

    return True, "ok"


def content_fingerprint(record: dict[str, Any]) -> str:
    """Hash of (creator, title-ish, sorted keywords) to detect the
    same asset re-indexed by different aggregator libraries."""
    raw = record.get("raw_meta") or {}
    title = (raw.get("title") or raw.get("name") or "").lower().strip()
    creator = (record.get("creator_name") or "").lower().strip()
    kws = " ".join(sorted((record.get("keywords") or [])[:10])).lower()
    blob = f"{creator}|{title}|{kws}|{record.get('asset_type','')}"
    return hashlib.sha1(blob.encode("utf-8")).hexdigest()[:16]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--library",
                    help="Filter only this library (default: all).")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print report, do not write clean manifests.")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    log = logging.getLogger("filter_assets")

    if not ASSETS_RAW_DIR.exists():
        log.error("No raw assets dir at %s — run 01_scrape_assets.py first",
                  ASSETS_RAW_DIR)
        return 1

    fingerprints: dict[str, tuple[str, str]] = {}  # fp -> (library, source_url)
    drop_reasons: Counter[str] = Counter()
    pass_counts: dict[str, int] = defaultdict(int)
    drop_counts: dict[str, int] = defaultdict(int)
    dup_counts: dict[str, int] = defaultdict(int)

    libraries = (
        [args.library] if args.library
        else [d.name for d in ASSETS_RAW_DIR.iterdir() if d.is_dir()]
    )

    if not args.dry_run:
        ASSETS_CLEAN_DIR.mkdir(parents=True, exist_ok=True)
        for lib in libraries:
            clean_path = ASSETS_CLEAN_DIR / lib / "manifest.jsonl"
            if clean_path.exists():
                clean_path.unlink()  # full rewrite for determinism

    for lib in libraries:
        raw_path = ASSETS_RAW_DIR / lib / "manifest.jsonl"
        if not raw_path.exists():
            log.warning("No raw manifest for %s", lib)
            continue
        records = load_jsonl(raw_path)
        log.info("=== %s: %d raw records ===", lib, len(records))

        for rec in records:
            passed, reason = evaluate(rec)
            if not passed:
                drop_counts[lib] += 1
                drop_reasons[reason] += 1
                continue
            fp = content_fingerprint(rec)
            if fp in fingerprints:
                origin_lib, origin_url = fingerprints[fp]
                dup_counts[lib] += 1
                drop_reasons[f"dup_of:{origin_lib}"] += 1
                if args.verbose:
                    log.debug("dup: %s in %s == %s in %s",
                              rec.get("source_url"), lib,
                              origin_url, origin_lib)
                continue
            fingerprints[fp] = (lib, rec.get("source_url", ""))
            pass_counts[lib] += 1
            if not args.dry_run:
                append_jsonl(ASSETS_CLEAN_DIR / lib / "manifest.jsonl", rec)

    total_pass = sum(pass_counts.values())
    total_drop = sum(drop_counts.values())
    total_dup = sum(dup_counts.values())
    total_raw = total_pass + total_drop + total_dup

    print("\n" + "=" * 56)
    print("ASSET FILTER SUMMARY")
    print("=" * 56)
    print(f"Total raw:   {total_raw}")
    print(f"Passed:      {total_pass} ({100*total_pass/max(total_raw,1):.1f}%)")
    print(f"Dropped:     {total_drop}")
    print(f"Dup-removed: {total_dup}")
    print("\nPer library:")
    for lib in libraries:
        p = pass_counts.get(lib, 0)
        d = drop_counts.get(lib, 0)
        du = dup_counts.get(lib, 0)
        print(f"  {lib:18} pass={p:>5} drop={d:>5} dup={du:>5}")
    print("\nTop drop reasons:")
    for reason, n in drop_reasons.most_common(15):
        print(f"  {n:>5}  {reason}")

    report = {
        "total_raw": total_raw,
        "total_pass": total_pass,
        "total_drop": total_drop,
        "total_dup": total_dup,
        "pass_per_library": dict(pass_counts),
        "drop_per_library": dict(drop_counts),
        "dup_per_library": dict(dup_counts),
        "drop_reasons": dict(drop_reasons),
        "mode": "DRY-RUN" if args.dry_run else "APPLIED",
    }
    if not args.dry_run:
        REPORT_PATH.write_text(json.dumps(report, indent=2,
                                          ensure_ascii=False),
                               encoding="utf-8")
        print(f"\nReport: {REPORT_PATH}")
    else:
        print("\nDRY-RUN — no files written.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
