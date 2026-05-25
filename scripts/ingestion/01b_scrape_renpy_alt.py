"""Fase 1bis — Ren'Py non-GitHub harvest pilot.

Closes the P1 bottleneck identified in docs/FINDING_dataset_boost_coverage.md:
Ren'Py is the engine where the base model is weakest yet our dataset has
only 103 chunks across 4/22 categories. GitHub is saturated for Ren'Py
(8 cloned repos). This orchestrator harvests Ren'Py code from two
non-GitHub sources verified by 4 rounds of Perplexity Deep Research:

  - GitLab topics `renpy` and `visual-novel` (16+ projects, MIT/CC0/etc.)
  - Itch.io `made-with-renpy/tag-open-source` (22 games, license per page)
  - Itch.io collection `c/2530378/renpy-resources` (~25 tools/frameworks)

For each enumerated item we read the license (from GitLab LICENSE file or
the Itch sidebar widget), accept only whitelisted permissive licenses,
then either:

  - clone the project via `git clone --depth 1` if a clone URL is
    available (GitLab projects, Itch tools linking GitHub/GitLab repos), or
  - emit a manual-download line in `data/itch_manual_downloads.txt` for
    pure-Itch items whose zip is only reachable via JS-loaded buttons
    (verified empirically — public HTML doesn't expose direct file URLs).

The harvest output flows through the EXISTING pipeline unchanged:
  02_filter.py → 03_parse_renpy.py → 03b_groom → 04_classify → 05_embed

CLI:
    python scripts/ingestion/01b_scrape_renpy_alt.py --dry-run
    python scripts/ingestion/01b_scrape_renpy_alt.py --source gitlab
    python scripts/ingestion/01b_scrape_renpy_alt.py --source itch
    python scripts/ingestion/01b_scrape_renpy_alt.py            # full
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from scripts.ingestion._gitlab_client import (  # noqa: E402
    GitLabClient, entry_from_gitlab_project, LICENSE_ALLOW,
)
from scripts.ingestion._itch_scraper import ItchScraper  # noqa: E402
from scripts.ingestion._scrape_helpers import (  # noqa: E402
    clone_repo, load_manifest, safe_repo_name, save_manifest,
)

MANIFEST_PATH = REPO_ROOT / "data" / "manifest.json"
REPOS_RAW_DIR = REPO_ROOT / "data" / "repos_raw"
LOG_PATH = REPO_ROOT / "scrape_log.txt"
MANUAL_DOWNLOAD_REPORT = REPO_ROOT / "data" / "itch_manual_downloads.txt"

GITLAB_TOPICS = ("renpy", "visual-novel", "renpy-game", "interactive-fiction")

ITCH_LIST_URL = "https://itch.io/games/made-with-renpy/tag-open-source"

# Tool URLs verified across Perplexity reports 2 + 4 (original 10) and an
# inventory of three high-prolific Ren'Py tool authors performed 2026-05-25
# (feniksdev, devilspider, tessw — each profile page enumerated, every
# product page reachable). Each tool below targets one of the 9 thin
# Ren'Py categories the coverage report flagged: A05_camera, D03_vfx,
# B04_navigation, E02_signals_events (the visual-novel equivalents). The
# Itch scraper reads the license from each page at runtime; we never
# hardcode it here. License gating happens in harvest_itch().
ITCH_RESOURCES_URLS = (
    # Original 10 (Perplexity round 2+4)
    "https://bobcgames.itch.io/bobcstats",
    "https://jsfehler.itch.io/renpy-encyclopaedia",
    "https://dicortesia.itch.io/dressup-minigame-for-renpy",
    "https://foxcapades.itch.io/renpy-color-sliders",
    "https://devilspider.itch.io/flowchart-plug-in",
    "https://devilspider.itch.io/pointnclick-plug-in-for-renpy",
    "https://devilspider.itch.io/animated-cursor-displayable",
    "https://tessw.itch.io/renpy-scene-navigator",
    "https://feniksdev.itch.io/parallax-zoom-viewports-for-renpy",
    "https://rdxvoidzero.itch.io/renpy-adult-visual-novel-framework",
    # feniksdev — D03 VFX + A05 camera (shaders, transitions, particles)
    "https://feniksdev.itch.io/immersive-particle-vfx-for-renpy",
    "https://feniksdev.itch.io/renpy-ripple-transition",
    "https://feniksdev.itch.io/outline-shader-renpy",
    "https://feniksdev.itch.io/better-colorize-for-renpy",
    "https://feniksdev.itch.io/gradients-for-renpy",
    # devilspider — D03 VFX (more shaders) + D01 UI extras
    "https://devilspider.itch.io/globe-displayable",
    "https://devilspider.itch.io/mandelbrot-julia-fractal-shaders",
    "https://devilspider.itch.io/blur-shader-pack",
    "https://devilspider.itch.io/crt-monitor-shader",
    "https://devilspider.itch.io/freeform-bar",
    "https://devilspider.itch.io/history-search-tool",
    "https://devilspider.itch.io/radar-chart-displayable",
    "https://devilspider.itch.io/image-bounds-displayable",
    # tessw — B04 navigation + D03 animation
    "https://tessw.itch.io/generate-animation-in-renpy",
    # jsfehler — E01 framework / E02 signals via GUI replacement
    "https://jsfehler.itch.io/entroponaut",
)

# License whitelist used to ACCEPT entries before clone/download. Mirrors
# scripts.shared.taxonomy.ALLOWED_LICENSES. "unknown" is allowed only on
# GitLab (where 02_filter will re-read LICENSE post-clone); Itch entries
# require a verified license to ship (no second chance to re-check).
ALLOWED_SPDX = {
    "MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause",
    "CC0-1.0", "Unlicense", "ISC", "Zlib",
}


def get_logger(verbose: bool) -> logging.Logger:
    logger = logging.getLogger("scrape_renpy_alt")
    if logger.handlers:
        return logger
    logger.setLevel(logging.DEBUG if verbose else logging.INFO)
    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] %(message)s")
    fh = logging.FileHandler(LOG_PATH, mode="a", encoding="utf-8")
    fh.setFormatter(formatter)
    logger.addHandler(fh)
    sh = logging.StreamHandler(sys.stdout)
    sh.setFormatter(formatter)
    logger.addHandler(sh)
    return logger


def harvest_gitlab(log: logging.Logger,
                   seen_urls: set[str]) -> list[dict[str, Any]]:
    client = GitLabClient(log=log)
    log.info("GitLab authenticated: %s", client.authed)
    new_entries: list[dict[str, Any]] = []
    for topic in GITLAB_TOPICS:
        projects = client.list_projects_for_topic(topic)
        log.info("Topic=%s → %d projects total", topic, len(projects))
        for p in projects:
            web = p.get("web_url") or ""
            if web in seen_urls:
                log.debug("SKIP already in manifest: %s", web)
                continue
            pid = p["id"]
            branch = p.get("default_branch") or "main"
            has_rpy = client.has_extension(pid, branch, ".rpy")
            if not has_rpy:
                log.info("SKIP %s: no .rpy in tree", web)
                continue
            lic = client.fetch_license(pid, branch)
            if lic != "unknown" and lic not in {
                    s.upper().replace("_", "-") for s in ALLOWED_SPDX
            } and lic not in ALLOWED_SPDX:
                log.info("SKIP %s: license=%s not in whitelist",
                         web, lic)
                continue
            # license="unknown" passes here; 02_filter will re-read LICENSE
            # from the cloned tree and either pin it or drop the repo.
            entry = entry_from_gitlab_project(p, lic, "renpy")
            new_entries.append(entry)
            seen_urls.add(web)
            log.info("ADD GitLab %s (license=%s, stars=%d)",
                     web, lic, entry["stars"])
    return new_entries


def harvest_itch(log: logging.Logger,
                 seen_urls: set[str]) -> tuple[list[dict[str, Any]],
                                                list[dict[str, Any]]]:
    """Returns (clonable_entries, manual_download_entries).

    Clonable: an external repo URL was found in the Itch page → existing
    clone_phase handles them.
    Manual: only an Itch zip exists; emitted to the report file for the
    operator to grab by hand (5-10 files at most).
    """
    scraper = ItchScraper(log=log)
    clonable: list[dict[str, Any]] = []
    manual: list[dict[str, Any]] = []
    target_urls: list[str] = []

    # 22 OS games
    target_urls.extend(scraper.crawl_list(ITCH_LIST_URL, max_pages=3))
    # 10 verified resource tools
    target_urls.extend(ITCH_RESOURCES_URLS)

    log.info("Itch total product URLs to inspect: %d (incl. dedup)",
             len(set(target_urls)))

    seen_itch: set[str] = set()
    for url in target_urls:
        if url in seen_itch:
            continue
        seen_itch.add(url)
        p = scraper.parse_product(url)
        if p is None:
            log.warning("Itch parse FAIL: %s", url)
            continue
        # License gating:
        #   - license in whitelist → accept directly
        #   - license == "unknown" AND has external repo clonable → accept,
        #     02_filter will re-read LICENSE from the cloned tree
        #   - license == "unknown" AND only Itch download → REJECT (no
        #     second chance, manual download has no LICENSE check)
        #   - other (e.g. GPL, CC-BY-NC) → reject
        has_external = len(p.external_repos) > 0
        if p.license not in ALLOWED_SPDX:
            if p.license == "unknown" and has_external:
                log.info("ALLOW %s: license=unknown but external repo "
                         "will be license-checked post-clone", url)
            else:
                log.info("SKIP %s: license=%s (raw=%r)",
                         url, p.license, p.license_raw)
                continue
        entry = p.to_manifest_entry("renpy")
        if entry["url"] in seen_urls:
            log.debug("SKIP already in manifest: %s", entry["url"])
            continue
        seen_urls.add(entry["url"])
        if entry["needs_manual_download"]:
            manual.append({
                "itch_page": url,
                "title": p.title,
                "author": p.author,
                "license": p.license,
                "downloads": [
                    {"name": d.filename, "size": d.size_text}
                    for d in p.downloads],
                "manifest_url": entry["url"],
                "engine": "renpy",
            })
            log.info("MANUAL itch %s (license=%s, %d files)",
                     url, p.license, len(p.downloads))
        else:
            clonable.append(entry)
            log.info("ADD itch+ext %s -> clone %s",
                     url, entry["clone_url"])
    return clonable, manual


def write_manual_report(items: list[dict[str, Any]]) -> None:
    if not items:
        return
    lines = [
        "# Ren'Py Itch.io manual-download report",
        "# These items expose their zip only via JS-loaded download",
        "# buttons. For each one, open the itch_page URL, click",
        "# Download, and drop the resulting file under:",
        f"#   {REPOS_RAW_DIR / 'renpy' / '<safe_name>'}/",
        "#",
        "",
    ]
    for it in items:
        safe = safe_repo_name(it["manifest_url"])
        lines.append(f"## {it['title']!r}  (by {it['author']!r})")
        lines.append(f"   page:     {it['itch_page']}")
        lines.append(f"   license:  {it['license']}")
        lines.append(f"   target:   data/repos_raw/renpy/{safe}/")
        for d in it["downloads"]:
            lines.append(f"   file:     {d['name']}  ({d['size']})")
        lines.append("")
    MANUAL_DOWNLOAD_REPORT.write_text("\n".join(lines), encoding="utf-8")


def clone_entries(entries: list[dict[str, Any]],
                  log: logging.Logger) -> int:
    cloned = 0
    for entry in entries:
        if not entry.get("clone_url"):
            continue
        target = REPOS_RAW_DIR / "renpy" / safe_repo_name(entry["url"])
        status = clone_repo(entry["clone_url"], target, log)
        entry["clone_status"] = status
        if status == "cloned":
            cloned += 1
    return cloned


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Fase 1bis — Ren'Py non-GitHub harvest pilot")
    ap.add_argument("--source", choices=("gitlab", "itch", "all"),
                    default="all")
    ap.add_argument("--dry-run", action="store_true",
                    help="Enumerate + parse + license check, no clone, "
                         "no manifest write.")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    log = get_logger(args.verbose)
    log.info("=" * 64)
    log.info("Fase 1bis — Ren'Py harvest pilot (source=%s, dry-run=%s)",
             args.source, args.dry_run)
    log.info("=" * 64)

    manifest = load_manifest(MANIFEST_PATH)
    seen_urls = {e.get("url") for e in manifest if e.get("url")}
    log.info("Manifest start: %d existing entries", len(manifest))

    new_gitlab: list[dict[str, Any]] = []
    new_itch_clonable: list[dict[str, Any]] = []
    new_itch_manual: list[dict[str, Any]] = []

    if args.source in ("gitlab", "all"):
        new_gitlab = harvest_gitlab(log, seen_urls)
        log.info("GitLab harvest: %d new entries", len(new_gitlab))
    if args.source in ("itch", "all"):
        new_itch_clonable, new_itch_manual = harvest_itch(log, seen_urls)
        log.info("Itch harvest: %d clonable + %d manual",
                 len(new_itch_clonable), len(new_itch_manual))

    if args.dry_run:
        log.info("DRY RUN — no manifest changes, no clones, no report.")
        log.info("Would add %d entries (gitlab=%d, itch+ext=%d, manual=%d)",
                 len(new_gitlab) + len(new_itch_clonable)
                 + len(new_itch_manual),
                 len(new_gitlab), len(new_itch_clonable),
                 len(new_itch_manual))
        return 0

    new_clonable = new_gitlab + new_itch_clonable
    if new_clonable:
        manifest.extend(new_clonable)
        save_manifest(MANIFEST_PATH, manifest)
        log.info("Manifest updated: +%d clonable entries (total %d)",
                 len(new_clonable), len(manifest))
        cloned_n = clone_entries(new_clonable, log)
        log.info("Cloned %d/%d projects into %s/renpy/",
                 cloned_n, len(new_clonable), REPOS_RAW_DIR)
        save_manifest(MANIFEST_PATH, manifest)  # persist clone_status

    if new_itch_manual:
        write_manual_report(new_itch_manual)
        log.info("Manual download report written: %s (%d items)",
                 MANUAL_DOWNLOAD_REPORT, len(new_itch_manual))

    log.info("Fase 1bis complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
