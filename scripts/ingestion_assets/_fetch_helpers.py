"""Shared helpers for asset scraping — rate-limited HTTP, on-disk
cache, retry. Used by every library-specific scraper module.

Design choices:
- Cache raw API responses in data/asset_cache/<library>/<sha1>.json
  so dev re-runs don't re-hit external APIs.
- Token-bucket rate limiter per-library (rate_limit_rpm from catalog).
- Idempotent: every scraper writes to data/assets_raw/<library>/
  manifest.jsonl, one line per asset, with source_url as natural key.
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from pathlib import Path
from threading import Lock
from typing import Any

import requests

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CACHE_DIR = REPO_ROOT / "data" / "asset_cache"
ASSETS_RAW_DIR = REPO_ROOT / "data" / "assets_raw"

DEFAULT_TIMEOUT = 30
MAX_RETRIES = 3
USER_AGENT = "Mozilla/5.0 GameStudioAI-asset-indexer/0.1"


class RateLimiter:
    """Per-library token bucket. Thread-safe (Lock-guarded), since
    scrapers may parallelize. Refills at rate_per_minute tokens/min."""

    def __init__(self, rate_per_minute: int):
        self.rate = max(1, rate_per_minute)
        self.interval_s = 60.0 / self.rate
        self._next_allowed = 0.0
        self._lock = Lock()

    def wait(self) -> None:
        with self._lock:
            now = time.monotonic()
            wait_for = self._next_allowed - now
            if wait_for > 0:
                time.sleep(wait_for)
            self._next_allowed = max(now, self._next_allowed) + self.interval_s


def _cache_path(library_id: str, url: str, extra_key: str = "") -> Path:
    h = hashlib.sha1((url + "|" + extra_key).encode("utf-8")).hexdigest()[:16]
    return CACHE_DIR / library_id / f"{h}.json"


def cached_get_json(
    library_id: str,
    url: str,
    limiter: RateLimiter,
    log: logging.Logger,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    cache_ttl_days: int = 14,
) -> dict[str, Any] | None:
    """GET JSON with on-disk cache + rate limit + retry.

    Returns parsed JSON dict, or None on permanent failure (logged).
    Cache hits skip rate limiting entirely.
    """
    extra = json.dumps(params or {}, sort_keys=True)
    cache_file = _cache_path(library_id, url, extra)
    if cache_file.exists():
        age_s = time.time() - cache_file.stat().st_mtime
        if age_s < cache_ttl_days * 86400:
            try:
                return json.loads(cache_file.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                log.warning("Corrupt cache %s, refetching", cache_file)

    final_headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    if headers:
        final_headers.update(headers)

    for attempt in range(1, MAX_RETRIES + 1):
        limiter.wait()
        try:
            r = requests.get(url, params=params, headers=final_headers,
                             timeout=DEFAULT_TIMEOUT)
        except requests.RequestException as exc:
            log.warning("HTTP error (try %d/%d) %s: %s",
                        attempt, MAX_RETRIES, url, exc)
            time.sleep(2 ** attempt)
            continue
        if r.status_code == 429:
            backoff = int(r.headers.get("Retry-After", "10"))
            log.warning("429 on %s, sleeping %ds", url, backoff)
            time.sleep(backoff)
            continue
        if r.status_code >= 500:
            log.warning("%d on %s (try %d)", r.status_code, url, attempt)
            time.sleep(2 ** attempt)
            continue
        if not r.ok:
            log.error("Permanent %d on %s: %s",
                      r.status_code, url, r.text[:200])
            return None
        try:
            data = r.json()
        except ValueError:
            log.error("Non-JSON response from %s", url)
            return None
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(json.dumps(data, ensure_ascii=False),
                              encoding="utf-8")
        return data
    log.error("All retries exhausted for %s", url)
    return None


def cached_get_html(
    library_id: str,
    url: str,
    limiter: RateLimiter,
    log: logging.Logger,
    cache_ttl_days: int = 14,
) -> str | None:
    """Same shape as cached_get_json but for HTML pages (scrape libs)."""
    cache_file = _cache_path(library_id, url, "html")
    cache_file = cache_file.with_suffix(".html")
    if cache_file.exists():
        age_s = time.time() - cache_file.stat().st_mtime
        if age_s < cache_ttl_days * 86400:
            try:
                return cache_file.read_text(encoding="utf-8", errors="replace")
            except OSError:
                pass

    for attempt in range(1, MAX_RETRIES + 1):
        limiter.wait()
        try:
            r = requests.get(url, headers={"User-Agent": USER_AGENT},
                             timeout=DEFAULT_TIMEOUT)
        except requests.RequestException as exc:
            log.warning("HTTP error (try %d/%d) %s: %s",
                        attempt, MAX_RETRIES, url, exc)
            time.sleep(2 ** attempt)
            continue
        if r.status_code == 429:
            time.sleep(int(r.headers.get("Retry-After", "10")))
            continue
        if not r.ok:
            log.error("Permanent %d on %s", r.status_code, url)
            return None
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        cache_file.write_text(r.text, encoding="utf-8")
        return r.text
    return None


def append_jsonl(path: Path, record: dict[str, Any]) -> None:
    """Append one JSON object as a line. Creates parent dirs."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")


def load_jsonl(path: Path) -> list[dict[str, Any]]:
    """Read JSONL into a list (small enough for assets manifests)."""
    if not path.exists():
        return []
    out: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                out.append(json.loads(line))
    return out


def existing_source_urls(path: Path) -> set[str]:
    """Idempotent re-run helper: skip URLs already in the manifest."""
    return {r.get("source_url") for r in load_jsonl(path)
            if r.get("source_url")}
