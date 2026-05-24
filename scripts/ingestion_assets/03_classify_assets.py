"""LLM tagging for assets — Phase 2 / Gap 7.4.

Reads data/assets_clean/<library>/manifest.jsonl and asks
gpt-4o-mini (cheap, fast) to fill the semantic fields the schema
needs but the scrapers don't have:
  - style_pack_compat: which of the 30 style packs is this asset
    visually compatible with?
  - genre_affinity: which of the 14 genres can use this asset?
  - engine_compat: which of the 8 engines can consume this?
  - use_case_tags: character/enemy/prop/decoration/etc
  - semantic_description: 1-2 sentence summary used for embedding
  - quality_score / confidence_score

Uses OpenAI structured outputs (json_schema enum-constrained) so we
never get free-form garbage back. Anti-hallucination protocol from
CLAUDE.md is enforced at the API level, not just post-hoc.

Output: data/assets_classified/<library>/manifest.jsonl
Cost target: ~$0.05 per 1000 assets with gpt-4o-mini.

CLI:
    python scripts/ingestion_assets/03_classify_assets.py --dry-run
    python scripts/ingestion_assets/03_classify_assets.py \\
        --library polyhaven --workers 6
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from dotenv import load_dotenv
from openai import OpenAI

from scripts.ingestion_assets._fetch_helpers import (
    append_jsonl, existing_source_urls, load_jsonl,
)

ASSETS_CLEAN_DIR = REPO_ROOT / "data" / "assets_clean"
ASSETS_CLASSIFIED_DIR = REPO_ROOT / "data" / "assets_classified"

# Mirror migration 003 enums + blueprint v2 catalogs. Adding a
# style pack or template means editing this file too.
STYLE_PACK_IDS = (
    # Pixel 2D (8)
    "A01","A02","A03","A04","A05","A06","A07","A08",
    # Stylized 2D (6)
    "B01","B02","B03","B04","B05","B06",
    # 3D stylized (8)
    "C01","C02","C03","C04","C05","C06","C07","C08",
    # Experimental (8)
    "D01","D02","D03","D04","D05","D06","D07","D08",
)
GENRE_IDS = (
    "metroidvania", "visual_novel", "mobile_puzzle", "browser_arcade",
    "jrpg", "card_game", "hardcore_platformer", "roguelike",
    "threejs_showcase", "stride_action", "multiplayer_arena",
    "social_sim", "bullet_hell", "retro_8bit",
)
ENGINE_IDS = (
    "godot", "phaser", "renpy", "defold",
    "monogame", "love2d", "threejs", "stride",
)
USE_CASE_TAGS = (
    "character", "enemy", "boss", "npc",
    "prop", "decoration", "weapon", "consumable",
    "hud_element", "inventory_icon", "achievement_badge",
    "title_screen", "cutscene_bg", "ambient_loop",
    "ui_button", "menu_bg", "particle", "skybox",
    "tile_ground", "tile_wall", "footstep", "impact",
)

# Strict JSON schema for gpt-4o-mini structured outputs.
CLASSIFICATION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "style_pack_compat", "genre_affinity", "engine_compat",
        "use_case_tags", "semantic_description",
        "quality_score", "confidence_score",
    ],
    "properties": {
        "style_pack_compat": {
            "type": "array",
            "items": {"type": "string", "enum": list(STYLE_PACK_IDS)},
            "maxItems": 6,
        },
        "genre_affinity": {
            "type": "array",
            "items": {"type": "string", "enum": list(GENRE_IDS)},
            "maxItems": 6,
        },
        "engine_compat": {
            "type": "array",
            "items": {"type": "string", "enum": list(ENGINE_IDS)},
            "maxItems": 8,
        },
        "use_case_tags": {
            "type": "array",
            "items": {"type": "string", "enum": list(USE_CASE_TAGS)},
            "maxItems": 6,
        },
        "semantic_description": {
            "type": "string",
            "minLength": 20,
            "maxLength": 400,
        },
        "quality_score": {"type": "integer", "minimum": 1, "maximum": 5},
        "confidence_score": {"type": "integer", "minimum": 0, "maximum": 100},
    },
}


SYSTEM_PROMPT = """You tag game-development assets for a multi-engine
AI game generation platform. Given the asset metadata, you return a
JSON object that maps the asset to our taxonomy.

Rules:
- ONLY use enum values from the schema. Never invent IDs.
- style_pack_compat: pick 1-4 packs that match visually. Empty array
  is OK if none fit clearly.
- genre_affinity: 1-4 genres where the asset is naturally usable.
- engine_compat: list ALL engines that can consume the file format.
  Sprites/PNG: every 2D engine. GLTF/GLB: godot, threejs, stride.
  Audio: every engine. Be permissive on format compatibility.
- quality_score 5 = production-grade hand-picked, 4 = solid CC0
  library, 3 = usable with adjustments, 2/1 = borderline (sets
  confidence below 85 for quarantine).
- confidence_score: how confident YOU are in your own tagging.
  >=85 = clear-cut. 60-84 = ambiguous. Set <60 if asset is unclear
  enough that you'd rather skip than mistag.
- semantic_description: 1-2 sentences in English, factual, no
  marketing language. Used for embedding similarity search."""


USER_PROMPT_TEMPLATE = """ASSET METADATA:
- source_library: {source_library}
- asset_type: {asset_type}
- file_format: {file_format}
- creator: {creator_name}
- license: {license}
- title: {title}
- description: {description}
- keywords: {keywords}
{extra}

Return the JSON object."""


def build_user_prompt(rec: dict[str, Any]) -> str:
    raw = rec.get("raw_meta") or {}
    extra_lines: list[str] = []
    if rec.get("audio_duration_s"):
        extra_lines.append(f"- duration_s: {rec['audio_duration_s']}")
    if rec.get("image_width") and rec.get("image_height"):
        extra_lines.append(f"- dimensions: "
                           f"{rec['image_width']}x{rec['image_height']}")
    if raw.get("asset_count"):
        extra_lines.append(f"- pack_asset_count: {raw['asset_count']}")
    if raw.get("mood_query"):
        extra_lines.append(f"- discovered_for_mood: {raw['mood_query']}")
    if raw.get("search_term"):
        extra_lines.append(f"- search_term: {raw['search_term']}")
    return USER_PROMPT_TEMPLATE.format(
        source_library=rec.get("source_library", "?"),
        asset_type=rec.get("asset_type", "?"),
        file_format=rec.get("file_format", "?"),
        creator_name=rec.get("creator_name") or "unknown",
        license=rec.get("license", "?"),
        title=raw.get("title") or raw.get("name") or rec.get("source_url", ""),
        description=(raw.get("description") or "")[:300],
        keywords=", ".join((rec.get("keywords") or [])[:15]),
        extra="\n".join(extra_lines),
    )


def classify_one(client: OpenAI, rec: dict[str, Any], model: str,
                 log: logging.Logger) -> tuple[dict[str, Any] | None, int, int]:
    """Returns (classification_dict_or_None, input_tokens, output_tokens)."""
    user_prompt = build_user_prompt(rec)
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "asset_classification",
                    "strict": True,
                    "schema": CLASSIFICATION_SCHEMA,
                },
            },
            temperature=0,
            max_tokens=600,
        )
    except Exception as exc:  # API/network boundary, classify error
        log.warning("Classify failed for %s: %s",
                    rec.get("source_url"), exc)
        return None, 0, 0

    content = resp.choices[0].message.content
    if not content:
        return None, 0, 0
    try:
        cls = json.loads(content)
    except json.JSONDecodeError as exc:
        log.warning("JSON decode failed for %s: %s",
                    rec.get("source_url"), exc)
        return None, 0, 0
    usage = resp.usage
    return cls, usage.prompt_tokens, usage.completion_tokens


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--library",
                    help="Classify only this library (default: all).")
    ap.add_argument("--workers", type=int, default=6,
                    help="Parallel classify workers.")
    ap.add_argument("--cost-cap-usd", type=float, default=5.0,
                    help="Abort if estimated cost exceeds this.")
    ap.add_argument("--limit", type=int, default=0,
                    help="Cap records classified this run.")
    ap.add_argument("--force", action="store_true",
                    help="Re-classify even if already classified.")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    log = logging.getLogger("classify_assets")
    load_dotenv()

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        log.error("OPENAI_API_KEY not set")
        return 1

    client = OpenAI(api_key=api_key)
    model = "gpt-4o-mini"
    # gpt-4o-mini pricing (May 2026): $0.15 input / $0.60 output per 1M tokens
    in_usd, out_usd = 0.15, 0.60

    if not ASSETS_CLEAN_DIR.exists():
        log.error("Run 02_filter_assets.py first.")
        return 1

    libraries = (
        [args.library] if args.library
        else [d.name for d in ASSETS_CLEAN_DIR.iterdir() if d.is_dir()]
    )

    work: list[tuple[str, dict[str, Any]]] = []
    for lib in libraries:
        clean_path = ASSETS_CLEAN_DIR / lib / "manifest.jsonl"
        if not clean_path.exists():
            continue
        already = set() if args.force else existing_source_urls(
            ASSETS_CLASSIFIED_DIR / lib / "manifest.jsonl")
        for rec in load_jsonl(clean_path):
            if rec.get("source_url") in already:
                continue
            work.append((lib, rec))
            if args.limit and len(work) >= args.limit:
                break
        if args.limit and len(work) >= args.limit:
            break

    log.info("To classify: %d records across %d libraries",
             len(work), len(libraries))
    if args.dry_run or not work:
        if work:
            print(f"DRY-RUN — would call gpt-4o-mini {len(work)} times "
                  f"(~${len(work) * 0.00006:.4f} estimated)")
        return 0

    if not args.force:
        ASSETS_CLASSIFIED_DIR.mkdir(parents=True, exist_ok=True)

    total_in = 0
    total_out = 0
    succeeded = 0
    failed = 0
    start = time.time()

    def task(item: tuple[str, dict[str, Any]]):
        return item, classify_one(client, item[1], model, log)

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = [ex.submit(task, item) for item in work]
        for fut in as_completed(futures):
            (lib, rec), (cls, in_t, out_t) = fut.result()
            total_in += in_t
            total_out += out_t
            if cls is None:
                failed += 1
                continue
            merged = dict(rec)
            merged.update(cls)
            append_jsonl(ASSETS_CLASSIFIED_DIR / lib / "manifest.jsonl",
                         merged)
            succeeded += 1

            cost_so_far = (total_in * in_usd + total_out * out_usd) / 1_000_000
            if cost_so_far > args.cost_cap_usd:
                log.error("Cost cap $%.2f exceeded ($%.2f), stopping",
                          args.cost_cap_usd, cost_so_far)
                for f in futures:
                    f.cancel()
                break

    elapsed = time.time() - start
    cost = (total_in * in_usd + total_out * out_usd) / 1_000_000

    print("\n" + "=" * 56)
    print("ASSET CLASSIFY SUMMARY")
    print("=" * 56)
    print(f"  succeeded:  {succeeded}")
    print(f"  failed:     {failed}")
    print(f"Tokens:       {total_in} in + {total_out} out")
    print(f"Cost USD:     ${cost:.4f}")
    print(f"Elapsed:      {elapsed:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
