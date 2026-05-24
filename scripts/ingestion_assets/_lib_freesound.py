"""Freesound scraper — API: https://freesound.org/apiv2

Mixed-license library: HARD filter via API param
`filter=license:"Creative Commons 0"`. We never request other
licenses, so we don't have to verify per-asset.

Requires FREESOUND_API_KEY env var (free tier, register at
https://freesound.org/apiv2/apply).

Volume strategy: there are 500k+ sounds but we cap at 50k CC0 +
queryable by mood (the audio_mood_library queries drive most of
our retrieval). Iterating ALL of them is wasteful.

Output: data/assets_raw/freesound/manifest.jsonl
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from scripts.ingestion_assets._asset_sources import get_library
from scripts.ingestion_assets._fetch_helpers import (
    ASSETS_RAW_DIR, RateLimiter, append_jsonl, cached_get_json,
    existing_source_urls,
)


# Search queries derived from AUDIO_MOOD_LIBRARY.md — one bank per
# mood. Each query returns up to 150 results (page size cap).
MOOD_QUERIES: dict[str, list[str]] = {
    "epic_orchestral": ["sword clash", "magic spell impact",
                        "boss roar", "epic drum hit"],
    "dark_ambient": ["horror ambient", "drone dark",
                     "footstep stone", "monster breath"],
    "chiptune_arcade": ["8-bit coin", "8-bit jump", "8-bit hit",
                        "chiptune powerup"],
    "lofi_chill": ["vinyl crackle", "rain ambient",
                   "cafe ambience", "lofi piano"],
    "synthwave_neon": ["laser sci-fi", "neon hum",
                       "glitch ui", "electronic impact"],
    "orchestral_calm": ["wind", "birds chirp", "water gentle",
                        "footstep grass"],
    "jazz_noir": ["typewriter", "rain window",
                  "footstep wet pavement", "vintage phone"],
    "fantasy_celtic": ["tankard clink", "fire crackle",
                       "tavern crowd", "sword sheath"],
    "electronic_tense": ["heartbeat", "sneak step",
                         "alert beep", "tension drone"],
    "piano_emotional": ["heartbeat soft", "breath",
                        "rain soft", "paper rustle"],
    "metal_hardcore": ["scream enemy", "explosion metal",
                       "saw clash", "guitar power chord"],
    "tropical_island": ["wave gentle", "seagull",
                        "sand step", "splash water"],
}

# Standalone SFX bank queries (independent of mood)
GENERIC_SFX_QUERIES: list[str] = [
    "ui click", "menu open", "menu close", "button press",
    "footstep wood", "footstep metal", "footstep water",
    "damage hit", "death", "game over", "victory fanfare",
    "coin pickup", "powerup", "level up",
    "door open", "door close", "chest open", "key pickup",
]

# How many results per query we keep (page_size).
PER_QUERY_LIMIT = 50


def fetch_freesound(log: logging.Logger, limit: int | None = None) -> int:
    """Iterate the mood + generic SFX queries, store CC0 results."""
    lib = get_library("freesound")
    api_key = os.getenv("FREESOUND_API_KEY")
    if not api_key:
        log.error("FREESOUND_API_KEY not set — skipping Freesound.")
        return 0

    limiter = RateLimiter(lib.rate_limit_rpm)
    manifest = ASSETS_RAW_DIR / lib.id / "manifest.jsonl"
    seen = existing_source_urls(manifest)
    new_count = 0

    all_queries: list[tuple[str, str]] = []
    for mood, queries in MOOD_QUERIES.items():
        for q in queries:
            all_queries.append((mood, q))
    for q in GENERIC_SFX_QUERIES:
        all_queries.append(("generic", q))

    for mood, query in all_queries:
        url = f"{lib.api_endpoint}/search/text/"
        data = cached_get_json(
            lib.id, url, limiter, log,
            params={
                "query": query,
                "filter": 'license:"Creative Commons 0"',
                "fields": ("id,name,url,description,duration,bitrate,"
                           "samplerate,channels,filesize,tags,license,"
                           "username,download,previews"),
                "page_size": PER_QUERY_LIMIT,
                "token": api_key,
            },
        )
        if not data:
            log.warning("Freesound query failed: %r", query)
            continue

        results = data.get("results") or []
        log.info("Freesound %r: %d results (CC0 only)", query, len(results))

        for r in results:
            canonical = r.get("url")
            if not canonical or canonical in seen:
                continue
            record = _build_record(r, mood, query)
            if record is None:
                continue
            append_jsonl(manifest, record)
            seen.add(canonical)
            new_count += 1

            if limit and new_count >= limit:
                log.info("Freesound hit --limit=%d", limit)
                return new_count

    return new_count


def _build_record(r: dict, mood: str, query: str) -> dict | None:
    """Convert Freesound API row into our raw manifest format.
    Returns None if the row is missing critical fields."""
    if not r.get("id") or not r.get("url"):
        return None
    license_raw = (r.get("license") or "").strip()
    # API filter already guarantees CC0, but defense-in-depth:
    if "creativecommons.org/publicdomain/zero" not in license_raw.lower():
        return None  # silently skip if not pure CC0

    previews = r.get("previews") or {}
    # prefer hq mp3 (lighter); we never serve from disk, just metadata
    preview_url = (previews.get("preview-hq-mp3")
                   or previews.get("preview-lq-mp3"))

    return {
        "source_library": "freesound",
        "source_url": r["url"],
        "download_url": r.get("download"),  # full file (requires OAuth)
        "thumbnail_url": preview_url,
        "license": "CC0-1.0",
        "license_verified_at": "2026-05-24T00:00:00Z",
        "attribution_required": False,
        "creator_name": r.get("username"),
        "asset_type": "audio_sfx",
        "file_format": "wav",  # freesound originals; preview is mp3
        "file_size_kb": int((r.get("filesize") or 0) / 1024) or None,
        "audio_duration_s": r.get("duration"),
        "audio_bpm": None,
        "audio_key": None,
        "keywords": (r.get("tags") or [])[:20],
        "raw_meta": {
            "name": r.get("name"),
            "description": (r.get("description") or "")[:500],
            "mood_query": mood,
            "search_term": query,
            "bitrate": r.get("bitrate"),
            "samplerate": r.get("samplerate"),
            "channels": r.get("channels"),
        },
    }
