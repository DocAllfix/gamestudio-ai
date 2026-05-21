"""Pre-Fase 4 readiness audit. Read-only.

Generates data/preflight_report.json and prints a one-page summary verifying
that the chunk dataset is ready for the LLM classifier (04_classify.py):

  - chunk count within budget (~9 500–12 000)
  - genre coverage matrix from blueprint §1.3 (target: every genre ≥60%)
  - schema parity (1 unique key set across the whole dataset)
  - DeepSeek V4 Flash cost estimate vs the $5 blueprint budget

Re-runnable any time without side effects.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CHUNKS_RAW = REPO_ROOT / "data" / "chunks_raw"
OUT_PATH = REPO_ROOT / "data" / "preflight_report.json"

# §1.3 of SUPREME_RAG_BLUEPRINT. Subcategory pins (e.g. C01.08) collapse to
# their primary category — we don't yet emit subcategories in Fase 3.
GENRES: dict[str, list[str]] = {
    "platformer_metroidvania": ["A01_player_controller","A02_state_machine","A03_combat","A04_enemy_ai","A05_camera","B01_level_structure","B03_physics_collision","C04_save_load","D01_ui","D02_audio","D03_vfx"],
    "rpg_jrpg":                ["A01_player_controller","A04_enemy_ai","C01_progression","C02_inventory","C03_dialogue_narrative","C04_save_load","D01_ui","D02_audio","E04_genre_specific"],
    "roguelike":               ["A01_player_controller","A02_state_machine","A03_combat","A04_enemy_ai","B02_procedural_gen","C02_inventory","D01_ui","D03_vfx"],
    "visual_novel":            ["C03_dialogue_narrative","D01_ui","D02_audio","C04_save_load","E04_genre_specific"],
    "puzzle_mobile":           ["A01_player_controller","A05_camera","D01_ui","D02_audio"],
    "card_deckbuilder":        ["E04_genre_specific","C01_progression","D01_ui","D02_audio","C04_save_load"],
    "action_beatemup":         ["A01_player_controller","A02_state_machine","A03_combat","A04_enemy_ai","A05_camera","B01_level_structure","D01_ui","D02_audio","D03_vfx"],
    "bullet_hell_arcade":      ["A01_player_controller","A03_combat","A04_enemy_ai","A05_camera","D01_ui","D03_vfx","D02_audio"],
    "tower_defense":           ["E04_genre_specific","A04_enemy_ai","C01_progression","D01_ui","D02_audio"],
    "farm_sim":                ["A01_player_controller","C02_inventory","C03_dialogue_narrative","C01_progression","C04_save_load","D01_ui","D02_audio","E04_genre_specific"],
    "horror":                  ["A01_player_controller","A04_enemy_ai","C03_dialogue_narrative","D02_audio","D03_vfx","C04_save_load"],
    "browser_3d":              ["A01_player_controller","A05_camera","B01_level_structure","D01_ui","D03_vfx"],
    "platformer_hardcore":     ["A01_player_controller","A02_state_machine","A05_camera","B01_level_structure","B03_physics_collision","D01_ui","D03_vfx"],
}

DEEPSEEK_INPUT_USD_PER_M = 0.27   # DeepSeek V4 Flash input pricing
NAIVE_USD_PER_CHUNK = 0.0003       # from blueprint §2.5
BUDGET_USD = 5.0


def scan_chunks() -> dict[str, Any]:
    files = sorted(CHUNKS_RAW.glob("*/*/chunk_*.json"))
    cat = Counter(); by_eng = Counter(); ct = Counter(); conf = Counter()
    key_sigs: set[frozenset[str]] = set()
    loc_total = 0
    char_total = 0
    for f in files:
        c = json.loads(f.read_text(encoding="utf-8"))
        cat[c["heuristic_category"]] += 1
        by_eng[c["engine"]] += 1
        ct[c.get("chunk_type", "MISSING")] += 1
        conf[c["heuristic_confidence"]] += 1
        loc_total += int(c.get("loc", 0))
        char_total += len(c.get("code", ""))
        key_sigs.add(frozenset(c.keys()))

    return {
        "files": files,
        "total": len(files),
        "by_engine": dict(by_eng),
        "by_category": dict(cat),
        "by_chunk_type": dict(ct),
        "by_confidence": dict(conf),
        "loc_total": loc_total,
        "char_total": char_total,
        "key_signatures": [sorted(s) for s in key_sigs],
    }


def genre_matrix(cat: dict[str, int]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for g, reqs in GENRES.items():
        covered = sum(1 for r in reqs if cat.get(r, 0) > 0)
        out[g] = {
            "required": len(reqs),
            "covered": covered,
            "pct": round(100 * covered / len(reqs), 1),
            "missing": [r for r in reqs if cat.get(r, 0) == 0],
        }
    return out


def cost_estimate(total: int, char_total: int) -> dict[str, Any]:
    avg_chars_per_chunk = char_total / total if total else 0
    avg_input_tokens = min(avg_chars_per_chunk / 4, 3000) + 250
    input_tokens_total = avg_input_tokens * total
    input_cost = input_tokens_total * DEEPSEEK_INPUT_USD_PER_M / 1_000_000
    naive_cost = NAIVE_USD_PER_CHUNK * total
    return {
        "model": "deepseek-chat",
        "chunks": total,
        "avg_input_tokens_per_chunk": round(avg_input_tokens, 0),
        "est_total_input_tokens": int(input_tokens_total),
        "est_input_cost_usd": round(input_cost, 3),
        "naive_per_chunk_cost_usd": round(naive_cost, 2),
        "blueprint_budget_usd": BUDGET_USD,
        "headroom_pct": round(100 * (BUDGET_USD - naive_cost) / BUDGET_USD, 1),
    }


def render(report: dict[str, Any]) -> None:
    print("=" * 64)
    print("PREFLIGHT FOR FASE 4")
    print("=" * 64)
    print(f"Total chunks:     {report['total']}")
    print(f"Unique schemas:   {report['unique_key_signatures']}")
    print(f"By engine:        {report['by_engine']}")
    print(f"By chunk_type:    {report['by_chunk_type']}")
    print(f"By confidence:    {report['by_confidence']}")
    print()
    ce = report["cost_estimate"]
    print(f"Cost estimate:    ${ce['naive_per_chunk_cost_usd']:.2f}  "
          f"(budget ${ce['blueprint_budget_usd']:.0f}, "
          f"headroom {ce['headroom_pct']}%)")
    print()
    print("Genre coverage (target >=60% each):")
    for g, v in report["genre_coverage"].items():
        flag = "" if v["pct"] >= 60 else "  <<-- LOW"
        print(f"  {g:<28} {v['covered']}/{v['required']}  "
              f"({v['pct']:>5.1f}%){flag}")
    print()
    print(f"READY FOR FASE 4: {report['ready']}")
    if not report["ready"]:
        print("  Gates failed:", report["failed_gates"])


def main() -> int:
    ap = argparse.ArgumentParser(description="Pre-Fase 4 readiness audit")
    ap.add_argument("--quiet", action="store_true",
                    help="Suppress the printed summary.")
    args = ap.parse_args()

    if not CHUNKS_RAW.is_dir():
        print(f"ERROR: {CHUNKS_RAW} missing.", file=sys.stderr)
        return 1

    s = scan_chunks()
    cov = genre_matrix(s["by_category"])
    cost = cost_estimate(s["total"], s["char_total"])

    failed: list[str] = []
    if not 9500 <= s["total"] <= 12000:
        failed.append(f"chunk_count_out_of_band ({s['total']})")
    if len(s["key_signatures"]) != 1:
        failed.append(f"schema_drift ({len(s['key_signatures'])} sigs)")
    if cost["naive_per_chunk_cost_usd"] >= 4.5:
        failed.append(f"cost_over_threshold (${cost['naive_per_chunk_cost_usd']})")
    low_genres = [g for g, v in cov.items() if v["pct"] < 60]
    if low_genres:
        failed.append(f"low_genre_coverage ({','.join(low_genres)})")
    if s["by_chunk_type"].get("MISSING", 0) > 0:
        failed.append(f"chunk_type_missing ({s['by_chunk_type']['MISSING']})")

    report: dict[str, Any] = {
        "total": s["total"],
        "by_engine": s["by_engine"],
        "by_category": s["by_category"],
        "by_chunk_type": s["by_chunk_type"],
        "by_confidence": s["by_confidence"],
        "loc": {"total": s["loc_total"],
                "avg_per_chunk": s["loc_total"] // s["total"] if s["total"] else 0},
        "unique_key_signatures": len(s["key_signatures"]),
        "key_signatures": s["key_signatures"],
        "cost_estimate": cost,
        "genre_coverage": cov,
        "ready": not failed,
        "failed_gates": failed,
    }
    OUT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False),
                        encoding="utf-8")
    if not args.quiet:
        render(report)
        print(f"\nReport: {OUT_PATH}")
    return 0 if report["ready"] else 1


if __name__ == "__main__":
    sys.exit(main())
