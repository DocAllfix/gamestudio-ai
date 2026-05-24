"""Kenney.nl scraper — HTML listing.

Kenney has no API. We iterate /assets/page:N (~13 pages × 15 packs
= ~200 packs), then fetch each /assets/<slug> page for metadata.

CC0 confirmed site-wide, BUT we still verify the literal string
"Creative Commons CC0" appears on every detail page as a
defense-in-depth check. If a future pack lands without it, we skip.

Granularity choice: one MANIFEST RECORD PER PACK, not per file.
A pack like "Input Prompts" has 1500 sprites but ships as one zip.
At runtime, the Asset Resolver will reference the pack-level URL
and the consumer can pick individual files. This keeps the index
manageable (~200 packs vs ~50k files) and matches how Kenney is
actually used.

Output: data/assets_raw/kenney/manifest.jsonl
"""
from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

from scripts.ingestion_assets._asset_sources import get_library
from scripts.ingestion_assets._fetch_helpers import (
    ASSETS_RAW_DIR, RateLimiter, append_jsonl, cached_get_html,
    existing_source_urls,
)


# Kenney serves links as ABSOLUTE URLs (https://kenney.nl/assets/<slug>)
# with mixed single/double quote attributes. We accept either quote
# style and either absolute or relative form, but reject `category:`
# `tag:` `series:` prefixed paths which are taxonomy navigation, not
# actual asset packs.
PACK_LINK_RE = re.compile(
    r"""href=['"](?:https?://kenney\.nl)?/assets/([a-z0-9][a-z0-9_-]*)['"]""",
    re.IGNORECASE)
LICENSE_OK_RE = re.compile(r"Creative\s+Commons\s+CC0", re.IGNORECASE)
TAG_RE = re.compile(
    r"""href=['"](?:https?://kenney\.nl)?/assets/tag:([^'"#?\s]+)['"]""",
    re.IGNORECASE)
TITLE_RE = re.compile(r"<h1[^>]*>(.*?)</h1>", re.IGNORECASE | re.DOTALL)
DOWNLOAD_RE = re.compile(
    r"""href=['"](?:https?://kenney\.nl)?(/content/sample/[^'"]+\.zip)['"]""",
    re.IGNORECASE)
COUNT_RE = re.compile(r"\b(\d[\d,]*)\s*[×x]\b")

# Crude type inference from pack name. Kenney is the only library
# where we have to guess asset_type from the title; everywhere else
# the source platform exposes it directly.
def infer_asset_type(slug: str, title: str, tags: list[str]) -> str:
    blob = (slug + " " + title + " " + " ".join(tags)).lower()
    if any(k in blob for k in ("audio", "music", "sound", "sfx")):
        # narrow further
        if any(k in blob for k in ("music", "loop", "track", "bgm")):
            return "audio_bgm"
        return "audio_sfx"
    if any(k in blob for k in ("ui", "icon", "interface", "prompt", "button")):
        return "ui_element" if "ui" in blob else "icon"
    if any(k in blob for k in ("3d", "kit", "model")):
        return "model_3d"
    if any(k in blob for k in ("tile", "tileset", "tilemap")):
        return "tileset"
    if any(k in blob for k in ("font", "pixel font", "typewriter")):
        return "font"
    return "sprite"


def fetch_kenney(log: logging.Logger, limit: int | None = None) -> int:
    """Scrape Kenney.nl pack listing + per-pack metadata."""
    lib = get_library("kenney")
    limiter = RateLimiter(lib.rate_limit_rpm)
    manifest = ASSETS_RAW_DIR / lib.id / "manifest.jsonl"
    seen = existing_source_urls(manifest)
    new_count = 0

    # Discover all pack slugs by iterating listing pages until we
    # find no new slugs (Kenney has ~13 pages).
    slugs: list[str] = []
    seen_slugs: set[str] = set()
    for page_num in range(1, 30):  # safety upper bound
        list_url = f"https://kenney.nl/assets/page:{page_num}"
        html = cached_get_html(lib.id, list_url, limiter, log)
        if not html:
            break
        page_slugs = set(PACK_LINK_RE.findall(html)) - seen_slugs
        # Strip taxonomy navigation matches. The regex character
        # class already excludes ':' so category:/tag:/series: are
        # rejected at the regex level, but we keep this filter as
        # belt-and-braces in case Kenney changes URL shapes.
        BAD = {"page", "category", "series", "tag", "categories"}
        page_slugs = {s for s in page_slugs
                      if s not in BAD and ":" not in s}
        if not page_slugs:
            log.info("Kenney page %d: no new slugs, stopping", page_num)
            break
        slugs.extend(sorted(page_slugs))
        seen_slugs.update(page_slugs)
        log.info("Kenney page %d: +%d slugs (total %d)",
                 page_num, len(page_slugs), len(slugs))

    log.info("Kenney: discovered %d pack slugs", len(slugs))

    for slug in slugs:
        canonical = f"https://kenney.nl/assets/{slug}"
        if canonical in seen:
            continue
        record = _fetch_pack(slug, canonical, limiter, log)
        if record is None:
            continue
        append_jsonl(manifest, record)
        seen.add(canonical)
        new_count += 1
        if limit and new_count >= limit:
            log.info("Kenney hit --limit=%d", limit)
            return new_count

    return new_count


def _fetch_pack(slug: str, canonical: str, limiter: RateLimiter,
                log: logging.Logger) -> dict[str, Any] | None:
    """Fetch one pack detail page, validate license, build record."""
    html = cached_get_html("kenney", canonical, limiter, log)
    if not html:
        return None
    if not LICENSE_OK_RE.search(html):
        log.warning("Kenney %s: CC0 marker missing, skipping", slug)
        return None

    title_match = TITLE_RE.search(html)
    title = _clean_html(title_match.group(1)) if title_match else slug.replace("-", " ").title()

    tags = sorted({_clean_html(t) for t in TAG_RE.findall(html)
                   if not t.startswith("category:")
                   and not t.startswith("series:")})[:20]

    asset_type = infer_asset_type(slug, title, tags)

    download = None
    dl_match = DOWNLOAD_RE.search(html)
    if dl_match:
        download = "https://kenney.nl" + dl_match.group(1)

    count_match = COUNT_RE.search(html)
    asset_count = None
    if count_match:
        try:
            asset_count = int(count_match.group(1).replace(",", ""))
        except ValueError:
            pass

    thumbnail = f"https://kenney.nl/data/img/assets/{slug}/header.png"

    return {
        "source_library": "kenney",
        "source_url": canonical,
        "download_url": download,
        "thumbnail_url": thumbnail,
        "license": "CC0-1.0",
        "license_verified_at": "2026-05-24T00:00:00Z",
        "attribution_required": False,
        "creator_name": "Kenney",
        "asset_type": asset_type,
        "file_format": "zip",  # pack-level; individual files vary
        "keywords": tags,
        "raw_meta": {
            "slug": slug,
            "title": title,
            "asset_count": asset_count,
        },
    }


_TAG_STRIP_RE = re.compile(r"<[^>]+>")

def _clean_html(s: str) -> str:
    """Strip HTML tags + collapse whitespace + URL-decode tag query."""
    s = _TAG_STRIP_RE.sub(" ", s)
    s = s.replace("%20", " ").replace("+", " ")
    return " ".join(s.split())
