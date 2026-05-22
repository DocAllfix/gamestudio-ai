"""Itch.io HTML scraper for Ren'Py harvest (Fase 1bis).

Stateless `requests + bs4` scraper. We scoped down to what the public
HTML actually exposes (verified empirically): listing pages, product
metadata (title + license + downloads names), and any external repo URL
(github.com / gitlab.com / codeberg.org / bitbucket.org) linked in the
product description. The download files themselves are loaded via
authenticated JS on itch.io, so direct zip retrieval is OUT OF SCOPE
for this pilot. The orchestrator either:

  - clones the external repo when present (e.g. jsfehler/renpy-encyclopaedia
    links to its GitHub), or
  - emits a manual-download report listing tool URL + filename + size so
    the operator can drop the zip into data/repos_raw/renpy/itch__... by
    hand for the 5-10 high-value tools (the volume is tiny by design).

This trade-off is documented in the plan; revisit with Playwright if and
when Itch becomes a primary source for >50 projects.
"""
from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any

import requests
from bs4 import BeautifulSoup

UA = "GameStudioAI-harvester/0.1 (Ren'Py harvest pilot)"
DEFAULT_TIMEOUT = 30
SLEEP_AFTER_CALL = 1.5  # conservative, no published rate limit
BACKOFF_429 = 30

EXTERNAL_HOSTS = ("github.com", "gitlab.com", "codeberg.org", "bitbucket.org")

# Whitelist aligned with taxonomy.ALLOWED_LICENSES (lowercased for match).
LICENSE_NAME_MAP = {
    "creative commons zero v1.0 universal": "CC0-1.0",
    "creative commons zero": "CC0-1.0",
    "cc0": "CC0-1.0",
    "mit license": "MIT",
    "mit": "MIT",
    "apache license 2.0": "Apache-2.0",
    "apache 2.0": "Apache-2.0",
    "apache": "Apache-2.0",
    "bsd 3-clause": "BSD-3-Clause",
    "bsd 2-clause": "BSD-2-Clause",
    "unlicense": "Unlicense",
    "isc": "ISC",
    "zlib": "Zlib",
    "gnu general public license v3.0 (gpl)": "GPL-3.0",
    "gnu general public license v3.0": "GPL-3.0",
    "gpl v3": "GPL-3.0",
    "gpl-3.0": "GPL-3.0",
    "gpl v2": "GPL-2.0",
    "agpl-3.0": "AGPL-3.0",
}


@dataclass
class ItchDownload:
    filename: str
    size_text: str


@dataclass
class ItchProduct:
    url: str
    title: str | None
    author: str | None
    license: str  # SPDX-like or "unknown"
    license_raw: str | None  # text as scraped, for audit
    downloads: list[ItchDownload]
    external_repos: list[str]  # github/gitlab/codeberg/bitbucket URLs
    item_type: str  # "tool" or "game" (heuristic)
    raw_html_len: int

    def to_manifest_entry(self, engine: str) -> dict[str, Any]:
        """Convert into a manifest entry compatible with 02_filter.

        For Itch entries with an external repo, we point the manifest at
        the external clone URL (so existing clone_phase works as-is).
        Pure-Itch entries (no external repo) carry no clone_url and the
        orchestrator emits a manual-download line for them.
        """
        clone_url = self.external_repos[0] if self.external_repos else None
        primary_repo = clone_url or self.url
        return {
            "url": primary_repo,
            "itch_page": self.url,
            "engine": engine,
            "license": self.license,
            "license_source": "itch_page" if self.license != "unknown" else None,
            "default_branch": "main",
            "language": "Python" if engine == "renpy" else None,
            "stars": 0,
            "size_kb": 0,
            "pushed_at": "",
            "topics": [],
            "source": "itch" if not clone_url else "itch+ext",
            "owner": self.author or "",
            "clone_url": clone_url,
            "needs_manual_download": clone_url is None,
            "downloads_seen": [d.filename for d in self.downloads],
            "bypass_filters": True,  # license verified out-of-band
            "clone_status": "pending" if clone_url else "manual",
        }


class ItchScraper:
    """Minimal session-based scraper for itch.io list + product pages."""

    def __init__(self, log: logging.Logger | None = None) -> None:
        self.session = requests.Session()
        self.session.headers["User-Agent"] = UA
        self.log = log or logging.getLogger("itch")

    def _get(self, url: str) -> str | None:
        try:
            r = self.session.get(url, timeout=DEFAULT_TIMEOUT)
        except requests.RequestException as exc:
            self.log.warning("Itch transport %s: %s", url, exc)
            return None
        if r.status_code == 429:
            self.log.warning("Itch 429 on %s, sleeping %ds", url, BACKOFF_429)
            time.sleep(BACKOFF_429)
            r = self.session.get(url, timeout=DEFAULT_TIMEOUT)
        if r.status_code != 200:
            self.log.warning("Itch %d on %s", r.status_code, url)
            return None
        time.sleep(SLEEP_AFTER_CALL)
        return r.text

    def crawl_list(self, list_url: str, max_pages: int = 10) -> list[str]:
        """Enumerate product URLs from a tag/collection page (paginated)."""
        found: list[str] = []
        seen: set[str] = set()
        for page in range(1, max_pages + 1):
            url = list_url if page == 1 else f"{list_url}?page={page}"
            html = self._get(url)
            if not html:
                break
            soup = BeautifulSoup(html, "html.parser")
            cards = soup.select("div.game_cell a.title")
            if not cards:
                break
            page_count = 0
            for a in cards:
                href = (a.get("href") or "").strip()
                if not href or href in seen:
                    continue
                seen.add(href)
                found.append(href)
                page_count += 1
            self.log.info("Itch list page %d: %d new products (%s)",
                          page, page_count, list_url)
            if page_count == 0:
                break
        return found

    def parse_product(self, product_url: str) -> ItchProduct | None:
        html = self._get(product_url)
        if not html:
            return None
        soup = BeautifulSoup(html, "html.parser")

        title_el = soup.select_one("h1.game_title")
        title = title_el.get_text(strip=True) if title_el else None

        panel = soup.select_one(".game_info_panel_widget")
        panel_text = panel.get_text(" ", strip=True) if panel else ""

        author = _extract_field(panel_text, "Author")
        license_raw = (_extract_field(panel_text, "Asset license")
                       or _extract_field(panel_text, "Code license")
                       or _extract_field(panel_text, "License"))
        license_id = _normalise_license(license_raw)

        downloads: list[ItchDownload] = []
        for d in soup.select("div.upload"):
            name_el = d.select_one(".name")
            size_el = d.select_one(".file_size")
            if name_el:
                downloads.append(ItchDownload(
                    filename=name_el.get_text(strip=True),
                    size_text=size_el.get_text(strip=True) if size_el else "",
                ))

        external: list[str] = []
        external_seen: set[str] = set()
        for a in soup.select("a[href]"):
            href = (a.get("href") or "").split("?")[0].split("#")[0]
            for host in EXTERNAL_HOSTS:
                if f"://{host}" in href and "/itch.io" not in href:
                    # Truncate to the repo root to avoid duplicating
                    # per-file blob links (github.com/owner/repo/blob/...).
                    repo_root = _truncate_to_repo_root(href, host)
                    if repo_root and repo_root not in external_seen:
                        external_seen.add(repo_root)
                        external.append(repo_root)

        # Heuristic: tools/frameworks usually carry "framework"/"plugin"/
        # "system"/"tool" in title; otherwise treat as game.
        item_type = "tool"
        if title:
            tl = title.lower()
            if not any(k in tl for k in (
                    "framework", "plugin", "system", "tool",
                    "viewer", "navigator", "displayable", "viewport",
                    "minigame", "framework", "encyclopedia",
                    "encyclopaedia", "flowchart", "color", "sliders")):
                item_type = "game"

        return ItchProduct(
            url=product_url, title=title, author=author,
            license=license_id, license_raw=license_raw,
            downloads=downloads, external_repos=external,
            item_type=item_type, raw_html_len=len(html),
        )


_FIELD_TERMINATORS = (
    "Status", "Category", "Rating", "Author", "Genre", "Tags",
    "More information", "Languages", "Asset license", "Code license",
    "License", "Average session", "Inputs", "Accessibility",
    "Made with", "Published",
)


def _extract_field(panel_text: str, label: str) -> str | None:
    """Extract a label's value from the flat sidebar text.

    Itch renders the sidebar as 'Status Released Category Tool ... Author
    foo Genre Visual Novel Tags x, y, z'. We pull the substring after the
    label up to the next known label (or end of string)."""
    if label not in panel_text:
        return None
    rest = panel_text.split(label, 1)[1].strip()
    cut = len(rest)
    for term in _FIELD_TERMINATORS:
        if term == label:
            continue
        idx = rest.find(" " + term + " ")
        if 0 < idx < cut:
            cut = idx
    return rest[:cut].strip() or None


def _normalise_license(raw: str | None) -> str:
    """Map free-form Itch license text to an SPDX-like id, or 'unknown'."""
    if not raw:
        return "unknown"
    lo = raw.lower().strip()
    for needle, spdx in LICENSE_NAME_MAP.items():
        if needle in lo:
            return spdx
    return "unknown"


def _truncate_to_repo_root(href: str, host: str) -> str | None:
    """Trim github.com/owner/repo/blob/... down to github.com/owner/repo."""
    m = re.match(rf"https?://{re.escape(host)}/([^/]+)/([^/]+)", href)
    if not m:
        return None
    owner, repo = m.group(1), m.group(2)
    repo = repo.split(".git")[0]
    return f"https://{host}/{owner}/{repo}"
