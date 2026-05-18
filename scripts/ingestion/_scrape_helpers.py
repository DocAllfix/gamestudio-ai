"""Helpers for 01_scrape.py: GitHub client, filters, manifest, cloning.

Extracted to keep 01_scrape.py under the 400-line file budget (CLAUDE.md).
"""
from __future__ import annotations

import json
import logging
import re
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests

from scripts.shared.taxonomy import ALLOWED_LICENSES, PUSHED_FILTERS
from scripts.ingestion._sources import ENGINE_LANGUAGES


GITHUB_API = "https://api.github.com"
SEARCH_PER_PAGE = 30
SEARCH_MAX_RESULTS_PER_QUERY = 60
MAX_SIZE_KB = 100_000
MIN_STARS = 20

SLEEP_AFTER_API_CALL = 2.0
SLEEP_AFTER_CLONE = 0.5

GITHUB_URL_PATTERN = re.compile(
    r"https?://github\.com/([A-Za-z0-9][A-Za-z0-9._-]*?)/([A-Za-z0-9][A-Za-z0-9._-]*?)"
    r"(?:\.git|/|#|\?|$)",
    re.IGNORECASE,
)

AWESOME_SKIP_OWNERS = {"sponsors", "topics", "marketplace", "features", "about"}
AWESOME_SKIP_NAMES = {
    "awesome-godot", "awesome-monogame", "awesome-love2d",
    "awesome-phaser3", "awesome-renpy", "awesome-defold",
}


class GitHubClient:
    """Thin wrapper around GitHub's REST API with backoff and a single auth header."""

    def __init__(self, token: str, log: logging.Logger) -> None:
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        })
        self.log = log

    def search_repos(self, query: str) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        for page in (1, 2):
            params = {
                "q": query,
                "sort": "stars",
                "order": "desc",
                "per_page": SEARCH_PER_PAGE,
                "page": page,
            }
            try:
                resp = self.session.get(f"{GITHUB_API}/search/repositories",
                                        params=params, timeout=30)
            except requests.RequestException as exc:
                self.log.error("Search request failed: query=%r err=%s", query, exc)
                break

            if resp.status_code == 403 and "rate limit" in resp.text.lower():
                reset = int(resp.headers.get("X-RateLimit-Reset", "0"))
                wait = max(reset - int(time.time()), 5)
                self.log.warning("Rate-limited on search, sleeping %ds", wait)
                time.sleep(wait + 1)
                continue
            if resp.status_code != 200:
                self.log.error("Search HTTP %s: query=%r body=%s",
                               resp.status_code, query, resp.text[:300])
                break

            items = resp.json().get("items", [])
            results.extend(items)
            time.sleep(SLEEP_AFTER_API_CALL)
            if len(items) < SEARCH_PER_PAGE:
                break

        return results[:SEARCH_MAX_RESULTS_PER_QUERY]

    def get_repo(self, owner: str, name: str) -> dict[str, Any] | None:
        try:
            resp = self.session.get(f"{GITHUB_API}/repos/{owner}/{name}", timeout=30)
        except requests.RequestException as exc:
            self.log.error("Repo fetch failed: %s/%s err=%s", owner, name, exc)
            return None
        time.sleep(SLEEP_AFTER_API_CALL)
        if resp.status_code != 200:
            self.log.warning("Repo fetch HTTP %s: %s/%s", resp.status_code, owner, name)
            return None
        return resp.json()


def is_valid_license(repo: dict[str, Any]) -> bool:
    lic = (repo.get("license") or {}).get("spdx_id")
    return bool(lic) and lic in ALLOWED_LICENSES


def matches_engine_language(repo: dict[str, Any], engine: str) -> bool:
    lang = (repo.get("language") or "").lower()
    if not lang:
        return False
    return lang in ENGINE_LANGUAGES.get(engine, set())


def passes_basic_filters(repo: dict[str, Any], engine: str) -> tuple[bool, str]:
    if repo.get("fork"):
        return False, "fork"
    if repo.get("archived"):
        return False, "archived"
    if repo.get("private"):
        return False, "private"
    if (repo.get("stargazers_count") or 0) < MIN_STARS:
        return False, f"stars<{MIN_STARS}"
    if (repo.get("size") or 0) > MAX_SIZE_KB:
        return False, f"size>{MAX_SIZE_KB}KB"
    if (repo.get("pushed_at") or "")[:10] < PUSHED_FILTERS[engine]:
        return False, f"pushed<{PUSHED_FILTERS[engine]}"
    if not is_valid_license(repo):
        spdx = (repo.get("license") or {}).get("spdx_id")
        return False, f"license_not_in_whitelist({spdx})"
    if not matches_engine_language(repo, engine):
        return False, f"language={repo.get('language')!r}_not_engine"
    return True, "ok"


def scrape_awesome_list(url: str, log: logging.Logger) -> set[tuple[str, str]]:
    pairs: set[tuple[str, str]] = set()
    try:
        resp = requests.get(url, timeout=30)
    except requests.RequestException as exc:
        log.error("Awesome fetch failed: url=%s err=%s", url, exc)
        return pairs
    if resp.status_code != 200:
        log.warning("Awesome fetch HTTP %s: %s", resp.status_code, url)
        return pairs

    for match in GITHUB_URL_PATTERN.finditer(resp.text):
        owner, name = match.group(1), match.group(2)
        if owner.lower() in AWESOME_SKIP_OWNERS:
            continue
        if name.lower() in AWESOME_SKIP_NAMES:
            continue
        pairs.add((owner, name))
    return pairs


def load_manifest(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    try:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return data
    except (json.JSONDecodeError, OSError) as exc:
        logging.getLogger("scrape").error("Manifest load failed: %s", exc)
    return []


def save_manifest(path: Path, entries: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, sort_keys=True, ensure_ascii=False)


def entry_from_repo(repo: dict[str, Any], engine: str) -> dict[str, Any]:
    return {
        "url": repo.get("html_url"),
        "engine": engine,
        "stars": repo.get("stargazers_count") or 0,
        "license": (repo.get("license") or {}).get("spdx_id"),
        "size_kb": repo.get("size") or 0,
        "topics": repo.get("topics") or [],
        "pushed_at": repo.get("pushed_at"),
        "language": repo.get("language"),
        "default_branch": repo.get("default_branch"),
        "clone_status": "pending",
        "scraped_at": datetime.now(timezone.utc).isoformat(),
    }


def safe_repo_name(url: str) -> str:
    slug = url.rstrip("/").split("github.com/", 1)[-1].replace("/", "__")
    return re.sub(r"[^A-Za-z0-9._-]+", "_", slug)


def clone_repo(url: str, target_dir: Path, log: logging.Logger) -> str:
    if target_dir.exists():
        log.info("Already cloned: %s", target_dir.name)
        return "already_cloned"
    target_dir.parent.mkdir(parents=True, exist_ok=True)
    try:
        result = subprocess.run(
            ["git", "clone", "--depth", "1", "--quiet", url, str(target_dir)],
            capture_output=True, text=True, timeout=180,
        )
    except subprocess.TimeoutExpired:
        log.error("Clone timeout: %s", url)
        return "failed_timeout"
    except (OSError, subprocess.SubprocessError) as exc:
        log.error("Clone exception: url=%s err=%s", url, exc)
        return "failed_exception"
    time.sleep(SLEEP_AFTER_CLONE)
    if result.returncode != 0:
        log.error("Clone failed: url=%s rc=%s stderr=%s",
                  url, result.returncode, result.stderr[:200])
        return "failed"
    return "cloned"
