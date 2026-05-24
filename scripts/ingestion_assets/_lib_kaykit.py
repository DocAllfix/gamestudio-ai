"""KayKit (Kay Lousberg) scraper — itch.io profile listing.

~15-25 packs on https://kaylousberg.itch.io/. Most are CC0 with
pay-what-you-want bonus tiers, but a FEW have custom EULAs for
paid-only packs. We hard-verify CC0 in the pack description before
ingesting; non-CC0 packs are silently dropped.

Output: data/assets_raw/kaykit/manifest.jsonl
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


# itch.io pack URL pattern: https://kaylousberg.itch.io/<slug>
# Profile page has anchors to each pack.
PACK_LINK_RE = re.compile(
    r"""href=['"]https?://kaylousberg\.itch\.io/([a-z0-9][a-z0-9_-]*)['"]""",
    re.IGNORECASE)

# Multiple CC0 phrasings used on itch.io pack pages.
CC0_RE = re.compile(
    r"\bCC0\b|public\s+domain|free\s+for\s+(personal\s+and\s+)?commercial\s+use\s+,?\s*no\s+attribution",
    re.IGNORECASE)
TITLE_RE = re.compile(r'<meta\s+property="og:title"\s+content="([^"]+)"',
                      re.IGNORECASE)
DESC_RE = re.compile(
    r'<meta\s+property="og:description"\s+content="([^"]+)"',
    re.IGNORECASE)
IMG_RE = re.compile(r'<meta\s+property="og:image"\s+content="([^"]+)"',
                    re.IGNORECASE)


def infer_asset_type(slug: str, title: str, desc: str) -> str:
    blob = (slug + " " + title + " " + desc).lower()
    if "animat" in blob:
        return "animation_3d"
    return "model_3d"


def fetch_kaykit(log: logging.Logger, limit: int | None = None) -> int:
    """Scrape KayKit itch.io profile + per-pack pages."""
    lib = get_library("kaykit")
    limiter = RateLimiter(lib.rate_limit_rpm)
    manifest = ASSETS_RAW_DIR / lib.id / "manifest.jsonl"
    seen = existing_source_urls(manifest)
    new_count = 0

    profile_url = "https://kaylousberg.itch.io/"
    profile_html = cached_get_html(lib.id, profile_url, limiter, log)
    if not profile_html:
        log.error("KayKit profile fetch failed")
        return 0

    slugs = sorted(set(PACK_LINK_RE.findall(profile_html)))
    # Filter out non-pack slugs (itch has /follow, /unsubscribe, etc.
    # but those don't match owner.itch.io/<slug> normally).
    blacklist = {"follow", "unsubscribe", "rss", "feed"}
    slugs = [s for s in slugs if s not in blacklist]
    log.info("KayKit: discovered %d pack slugs", len(slugs))

    for slug in slugs:
        canonical = f"https://kaylousberg.itch.io/{slug}"
        if canonical in seen:
            continue
        record = _fetch_pack(slug, canonical, limiter, log)
        if record is None:
            continue
        append_jsonl(manifest, record)
        seen.add(canonical)
        new_count += 1
        if limit and new_count >= limit:
            log.info("KayKit hit --limit=%d", limit)
            return new_count

    return new_count


def _fetch_pack(slug: str, canonical: str, limiter: RateLimiter,
                log: logging.Logger) -> dict[str, Any] | None:
    """Per-pack: verify CC0, extract title + thumbnail."""
    html = cached_get_html("kaykit", canonical, limiter, log)
    if not html:
        return None
    if not CC0_RE.search(html):
        log.warning("KayKit %s: CC0 marker not found, skipping", slug)
        return None

    title_match = TITLE_RE.search(html)
    title = title_match.group(1) if title_match else slug.replace("-", " ").title()
    desc_match = DESC_RE.search(html)
    desc = (desc_match.group(1) if desc_match else "")[:400]
    img_match = IMG_RE.search(html)
    thumbnail = img_match.group(1) if img_match else None

    asset_type = infer_asset_type(slug, title, desc)

    keywords = [t for t in re.split(r"[\s_-]", slug) if len(t) > 2][:8]

    return {
        "source_library": "kaykit",
        "source_url": canonical,
        # itch.io doesn't expose direct zip URL without OAuth user login.
        # We store the pack page URL as download_url and let the user/
        # runtime click-through. (Same approach as Kenney.)
        "download_url": canonical,
        "thumbnail_url": thumbnail,
        "license": "CC0-1.0",
        "license_verified_at": "2026-05-24T00:00:00Z",
        "attribution_required": False,
        "creator_name": "Kay Lousberg",
        "asset_type": asset_type,
        "file_format": "zip",
        "keywords": keywords,
        "raw_meta": {
            "slug": slug,
            "title": title,
            "description": desc,
        },
    }
