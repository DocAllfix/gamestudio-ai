"""Asset scraper entry point — Phase 2 / Gap 7.2.

Dispatches to library-specific modules listed in _asset_sources.py.
At day-1 we support Tier A (API-based, CC0-confirmed):
  - polyhaven   (Poly Haven API: 3k models/textures/HDRIs)
  - freesound   (Freesound API: ~50k CC0 SFX from mood queries)

HTML-scrape libraries (kenney, quaternius, kaykit, opengameart,
itch_free, craftpix, gameassets_com, sketchfab_cc0, pmndrs_drei)
will be added in a follow-up commit. Tier A alone covers ~50k
verifiably-CC0 assets, the highest-quality subset of the catalog.

Output: one JSONL manifest per library in
    data/assets_raw/<library_id>/manifest.jsonl

CLI:
    python scripts/ingestion_assets/01_scrape_assets.py --dry-run
    python scripts/ingestion_assets/01_scrape_assets.py
    python scripts/ingestion_assets/01_scrape_assets.py \\
        --library polyhaven --limit 50
"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv

from scripts.ingestion_assets._asset_sources import CATALOG
from scripts.ingestion_assets._lib_polyhaven import fetch_polyhaven
from scripts.ingestion_assets._lib_freesound import fetch_freesound
from scripts.ingestion_assets._lib_kenney import fetch_kenney
from scripts.ingestion_assets._lib_quaternius import fetch_quaternius
from scripts.ingestion_assets._lib_kaykit import fetch_kaykit

# Map library_id -> fetcher function. Adding a new library means
# importing its _lib_<id>.py module and adding it here.
FETCHERS = {
    "polyhaven": fetch_polyhaven,
    "freesound": fetch_freesound,
    "kenney": fetch_kenney,
    "quaternius": fetch_quaternius,
    "kaykit": fetch_kaykit,
}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--library", choices=list(FETCHERS.keys()),
                    help="Only scrape this library (default: all Tier A).")
    ap.add_argument("--limit", type=int, default=0,
                    help="Cap new records per library (0 = no cap).")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print plan, do not call APIs or write files.")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    log = logging.getLogger("scrape_assets")
    load_dotenv()

    target_libs = [args.library] if args.library else list(FETCHERS.keys())

    if args.dry_run:
        print("DRY RUN — would scrape:")
        for lib_id in target_libs:
            lib = next((c for c in CATALOG if c.id == lib_id), None)
            if not lib:
                continue
            print(f"  {lib_id:14} ~{lib.estimated_total:>6} est. assets "
                  f"({lib.scrape_strategy}, limit={args.limit or 'none'})")
        print("\nNo files written.")
        return 0

    grand_total = 0
    for lib_id in target_libs:
        fetcher = FETCHERS[lib_id]
        log.info("=== Scraping %s ===", lib_id)
        limit = args.limit if args.limit > 0 else None
        try:
            count = fetcher(log, limit=limit)
        except Exception as exc:  # pragma: no cover — pipeline boundary
            log.exception("Fatal error in %s scraper: %s", lib_id, exc)
            continue
        log.info("=== %s: +%d new records ===", lib_id, count)
        grand_total += count

    print(f"\nGRAND TOTAL new records: {grand_total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
