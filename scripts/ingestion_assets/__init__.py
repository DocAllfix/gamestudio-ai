"""Asset ingestion pipeline — Phase 2 Resource Hunt (Gap 7).

Mirrors scripts/ingestion/ for the asset side of the RAG dataset:
  - 01_scrape_assets.py  — fetch metadata from 13 verified libraries
  - 02_filter_assets.py  — license + size + format + dedup
  - 03_classify_assets.py — gpt-4o-mini semantic tagging
  - 04_embed_assets.py   — local CLIP (image) + CLAP (audio) + text
  - 05_store_assets.py   — Supabase batch insert

The license-first guardrail (FORBIDDEN_LICENSE_MARKERS already used
in code ingestion) is mirrored here via asset_library_index.license
CHECK constraint in migration 003.
"""
