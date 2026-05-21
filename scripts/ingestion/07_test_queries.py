"""Fase 6.2 — RAG query test suite.

Runs 20 test cases directly against the Supabase RPCs that lib/knowledge.ts
will use in Phase 2. Each test names a query, the RPC parameters, and the
success criterion. Tests cover:

  - Engine + category filters       (T1..T10)
  - key_features filters            (T11..T15)
  - game_parameters (numeric DNA)   (T16..T18)
  - Semantic vector search          (T19)
  - Cross-genre (metroidvania)      (T20)

Exit code 0 when >=16/20 pass (blueprint §6.2 threshold), else 1.

CLI:
    python scripts/ingestion/07_test_queries.py
    python scripts/ingestion/07_test_queries.py --verbose
"""
from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from openai import OpenAI  # noqa: E402

from scripts.shared.db import get_connection  # noqa: E402

PASS_THRESHOLD = 16  # blueprint §6.2: >=16/20 == FASE 6 GATE


@dataclass
class TestCase:
    name: str
    runner: Callable[[Any], tuple[bool, str]]


def _kb_search(cur, **kw) -> list[tuple]:
    """Call search_code_knowledge with named params. Returns rows."""
    sql = """
        SELECT * FROM search_code_knowledge(
            p_engine := %(p_engine)s,
            p_category := %(p_category)s,
            p_genres := %(p_genres)s,
            p_features := %(p_features)s,
            p_complexity := %(p_complexity)s,
            p_chunk_type := %(p_chunk_type)s,
            p_min_quality := %(p_min_quality)s,
            p_min_confidence := %(p_min_confidence)s,
            p_query_embedding := %(p_query_embedding)s,
            p_limit := %(p_limit)s
        )
    """
    defaults = {
        "p_engine": None, "p_category": None, "p_genres": None,
        "p_features": None, "p_complexity": None, "p_chunk_type": None,
        "p_min_quality": 1, "p_min_confidence": 85,
        "p_query_embedding": None, "p_limit": 50,
    }
    defaults.update(kw)
    cur.execute(sql, defaults)
    return cur.fetchall()


def _params_search(cur, engine: str, genre: str, group: str,
                   min_q: int = 1, limit: int = 50) -> list[tuple]:
    cur.execute("""
        SELECT * FROM get_reference_parameters(
            p_engine := %s, p_genre := %s, p_parameter_group := %s,
            p_min_quality := %s, p_limit := %s)
    """, (engine, genre, group, min_q, limit))
    return cur.fetchall()


def _embed_query(client: OpenAI, text: str) -> str:
    """Generate the 1536-dim embedding and serialise it as the pgvector
    text literal the RPC accepts."""
    resp = client.embeddings.create(
        model="text-embedding-3-small", input=text)
    return "[" + ",".join(f"{x:.7f}" for x in resp.data[0].embedding) + "]"


# ---- 20 test case definitions ---------------------------------------------

def build_tests(cur, client: OpenAI) -> list[TestCase]:
    tests: list[TestCase] = []

    def t1():
        rows = _kb_search(cur, p_engine="godot",
                          p_category="A01_player_controller")
        return (len(rows) >= 3,
                f"got {len(rows)} (need >=3)")
    tests.append(TestCase("T01 Godot player controller", t1))

    def t2():
        rows = _kb_search(cur, p_engine="godot", p_category="A04_enemy_ai")
        return (len(rows) >= 3, f"got {len(rows)} (need >=3)")
    tests.append(TestCase("T02 Godot enemy AI", t2))

    def t3():
        rows = _kb_search(cur, p_engine="godot",
                          p_features=["boss_phase"])
        return (len(rows) >= 1, f"got {len(rows)} (need >=1)")
    tests.append(TestCase("T03 Godot boss fight (boss_phase)", t3))

    def t4():
        rows = _kb_search(cur, p_engine="godot", p_category="A05_camera")
        return (len(rows) >= 1, f"got {len(rows)} (need >=1)")
    tests.append(TestCase("T04 Godot camera system", t4))

    def t5():
        rows = _kb_search(cur, p_engine="godot", p_category="C04_save_load")
        return (len(rows) >= 1, f"got {len(rows)} (need >=1)")
    tests.append(TestCase("T05 Godot save system", t5))

    def t6():
        rows = _kb_search(cur, p_engine="godot", p_category="D01_ui")
        return (len(rows) >= 2, f"got {len(rows)} (need >=2)")
    tests.append(TestCase("T06 Godot UI menu", t6))

    def t7():
        rows = _kb_search(cur, p_engine="godot", p_category="D02_audio")
        return (len(rows) >= 1, f"got {len(rows)} (need >=1)")
    tests.append(TestCase("T07 Godot audio manager", t7))

    def t8():
        rows = _kb_search(cur, p_engine="godot",
                          p_category="B01_level_structure")
        return (len(rows) >= 2, f"got {len(rows)} (need >=2)")
    tests.append(TestCase("T08 Godot level structure", t8))

    def t9():
        rows = _kb_search(cur, p_engine="phaser", p_limit=100)
        return (len(rows) >= 3, f"got {len(rows)} (need >=3)")
    tests.append(TestCase("T09 Phaser game scene", t9))

    def t10():
        rows = _kb_search(cur, p_engine="renpy",
                          p_category="C03_dialogue_narrative")
        return (len(rows) >= 1, f"got {len(rows)} (need >=1)")
    tests.append(TestCase("T10 Ren'Py dialogue", t10))

    def t11():
        rows = _kb_search(cur, p_engine="godot",
                          p_features=["wall_jump"])
        return (len(rows) >= 1, f"got {len(rows)} (need >=1)")
    tests.append(TestCase("T11 Feature: wall_jump", t11))

    def t12():
        rows = _kb_search(cur, p_engine="godot",
                          p_features=["dash"])
        return (len(rows) >= 1, f"got {len(rows)} (need >=1)")
    tests.append(TestCase("T12 Feature: dash", t12))

    def t13():
        rows = _kb_search(cur, p_engine="godot",
                          p_features=["coyote_time"])
        return (len(rows) >= 1, f"got {len(rows)} (need >=1)")
    tests.append(TestCase("T13 Feature: coyote_time", t13))

    def t14():
        rows = _kb_search(cur, p_features=["screen_shake"])
        return (len(rows) >= 1, f"got {len(rows)} (need >=1)")
    tests.append(TestCase("T14 Feature: screen_shake (any engine)", t14))

    def t15():
        rows = _kb_search(cur, p_features=["i_frames"])
        return (len(rows) >= 1, f"got {len(rows)} (need >=1)")
    tests.append(TestCase("T15 Feature: i_frames (any engine)", t15))

    def t16():
        rows = _params_search(cur, engine="godot", genre="platformer",
                              group="player_physics")
        return (len(rows) >= 3, f"got {len(rows)} (need >=3)")
    tests.append(TestCase("T16 Params: godot platformer player_physics", t16))

    def t17():
        cur.execute("""
            SELECT * FROM game_parameters
            WHERE engine='godot' AND parameter_group='enemy_stats'
            LIMIT 10
        """)
        rows = cur.fetchall()
        return (len(rows) >= 1, f"got {len(rows)} (need >=1)")
    tests.append(TestCase("T17 Params: godot enemy_stats (any genre)", t17))

    def t18():
        cur.execute("""
            SELECT * FROM game_parameters
            WHERE engine='godot' AND parameter_group='combat_stats'
            LIMIT 10
        """)
        rows = cur.fetchall()
        return (len(rows) >= 1, f"got {len(rows)} (need >=1)")
    tests.append(TestCase("T18 Params: godot combat_stats", t18))

    def t19():
        vec = _embed_query(client,
                           "2D platformer movement with double jump")
        rows = _kb_search(cur, p_engine="godot",
                          p_query_embedding=vec, p_limit=5)
        platformer_hits = [r for r in rows
                           if "A01_player_controller" in (r[2] or "")
                           or "platformer" in (r[5] or [])]
        return (len(platformer_hits) >= 1,
                f"got {len(rows)} rows, {len(platformer_hits)} platformer-relevant")
    tests.append(TestCase("T19 Semantic: 2D platformer movement", t19))

    def t20():
        rows = _kb_search(cur, p_genres=["metroidvania"], p_limit=50)
        return (len(rows) >= 1, f"got {len(rows)} (need >=1)")
    tests.append(TestCase("T20 Cross-genre: metroidvania", t20))

    return tests


def main() -> int:
    ap = argparse.ArgumentParser(description="Fase 6.2 — RAG test suite")
    ap.add_argument("--verbose", action="store_true",
                    help="Print details for each test.")
    args = ap.parse_args()

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        print("ERROR: OPENAI_API_KEY missing", file=sys.stderr)
        return 1
    client = OpenAI(api_key=api_key)

    print("=" * 72)
    print("FASE 6.2 — RAG TEST SUITE (20 cases)")
    print("=" * 72)

    passed = 0
    failed_tests: list[str] = []
    with get_connection() as conn:
        cur = conn.cursor()
        tests = build_tests(cur, client)
        for tc in tests:
            try:
                ok, detail = tc.runner()
            except Exception as exc:
                ok = False
                detail = f"EXC {type(exc).__name__}: {str(exc)[:120]}"
            mark = "PASS" if ok else "FAIL"
            print(f"  [{mark}] {tc.name:<45} {detail}")
            if ok:
                passed += 1
            else:
                failed_tests.append(tc.name)

    print()
    print(f"  PASSED: {passed}/20")
    print(f"  THRESHOLD: {PASS_THRESHOLD}/20")
    if failed_tests:
        print(f"  Failed tests: {failed_tests}")
    overall = passed >= PASS_THRESHOLD
    print(f"  OVERALL: {'PASS' if overall else 'FAIL'}")
    return 0 if overall else 1


if __name__ == "__main__":
    sys.exit(main())
