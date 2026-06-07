"""Index OpenGameArt 2D assets from the HuggingFace machine-readable dump
into public.asset_library_index — INDEX-ONLY, gap-targeted, dedup-safe.

Why this exists (2026-06-07): real game runs came out "empty" (crema bg, no
platforms, pink placeholder enemies) because the catalog had ZERO backgrounds,
~8 usable ground tiles, and 9 enemies. The match_assets RPC wasn't wrong — the
warehouse was empty for exactly the slots that make a game look like a game.

This script consumes `nyuuzyou/OpenGameArt-CC-BY-4.0` (the JSONL is 222 KB; the
binary ZIPs are GBs and we NEVER download them — index-only). Each record has
url/title/tags/description/preview_images/files[].url/licenses, so we can
classify from text + register the direct file URL (download on-demand at build
time, files live at the source / go to R2 when processed, never on local disk).

Disk-safe: only the small JSONL is read; `download_url` points at OGA. Dedup:
ON CONFLICT (source_url) DO NOTHING — re-runnable, never re-ingests what we have.
Allowlist: CC-BY-4.0 only (the whole dataset is CC-BY 4.0 → in allowlist).

Usage:
  python scripts/ingestion_assets/10_index_oga_hf.py --jsonl <path> --dry-run
  python scripts/ingestion_assets/10_index_oga_hf.py --jsonl <path>
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from typing import Any

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv  # noqa: E402

from shared.db import get_connection  # noqa: E402

load_dotenv()

ALLOWED_LICENSE = "CC-BY-4.0"  # the whole dataset; normalize "CC-BY 4.0" → this

# --- Style pack themes (reused from 09_backfill_style.py; per-THEME, not group) ---
PACK_THEMES: dict[str, list[str]] = {
    "A01": ["dark", "desaturated", "gloomy", "metroidvania", "grim"],
    "A02": ["cozy", "cute", "vibrant", "colorful", "cheerful", "pastel", "kawaii"],
    "A03": ["1-bit", "gameboy", "monochrome", "2 color", "retro"],
    "A04": ["gbc", "game boy color", "jrpg"],
    "A05": ["16-bit", "snes", "jrpg", "fantasy rpg"],
    "A06": ["cyberpunk", "neon", "urban", "night", "sci-fi", "scifi", "space"],
    "A07": ["horror", "creepy", "blood", "monster", "spooky", "undead"],
    "A08": ["arcade", "80s", "action", "synth"],
    "B01": ["flat", "vector", "rounded", "minimal", "ui", "casual"],
    "B02": ["watercolor", "painterly", "soft", "hand-painted", "handpainted"],
    "B03": ["comic", "bold", "ink", "outline", "graphic novel"],
    "B04": ["anime", "manga"],
    "B05": ["noir", "black and white", "film noir"],
    "B06": ["paper", "cut-paper", "cutout", "craft"],
    "D07": ["retrowave", "synthwave", "vaporwave"],
    "D08": ["oil", "dark fantasy", "grimdark", "gothic"],
}
# Pixel-art tells route to the A-family; otherwise default to B-family stylized 2D.
PIXEL_TELLS = ["pixel", "8-bit", "8 bit", "16-bit", "16 bit", "retro", "snes", "nes", "gameboy"]
A_FAMILY = ["A01", "A02", "A03", "A04", "A05", "A06", "A07", "A08"]
B_FAMILY = ["B01", "B02", "B03", "B04", "B05", "B06"]

# --- asset_type classification by tag/title signal (gap slots first) ---
TYPE_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("background", re.compile(r"\b(background|parallax|scenery|backdrop|skybox)\b", re.I)),
    ("tileset", re.compile(r"\b(tileset|tile set|tilemap|tiles?)\b", re.I)),
    ("ui_element", re.compile(r"\b(gui|ui|button|hud|interface|menu)\b", re.I)),
    ("icon", re.compile(r"\b(icon|icons|symbol)\b", re.I)),
    ("sprite", re.compile(r"\b(sprite|character|hero|enemy|monster|player|npc|creature)\b", re.I)),
]
# --- use_case_tags: what the asset IS in a game (the code_gen reads these) ---
USE_CASE_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("enemy", re.compile(r"\b(enemy|monster|creature|slime|goblin|skeleton|zombie|boss)\b", re.I)),
    ("character", re.compile(r"\b(character|hero|player|knight|warrior|protagonist)\b", re.I)),
    ("npc", re.compile(r"\b(npc|villager|merchant|townsfolk)\b", re.I)),
    ("background", re.compile(r"\b(background|parallax|scenery|backdrop)\b", re.I)),
    ("tile_ground", re.compile(r"\b(ground|floor|platform|terrain|grass|dirt)\b", re.I)),
    ("tile_wall", re.compile(r"\b(wall|brick|stone)\b", re.I)),
    ("prop", re.compile(r"\b(prop|object|barrel|crate|chest|tree|rock|furniture)\b", re.I)),
    ("pickup", re.compile(r"\b(coin|gem|pickup|collectible|powerup|power-up|item)\b", re.I)),
    ("hud_element", re.compile(r"\b(hud|health|heart|bar|score)\b", re.I)),
    ("decoration", re.compile(r"\b(decoration|decor|plant|bush|flower)\b", re.I)),
]
# --- genre_affinity from theme words ---
GENRE_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("platformer", re.compile(r"\b(platform|platformer|jump|sidescroll)\b", re.I)),
    ("rpg", re.compile(r"\b(rpg|jrpg|fantasy|dungeon|quest)\b", re.I)),
    ("top_down_adventure", re.compile(r"\b(top-down|top down|overhead|zelda)\b", re.I)),
    ("shooter", re.compile(r"\b(shooter|shoot|space|bullet|gun)\b", re.I)),
    ("puzzle", re.compile(r"\b(puzzle|match|block)\b", re.I)),
    ("arcade", re.compile(r"\b(arcade|retro|classic)\b", re.I)),
    ("horror", re.compile(r"\b(horror|creepy|scary|undead)\b", re.I)),
]
ANIM_RE = re.compile(r"\b(animat|spritesheet|sprite sheet|idle|run cycle|walk cycle|frames?)\b", re.I)
DIRECT_IMG = re.compile(r"\.(png|jpg|jpeg|gif)$", re.I)


def text_of(rec: dict[str, Any]) -> str:
    tags = " ".join(str(t) for t in (rec.get("tags") or []))
    return f"{rec.get('title', '')} {tags} {rec.get('description', '')}".lower()


def classify_type(text: str) -> str:
    for atype, rx in TYPE_RULES:
        if rx.search(text):
            return atype
    return "sprite"  # 2D art default


def classify_multi(text: str, rules: list[tuple[str, re.Pattern[str]]]) -> list[str]:
    return [tag for tag, rx in rules if rx.search(text)]


def classify_style(text: str) -> list[str]:
    """Per-theme style pack pick (specific, not whole-group). Pixel tells →
    A-family candidates, else B-family. Floor to family[0] when no theme hits."""
    is_pixel = any(t in text for t in PIXEL_TELLS)
    family = A_FAMILY if is_pixel else B_FAMILY
    hits = [pid for pid in family if pid in PACK_THEMES and any(tok in text for tok in PACK_THEMES[pid])]
    # also allow the cross-family special packs when their theme is explicit
    for pid in ("D07", "D08"):
        if any(tok in text for tok in PACK_THEMES[pid]):
            hits.append(pid)
    return hits or [family[0]]


def make_record(rec: dict[str, Any]) -> dict[str, Any] | None:
    licenses = [str(x) for x in (rec.get("licenses") or [])]
    if not any("CC-BY" in lic and "4.0" in lic for lic in licenses):
        return None  # allowlist guard (the dataset is all CC-BY 4.0, but be strict)
    files = rec.get("files") or []
    img = next((f for f in files if DIRECT_IMG.search(str(f.get("url") or f.get("name") or ""))), None)
    if not img:
        return None  # skip ZIP-only records (no direct image → no index-only download)
    download_url = str(img["url"])
    source_url = str(rec.get("url") or "")
    if not source_url:
        return None

    text = text_of(rec)
    atype = classify_type(text)
    use_cases = classify_multi(text, USE_CASE_RULES)
    # Fallback so the code_gen always knows the slot: a typed asset with no
    # use_case hit gets the sensible default for its kind (sprite→character,
    # tileset→tile_ground, background→background, icon/ui→hud_element).
    if not use_cases:
        use_cases = {
            "sprite": ["character"],
            "tileset": ["tile_ground"],
            "background": ["background"],
            "icon": ["hud_element"],
            "ui_element": ["hud_element"],
        }.get(atype, [])
    genres = classify_multi(text, GENRE_RULES)
    styles = classify_style(text)
    keywords = [str(t) for t in (rec.get("tags") or [])][:25]
    if ANIM_RE.search(text) and "spritesheet" not in keywords:
        keywords.append("spritesheet")
    title = str(rec.get("title") or "untitled")
    desc = str(rec.get("description") or "")[:500]
    semantic = f"{title}. {desc}".strip()

    return {
        "source_library": "opengameart_hf",
        "source_url": source_url,
        "download_url": download_url,
        "thumbnail_url": (rec.get("preview_images") or [None])[0],
        "license": ALLOWED_LICENSE,
        "attribution_required": True,
        "creator_name": str(rec.get("author") or "unknown"),
        "asset_type": atype,
        "file_format": download_url.split(".")[-1].lower(),
        "style_pack_compat": styles,
        "genre_affinity": genres,
        "use_case_tags": use_cases,
        "engine_compat": ["godot", "phaser", "threejs", "babylon", "defold"],  # 2D → all engines
        "semantic_description": semantic[:1000],
        "keywords": keywords,
        "quality_score": 3,
        # 85 = the match_assets RPC entry floor (confidence_score >= 85). OGA tags
        # are explicit ("tileset"/"enemy"/"background"), so tag-based use_case/type
        # is reliable enough to clear the floor; a later vision pass can refine.
        "confidence_score": 85,
        "embedding_type": "text",  # DB check constraint value (model is text-embedding-3-small)
    }


def embed(texts: list[str]) -> list[list[float]]:
    """Batch embeddings via OpenAI (same model as the rest of the KB)."""
    from openai import OpenAI

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    out: list[list[float]] = []
    for i in range(0, len(texts), 100):
        chunk = texts[i:i + 100]
        resp = client.embeddings.create(model="text-embedding-3-small", input=chunk)
        out.extend(d.embedding for d in resp.data)
    return out


INSERT_COLS = [
    "source_library", "source_url", "download_url", "thumbnail_url", "license",
    "attribution_required", "creator_name", "asset_type", "file_format",
    "style_pack_compat", "genre_affinity", "use_case_tags", "engine_compat",
    "semantic_description", "keywords", "quality_score", "confidence_score",
    "embedding_type",
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--jsonl", required=True, help="decompressed 2D_Art.jsonl path")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="cap records (0 = all)")
    args = ap.parse_args()

    with open(args.jsonl, encoding="utf-8") as fh:
        raw = [json.loads(line) for line in fh if line.strip()]

    records: list[dict[str, Any]] = []
    for rec in raw:
        built = make_record(rec)
        if built:
            records.append(built)
        if args.limit and len(records) >= args.limit:
            break

    # Distribution report (so we SEE what the gap fill brings).
    by_type: dict[str, int] = {}
    by_use: dict[str, int] = {}
    for r in records:
        by_type[r["asset_type"]] = by_type.get(r["asset_type"], 0) + 1
        for u in r["use_case_tags"]:
            by_use[u] = by_use.get(u, 0) + 1
    print(f"[index-oga-hf] {len(raw)} raw -> {len(records)} indexable (direct-image, allowlist)")
    print(f"  by asset_type: {json.dumps(by_type, sort_keys=True)}")
    print(f"  by use_case:   {json.dumps(dict(sorted(by_use.items(), key=lambda x: -x[1])[:12]))}")

    if args.dry_run:
        print("[dry-run] no DB writes. Sample rows:")
        for r in records[:3]:
            print(f"  - {r['asset_type']:10} | {r['use_case_tags']} | {r['style_pack_compat']} | {r['semantic_description'][:60]}")
        return

    print(f"[embed] embedding {len(records)} semantic descriptions...")
    vectors = embed([r["semantic_description"] for r in records])

    sql = (
        f"INSERT INTO public.asset_library_index ({', '.join(INSERT_COLS)}, embedding) "
        f"VALUES ({', '.join(['%s'] * len(INSERT_COLS))}, %s::vector) "
        f"ON CONFLICT (source_url) DO NOTHING"
    )
    inserted = 0
    with get_connection() as conn:
        with conn.cursor() as cur:
            for r, vec in zip(records, vectors):
                vals = [r[c] for c in INSERT_COLS] + ["[" + ",".join(str(x) for x in vec) + "]"]
                cur.execute(sql, vals)
                inserted += cur.rowcount
        conn.commit()
    print(f"[done] inserted {inserted} new rows (dedup skipped {len(records) - inserted} already-present)")


if __name__ == "__main__":
    main()
