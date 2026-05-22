"""Coverage report — Fase 1ter verification step.

Reads code_knowledge and emits the engine x category coverage matrix plus
the derived gap analysis the dataset planning depends on:

  - per-engine totals
  - the full 8 x 21 heatmap (counts)
  - zero cells and thin cells (< MIN_HEALTHY)
  - over-stuffed cells (> MAX_HEALTHY — likely a category-discarica)
  - genre coverage (which engines can plausibly back each genre)

Writes data/coverage_report_phase1ter.json and prints a human summary.
Read-only: never writes to the DB.

CLI:
    python scripts/ingestion/10_coverage_report.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.shared.db import get_connection

# The 21 "real" categories. X00_uncertain and X02_trash are escape hatches,
# not coverage targets, so they're excluded from the gap math.
CATEGORIES = [
    "A01_player_controller", "A02_state_machine", "A03_combat",
    "A04_enemy_ai", "A05_camera",
    "B01_level_structure", "B02_procedural_gen", "B03_physics_collision",
    "B04_navigation",
    "C01_progression", "C02_inventory", "C03_dialogue_narrative",
    "C04_save_load",
    "D01_ui", "D02_audio", "D03_vfx",
    "E01_project_structure", "E02_signals_events", "E03_game_flow",
    "E04_genre_specific", "X01_utility",
]
ENGINES = ["godot", "phaser", "renpy", "defold", "monogame", "love2d",
           "threejs", "stride"]

MIN_HEALTHY = 5     # below this a cell is "thin" (weak grounding)
MAX_HEALTHY = 250   # above this a cell may be a category-discarica

# A genre is "backed" by an engine when that engine has >=MIN_HEALTHY chunks
# in every category the genre leans on. These are the genre->category maps
# the product's getReferences() will lean on.
GENRES: dict[str, list[str]] = {
    "platformer": ["A01_player_controller", "A02_state_machine",
                   "B03_physics_collision"],
    "rpg": ["C01_progression", "C02_inventory", "C03_dialogue_narrative",
            "C04_save_load"],
    "visual_novel": ["C03_dialogue_narrative", "C04_save_load", "D01_ui",
                     "E04_genre_specific"],
    "shooter": ["A01_player_controller", "A03_combat", "A04_enemy_ai",
                "B03_physics_collision"],
    "roguelike": ["B02_procedural_gen", "C02_inventory", "A02_state_machine"],
    "puzzle": ["A02_state_machine", "B01_level_structure", "D01_ui"],
    "sandbox_3d": ["B01_level_structure", "A05_camera", "D03_vfx"],
    "html5_casual": ["A01_player_controller", "B03_physics_collision",
                     "D01_ui", "E03_game_flow"],
}


def build_matrix(cur) -> dict[str, dict[str, int]]:
    cur.execute(
        "SELECT engine, primary_category, COUNT(*) FROM code_knowledge "
        "GROUP BY 1, 2")
    matrix: dict[str, dict[str, int]] = {e: {} for e in ENGINES}
    for engine, cat, n in cur.fetchall():
        matrix.setdefault(engine, {})[cat] = n
    return matrix


def main() -> int:
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM code_knowledge")
        total = cur.fetchone()[0]
        matrix = build_matrix(cur)
        cur.execute(
            "SELECT engine, COUNT(*) FROM code_knowledge GROUP BY 1")
        engine_totals = dict(cur.fetchall())

    zero_cells: list[str] = []
    thin_cells: list[str] = []
    fat_cells: list[str] = []
    for eng in ENGINES:
        for cat in CATEGORIES:
            n = matrix.get(eng, {}).get(cat, 0)
            if n == 0:
                zero_cells.append(f"{eng}.{cat}")
            elif n < MIN_HEALTHY:
                thin_cells.append(f"{eng}.{cat} ({n})")
            elif n > MAX_HEALTHY:
                fat_cells.append(f"{eng}.{cat} ({n})")

    genre_coverage: dict[str, list[str]] = {}
    for genre, cats in GENRES.items():
        backed = [
            eng for eng in ENGINES
            if all(matrix.get(eng, {}).get(c, 0) >= MIN_HEALTHY for c in cats)
        ]
        genre_coverage[genre] = backed

    report = {
        "total_chunks": total,
        "engine_totals": engine_totals,
        "matrix": matrix,
        "zero_cells": zero_cells,
        "thin_cells": thin_cells,
        "fat_cells": fat_cells,
        "genre_coverage": genre_coverage,
        "thresholds": {"min_healthy": MIN_HEALTHY, "max_healthy": MAX_HEALTHY},
    }
    out = REPO_ROOT / "data" / "coverage_report_phase1ter.json"
    out.write_text(json.dumps(report, indent=2, sort_keys=True),
                   encoding="utf-8")

    print(f"Total chunks: {total}\n")
    print("Per engine:")
    for eng in ENGINES:
        print(f"  {eng:<10} {engine_totals.get(eng, 0)}")

    print(f"\nHeatmap ({'.' if False else 'count, blank=0'}):")
    hdr = "category".ljust(24) + "".join(e[:6].rjust(8) for e in ENGINES)
    print(hdr)
    print("-" * len(hdr))
    for cat in CATEGORIES:
        cells = "".join(
            (str(matrix.get(e, {}).get(cat, 0)) or "").rjust(8)
            for e in ENGINES)
        print(cat.ljust(24) + cells)

    print(f"\nZERO cells ({len(zero_cells)}):")
    for c in zero_cells:
        print(f"  {c}")
    print(f"\nTHIN cells <{MIN_HEALTHY} ({len(thin_cells)}):")
    for c in thin_cells:
        print(f"  {c}")
    print(f"\nFAT cells >{MAX_HEALTHY} ({len(fat_cells)}):")
    for c in fat_cells:
        print(f"  {c}")

    print("\nGenre coverage (engines with >=5 chunks in every needed cat):")
    for genre, backed in genre_coverage.items():
        print(f"  {genre:<15} {', '.join(backed) or '(none)'}")

    print(f"\nReport: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
