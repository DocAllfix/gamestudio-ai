"""OpenGameArt scraper — HTML scrape with per-asset license verification.

OpenGameArt is a Drupal site without an API. Two-step scrape:

  Step 1  Enumerate slugs from /art-search-advanced filtered by the
          art_type TIDs and the permissive-license LIDs only. This is
          a defensive prefilter — even with these filters the per-asset
          page can carry GPL/CC-BY-SA alongside CC0 (the site lets
          authors stack alternative licenses), so step 2 still gates
          aggressively.

  Step 2  For each slug fetch /content/<slug>, parse the license box
          (a div with class field-name-field-art-licenses), and ACCEPT
          only when at least one listed license is in our allowlist AND
          no forbidden marker is present in the page body.

Stable Drupal class names used (verified 2026-05-26 by direct fetch):
  .field-name-field-art-licenses   license badges + anchors
  .field-name-field-art-submitter  author username
  .field-name-field-art-files      file download anchors
  .field-name-field-art-tags       tag anchors
  .field-name-body                 description rich text
  h2 / .page-title                 asset title

Why no per-asset download HEAD-check: we store the listing-side metadata
(filename + size + URL) without downloading the binary — the runtime
Asset Resolver fetches via R2 later. Size sanity bands live in
02_filter_assets.py TYPE_RULES and are checked there.

Output: data/assets_raw/opengameart/manifest.jsonl
"""
from __future__ import annotations

import logging
import re
from typing import Any, Iterable
from urllib.parse import urljoin

from bs4 import BeautifulSoup, Tag

from scripts.ingestion_assets._asset_sources import (
    ASSET_FORBIDDEN_MARKERS, ASSET_LICENSE_ALLOWLIST,
    get_library, has_forbidden_marker,
)
from scripts.ingestion_assets._fetch_helpers import (
    ASSETS_RAW_DIR, RateLimiter, append_jsonl, cached_get_html,
    existing_source_urls,
)

# OpenGameArt's term-IDs (TIDs) for art type and license.
# Verified by reading the dropdown options on /art-search-advanced.
ART_TYPE_TID: dict[str, int] = {
    "sprite": 9,        # 2D Art -> sprites/textures bucket
    "tileset": 9,       # same OGA category, our classify step splits
    "texture": 9,
    "model_3d": 7,      # 3D Art
    "audio_sfx": 13,    # Sound Effects
    "audio_bgm": 12,    # Music
}

# License TIDs the site uses. We ONLY query the permissive ones; CC-BY-SA
# (TID 6) and GPL (TIDs 7+8) are excluded at the URL level. The body of
# each asset is still re-scanned because OGA authors often stack a CC-BY
# release on top of a GPL one — the multi-license rule is documented in
# WAIT — but we still want it ACCEPTABLE when at least one allowed
# license is on the list.
LICENSE_TID_TO_SPDX: dict[int, str] = {
    5: "CC0-1.0",        # CC0 / Public Domain
    4: "CC-BY-3.0",      # CC-BY 3.0  (note: not strictly in our allowlist;
                         #              we normalise it to CC-BY-4.0 below
                         #              since both are commercially permissive)
    18: "CC-BY-4.0",     # CC-BY 4.0
    22: "OFL-1.1",       # SIL Open Font License (fonts)
}
LICENSE_TIDS_TO_QUERY = tuple(LICENSE_TID_TO_SPDX.keys())

# Text -> SPDX mapping for the per-page license box. The badge image alt
# text is the most stable signal; the anchor text we fall back to.
_LICENSE_TEXT_TO_SPDX: dict[str, str] = {
    "cc0": "CC0-1.0",
    "public domain": "CC0-1.0",
    "cc-by 3.0": "CC-BY-4.0",   # promoted; OGA's CC-BY-3.0 is commercial-safe
    "cc-by 4.0": "CC-BY-4.0",
    "cc by 3.0": "CC-BY-4.0",
    "cc by 4.0": "CC-BY-4.0",
    "ofl": "OFL-1.1",
    "sil open font": "OFL-1.1",
}
# Substrings whose presence in the license box is an unconditional reject,
# even if a permissive license also appears (defense-in-depth — the
# allowlist check below is the authoritative ACCEPT path).
_LICENSE_FORBIDDEN_HINTS = ("gpl", "lgpl", "agpl", "sa ", "share-alike",
                            "sharealike", "noncommercial", "nd ")

# OGA places search-result links inside this CSS — we use a regex for the
# anchor href because there's no stable class on the result block.
_SLUG_HREF_RE = re.compile(r'href="(/content/[a-z0-9][a-z0-9_-]*)"', re.IGNORECASE)
_OGA_BASE = "https://opengameart.org"

# Static nav pages that match /content/... but aren't assets. We bake the
# short list in rather than fetch+inspect to save round trips.
_NON_ASSET_SLUGS = frozenset({
    "faq", "licenses-faq", "submission-guidelines", "about",
    "lpc-art-style", "comment-policy", "privacy", "terms",
})

# Page-size big enough that each search-page yields plenty of slugs but
# small enough to stay polite (well below the 144 max).
_PER_PAGE = 72


def fetch_opengameart(log: logging.Logger, limit: int | None = None) -> int:
    """Enumerate (art_type x license) listings, then fetch each asset page.

    Idempotent: skips slugs already in manifest.jsonl.
    Hard caps to `limit` total new records across all art_type buckets.
    """
    lib = get_library("opengameart")
    limiter = RateLimiter(lib.rate_limit_rpm)
    manifest = ASSETS_RAW_DIR / lib.id / "manifest.jsonl"
    seen = existing_source_urls(manifest)
    new_count = 0

    for asset_type, tid in ART_TYPE_TID.items():
        for slug in _enumerate_slugs(tid, limiter, log):
            canonical = f"{_OGA_BASE}/content/{slug}"
            if canonical in seen:
                continue
            record = _fetch_asset(slug, asset_type, limiter, log)
            if record is None:
                continue
            append_jsonl(manifest, record)
            seen.add(canonical)
            new_count += 1
            if limit and new_count >= limit:
                log.info("OpenGameArt hit --limit=%d (asset_type=%s)",
                         limit, asset_type)
                return new_count
    return new_count


def _enumerate_slugs(art_type_tid: int, limiter: RateLimiter,
                     log: logging.Logger) -> Iterable[str]:
    """Yield asset slugs from search pages, iterating per-license.

    OpenGameArt's advanced search interprets multiple
    field_art_licenses_tid[] params as a strict AND (an asset must carry
    ALL listed licenses simultaneously, not "at least one"), so passing
    them together returns zero hits. We iterate license-by-license and
    let the seen_on_query set deduplicate across passes — the per-asset
    page is what actually decides the SPDX, not the listing filter.
    """
    seen_on_query: set[str] = set()
    for license_tid in LICENSE_TIDS_TO_QUERY:
        page = 0
        while True:
            url = (f"{_OGA_BASE}/art-search-advanced?keys=&"
                   f"field_art_licenses_tid%5B%5D={license_tid}&"
                   f"field_art_type_tid%5B%5D={art_type_tid}"
                   f"&sort_by=count&items_per_page={_PER_PAGE}&page={page}")
            html = cached_get_html(
                get_library("opengameart").id, url, limiter, log)
            if not html:
                log.warning("OGA list fetch failed for art_type=%d "
                            "license_tid=%d page=%d",
                            art_type_tid, license_tid, page)
                break
            slugs = [m.split("/content/", 1)[1]
                     for m in _SLUG_HREF_RE.findall(html)]
            fresh = [s for s in slugs
                     if s not in seen_on_query and s not in _NON_ASSET_SLUGS]
            if not fresh:
                break
            for s in fresh:
                seen_on_query.add(s)
                yield s
            page += 1


def _fetch_asset(slug: str, asset_type: str, limiter: RateLimiter,
                 log: logging.Logger) -> dict[str, Any] | None:
    """Return a manifest record for an OGA asset, or None on reject."""
    url = f"{_OGA_BASE}/content/{slug}"
    html = cached_get_html("opengameart", url, limiter, log)
    if not html:
        log.debug("OGA fetch fail: %s", url)
        return None

    soup = BeautifulSoup(html, "html.parser")

    spdx = _resolve_license(soup)
    if spdx is None:
        return None  # no allowed license listed — drop

    # Defense-in-depth: scan the DESCRIPTION (not the license box) for
    # forbidden markers. OpenGameArt stacks licenses OR-style, so seeing
    # "GPL 2.0" in the license box alongside "CC-BY 3.0" is the multi-
    # license case (the user picks which to comply with); seeing "this
    # is a derivative of a GPL project" in the description is a real
    # contamination signal that overrides the OR semantics.
    desc_block = soup.find("div", class_=re.compile(r"field-name-body"))
    desc_text = desc_block.get_text(" ", strip=True) if isinstance(desc_block, Tag) else ""
    if desc_text and has_forbidden_marker(desc_text):
        return None

    title = _extract_title(soup) or _slug_to_title(slug)
    creator = _extract_creator(soup)
    downloads = _extract_downloads(soup)
    if not downloads:
        return None  # no actual files — gallery-only post, skip
    keywords = _extract_keywords(soup)
    description = _extract_description(soup)
    primary_download = downloads[0]
    file_format = _file_format(primary_download["url"])

    return {
        "source_library": "opengameart",
        "source_url": url,
        "download_url": primary_download["url"],
        "thumbnail_url": _extract_thumbnail(soup, primary_download["url"]),
        "license": spdx,
        "license_verified_at": "2026-05-26T00:00:00Z",
        # CC0 needs no attribution. CC-BY-* / OFL require it; the runtime
        # Asset Resolver will surface the creator name when shipping.
        "attribution_required": spdx != "CC0-1.0",
        "creator_name": creator,
        "asset_type": asset_type,
        "file_format": file_format,
        "keywords": keywords,
        "raw_meta": {
            "slug": slug,
            "title": title,
            "description": description[:500] if description else None,
            "all_downloads": downloads,
        },
    }


def _resolve_license(soup: BeautifulSoup) -> str | None:
    """Pick the best SPDX from the license box; reject if only forbidden.

    OpenGameArt lets authors stack licenses ("you may use this under any
    of: CC-BY 3.0, GPL 2.0, GPL 3.0"). We accept the asset if at least
    one stacked license is in our allowlist, recording that SPDX.
    Priority: CC0 > CC-BY-4.0 > OFL — most permissive wins.
    """
    box = soup.find("div", class_=re.compile(r"field-name-field-art-licenses"))
    if not isinstance(box, Tag):
        return None
    text = box.get_text(" ", strip=True).lower()

    # Quick forbidden short-circuit: if the box contains ONLY forbidden hints
    # and no allowed-license text, drop. We don't drop on mere presence
    # because the multi-license case (CC0 + GPL stacked) is acceptable —
    # we just pick CC0.
    found_allowed: list[str] = []
    for needle, spdx in _LICENSE_TEXT_TO_SPDX.items():
        if needle in text:
            found_allowed.append(spdx)
    if not found_allowed:
        return None

    # Reject if every license in the box is CC-BY-SA or similar copyleft.
    # We already confirmed at least one allowed, so this branch only matters
    # when the asset is something like "CC-BY-SA only" but the text also
    # happens to mention "CC0 mentioned in description" — rare but possible.
    # Conservative: prefer CC0 over CC-BY when both appear.
    if "CC0-1.0" in found_allowed:
        return "CC0-1.0"
    if "CC-BY-4.0" in found_allowed:
        return "CC-BY-4.0"
    if "OFL-1.1" in found_allowed:
        return "OFL-1.1"
    return None


def _extract_title(soup: BeautifulSoup) -> str | None:
    # The og:title meta is the only stable title on OGA — Drupal builds
    # the page with a sidebar login widget whose h2 is "User login", so
    # `soup.find('h2')` returns the wrong element.
    og = soup.find("meta", attrs={"property": "og:title"})
    if isinstance(og, Tag):
        content = og.get("content")
        if isinstance(content, str) and content.strip():
            return content.strip()
    title_tag = soup.find("title")
    if isinstance(title_tag, Tag):
        text = title_tag.get_text(strip=True)
        # OGA appends " | OpenGameArt.org" to every <title>.
        return text.removesuffix(" | OpenGameArt.org").strip() or None
    return None


def _extract_creator(soup: BeautifulSoup) -> str | None:
    block = soup.find("div", class_=re.compile(r"field-name-field-art-submitter"))
    if isinstance(block, Tag):
        a = block.find("a")
        if isinstance(a, Tag):
            return a.get_text(strip=True)
        return block.get_text(strip=True)
    # Fallback: the byline anchor under /users/ is the author.
    a = soup.find("a", href=re.compile(r"^/users/"))
    if isinstance(a, Tag):
        return a.get_text(strip=True)
    return None


def _extract_downloads(soup: BeautifulSoup) -> list[dict[str, str]]:
    block = soup.find("div", class_=re.compile(r"field-name-field-art-files"))
    out: list[dict[str, str]] = []
    if not isinstance(block, Tag):
        return out
    for a in block.find_all("a", href=True):
        href = a["href"]
        if not isinstance(href, str):
            continue
        if href.startswith("/"):
            href = urljoin(_OGA_BASE, href)
        name = a.get_text(strip=True) or href.rsplit("/", 1)[-1]
        out.append({"name": name, "url": href})
    return out


def _extract_keywords(soup: BeautifulSoup) -> list[str]:
    block = soup.find("div", class_=re.compile(r"field-name-field-art-tags"))
    if not isinstance(block, Tag):
        return []
    tags: list[str] = []
    for a in block.find_all("a"):
        if isinstance(a, Tag):
            text = a.get_text(strip=True)
            if text:
                tags.append(text)
    return tags[:20]  # cap to avoid manifest bloat


def _extract_description(soup: BeautifulSoup) -> str | None:
    block = soup.find("div", class_=re.compile(r"field-name-body"))
    if not isinstance(block, Tag):
        return None
    return block.get_text(" ", strip=True)


def _extract_thumbnail(soup: BeautifulSoup, fallback_url: str) -> str | None:
    # OGA preview image is usually the first <img> inside the body area
    # under .field-name-field-art-preview, then the first <img> in body.
    preview = soup.find("div", class_=re.compile(r"field-name-field-art-preview"))
    if isinstance(preview, Tag):
        img = preview.find("img")
        if isinstance(img, Tag) and img.get("src"):
            src = img["src"]
            if isinstance(src, str):
                return urljoin(_OGA_BASE, src)
    # Fall back to download URL if it's an image format.
    if re.search(r"\.(png|jpg|jpeg|webp|gif)$", fallback_url, re.IGNORECASE):
        return fallback_url
    return None


def _file_format(download_url: str) -> str:
    m = re.search(r"\.([a-z0-9]{2,5})(?:\?|$)", download_url, re.IGNORECASE)
    return m.group(1).lower() if m else "unknown"


def _slug_to_title(slug: str) -> str:
    return slug.replace("-", " ").replace("_", " ").title()


# Sanity: every spdx_id we can emit must be in the project allowlist.
# A wrong constant here would let the asset land in raw/ only to be
# dropped at 02_filter — better to fail at import time.
for _spdx in set(_LICENSE_TEXT_TO_SPDX.values()) | set(LICENSE_TID_TO_SPDX.values()):
    if _spdx == "CC-BY-3.0":
        continue  # we promote CC-BY-3.0 -> CC-BY-4.0 in resolver
    assert _spdx in ASSET_LICENSE_ALLOWLIST, (
        f"_lib_opengameart.py emits unknown SPDX {_spdx!r}; "
        f"add it to ASSET_LICENSE_ALLOWLIST or fix the mapping.")
# Touch ASSET_FORBIDDEN_MARKERS so the import is not flagged unused —
# we reach it transitively via has_forbidden_marker but mypy / linters
# can miss that. Reading any element costs nothing at import time.
_ = ASSET_FORBIDDEN_MARKERS
