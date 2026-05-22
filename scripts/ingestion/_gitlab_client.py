"""GitLab REST API client for Ren'Py harvest (Fase 1bis).

Mirror of `_scrape_helpers.GitHubClient` but for gitlab.com. The pipeline
saturated GitHub for Ren'Py (only 8 repos cloned, mostly toolkit-only);
GitLab hosts a parallel ecosystem of Ren'Py projects under
`gitlab.com/explore/projects/topics/renpy` and `topic:visual-novel`.

Endpoints used (REST v4):
  - GET /projects?topic=<topic>&simple=true&per_page=100&page=N
  - GET /projects/{id}/repository/tree?ref=<branch>&recursive=true&per_page=100&page=N
  - GET /projects/{id}/repository/files/LICENSE/raw?ref=<branch>

Auth: optional. With a Personal Access Token (env var `GITLAB_TOKEN`,
scope `read_api`) the rate limit is 2000 req/10min. Anonymous is 400/10min.

The client is intentionally narrow: it lists projects for a topic, checks
they have .rpy in the tree, reads their LICENSE, and returns manifest-shaped
records ready to be appended by the orchestrator (01b_scrape_renpy_alt.py).
"""
from __future__ import annotations

import logging
import os
import re
import time
from typing import Any

import requests

GITLAB_BASE = "https://gitlab.com/api/v4"
PER_PAGE = 100
PAGE_CAP = 10  # safety: at most 1000 projects per topic, plenty for Ren'Py
REQUEST_TIMEOUT = 30
SLEEP_AFTER_CALL = 1.0
RATE_LIMIT_SAFE_FLOOR = 50

# Whitelist (mirrors taxonomy.ALLOWED_LICENSES + permissive variants we
# accept after reading the LICENSE file body).
LICENSE_ALLOW = {
    "mit", "apache-2.0", "bsd-2-clause", "bsd-3-clause",
    "cc0-1.0", "isc", "zlib", "unlicense",
}
LICENSE_DENY = {"gpl-2.0", "gpl-3.0", "agpl-3.0", "lgpl-2.1", "lgpl-3.0"}


def detect_license_from_body(text: str) -> str:
    """Pattern-match an SPDX-like id from a raw LICENSE file body.

    Aligned with `_filter_rules.LICENSE_BODY_MARKERS` so a Ren'Py project
    on GitLab gets the same label it would get from `02_filter` on a
    cloned repo. Falls back to 'unknown' on miss.
    """
    lo = text.lower()
    if "mit license" in lo or "permission is hereby granted, free of charge" in lo:
        return "MIT"
    if "apache license" in lo and "version 2.0" in lo:
        return "Apache-2.0"
    if ("redistribution and use in source and binary forms" in lo
            and "neither the name of" in lo):
        return "BSD-3-Clause"
    if "redistribution and use in source and binary forms" in lo:
        return "BSD-2-Clause"
    if "cc0 1.0" in lo or "public domain dedication" in lo:
        return "CC0-1.0"
    if "this is free and unencumbered software released into the public domain" in lo:
        return "Unlicense"
    if "isc license" in lo or ("permission to use, copy, modify" in lo
                                and "isc" in lo):
        return "ISC"
    if "zlib license" in lo or "altered source versions must be plainly marked" in lo:
        return "Zlib"
    if "gnu affero general public license" in lo:
        return "AGPL-3.0"
    if "lesser general public license" in lo:
        return "LGPL-3.0"
    if "gnu general public license" in lo:
        return "GPL-3.0"
    return "unknown"


class GitLabClient:
    """Thin GitLab REST client with rate-limit-aware retries.

    Usage:
        client = GitLabClient(log=my_logger)
        projects = client.list_projects_for_topic("renpy")
        for p in projects:
            tree = client.has_extension(p["id"], p["default_branch"], ".rpy")
    """

    def __init__(self, log: logging.Logger | None = None) -> None:
        self.session = requests.Session()
        token = os.environ.get("GITLAB_TOKEN", "")
        if token:
            self.session.headers["PRIVATE-TOKEN"] = token
            self.authed = True
        else:
            self.authed = False
        self.session.headers["User-Agent"] = "GameStudioAI-harvester/0.1 (Ren'Py harvest)"
        self.log = log or logging.getLogger("gitlab")

    def _handle_rate_limit(self, resp: requests.Response) -> None:
        if resp.status_code == 429:
            reset = resp.headers.get("RateLimit-Reset")
            wait = (int(reset) - int(time.time())) if reset else 60
            wait = max(wait, 30)
            self.log.warning("GitLab 429 rate limited, sleeping %ds", wait)
            time.sleep(wait)
            return
        remaining = resp.headers.get("RateLimit-Remaining")
        if remaining is not None and remaining.isdigit() \
                and int(remaining) < RATE_LIMIT_SAFE_FLOOR:
            reset = resp.headers.get("RateLimit-Reset")
            wait = (int(reset) - int(time.time())) if reset else 30
            wait = max(wait, 5)
            self.log.info("GitLab rate budget low (%s), sleeping %ds",
                          remaining, wait)
            time.sleep(wait)

    def _get(self, path: str, params: dict[str, Any] | None = None,
             retries: int = 3) -> requests.Response | None:
        url = f"{GITLAB_BASE}{path}"
        for attempt in range(retries):
            try:
                resp = self.session.get(url, params=params,
                                        timeout=REQUEST_TIMEOUT)
            except requests.RequestException as exc:
                self.log.warning("GitLab transport error %s on %s, retry %d/%d",
                                 exc, url, attempt + 1, retries)
                time.sleep(2 ** attempt)
                continue
            if resp.status_code in (500, 502, 503, 504):
                self.log.warning("GitLab %d on %s, retry %d/%d",
                                 resp.status_code, url, attempt + 1, retries)
                time.sleep(2 ** attempt)
                continue
            self._handle_rate_limit(resp)
            time.sleep(SLEEP_AFTER_CALL)
            return resp
        return None

    def list_projects_for_topic(self, topic: str) -> list[dict[str, Any]]:
        """Enumerate every project tagged with `topic` (paginated)."""
        out: list[dict[str, Any]] = []
        for page in range(1, PAGE_CAP + 1):
            resp = self._get("/projects", params={
                "topic": topic, "simple": False,
                "per_page": PER_PAGE, "page": page,
                "order_by": "star_count", "sort": "desc",
                "archived": "false",
            })
            if resp is None or resp.status_code >= 400:
                self.log.warning("GitLab projects?topic=%s page=%d failed", topic, page)
                break
            chunk = resp.json()
            if not chunk:
                break
            out.extend(chunk)
            total_pages = resp.headers.get("X-Total-Pages")
            if total_pages and total_pages.isdigit() \
                    and page >= int(total_pages):
                break
        self.log.info("GitLab topic=%s returned %d projects", topic, len(out))
        return out

    def has_extension(self, project_id: int, branch: str,
                      ext: str) -> bool:
        """Return True if the project tree (recursive) contains at least
        one file ending in `ext`. Bounded by PAGE_CAP pages of tree."""
        ext_lo = ext.lower()
        for page in range(1, PAGE_CAP + 1):
            resp = self._get(
                f"/projects/{project_id}/repository/tree",
                params={"ref": branch, "recursive": "true",
                        "per_page": PER_PAGE, "page": page})
            if resp is None or resp.status_code >= 400:
                return False
            entries = resp.json()
            if not entries:
                return False
            for e in entries:
                if e.get("type") == "blob" \
                        and (e.get("path") or "").lower().endswith(ext_lo):
                    return True
            total_pages = resp.headers.get("X-Total-Pages")
            if total_pages and total_pages.isdigit() \
                    and page >= int(total_pages):
                break
        return False

    def fetch_license(self, project_id: int, branch: str) -> str:
        """Read LICENSE / LICENSE.txt / LICENSE.md from the repo root and
        pattern-match its body. 'unknown' if no file is present."""
        for candidate in ("LICENSE", "LICENSE.txt", "LICENSE.md",
                          "COPYING", "COPYING.txt"):
            resp = self._get(
                f"/projects/{project_id}/repository/files/{candidate}/raw",
                params={"ref": branch})
            if resp is None:
                continue
            if resp.status_code == 200 and resp.text:
                return detect_license_from_body(resp.text)
            if resp.status_code == 404:
                continue
            # Other status: treat as unavailable, try next candidate.
        return "unknown"


_GITLAB_NAMESPACE_RE = re.compile(r"^https?://gitlab\.com/(.+?)/?$")


def entry_from_gitlab_project(proj: dict[str, Any], license_id: str,
                              engine: str) -> dict[str, Any]:
    """Shape a GitLab project dict into a manifest entry compatible with
    the existing pipeline. Mirrors `_scrape_helpers.entry_from_repo`."""
    web_url = proj.get("web_url") or ""
    namespace = ""
    m = _GITLAB_NAMESPACE_RE.match(web_url)
    if m:
        namespace = m.group(1)
    pushed = (proj.get("last_activity_at") or "")[:10]
    return {
        "url": web_url,
        "engine": engine,
        "license": license_id,
        "license_source": "license_body" if license_id != "unknown" else None,
        "default_branch": proj.get("default_branch") or "main",
        "language": "Python",  # GitLab does not detect Ren'Py separately
        "stars": int(proj.get("star_count") or 0),
        "size_kb": 0,  # GitLab doesn't return size on listing
        "pushed_at": pushed,
        "topics": list(proj.get("topics") or []),
        "source": "gitlab",
        "owner": namespace.split("/")[0] if namespace else "",
        "clone_url": proj.get("http_url_to_repo") or f"{web_url}.git",
        "project_id": proj.get("id"),
        "bypass_filters": True,  # license verified out-of-band
        "clone_status": "pending",
    }
