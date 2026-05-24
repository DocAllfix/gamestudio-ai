"""Catalog of 13 asset libraries — verified license + scrape strategy.

Each entry encodes:
- canonical_url: source homepage (human reference)
- api_endpoint: machine-readable feed (None = scrape HTML)
- license_default: SPDX license to apply when API doesn't expose
  per-asset license. ONLY safe libraries (CC0/permissive) are marked
  with a non-null default; mixed-license libraries (OpenGameArt,
  Freesound, itch.io free) MUST be filtered per-asset.
- license_per_asset: True if every asset must be re-checked
  individually before ingestion (cannot trust default).
- asset_types: which asset_type categories this library serves
  (matches the CHECK constraint in migration 003).
- scrape_strategy: 'api' | 'html_listing' | 'github_release'
- rate_limit_rpm: requests per minute we allow ourselves
- requires_auth: True if API needs token (env var name in env_var)
- env_var: name of env var holding API token if requires_auth
- notes: scrape gotchas

Used by 01_scrape_assets.py to dispatch to the right fetcher.

References:
- docs/ASSET_LIBRARY_MANIFEST.md — full inventory + per-pack notes
- docs/PIETRA_v5_ADDENDUM.md §C.2 — count of utilizable assets
"""
from __future__ import annotations

from dataclasses import dataclass, field


# License allowlist mirrors the CHECK constraint in migration 003.
# Anything not in this set MUST be rejected at filter time.
ASSET_LICENSE_ALLOWLIST: frozenset[str] = frozenset({
    "CC0-1.0", "CC-BY-4.0", "MIT", "Apache-2.0",
    "BSD-2-Clause", "BSD-3-Clause", "ISC", "Zlib",
    "Unlicense", "OFL-1.1",
})

# Hard reject markers — even one match in the license text drops
# the asset. Mirrors FORBIDDEN_LICENSE_MARKERS in code ingestion.
ASSET_FORBIDDEN_MARKERS: frozenset[str] = frozenset({
    "GPL", "AGPL", "LGPL", "SSPL",
    "CC-BY-NC", "CC-BY-ND", "CC-BY-SA",
    "non-commercial", "no derivatives",
    "all rights reserved",
})


@dataclass(frozen=True)
class AssetLibrary:
    """One asset library source. Immutable so the catalog is safe to
    share across threads in the scrape pool."""
    id: str
    display_name: str
    canonical_url: str
    api_endpoint: str | None
    license_default: str | None
    license_per_asset: bool
    asset_types: tuple[str, ...]
    scrape_strategy: str
    rate_limit_rpm: int
    requires_auth: bool
    env_var: str | None
    estimated_total: int
    notes: str
    # Optional override of which asset_types to KEEP from this source
    # (some libs offer thousands of asset types, we only ingest a subset)
    keep_asset_types: tuple[str, ...] = field(default_factory=tuple)


CATALOG: tuple[AssetLibrary, ...] = (
    # =====================================================
    # Tier A — CC0 confirmed, single license, safe defaults
    # =====================================================
    AssetLibrary(
        id="kenney",
        display_name="Kenney.nl",
        canonical_url="https://kenney.nl/assets",
        api_endpoint=None,  # HTML scraping required
        license_default="CC0-1.0",
        license_per_asset=False,
        asset_types=("sprite", "tileset", "ui_element", "icon",
                     "model_3d", "audio_sfx", "audio_bgm", "font"),
        scrape_strategy="html_listing",
        rate_limit_rpm=30,
        requires_auth=False,
        env_var=None,
        estimated_total=60_000,
        notes="CC0 confirmed site-wide. Iterate /assets paginated. "
              "Each pack has /content/.../pack.zip + thumbnail.",
    ),
    AssetLibrary(
        id="quaternius",
        display_name="Quaternius",
        canonical_url="https://quaternius.com",
        api_endpoint=None,
        license_default="CC0-1.0",
        license_per_asset=False,
        asset_types=("model_3d", "animation_3d"),
        scrape_strategy="html_listing",
        rate_limit_rpm=20,
        requires_auth=False,
        env_var=None,
        estimated_total=5_000,
        notes="CC0 confirmed. ~80 packs. Patreon is opt-in support.",
    ),
    AssetLibrary(
        id="kaykit",
        display_name="KayKit (Kay Lousberg)",
        canonical_url="https://kaylousberg.com",
        api_endpoint=None,
        # Per-pack: most are CC0 but some Itch "name-your-price" packs
        # have custom EULAs. Default CC0 is correct for the free tier.
        license_default="CC0-1.0",
        license_per_asset=True,
        asset_types=("model_3d", "animation_3d"),
        scrape_strategy="html_listing",
        rate_limit_rpm=20,
        requires_auth=False,
        env_var=None,
        estimated_total=1_500,
        notes="Verify per-pack license: itch.io page LICENSE block. "
              "Confirmed CC0: Adventurers, Dungeon, Animations, "
              "Skeletons, Mini-Game, Restaurant.",
    ),
    AssetLibrary(
        id="polyhaven",
        display_name="Poly Haven",
        canonical_url="https://polyhaven.com",
        api_endpoint="https://api.polyhaven.com",
        license_default="CC0-1.0",
        license_per_asset=False,
        asset_types=("model_3d", "texture", "hdri"),
        scrape_strategy="api",
        rate_limit_rpm=60,
        requires_auth=False,
        env_var=None,
        estimated_total=3_000,
        notes="Official API. /assets?type=models|textures|hdris. "
              "CC0 confirmed site-wide. Best signal-to-noise.",
    ),
    AssetLibrary(
        id="kenney_audio",
        display_name="Kenney Audio",
        canonical_url="https://kenney.nl/assets?q=audio",
        api_endpoint=None,
        license_default="CC0-1.0",
        license_per_asset=False,
        asset_types=("audio_sfx", "audio_bgm"),
        scrape_strategy="html_listing",
        rate_limit_rpm=30,
        requires_auth=False,
        env_var=None,
        estimated_total=5_000,
        notes="Subset of Kenney filtered by audio tag.",
    ),

    # =====================================================
    # Tier B — Mixed license, per-asset verification required
    # =====================================================
    AssetLibrary(
        id="opengameart",
        display_name="OpenGameArt.org",
        canonical_url="https://opengameart.org",
        api_endpoint=None,
        license_default=None,  # mixed: must verify per-asset
        license_per_asset=True,
        asset_types=("sprite", "tileset", "ui_element", "icon",
                     "background", "concept_art", "model_3d",
                     "texture", "audio_sfx", "audio_bgm", "font"),
        scrape_strategy="html_listing",
        rate_limit_rpm=15,
        requires_auth=False,
        env_var=None,
        estimated_total=50_000,
        notes="Drupal-based. Filter ONLY by license: CC0, CC-BY-3.0, "
              "CC-BY-4.0, OFL-1.1. Reject CC-BY-SA (copyleft) and GPL.",
    ),
    AssetLibrary(
        id="freesound",
        display_name="Freesound",
        canonical_url="https://freesound.org",
        api_endpoint="https://freesound.org/apiv2",
        license_default=None,
        license_per_asset=True,
        asset_types=("audio_sfx", "audio_voice"),
        scrape_strategy="api",
        rate_limit_rpm=60,
        requires_auth=True,
        env_var="FREESOUND_API_KEY",
        estimated_total=500_000,
        notes="Official API. Filter via license:\"Creative Commons 0\" "
              "or license:\"Attribution\". Skip Sampling+, NC, SA.",
    ),
    AssetLibrary(
        id="itch_free",
        display_name="itch.io free assets",
        canonical_url="https://itch.io/game-assets/free",
        api_endpoint="https://api.itch.io",
        license_default=None,
        license_per_asset=True,
        asset_types=("sprite", "tileset", "ui_element", "audio_sfx",
                     "audio_bgm", "font", "background"),
        scrape_strategy="html_listing",
        rate_limit_rpm=20,
        requires_auth=False,
        env_var=None,
        estimated_total=10_000,
        notes="Per-asset license. Index TOP 500 by download count "
              "and accept only CC0/CC-BY/MIT/personal+commercial.",
    ),
    AssetLibrary(
        id="craftpix",
        display_name="CraftPix Freebies",
        canonical_url="https://craftpix.net/freebies/",
        api_endpoint=None,
        # 'free commercial' is CraftPix custom term — verify each pack
        license_default=None,
        license_per_asset=True,
        asset_types=("sprite", "tileset", "ui_element", "icon",
                     "background"),
        scrape_strategy="html_listing",
        rate_limit_rpm=15,
        requires_auth=False,
        env_var=None,
        estimated_total=280,
        notes="280 free packs (Mar 2026). License = 'free commercial' "
              "= permissive but custom. Re-tag as CC-BY-4.0 if license "
              "page confirms no attribution requirement, else Unlicense.",
    ),
    AssetLibrary(
        id="gameassets_com",
        display_name="GameAssets.com",
        canonical_url="https://gameassets.com",
        api_endpoint=None,
        license_default="CC0-1.0",
        license_per_asset=True,
        asset_types=("sprite", "tileset", "model_3d", "audio_sfx"),
        scrape_strategy="html_listing",
        rate_limit_rpm=15,
        requires_auth=False,
        env_var=None,
        estimated_total=60_000,
        notes="Claims 60k CC0. LOW priority: heavy overlap with Kenney/"
              "Quaternius (aggregator). Verify site is still active.",
    ),

    # =====================================================
    # Tier C — Sketchfab CC0 filter, Pmndrs Drei (NEW)
    # =====================================================
    AssetLibrary(
        id="sketchfab_cc0",
        display_name="Sketchfab CC0 filter",
        canonical_url="https://sketchfab.com/3d-models"
                      "?features=downloadable&licenses="
                      "322a749bcfa841b29dff1e8a1bb74b0b",
        api_endpoint="https://api.sketchfab.com/v3",
        license_default="CC0-1.0",
        license_per_asset=False,  # CC0 filter is server-side enforced
        asset_types=("model_3d", "animation_3d"),
        scrape_strategy="api",
        rate_limit_rpm=60,
        requires_auth=False,
        env_var=None,
        estimated_total=70_000,
        notes="Filter strict: ?license=cc0 + ?downloadable=true. "
              "Heterogeneous quality. Cap face_count <= 50k to avoid "
              "AAA-grade assets that bloat the index.",
    ),
    AssetLibrary(
        id="pmndrs_drei",
        display_name="Pmndrs Drei (Three.js helpers)",
        canonical_url="https://github.com/pmndrs/drei",
        api_endpoint=None,
        license_default="MIT",
        license_per_asset=False,
        asset_types=("shader",),  # treat each drei helper as a "shader/component"
        scrape_strategy="github_release",
        rate_limit_rpm=60,
        requires_auth=False,
        env_var=None,
        estimated_total=200,
        notes="Index drei components as functional 'assets' for the "
              "Three.js code_gen tool — each helper is a ready-to-use "
              "primitive (Sky, Stars, OrbitControls, etc).",
    ),

    # =====================================================
    # Tier D — OpenGameArt audio subset (split from #6)
    # =====================================================
    AssetLibrary(
        id="opengameart_audio",
        display_name="OpenGameArt Audio",
        canonical_url="https://opengameart.org/art-search?type=audio",
        api_endpoint=None,
        license_default=None,
        license_per_asset=True,
        asset_types=("audio_sfx", "audio_bgm"),
        scrape_strategy="html_listing",
        rate_limit_rpm=15,
        requires_auth=False,
        env_var=None,
        estimated_total=10_000,
        notes="Same domain as #6 but audio-only filter. Same license "
              "verification rule.",
    ),
)


# Convenience lookups -------------------------------------------------

def get_library(library_id: str) -> AssetLibrary:
    """Lookup by id. Raises KeyError if missing."""
    for lib in CATALOG:
        if lib.id == library_id:
            return lib
    raise KeyError(f"Unknown asset library id: {library_id!r}")


def libraries_for_asset_type(asset_type: str) -> tuple[AssetLibrary, ...]:
    """All libraries that ship this asset_type."""
    return tuple(lib for lib in CATALOG if asset_type in lib.asset_types)


def is_license_allowed(license_spdx: str | None) -> bool:
    """Strict check: only the allowlist passes. None / unknown = reject."""
    if not license_spdx:
        return False
    return license_spdx.strip() in ASSET_LICENSE_ALLOWLIST


def has_forbidden_marker(text: str | None) -> str | None:
    """Return the first forbidden marker found in the license text, or
    None. Used as a second-pass safety check on free-form license
    fields where the SPDX id might be misleading."""
    if not text:
        return None
    t = text.upper()
    for marker in ASSET_FORBIDDEN_MARKERS:
        if marker.upper() in t:
            return marker
    return None
