"""License resolution helpers for 12_license_audit.py (Fase RAG-1).

Pure, side-effect-light functions that take a repo URL (or a local clone
path) and return a resolved SPDX-ish license id, or one of two sentinels:

    FORBIDDEN_PREFIX + "<id>"   the repo is copyleft/non-commercial -> quarantine
    None                        could not resolve -> quarantine as unresolvable

Resolution order, cheapest-and-most-trustworthy first:
    1. local clone LICENSE body  (offline, deterministic string match)
    2. GitHub Licenses API       (authoritative spdx_id, github.com only)
    3. raw LICENSE over HTTP     (gitlab.com and any other host)

Why deterministic, not LLM: a license is a legal fact, not a judgement
call. We match the canonical body text against the same marker tables the
ingestion filter already trusts (scripts/ingestion/_filter_rules.py), so the
audit and the filter can never disagree.
"""
from __future__ import annotations

import base64
import json
import logging
import re
from pathlib import Path
from typing import Optional

import requests

from scripts.ingestion._filter_rules import (
    FORBIDDEN_LICENSE_MARKERS,
    LICENSE_BODY_MARKERS,
    LICENSE_FILENAMES,
)
from scripts.ingestion._scrape_helpers import safe_repo_name

FORBIDDEN_PREFIX = "forbidden:"

# GitHub spdx_id values mapped onto the allowlist spelling used in the KB.
# "NOASSERTION" and "" are GitHub's way of saying "couldn't classify" — they
# are NOT a resolution, so they are intentionally absent here and fall through.
_GITHUB_SPDX_MAP: dict[str, str] = {
    "MIT": "MIT",
    "Apache-2.0": "Apache-2.0",
    "BSD-2-Clause": "BSD-2-Clause",
    "BSD-3-Clause": "BSD-3-Clause",
    "Unlicense": "Unlicense",
    "ISC": "ISC",
    "Zlib": "Zlib",
    "CC0-1.0": "CC0-1.0",
    "0BSD": "BSD-2-Clause",
    "MIT-0": "MIT",
}

# spdx_id values GitHub returns for copyleft/non-commercial licenses.
_GITHUB_FORBIDDEN: dict[str, str] = {
    "GPL-2.0": "GPL", "GPL-3.0": "GPL",
    "AGPL-3.0": "AGPL",
    "LGPL-2.1": "LGPL", "LGPL-3.0": "LGPL",
    "CC-BY-SA-4.0": "CC-BY-SA", "CC-BY-NC-4.0": "CC-BY-NC",
}

_GITHUB_API = "https://api.github.com"
_HTTP_TIMEOUT = 15


def canonical_repo_url(source_repo: str) -> str:
    """Strip the `__subproject` suffix the parser appends to mono-repo chunks.

    e.g. ``.../godot-demo-projects__3d_platformer`` -> ``.../godot-demo-projects``
    """
    return source_repo.split("__", 1)[0]


# A LICENSE/COPYING file rarely exceeds this for a single-license project.
# Larger files are almost always bundled-dependency manifests (e.g. LÖVE's
# license.txt lists zlib for LOVE itself then dozens of vendored deps, some
# GPL). Scanning the whole body trips on a buried dependency marker, so we
# only trust the PRIMARY declaration in the opening window.
_PRIMARY_WINDOW = 2000


def _classify_body(text: str) -> Optional[str]:
    """Classify a LICENSE body from its PRIMARY (opening) declaration.

    Why only the opening window: multi-project manifests state the project's
    own license at the top, then list vendored dependencies further down.
    A whole-file forbidden-marker scan would wrongly quarantine a zlib project
    because a bundled dep is GPL. We therefore (a) match forbidden markers
    only when they appear inside the primary window, and (b) match permissive
    markers only inside that same window. Returns an allowlist id, a
    ``forbidden:<id>`` sentinel, or None.
    """
    head = text[:_PRIMARY_WINDOW].lower()
    for fid, markers in FORBIDDEN_LICENSE_MARKERS.items():
        if any(m in head for m in markers):
            return f"{FORBIDDEN_PREFIX}{fid}"
    for spdx, markers in LICENSE_BODY_MARKERS.items():
        if all(m in head for m in markers):
            return spdx
    # Single-marker fallback for bodies that only carry one strong phrase.
    for spdx, markers in LICENSE_BODY_MARKERS.items():
        if any(m in head for m in markers):
            return spdx
    return None


def resolve_from_local_clone(source_repo: str, repos_raw: Path,
                             log: logging.Logger) -> Optional[str]:
    """Look for a LICENSE file in the on-disk clone and classify its body.

    Searches every engine subfolder because the audit groups by repo, not by
    engine. Returns an allowlist id, a forbidden sentinel, or None.
    """
    safe = safe_repo_name(canonical_repo_url(source_repo))
    if not repos_raw.is_dir():
        return None
    for engine_dir in repos_raw.iterdir():
        clone = engine_dir / safe
        if not clone.is_dir():
            continue
        for entry in clone.iterdir():
            if entry.is_file() and entry.name.lower() in LICENSE_FILENAMES:
                try:
                    body = entry.read_text(encoding="utf-8", errors="ignore")
                except OSError as exc:
                    log.warning("read fail %s: %s", entry, exc)
                    continue
                result = _classify_body(body)
                if result:
                    log.debug("local clone resolved %s -> %s", safe, result)
                    return result
        return None  # clone exists but no readable/classifiable LICENSE
    return None


def resolve_from_github_api(source_repo: str, token: str,
                            log: logging.Logger) -> Optional[str]:
    """Query GitHub's Licenses API for an authoritative spdx_id.

    github.com only. Returns an allowlist id, a forbidden sentinel, or None
    (repo gone, no license, or NOASSERTION).
    """
    url = canonical_repo_url(source_repo)
    match = re.match(r"https?://github\.com/([^/]+)/([^/]+)", url)
    if not match:
        return None
    owner, repo = match.group(1), match.group(2).removesuffix(".git")
    api = f"{_GITHUB_API}/repos/{owner}/{repo}/license"
    try:
        resp = requests.get(
            api, timeout=_HTTP_TIMEOUT,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            })
    except requests.RequestException as exc:
        log.warning("github api fail %s: %s", api, exc)
        return None
    if resp.status_code == 404:
        log.info("github 404 (no license or repo gone): %s", url)
        return None
    if resp.status_code != 200:
        log.warning("github api %d for %s", resp.status_code, url)
        return None
    spdx = (resp.json().get("license") or {}).get("spdx_id", "")
    if spdx in _GITHUB_FORBIDDEN:
        return f"{FORBIDDEN_PREFIX}{_GITHUB_FORBIDDEN[spdx]}"
    return _GITHUB_SPDX_MAP.get(spdx)  # None for NOASSERTION/unmapped


def normalize_license_string(raw: str) -> Optional[str]:
    """Map a free-form license string (e.g. from package.json) onto our verdict.

    Handles SPDX ids and a few common spellings. Returns an allowlist id, a
    ``forbidden:<id>`` sentinel, or None when the string is empty/unrecognised
    (e.g. "SEE LICENSE IN ...", "UNLICENSED" meaning proprietary in npm).
    """
    s = (raw or "").strip()
    low = s.lower()
    if not s or low in ("unlicensed", "private", "proprietary", "none"):
        return None
    forbidden = {
        "gpl": "GPL", "agpl": "AGPL", "lgpl": "LGPL",
        "cc-by-sa": "CC-BY-SA", "cc-by-nc": "CC-BY-NC", "noncommercial": "CC-BY-NC",
    }
    for needle, fid in forbidden.items():
        if needle in low:
            return f"{FORBIDDEN_PREFIX}{fid}"
    # SPDX id passes straight through the GitHub map (covers MIT/ISC/Apache/etc).
    if s in _GITHUB_SPDX_MAP:
        return _GITHUB_SPDX_MAP[s]
    spellings = {
        "mit": "MIT", "apache-2.0": "Apache-2.0", "apache 2.0": "Apache-2.0",
        "bsd-2-clause": "BSD-2-Clause", "bsd-3-clause": "BSD-3-Clause",
        "bsd": "BSD-3-Clause", "isc": "ISC", "zlib": "Zlib",
        "unlicense": "Unlicense", "cc0-1.0": "CC0-1.0", "cc0": "CC0-1.0",
    }
    return spellings.get(low)


def resolve_from_package_json(source_repo: str, token: str,
                              log: logging.Logger) -> Optional[str]:
    """Read the `license` field of a repo's root package.json (github.com).

    The authoritative fallback for repos with no LICENSE file but a valid
    npm/JS package manifest — common for the official Phaser example/template
    repos, whose source is MIT/ISC even when GitHub's License API 404s.
    Returns an allowlist id, a forbidden sentinel, or None.
    """
    url = canonical_repo_url(source_repo)
    match = re.match(r"https?://github\.com/([^/]+)/([^/]+)", url)
    if not match:
        return None
    owner, repo = match.group(1), match.group(2).removesuffix(".git")
    api = f"{_GITHUB_API}/repos/{owner}/{repo}/contents/package.json"
    try:
        resp = requests.get(
            api, timeout=_HTTP_TIMEOUT,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            })
    except requests.RequestException as exc:
        log.warning("package.json fetch fail %s: %s", api, exc)
        return None
    if resp.status_code != 200:
        return None
    try:
        content = base64.b64decode(resp.json()["content"]).decode(
            "utf-8", errors="ignore")
        license_field = json.loads(content).get("license")
    except (KeyError, ValueError, TypeError) as exc:
        log.debug("package.json parse fail %s: %s", url, exc)
        return None
    if isinstance(license_field, dict):  # legacy {"type": "MIT"} form
        license_field = license_field.get("type", "")
    if not isinstance(license_field, str):
        return None
    result = normalize_license_string(license_field)
    if result:
        log.debug("package.json resolved %s -> %s", url, result)
    return result


def resolve_from_raw_http(source_repo: str,
                          log: logging.Logger) -> Optional[str]:
    """Fetch a raw LICENSE file over HTTP and classify its body.

    Covers gitlab.com (and any non-GitHub host) where we have no API client.
    Tries the common raw paths on the two default branches. Returns an
    allowlist id, a forbidden sentinel, or None.
    """
    url = canonical_repo_url(source_repo).rstrip("/")
    candidates: list[str] = []
    gl = re.match(r"https?://gitlab\.com/(.+)", url)
    if gl:
        slug = gl.group(1)
        for branch in ("main", "master"):
            for fname in ("LICENSE", "LICENSE.txt", "LICENSE.md", "COPYING"):
                candidates.append(
                    f"https://gitlab.com/{slug}/-/raw/{branch}/{fname}")
    else:
        return None  # only gitlab handled here; github goes through the API

    for cand in candidates:
        try:
            resp = requests.get(cand, timeout=_HTTP_TIMEOUT)
        except requests.RequestException as exc:
            log.debug("raw http fail %s: %s", cand, exc)
            continue
        if resp.status_code == 200 and resp.text.strip():
            result = _classify_body(resp.text)
            if result:
                log.debug("raw http resolved %s -> %s", url, result)
                return result
    return None


def is_forbidden(resolution: Optional[str]) -> bool:
    """True when a resolution is the copyleft/non-commercial sentinel."""
    return bool(resolution) and resolution.startswith(FORBIDDEN_PREFIX)


def resolve_license(source_repo: str, repos_raw: Path, token: Optional[str],
                    log: logging.Logger) -> Optional[str]:
    """Resolve a repo's license, most-authoritative source first.

    For github.com the Licenses API is queried first: its spdx_id is
    authoritative and, crucially, correctly reports GPL/AGPL where a local
    body scan can be fooled by a project that vendors GPL dependencies. The
    local clone is the fallback (and the only option offline), then raw HTTP
    for gitlab.com. Returns an allowlist id, a ``forbidden:<id>`` sentinel,
    or None when nothing resolves.
    """
    canon = canonical_repo_url(source_repo)
    is_github = canon.startswith(("https://github.com/", "http://github.com/"))

    if is_github and token:
        gh = resolve_from_github_api(source_repo, token, log)
        if gh is not None:
            return gh

    local = resolve_from_local_clone(source_repo, repos_raw, log)
    if local is not None:
        return local

    # No LICENSE file but a JS manifest can still carry an authoritative
    # license field (the official Phaser example repos are the canonical case).
    if is_github and token:
        pkg = resolve_from_package_json(source_repo, token, log)
        if pkg is not None:
            return pkg

    return resolve_from_raw_http(source_repo, log)
