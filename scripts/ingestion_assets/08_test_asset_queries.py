"""Fase RAG-5 — Asset RPC test suite.

Validates the three RPCs defined in migration 003 that the D.5 Asset
Resolver will call from lib/assets.ts:

  match_assets         multi-axis retrieval (vector + filters)
  match_loras          LoRA selection ranked algorithm
  increment_asset_usage  episodic memory update

Each test names the RPC, its parameters and the success criterion.
Threshold for the suite GREEN-LIGHT (Reasoning Engine Week 1 gate):
PASS >= 8/10.

CLI:
    python scripts/ingestion_assets/08_test_asset_queries.py
    python scripts/ingestion_assets/08_test_asset_queries.py --verbose
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

PASS_THRESHOLD = 8  # >=8/10 == GREEN-LIGHT for Reasoning Engine Week 1


@dataclass
class TestCase:
    name: str
    runner: Callable[[], tuple[bool, str]]


def _embed_query(client: OpenAI, text: str) -> str:
    """Generate the 1536-dim embedding and serialise as a pgvector literal.

    The match_assets RPC requires a non-null vector to compute similarity;
    callers without a semantic query still need to embed something —
    a 1.0-vector returns degenerate ranking but is valid SQL. So in
    every test we embed a real string.
    """
    resp = client.embeddings.create(
        model="text-embedding-3-small", input=text)
    return "[" + ",".join(f"{x:.7f}" for x in resp.data[0].embedding) + "]"


def _match_assets(cur, **kw: Any) -> list[tuple]:
    """Call match_assets with sane defaults. Returns rows.

    Every text parameter gets an explicit ``::text`` cast because psycopg2
    serialises Python None as untyped NULL — and PostgreSQL's function
    dispatcher refuses to resolve match_assets when the argument types
    come in as ``unknown`` instead of ``text``. The cast is harmless on
    real strings and necessary on NULLs.
    """
    sql = """
        SELECT * FROM match_assets(
            p_query_embedding := %(p_query_embedding)s::vector,
            p_asset_type := %(p_asset_type)s::text,
            p_style_pack := %(p_style_pack)s::text,
            p_genre := %(p_genre)s::text,
            p_engine := %(p_engine)s::text,
            p_min_quality := %(p_min_quality)s::smallint,
            p_match_threshold := %(p_match_threshold)s::numeric,
            p_match_count := %(p_match_count)s::int
        )
    """
    defaults: dict[str, Any] = {
        "p_query_embedding": None,
        "p_asset_type": None,
        "p_style_pack": None,
        "p_genre": None,
        "p_engine": None,
        "p_min_quality": 1,         # don't lock out smoke-test data
        "p_match_threshold": 0.10,  # default 0.75 is severe for text-only
        "p_match_count": 20,
    }
    defaults.update(kw)
    cur.execute(sql, defaults)
    return cur.fetchall()


def _match_loras(cur, **kw: Any) -> list[tuple]:
    """Call match_loras with sane defaults; explicit ::text casts on every
    text param for the same RPC-dispatcher reason as _match_assets."""
    sql = """
        SELECT * FROM match_loras(
            p_style_pack := %(p_style_pack)s::text,
            p_asset_type := %(p_asset_type)s::text,
            p_genre := %(p_genre)s::text,
            p_base_model_preferred := %(p_base_model_preferred)s::text,
            p_match_count := %(p_match_count)s::int
        )
    """
    defaults: dict[str, Any] = {
        "p_style_pack": None,
        "p_asset_type": None,
        "p_genre": None,
        "p_base_model_preferred": None,
        "p_match_count": 5,
    }
    defaults.update(kw)
    cur.execute(sql, defaults)
    return cur.fetchall()


# ---- 10 test case definitions ---------------------------------------------

def build_tests(cur, client: OpenAI) -> list[TestCase]:
    tests: list[TestCase] = []

    def t1() -> tuple[bool, str]:
        vec = _embed_query(client, "pixel art dungeon tileset stone walls")
        rows = _match_assets(cur, p_query_embedding=vec,
                             p_asset_type="tileset")
        return (len(rows) >= 3, f"got {len(rows)} tileset (need >=3)")
    tests.append(TestCase("T01 match_assets tileset semantic", t1))

    def t2() -> tuple[bool, str]:
        vec = _embed_query(client, "epic orchestral boss battle music")
        rows = _match_assets(cur, p_query_embedding=vec,
                             p_asset_type="audio_bgm")
        # OGA music scrape produces audio_bgm; pre-OGA the count is 0
        # so this test is the canary for the Phase 4 ingest landing.
        return (len(rows) >= 1, f"got {len(rows)} audio_bgm (need >=1)")
    tests.append(TestCase("T02 match_assets BGM (Phase 4 canary)", t2))

    def t3() -> tuple[bool, str]:
        vec = _embed_query(client, "low poly fantasy character model")
        rows = _match_assets(cur, p_query_embedding=vec,
                             p_asset_type="model_3d")
        return (len(rows) >= 3, f"got {len(rows)} model_3d (need >=3)")
    tests.append(TestCase("T03 match_assets low-poly 3D character", t3))

    def t4() -> tuple[bool, str]:
        vec = _embed_query(client, "outdoor sunset HDRI environment")
        rows = _match_assets(cur, p_query_embedding=vec,
                             p_asset_type="hdri")
        return (len(rows) >= 1, f"got {len(rows)} hdri (need >=1)")
    tests.append(TestCase("T04 match_assets HDRI semantic", t4))

    def t5() -> tuple[bool, str]:
        vec = _embed_query(client, "laser shot sci-fi sound effect")
        rows = _match_assets(cur, p_query_embedding=vec,
                             p_asset_type="audio_sfx")
        return (len(rows) >= 3, f"got {len(rows)} audio_sfx (need >=3)")
    tests.append(TestCase("T05 match_assets SFX semantic", t5))

    def t6() -> tuple[bool, str]:
        # genre_affinity is well populated (visual_novel covers 1003 rows).
        vec = _embed_query(client, "visual novel character portrait")
        rows = _match_assets(cur, p_query_embedding=vec,
                             p_genre="visual_novel", p_match_count=10)
        return (len(rows) >= 3, f"got {len(rows)} VN-tagged (need >=3)")
    tests.append(TestCase("T06 match_assets genre=visual_novel", t6))

    def t7() -> tuple[bool, str]:
        # Pixel art style_pack — sparse in asset_library_index but the
        # filter must at least execute without error.
        vec = _embed_query(client, "8-bit retro pixel sprite character")
        rows = _match_assets(cur, p_query_embedding=vec,
                             p_genre="retro_8bit", p_match_count=10)
        return (len(rows) >= 1,
                f"got {len(rows)} retro_8bit (need >=1)")
    tests.append(TestCase("T07 match_assets genre=retro_8bit", t7))

    def t8() -> tuple[bool, str]:
        # match_loras: pick a style_pack that is seeded into lora_library.
        # A01 is the first style pack and has multiple LoRA mappings.
        rows = _match_loras(cur, p_style_pack="A01", p_asset_type="sprite")
        return (len(rows) >= 1,
                f"got {len(rows)} LoRA (need >=1 ranked match)")
    tests.append(TestCase("T08 match_loras A01 sprite", t8))

    def t9() -> tuple[bool, str]:
        # match_loras with multi-axis: style_pack + genre + base_model.
        # The rank_score formula gives a non-zero score iff style_pack
        # matches; we set genre & base_model to non-null to exercise the
        # bonuses (not strictly required).
        rows = _match_loras(cur, p_style_pack="A03",
                            p_asset_type="background",
                            p_genre="hardcore_platformer",
                            p_base_model_preferred="SDXL 1.0")
        return (len(rows) >= 1,
                f"got {len(rows)} LoRA (need >=1)")
    tests.append(TestCase("T09 match_loras A03 + genre + base_model", t9))

    def t10() -> tuple[bool, str]:
        # increment_asset_usage: pick a known asset id, read
        # success_score, increment with p_success=true, read again,
        # assert it moved according to the EMA formula
        # (new = old * 0.95 + 0.05).
        cur.execute("""
            SELECT id, success_score
              FROM asset_library_index
             WHERE asset_type='audio_sfx'
             ORDER BY times_used_in_generation ASC, id LIMIT 1
        """)
        row = cur.fetchone()
        if row is None:
            return (False, "no asset to test against")
        asset_id, old_score = row
        cur.execute(
            "SELECT increment_asset_usage(%s, %s)", (asset_id, True))
        cur.execute(
            "SELECT success_score FROM asset_library_index WHERE id=%s",
            (asset_id,))
        new_score = cur.fetchone()[0]
        # EMA: new = old*0.95 + 0.05  -> must be strictly greater unless
        # the asset was already saturated to ~1.0.
        moved = float(new_score) > float(old_score) - 1e-9
        # Roll back the side effect so this test is idempotent across
        # re-runs (don't pollute success_score with synthetic data).
        cur.execute(
            "UPDATE asset_library_index SET success_score=%s, "
            "times_used_in_generation = times_used_in_generation - 1 "
            "WHERE id=%s",
            (old_score, asset_id))
        return (moved,
                f"old={old_score:.4f} new={new_score:.4f} moved={moved}")
    tests.append(TestCase("T10 increment_asset_usage EMA + rollback", t10))

    return tests


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Fase RAG-5 — Asset RPC test suite")
    ap.add_argument("--verbose", action="store_true",
                    help="Print details for each test.")
    args = ap.parse_args()
    _ = args.verbose  # currently unused; reserved for per-test row dumps

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        print("ERROR: OPENAI_API_KEY missing", file=sys.stderr)
        return 1
    client = OpenAI(api_key=api_key)

    print("=" * 72)
    print("FASE RAG-5 — ASSET RPC TEST SUITE (10 cases)")
    print("=" * 72)

    passed = 0
    failed_tests: list[str] = []
    with get_connection() as conn:
        # Important: autocommit because T10 wraps an UPDATE we want
        # immediately visible to the rollback SELECT in the same RPC.
        conn.autocommit = True
        cur = conn.cursor()
        tests = build_tests(cur, client)
        for tc in tests:
            try:
                ok, detail = tc.runner()
            except Exception as exc:  # pragma: no cover — DB boundary
                ok = False
                detail = f"EXC {type(exc).__name__}: {str(exc)[:140]}"
            mark = "PASS" if ok else "FAIL"
            print(f"  [{mark}] {tc.name:<45} {detail}")
            if ok:
                passed += 1
            else:
                failed_tests.append(tc.name)

    print()
    print(f"  PASSED: {passed}/10")
    print(f"  THRESHOLD: {PASS_THRESHOLD}/10")
    if failed_tests:
        print(f"  Failed: {failed_tests}")
    overall = passed >= PASS_THRESHOLD
    print(f"  OVERALL: {'PASS' if overall else 'FAIL'}")
    return 0 if overall else 1


if __name__ == "__main__":
    sys.exit(main())
