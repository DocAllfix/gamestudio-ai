#!/usr/bin/env python3
"""Backfill style_pack_compat on asset_library_index (FASE 2.5a) — FINE-GRAINED.

The style axis was empty (0%). This populates style_pack_compat with the SPECIFIC
style_packs each asset fits — not whole groups — so within one family (e.g. pixel)
a cyberpunk asset maps to the neon packs, a horror asset to the dark packs, a cozy
asset to the vibrant ones. This gives variety + precision: the resolver/preset can
match by the exact look, and a game's assets stay stylistically coherent.

Approach: each pack has a THEME signature (keywords from its description). An asset
(its keywords + semantic_description) is matched against every DIMENSION-compatible
pack's theme; matching packs are assigned. Always include the family's generic
packs as a floor so nothing ends up uncategorized. Deterministic, zero-cost.

Packs (A pixel-2d, B stylized-2d, C 3d, D experimental). DIMENSION gate first:
3D assets (model/texture/hdri) → only C* (+ D-3D-ish); 2D assets → A*/B*/D-2D.

Usage:
  python scripts/ingestion_assets/09_backfill_style.py --dry-run
  python scripts/ingestion_assets/09_backfill_style.py
"""
import argparse
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.db import get_connection  # noqa: E402

# Per-pack THEME signatures: a pack is assigned if the asset text hits any token.
# Derived from the style_packs descriptions (themes/palette/mood), so assignment
# is by the asset's actual character, not just its family.
PACK_THEMES = {
    # A — pixel 2D
    "A01": ["dark", "desaturated", "gloomy", "metroidvania", "grim", "contrast"],
    "A02": ["cozy", "cute", "vibrant", "colorful", "cheerful", "positive", "pastel", "kawaii"],
    "A03": ["1-bit", "gameboy", "monochrome", "2 color", "two color", "retro"],
    "A04": ["gbc", "game boy color", "4 tone", "jrpg"],
    "A05": ["16-bit", "snes", "jrpg", "square", "fantasy rpg"],
    "A06": ["cyberpunk", "neon", "magenta", "cyan", "urban", "night", "sci-fi", "scifi"],
    "A07": ["horror", "sickly", "creepy", "blood", "dark", "monster", "spooky"],
    "A08": ["arcade", "80s", "hotline", "high-contrast", "action", "synth"],
    # B — stylized 2D
    "B01": ["flat", "vector", "rounded", "pastel", "minimal", "ui", "cute", "casual"],
    "B02": ["watercolor", "painterly", "soft", "gradient", "hand-painted", "handpainted"],
    "B03": ["comic", "bold", "halftone", "ink", "outline", "graphic novel"],
    "B04": ["anime", "manga", "bloom", "soft anime"],
    "B05": ["noir", "black and white", "film noir", "monochrome", "hard shadow"],
    "B06": ["paper", "cut-paper", "cutout", "layered", "craft"],
    # C — 3D
    "C01": ["low-poly", "lowpoly", "flat shading", "no texture", "stylized"],
    "C02": ["voxel", "minecraft", "block", "cube"],
    "C03": ["cel-shaded", "cel shaded", "toon", "anime", "outline"],
    "C04": ["ps1", "playstation", "low-res", "vertex", "jitter", "retro 3d"],
    "C05": ["n64", "nintendo 64", "soft polygon", "bilinear"],
    "C06": ["clean", "metallic", "emissive", "modern", "sci-fi", "scifi", "pbr"],
    "C07": ["fantasy", "stylized", "saturated", "detailed", "prop"],
    "C08": ["geometric", "abstract", "gradient", "luminous", "minimal"],
    # D — experimental
    "D01": ["ascii", "text"],
    "D02": ["rubber-hose", "rubber hose", "rotoscope", "cartoon", "1930s"],
    "D03": ["mspaint", "ms paint", "naive", "doodle"],
    "D04": ["hi-res pixel", "high-res pixel", "realistic pixel", "muted"],
    "D05": ["photographic", "photo background", "photoreal"],
    "D06": ["silhouette", "two-color", "shadow"],
    "D07": ["retrowave", "synthwave", "neon", "80s", "vaporwave"],
    "D08": ["oil", "oil-painted", "dark fantasy", "berserk", "darkest dungeon", "grimdark", "gothic"],
}
PIXEL = [f"A0{i}" for i in range(1, 9)]
ILLUS = [f"B0{i}" for i in range(1, 7)]
THREED = [f"C0{i}" for i in range(1, 9)]
D_2D = ["D01", "D02", "D03", "D04", "D06", "D07", "D08"]  # 2D-ish experimental
D_3D: list[str] = []  # none of D is inherently 3D
PIXEL_KW = ("pixel", "8bit", "8-bit", "16bit", "16-bit", "retro", "gbc", "snes", "nes")
VECTOR_KW = ("vector", "flat", "cartoon", "rounded", "ui", "icon")


def styles_for(asset_type: str, source: str, keywords: list[str], desc: str) -> list[str]:
    text = (" ".join(keywords or []) + " " + (desc or "")).lower()
    is_3d = asset_type in ("model_3d", "animation_3d", "texture", "hdri")
    candidates = (THREED + D_3D) if is_3d else (PIXEL + ILLUS + D_2D)

    # 1. Specific theme matches across the dimension-compatible packs.
    hits = [pid for pid in candidates if any(tok in text for tok in PACK_THEMES.get(pid, []))]

    # 2. Family floor so nothing is left empty / too narrow.
    if is_3d:
        floor = THREED  # any 3D asset is usable across 3D styles
    elif any(k in text for k in PIXEL_KW):
        floor = PIXEL
    elif source == "kenney" or any(k in text for k in VECTOR_KW):
        floor = ILLUS
    else:
        floor = ILLUS + PIXEL  # generic 2D usable in both families

    # Merge specific hits first (priority) + floor, dedup preserving order.
    out: list[str] = []
    for pid in hits + floor:
        if pid not in out:
            out.append(pid)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, asset_type, source_library, keywords, semantic_description "
                "FROM public.asset_library_index"  # re-run over all (overwrite coarse pass)
            )
            rows = cur.fetchall()
            print(f"rows: {len(rows)}")
            updates = []
            specific = 0
            for aid, atype, source, keywords, desc in rows:
                packs = styles_for(atype, source or "", keywords or [], desc or "")
                # count rows that got at least one SPECIFIC theme match (not just floor)
                text = (" ".join(keywords or []) + " " + (desc or "")).lower()
                if any(any(t in text for t in PACK_THEMES.get(p, [])) for p in packs):
                    specific += 1
                updates.append((packs, aid))
            print(f"rows with a specific theme match: {specific} / {len(rows)}")
            if args.dry_run:
                # show a few examples
                for packs, aid in updates[:5]:
                    print("  ", aid[:8], "->", packs[:6])
                print("[dry-run] nothing written")
                return
            for packs, aid in updates:
                cur.execute(
                    "UPDATE public.asset_library_index SET style_pack_compat = %s WHERE id = %s",
                    (packs, aid),
                )
            conn.commit()
            print(f"updated {len(updates)} rows")


if __name__ == "__main__":
    main()
