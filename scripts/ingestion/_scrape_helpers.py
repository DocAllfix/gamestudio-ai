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
from scripts.ingestion._sources import ENGINE_LANGUAGES, LICENSE_BYPASS_ORGS


# Topic aliases for the language=null fallback. When GitHub does not report a
# language for a repo, we check whether any of these topic strings appear in
# repo.topics — they are strong evidence the repo belongs to that engine.
ENGINE_TOPIC_ALIASES: dict[str, set[str]] = {
    "godot":    {"godot", "godot-engine", "godot4", "godot-4", "gdscript"},
    "phaser":   {"phaser", "phaser3", "phaserjs", "phaser-3"},
    "renpy":    {"renpy", "ren-py", "visual-novel"},
    "defold":   {"defold", "defold-engine"},
    "monogame": {"monogame", "xna", "xna-framework"},
    "love2d":   {"love2d", "love-2d", "love", "lua-game"},
    "threejs":  {"threejs", "three-js", "three", "webgl-game"},
    "stride":   {"stride3d", "stride-engine", "xenko"},
}


GITHUB_API = "https://api.github.com"
SEARCH_PER_PAGE = 30
SEARCH_MAX_RESULTS_PER_QUERY = 120
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
        for page in (1, 2, 3, 4):
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

    def list_org_repos(self, org: str) -> list[dict[str, Any]]:
        """List all repos under a GitHub organization (or personal account).
        Paginates up to 3 pages of 100 (max 300 repos per org). Falls back to
        /users/{org}/repos when /orgs/{org}/repos returns 404 (personal accounts
        like rxi, mrdoob).
        """
        results: list[dict[str, Any]] = []
        for page in (1, 2, 3):
            params = {"per_page": 100, "page": page,
                      "type": "public", "sort": "updated"}
            try:
                resp = self.session.get(
                    f"{GITHUB_API}/orgs/{org}/repos", params=params, timeout=30,
                )
            except requests.RequestException as exc:
                self.log.error("Org list failed: %s err=%s", org, exc)
                break
            if resp.status_code == 404:
                try:
                    resp = self.session.get(
                        f"{GITHUB_API}/users/{org}/repos",
                        params={"per_page": 100, "page": page, "sort": "updated"},
                        timeout=30,
                    )
                except requests.RequestException as exc:
                    self.log.error("User list failed: %s err=%s", org, exc)
                    break
            time.sleep(SLEEP_AFTER_API_CALL)
            if resp.status_code != 200:
                self.log.warning("Org/user list HTTP %s: %s", resp.status_code, org)
                break
            items = resp.json()
            if not isinstance(items, list):
                break
            results.extend(items)
            if len(items) < 100:
                break
        return results

    def search_topic(self, topic: str, engine: str) -> list[dict[str, Any]]:
        """Search GitHub for repos tagged with a given topic, scoped to the
        engine's stars/pushed/size filters. Returns up to SEARCH_MAX_RESULTS_PER_QUERY.
        """
        q = (
            f"topic:{topic} stars:>={MIN_STARS} "
            f"pushed:>={PUSHED_FILTERS[engine]} "
            f"size:<={MAX_SIZE_KB}"
        )
        return self.search_repos(q)

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
    if lang:
        return lang in ENGINE_LANGUAGES.get(engine, set())
    topics = {t.lower() for t in (repo.get("topics") or [])}
    if engine in topics:
        return True
    return bool(topics & ENGINE_TOPIC_ALIASES.get(engine, set()))


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
        owner = ((repo.get("owner") or {}).get("login") or "").lower()
        bypass = {o.lower() for o in LICENSE_BYPASS_ORGS}
        if owner not in bypass:
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


def expand_subdirs(
    entry: dict[str, Any],
    repo_dir: Path,
    pattern: str,
    log: logging.Logger,
) -> list[dict[str, Any]]:
    """Walk an already-cloned mono-repo and produce one synthetic manifest
    entry per matching sub-directory. Each entry inherits the parent's
    metadata and adds `subdir_path` / `parent_url` / `source="subdir"` /
    `clone_status="via_parent"`. The parent repo is cloned once; downstream
    parsers will `cd parent_clone / subdir_path` when `subdir_path` is set.
    """
    out: list[dict[str, Any]] = []
    if not repo_dir.exists():
        log.warning("Cannot expand subdirs: parent not cloned at %s", repo_dir)
        return out
    # Pattern modes:
    #  - ends with "/"      -> directory-mode: each matching dir is ONE entry
    #    (groups many files under one project root; e.g. phaser per category)
    #  - ends with ":file"  -> file-mode: each matching FILE is one entry
    #    (e.g. three.js each examples/*.html is a standalone scene)
    #  - otherwise          -> anchor-mode: match.parent is the project root,
    #    deduped (e.g. **/project.godot -> the dir containing it)
    if pattern.endswith(":file"):
        mode, glob_pat = "file", pattern[: -len(":file")]
    elif pattern.endswith("/"):
        mode, glob_pat = "dir", pattern.rstrip("/")
    else:
        mode, glob_pat = "anchor", pattern

    seen_rel: set[str] = set()
    for match in sorted(repo_dir.glob(glob_pat)):
        if mode == "dir":
            if not match.is_dir():
                continue
            target = match
        elif mode == "file":
            if not match.is_file():
                continue
            target = match
        else:
            target = match.parent if match.is_file() else match
        try:
            rel = target.relative_to(repo_dir).as_posix()
        except ValueError:
            continue
        if not rel or rel == "." or rel in seen_rel:
            continue
        seen_rel.add(rel)
        synth = dict(entry)
        synth["subdir_path"] = rel
        synth["parent_url"] = entry.get("url")
        synth["source"] = "subdir"
        synth["clone_status"] = "via_parent"
        out.append(synth)
    return out


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
