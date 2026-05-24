"""Poly Haven scraper — API: https://api.polyhaven.com

Why this is the easiest library:
- Official API, no auth.
- CC0 site-wide (no per-asset license checks needed).
- Stable schema: /assets, /info/{slug}, /files/{slug}.
- ~3000 assets total: 500 HDRIs + 1500 textures + 1000 models.

Endpoints used:
  GET /assets?type={hdris|textures|models}
    -> { slug: {name, type, categories, tags, date_published, ...} }
  GET /files/{slug}
    -> per-format file URLs (we keep the smallest preview-quality)

Output: one record per asset appended to
    data/assets_raw/polyhaven/manifest.jsonl
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from scripts.ingestion_assets._asset_sources import get_library
from scripts.ingestion_assets._fetch_helpers import (
    ASSETS_RAW_DIR, RateLimiter, append_jsonl, cached_get_json,
    existing_source_urls,
)


# Map Poly Haven asset type ID -> our asset_type enum (migration 003 CHECK).
PH_TYPE_MAP: dict[int, str] = {
    0: "hdri",
    1: "texture",
    2: "model_3d",
}
PH_TYPE_QUERY: dict[str, str] = {
    "hdri": "hdris",
    "texture": "textures",
    "model_3d": "models",
}


def fetch_polyhaven(log: logging.Logger, limit: int | None = None) -> int:
    """Index every Poly Haven asset. Returns count of new records.

    Idempotent: skips slugs already in the manifest.jsonl.
    """
    lib = get_library("polyhaven")
    limiter = RateLimiter(lib.rate_limit_rpm)
    manifest = ASSETS_RAW_DIR / lib.id / "manifest.jsonl"
    seen = existing_source_urls(manifest)
    new_count = 0

    for asset_type, ph_query in PH_TYPE_QUERY.items():
        list_url = f"{lib.api_endpoint}/assets"
        data = cached_get_json(lib.id, list_url, limiter, log,
                               params={"type": ph_query})
        if not data:
            log.error("Poly Haven %s: list fetch failed", ph_query)
            continue

        log.info("Poly Haven %s: %d assets in API", ph_query, len(data))

        for slug, meta in data.items():
            canonical = f"https://polyhaven.com/a/{slug}"
            if canonical in seen:
                continue

            files_url = f"{lib.api_endpoint}/files/{slug}"
            files = cached_get_json(lib.id, files_url, limiter, log) or {}

            record = _build_record(slug, asset_type, meta, files)
            append_jsonl(manifest, record)
            seen.add(canonical)
            new_count += 1

            if limit and new_count >= limit:
                log.info("Poly Haven hit --limit=%d", limit)
                return new_count

    return new_count


def _build_record(slug: str, asset_type: str,
                  meta: dict[str, Any], files: dict[str, Any]) -> dict[str, Any]:
    """Compose a raw manifest record. Fields land in
    asset_library_index via the store step; missing fields are filled
    by the classify step (semantic_description, embedding, etc)."""
    # Pick the smallest preview-quality download URL we can find.
    # For textures: prefer 1k JPG. For HDRIs: 1k EXR. For models: gltf.
    download_url = _pick_download(asset_type, files)
    thumbnail = (f"https://cdn.polyhaven.com/asset_img/thumbs/"
                 f"{slug}.png?width=256")

    return {
        "source_library": "polyhaven",
        "source_url": f"https://polyhaven.com/a/{slug}",
        "download_url": download_url,
        "thumbnail_url": thumbnail,
        "license": "CC0-1.0",
        "license_verified_at": "2026-05-24T00:00:00Z",
        "attribution_required": False,
        "creator_name": _extract_creator(meta),
        "asset_type": asset_type,
        "file_format": _pick_format(asset_type, files),
        "image_width": (meta.get("dimensions") or [None, None])[0]
                       if asset_type == "hdri" else None,
        "image_height": (meta.get("dimensions") or [None, None])[1]
                        if asset_type == "hdri" else None,
        "model_triangle_count": None,  # not in API; filter step extracts
        "keywords": list(meta.get("categories", [])) + list(meta.get("tags", [])),
        "raw_meta": meta,  # kept for classify step prompt context
    }


def _pick_download(asset_type: str, files: dict[str, Any]) -> str | None:
    """Pick the lightest reasonable file URL."""
    if asset_type == "hdri":
        hdri = files.get("hdri", {})
        for res in ("1k", "2k", "4k"):
            entry = hdri.get(res, {}).get("hdr")
            if entry and entry.get("url"):
                return entry["url"]
    elif asset_type == "texture":
        diff = files.get("Diffuse") or files.get("Albedo") or {}
        for res in ("1k", "2k"):
            entry = diff.get(res, {}).get("jpg")
            if entry and entry.get("url"):
                return entry["url"]
    elif asset_type == "model_3d":
        blend = files.get("blend") or files.get("gltf") or files.get("fbx")
        if isinstance(blend, dict):
            for v in blend.values():
                if isinstance(v, dict):
                    for fmt_dict in v.values():
                        if isinstance(fmt_dict, dict) and fmt_dict.get("url"):
                            return fmt_dict["url"]
    return None


def _pick_format(asset_type: str, files: dict[str, Any]) -> str:
    if asset_type == "hdri":
        return "hdr"
    if asset_type == "texture":
        return "jpg"
    if asset_type == "model_3d":
        return "gltf" if "gltf" in files else "blend"
    return "unknown"


def _extract_creator(meta: dict[str, Any]) -> str | None:
    authors = meta.get("authors")
    if isinstance(authors, dict) and authors:
        return ", ".join(authors.keys())
    if isinstance(authors, list) and authors:
        return ", ".join(str(a) for a in authors)
    return None
