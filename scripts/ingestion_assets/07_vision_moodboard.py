"""Vision moodboard for reference_games — Phase 2 / Gap 8-bis.

For each row in public.reference_games:
  1. Parse appid from store_url (Steam canonical).
  2. Call Steam public appdetails API for screenshot URLs.
  3. Pick 5 representative screenshots.
  4. Send them to gpt-4o-mini Vision (cheaper than Sonnet, ~$0.40
     total for 80 games vs ~$8 with Sonnet — 20x saving with
     comparable quality for our tag-extraction task).
  5. Store the analysis as jsonb (visual_analysis column) +
     screenshot URLs (moodboard_image_urls).

Output: UPDATE reference_games SET moodboard_image_urls=...,
        visual_analysis=..., analyzed_at=now().

Idempotent: skips rows where analyzed_at IS NOT NULL unless --force.

CLI:
    python scripts/ingestion_assets/07_vision_moodboard.py --dry-run
    python scripts/ingestion_assets/07_vision_moodboard.py
    python scripts/ingestion_assets/07_vision_moodboard.py --limit 5
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import requests
from dotenv import load_dotenv
from openai import OpenAI

from scripts.shared.db import get_connection

STEAM_APPID_RE = re.compile(r"steampowered\.com/app/(\d+)/?", re.IGNORECASE)
STEAM_API = "https://store.steampowered.com/api/appdetails"
VISION_MODEL = "gpt-4o-mini"

VISION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["dominant_palette", "lighting_style", "mood",
                 "art_direction", "ui_layout_pattern",
                 "notable_visual_elements"],
    "properties": {
        "dominant_palette": {
            "type": "array",
            "items": {"type": "string"},  # hex strings
            "minItems": 4, "maxItems": 7,
        },
        "lighting_style": {
            "type": "string",
            "enum": ["high_contrast", "soft_diffuse", "neon_glow",
                     "natural_daylight", "moody_dark", "cinematic",
                     "flat_unlit", "stylized_toon", "filmgrain_analog",
                     "psx_lowfi"],
        },
        "mood": {
            "type": "string",
            "enum": ["cozy", "tense", "epic", "melancholic", "playful",
                     "horror", "minimal", "noir", "vibrant_cute",
                     "dark_fantasy", "synthwave"],
        },
        "art_direction": {
            "type": "string",
            "minLength": 30, "maxLength": 300,
        },
        "ui_layout_pattern": {
            "type": "string",
            "enum": ["minimal_hud", "rpg_panels", "card_stack",
                     "iso_grid", "vn_textbox", "arcade_score",
                     "fullscreen_immersive", "tile_inventory"],
        },
        "notable_visual_elements": {
            "type": "array",
            "items": {"type": "string"},
            "maxItems": 8,
        },
    },
}

SYSTEM_PROMPT = """You analyse game screenshots to extract visual
moodboard data. Look at all provided images together — they're from
the same game. Return ONE JSON object using ONLY enum values from
the schema. Be specific and concrete, no marketing language."""


def parse_appid(url: str) -> str | None:
    m = STEAM_APPID_RE.search(url or "")
    return m.group(1) if m else None


def fetch_screenshots(appid: str, log: logging.Logger) -> list[str]:
    """Return up to 5 representative screenshot URLs (1920x1080)."""
    try:
        r = requests.get(STEAM_API,
                         params={"appids": appid, "filters": "screenshots"},
                         timeout=15)
    except requests.RequestException as exc:
        log.warning("Steam fetch fail appid=%s: %s", appid, exc)
        return []
    if not r.ok:
        return []
    try:
        data = r.json().get(appid, {})
    except ValueError:
        return []
    if not data.get("success"):
        return []
    shots = data.get("data", {}).get("screenshots", []) or []
    # Pick first, last, and 3 evenly-spaced in between for diversity.
    if not shots:
        return []
    if len(shots) <= 5:
        chosen = shots
    else:
        n = len(shots)
        idx = [0, n // 4, n // 2, 3 * n // 4, n - 1]
        chosen = [shots[i] for i in idx]
    return [s.get("path_full") or s.get("path_thumbnail")
            for s in chosen if s.get("path_full") or s.get("path_thumbnail")]


def analyze_with_vision(client: OpenAI, title: str, urls: list[str],
                        log: logging.Logger) -> tuple[dict | None, int, int]:
    """Call gpt-4o-mini Vision on the 5 screenshots. Returns
    (analysis_dict | None, input_tokens, output_tokens)."""
    content: list[dict] = [
        {"type": "text",
         "text": f"Game title: {title}\nAnalyze the 5 screenshots."},
    ]
    for u in urls:
        content.append({
            "type": "image_url",
            "image_url": {"url": u, "detail": "low"},  # low = cheaper
        })
    try:
        resp = client.chat.completions.create(
            model=VISION_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": content},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "moodboard_analysis",
                    "strict": True,
                    "schema": VISION_SCHEMA,
                },
            },
            temperature=0,
            max_tokens=800,
        )
    except Exception as exc:
        log.warning("Vision fail %s: %s", title, exc)
        return None, 0, 0
    text = resp.choices[0].message.content
    if not text:
        return None, 0, 0
    try:
        analysis = json.loads(text)
    except json.JSONDecodeError:
        return None, 0, 0
    return analysis, resp.usage.prompt_tokens, resp.usage.completion_tokens


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true",
                    help="Re-analyze games already analyzed.")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--cost-cap-usd", type=float, default=2.0)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--verbose", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    log = logging.getLogger("vision_moodboard")
    load_dotenv()

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        log.error("OPENAI_API_KEY not set")
        return 1

    with get_connection() as conn:
        cur = conn.cursor()
        sql = "SELECT id, title, store_url FROM public.reference_games"
        if not args.force:
            sql += " WHERE analyzed_at IS NULL"
        sql += " ORDER BY release_year DESC NULLS LAST"
        if args.limit:
            sql += f" LIMIT {int(args.limit)}"
        cur.execute(sql)
        targets = cur.fetchall()

    log.info("To analyze: %d games", len(targets))
    if not targets or args.dry_run:
        return 0

    client = OpenAI(api_key=api_key)
    # gpt-4o-mini pricing (vision): $0.15 input / $0.60 output per 1M
    in_usd, out_usd = 0.15, 0.60

    succeeded = 0
    failed = 0
    skipped_no_appid = 0
    skipped_no_screenshots = 0
    total_in = 0
    total_out = 0

    def task(row):
        gid, title, store_url = row
        appid = parse_appid(store_url)
        if not appid:
            return ("no_appid", gid, title, None, None, 0, 0)
        urls = fetch_screenshots(appid, log)
        if not urls:
            return ("no_shots", gid, title, None, None, 0, 0)
        analysis, in_t, out_t = analyze_with_vision(client, title, urls, log)
        if analysis is None:
            return ("vision_fail", gid, title, None, None, in_t, out_t)
        return ("ok", gid, title, urls, analysis, in_t, out_t)

    update_sql = """
        UPDATE public.reference_games
        SET moodboard_image_urls = %s,
            visual_analysis = %s::jsonb,
            analyzed_at = now()
        WHERE id = %s
    """

    with get_connection() as conn:
        cur = conn.cursor()
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            futures = [ex.submit(task, r) for r in targets]
            for i, fut in enumerate(as_completed(futures), 1):
                status, gid, title, urls, analysis, in_t, out_t = fut.result()
                total_in += in_t
                total_out += out_t
                if status == "no_appid":
                    skipped_no_appid += 1
                    log.debug("skip-no-appid: %s", title)
                    continue
                if status == "no_shots":
                    skipped_no_screenshots += 1
                    log.debug("skip-no-shots: %s", title)
                    continue
                if status == "vision_fail":
                    failed += 1
                    continue
                cur.execute(update_sql,
                            (urls, json.dumps(analysis), gid))
                conn.commit()
                succeeded += 1
                if i % 5 == 0:
                    log.info("Progress: %d/%d (ok=%d)", i, len(targets),
                             succeeded)

                cost = (total_in * in_usd + total_out * out_usd) / 1_000_000
                if cost > args.cost_cap_usd:
                    log.error("Cost cap exceeded ($%.2f), stopping", cost)
                    for f in futures:
                        f.cancel()
                    break

    cost = (total_in * in_usd + total_out * out_usd) / 1_000_000

    print("\n" + "=" * 56)
    print("VISION MOODBOARD SUMMARY")
    print("=" * 56)
    print(f"  succeeded:           {succeeded}")
    print(f"  failed (vision):     {failed}")
    print(f"  skipped (no appid):  {skipped_no_appid}")
    print(f"  skipped (no shots):  {skipped_no_screenshots}")
    print(f"Tokens:                {total_in} in + {total_out} out")
    print(f"Cost USD:              ${cost:.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
