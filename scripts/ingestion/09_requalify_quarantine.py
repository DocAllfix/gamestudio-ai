"""Re-qualify mis-classified chunks — Fase 1ter recovery step.

Two recovery modes, both targeting the Ren'Py "form over domain" problem:
the Fase 4 classifier reads Ren'Py framework code (inventory, save,
progression, audio) as D01_ui because Ren'Py implements those domains as
`screen` blocks. The screen *form* dominated the *purpose*.

  --source quarantine    Re-classify chunks sitting in
                         code_knowledge_quarantine (confidence 60-84).
                         Promote to code_knowledge when the new pass
                         clears the accept gate (>=85).

  --source code-knowledge --category D01_ui
                         Re-classify chunks already accepted under one
                         category. UPDATE in place when the new pass moves
                         them to a different category with high confidence.

Both modes inject a domain hint into the prompt: "read the screen's
PURPOSE, not its form". The hint is advisory — the LLM still owns the
final call and the confidence gate still binds. Nothing is promoted or
moved below the accept threshold.

Idempotent: a chunk that stays D01_ui (or stays quarantined) is left
untouched, so re-runs converge.

CLI:
    python scripts/ingestion/09_requalify_quarantine.py \
        --engine renpy --source quarantine --dry-run
    python scripts/ingestion/09_requalify_quarantine.py \
        --engine renpy --source code-knowledge --category D01_ui --apply
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

from dotenv import load_dotenv
from tqdm import tqdm

REPO_ROOT = __import__("pathlib").Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.shared.db import get_connection
from scripts.shared.confidence_gate import gate_classification
from scripts.ingestion._classify_llm import (
    PROVIDER_CONFIG,
    DeepSeekClassifier,
)

# Filename / scene-context priors. A token in the chunk's source file path
# or scene_context nudges the classifier toward the right domain. These are
# hints, not overrides — the LLM may disagree and the gate still binds.
DOMAIN_PRIORS: tuple[tuple[tuple[str, ...], str], ...] = (
    (("inventory", "item", "items", "backpack"), "C02_inventory"),
    (("save", "persistent", "load", "slot"), "C04_save_load"),
    (("audio", "music", "sound", "sfx", "voice"), "D02_audio"),
    (("progress", "stats", "stat", "level", "xp", "skill", "attribute"),
     "C01_progression"),
    (("dialog", "dialogue", "script", "chapter", "narrative", "say",
      "conversation"), "C03_dialogue_narrative"),
)

RENPY_DOMAIN_HINT = (
    "This is Ren'Py code. Ren'Py implements many gameplay domains as "
    "`screen` blocks, so a screen is NOT automatically UI. Read the "
    "screen's PURPOSE: if it manages player items -> C02_inventory; save "
    "slots / persistent data -> C04_save_load; music/sound playback -> "
    "D02_audio; stats/level/XP/skills -> C01_progression; branching "
    "dialogue or narrative flow -> C03_dialogue_narrative. Use D01_ui ONLY "
    "for screens that purely render layout with no game-state logic "
    "(main_menu, preferences, options, splash). {prior}"
)


def _prior_for(file_paths: Any, scene_context: str | None) -> str:
    """Return an extra hint string when a filename/context token matches a
    known domain, else empty."""
    haystack = " ".join(
        str(p) for p in (file_paths or [])
    ).lower() + " " + (scene_context or "").lower()
    for tokens, category in DOMAIN_PRIORS:
        if any(t in haystack for t in tokens):
            return (f"A filename/context signal suggests this may be "
                    f"{category} — weigh it, but verify against the code.")
    return ""


def _row_to_chunk(row: dict[str, Any]) -> dict[str, Any]:
    """Adapt a DB record into the shape build_prompt expects, injecting the
    Ren'Py domain hint as a high-confidence heuristic_domain."""
    prior = _prior_for(row.get("source_file_paths"), row.get("scene_context"))
    return {
        "engine": row["engine"],
        "heuristic_confidence": "high",
        "heuristic_domain": RENPY_DOMAIN_HINT.format(prior=prior),
        "heuristic_category": row.get("primary_category", "?"),
        "scene_context": row.get("scene_context") or "",
        "extends_type": None,
        "class_name": None,
        "functions_found": [],
        "signals_defined": [],
        "code": row.get("code", ""),
    }


def _fetch(cur: Any, source: str, engine: str,
           category: str | None) -> list[dict[str, Any]]:
    cols = ("id, engine, primary_category, code, scene_context, "
            "source_file_paths, confidence_score")
    if source == "quarantine":
        cur.execute(
            f"SELECT {cols} FROM code_knowledge_quarantine "
            f"WHERE engine = %s AND confidence_score >= 70 "
            f"ORDER BY confidence_score DESC", (engine,))
    else:
        cur.execute(
            f"SELECT {cols} FROM code_knowledge "
            f"WHERE engine = %s AND primary_category = %s",
            (engine, category))
    names = [d[0] for d in cur.description]
    return [dict(zip(names, r)) for r in cur.fetchall()]


def main() -> int:
    ap = argparse.ArgumentParser(description="Re-qualify mis-classified chunks.")
    ap.add_argument("--engine", default="renpy")
    ap.add_argument("--source", choices=("quarantine", "code-knowledge"),
                    required=True)
    ap.add_argument("--category", help="Only with --source code-knowledge: "
                    "the current category to re-examine (e.g. D01_ui).")
    ap.add_argument("--provider", choices=("deepseek", "openai"),
                    default="openai")
    ap.add_argument("--apply", action="store_true",
                    help="Persist changes. Without it, dry-run only.")
    ap.add_argument("--limit", type=int, default=0,
                    help="Cap chunks processed (0 = all).")
    args = ap.parse_args()

    if args.source == "code-knowledge" and not args.category:
        print("ERROR: --category required with --source code-knowledge",
              file=sys.stderr)
        return 1

    load_dotenv()
    pconf = PROVIDER_CONFIG[args.provider]
    clf = DeepSeekClassifier(
        api_key=os.getenv(pconf["env_var"], ""),
        model=pconf["model"], base_url=pconf["base_url"],
        provider=args.provider)

    with get_connection() as conn:
        cur = conn.cursor()
        rows = _fetch(cur, args.source, args.engine, args.category)
        if args.limit:
            rows = rows[:args.limit]
        print(f"Re-qualifying {len(rows)} chunks "
              f"(source={args.source} engine={args.engine}"
              f"{' cat=' + args.category if args.category else ''})\n")

        moved = 0
        promoted = 0
        unchanged = 0
        cost = 0.0
        moves: dict[str, int] = {}
        pending_writes = 0

        for row in tqdm(rows, desc="requalify"):
            chunk = _row_to_chunk(row)
            result = clf.classify_chunk(chunk)
            cost += result.cost_usd
            if not result.ok or not result.classification:
                unchanged += 1
                continue
            cls = result.classification
            outcome = gate_classification(cls)
            new_cat = cls["primary_category"]
            new_conf = cls["confidence_score"]
            old_cat = row.get("primary_category")

            wrote = False
            if args.source == "quarantine":
                # Promote only if the new pass clears the accept gate AND
                # lands on a real (non-uncertain) category.
                if outcome == "accepted" and not new_cat.startswith("X0"):
                    if args.apply:
                        _promote(cur, row["id"], cls)
                        wrote = True
                    promoted += 1
                    moves[new_cat] = moves.get(new_cat, 0) + 1
                else:
                    unchanged += 1
            else:
                # code-knowledge re-tag: move in place only if the category
                # actually changes, the new pass is confident, and it's a
                # real category. Otherwise leave the accepted chunk alone.
                if (new_cat != old_cat and new_conf >= 85
                        and not new_cat.startswith("X0")):
                    if args.apply:
                        _update_category(cur, row["id"], cls)
                        wrote = True
                    moved += 1
                    moves[f"{old_cat}->{new_cat}"] = \
                        moves.get(f"{old_cat}->{new_cat}", 0) + 1
                else:
                    unchanged += 1

            # Commit incrementally so a dropped connection on a long run
            # never rolls back hundreds of LLM calls. A promoted/re-tagged
            # chunk no longer matches the source query, so re-runs resume
            # naturally from where a crash left off.
            if wrote:
                pending_writes += 1
                if pending_writes >= 20:
                    conn.commit()
                    pending_writes = 0

        if args.apply and pending_writes:
            conn.commit()

    print("\n" + "=" * 56)
    print("RE-QUALIFY SUMMARY")
    print("=" * 56)
    if args.source == "quarantine":
        print(f"Promoted to code_knowledge: {promoted}")
    else:
        print(f"Re-tagged in place:         {moved}")
    print(f"Unchanged:                  {unchanged}")
    print(f"Cost USD:                   ${cost:.4f}")
    print(f"Mode:                       {'APPLY' if args.apply else 'DRY-RUN'}")
    print("\nMoves:")
    for k, v in sorted(moves.items(), key=lambda x: -x[1]):
        print(f"  {k:<35} {v}")
    return 0


def _promote(cur: Any, qid: int, cls: dict[str, Any]) -> None:
    """Copy a quarantine row into code_knowledge with the new classification,
    then delete it from quarantine. Carries over the embedding + code."""
    cur.execute(
        """INSERT INTO code_knowledge (
               engine, language, primary_category, subcategories, chunk_type,
               genre_tags, complexity, design_patterns, key_features,
               quality_score, reusability_score, confidence_score, summary,
               code, loc, source_repo, source_license, source_file_paths,
               scene_context, embedding)
           SELECT engine, language, %s, %s, chunk_type,
                  %s, %s, %s, %s,
                  %s, %s, %s, %s,
                  code, loc, source_repo, source_license, source_file_paths,
                  scene_context, embedding
           FROM code_knowledge_quarantine WHERE id = %s""",
        (cls["primary_category"], cls["subcategories"],
         cls["genre_tags"], cls["complexity"], cls["design_patterns"],
         cls["key_features"], cls["quality_score"], cls["reusability_score"],
         cls["confidence_score"], cls["one_line_summary"], qid))
    cur.execute("DELETE FROM code_knowledge_quarantine WHERE id = %s", (qid,))


def _update_category(cur: Any, cid: int, cls: dict[str, Any]) -> None:
    cur.execute(
        """UPDATE code_knowledge
           SET primary_category = %s, subcategories = %s, genre_tags = %s,
               complexity = %s, design_patterns = %s, key_features = %s,
               confidence_score = %s, summary = %s, updated_at = now()
           WHERE id = %s""",
        (cls["primary_category"], cls["subcategories"], cls["genre_tags"],
         cls["complexity"], cls["design_patterns"], cls["key_features"],
         cls["confidence_score"], cls["one_line_summary"], cid))


if __name__ == "__main__":
    sys.exit(main())
