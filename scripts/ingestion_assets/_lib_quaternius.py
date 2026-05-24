"""Quaternius scraper — HTML listing.

~82 packs discoverable from the homepage as /packs/<slug>.html.
Each pack page declares CC0 explicitly in the license section.
We do per-page CC0 verification before ingesting.

Granularity: one MANIFEST RECORD PER PACK (like Kenney). Each pack
contains 20-500 individual 3D models, but at retrieval time the
Asset Resolver references the pack as a unit.

Output: data/assets_raw/quaternius/manifest.jsonl
"""
from __future__ import annotations

import logging
import re
from typing import Any

from scripts.ingestion_assets._asset_sources import get_library
from scripts.ingestion_assets._fetch_helpers import (
    ASSETS_RAW_DIR, RateLimiter, append_jsonl, cached_get_html,
    existing_source_urls,
)


# Quaternius uses slug pattern /packs/<lowercaseslug>.html
PACK_LINK_RE = re.compile(
    r"""href=['"](?:https?://quaternius\.com)?/packs/([a-z0-9][a-z0-9_-]*)\.html['"]""",
    re.IGNORECASE)
CC0_RE = re.compile(r"\bCC0\b|public\s+domain|free\s+to\s+use\s+in\s+(personal\s+and\s+)?commercial",
                    re.IGNORECASE)
TITLE_RE = re.compile(r"<h1[^>]*>(.*?)</h1>", re.IGNORECASE | re.DOTALL)
DOWNLOAD_RE = re.compile(
    r"""href=['"]([^'"]+\.zip)['"]""", re.IGNORECASE)
TAG_RE = re.compile(r"<title>(.*?)</title>", re.IGNORECASE | re.DOTALL)


# Heuristic: keyword in slug -> asset_type. All Quaternius packs are
# 3D models or animations (no sprites/audio), so default = model_3d.
def infer_asset_type(slug: str, title: str) -> str:
    blob = (slug + " " + title).lower()
    if "animated" in blob or "animation" in blob:
        return "animation_3d"
    return "model_3d"


def fetch_quaternius(log: logging.Logger, limit: int | None = None) -> int:
    """Scrape Quaternius homepage + per-pack pages."""
    lib = get_library("quaternius")
    limiter = RateLimiter(lib.rate_limit_rpm)
    manifest = ASSETS_RAW_DIR / lib.id / "manifest.jsonl"
    seen = existing_source_urls(manifest)
    new_count = 0

    # Step 1: discover all pack slugs from the homepage.
    home_url = "https://quaternius.com/"
    home_html = cached_get_html(lib.id, home_url, limiter, log)
    if not home_html:
        log.error("Quaternius homepage fetch failed")
        return 0

    slugs = sorted(set(PACK_LINK_RE.findall(home_html)))
    log.info("Quaternius: discovered %d pack slugs", len(slugs))

    # Step 2: fetch each pack page, verify CC0, extract metadata.
    for slug in slugs:
        canonical = f"https://quaternius.com/packs/{slug}.html"
        if canonical in seen:
            continue
        record = _fetch_pack(slug, canonical, limiter, log)
        if record is None:
            continue
        append_jsonl(manifest, record)
        seen.add(canonical)
        new_count += 1
        if limit and new_count >= limit:
            log.info("Quaternius hit --limit=%d", limit)
            return new_count

    return new_count


def _fetch_pack(slug: str, canonical: str, limiter: RateLimiter,
                log: logging.Logger) -> dict[str, Any] | None:
    """Per-pack: verify CC0, extract title + download URL + asset type."""
    html = cached_get_html("quaternius", canonical, limiter, log)
    if not html:
        return None
    if not CC0_RE.search(html):
        log.warning("Quaternius %s: CC0 marker not found, skipping", slug)
        return None

    title_match = TITLE_RE.search(html)
    title = _clean_html(title_match.group(1)) if title_match else _slug_to_title(slug)

    asset_type = infer_asset_type(slug, title)

    # First zip download link encountered
    dl_match = DOWNLOAD_RE.search(html)
    download = dl_match.group(1) if dl_match else None
    if download and download.startswith("/"):
        download = "https://quaternius.com" + download

    # Page <title> often has tag keywords
    page_title = TAG_RE.search(html)
    keywords: list[str] = []
    if page_title:
        kw_text = _clean_html(page_title.group(1)).lower()
        for k in ("character", "weapon", "vehicle", "building", "medieval",
                  "fantasy", "scifi", "sci-fi", "space", "modular",
                  "animal", "monster", "rpg", "platformer", "nature",
                  "furniture", "food", "low poly", "low-poly", "kit",
                  "animation", "animated", "cute", "cyberpunk", "zombie"):
            if k in kw_text:
                keywords.append(k.replace(" ", "_").replace("-", "_"))
    if not keywords:
        # Pull from slug as fallback
        keywords = [t for t in re.split(r"[_-]", slug) if len(t) > 2][:8]

    thumbnail = f"https://quaternius.com/packs/thumbnails/{slug}.webp"

    return {
        "source_library": "quaternius",
        "source_url": canonical,
        "download_url": download,
        "thumbnail_url": thumbnail,
        "license": "CC0-1.0",
        "license_verified_at": "2026-05-24T00:00:00Z",
        "attribution_required": False,
        "creator_name": "Quaternius",
        "asset_type": asset_type,
        "file_format": "zip",  # pack-level container
        "keywords": keywords[:15],
        "raw_meta": {
            "slug": slug,
            "title": title,
        },
    }


def _slug_to_title(slug: str) -> str:
    """Quick fallback title from slug."""
    return slug.replace("-", " ").replace("_", " ").title()


_TAG_STRIP_RE = re.compile(r"<[^>]+>")


def _clean_html(s: str) -> str:
    s = _TAG_STRIP_RE.sub(" ", s)
    return " ".join(s.split())
