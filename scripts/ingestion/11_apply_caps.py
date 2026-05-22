"""Per-category caps — Fase 1ter cleanup step.

Trims over-stuffed (engine, category) cells in code_knowledge to a target
size by keeping the top-N chunks ordered by (quality_score + reusability_score)
desc, then loc desc. Idempotent: a cell already at-or-below the cap is left
alone. Run after every embed_store cycle so re-parses don't re-introduce
the boilerplate noise we trimmed in Fase 1ter.

The default cap is conservative (250) and applies only to project-structure
and signals cells that empirically grow into category-discariche. Other
cells are uncapped — a high count there is real diversity, not noise.

Why a separate script: embed_store inserts everything that comes out of the
classifier, by design. Capping is a curation policy, not an ingestion fact.
Keeping it isolated means we can audit, dry-run, and tune the policy without
touching the ingestion path.

CLI:
    python scripts/ingestion/11_apply_caps.py            # dry-run
    python scripts/ingestion/11_apply_caps.py --apply    # do it
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.shared.db import get_connection

# (engine, primary_category) -> max chunks kept. The targets here are the
# cells that empirically became dataset-noise: boilerplate Program.cs /
# main.ts / project.godot fragments + Godot's signal scaffolding. Tune
# here; the script is the canonical source.
CAPS: dict[tuple[str, str], int] = {
    ("godot",    "E01_project_structure"): 250,
    ("godot",    "E02_signals_events"):    250,
    ("godot",    "D01_ui"):                250,
    ("threejs",  "E01_project_structure"): 250,
    ("monogame", "E01_project_structure"): 250,
    ("renpy",    "D01_ui"):                250,
}

BACKUP_PATH = REPO_ROOT / "data" / "caps_backup_latest.json"


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Trim over-stuffed engine x category cells.")
    ap.add_argument("--apply", action="store_true",
                    help="Persist the deletions. Default is dry-run.")
    args = ap.parse_args()

    backup: dict[str, object] = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "applied": bool(args.apply),
        "cuts": [],
    }

    with get_connection() as conn:
        cur = conn.cursor()
        total_cut = 0
        for (engine, category), cap in CAPS.items():
            cur.execute(
                "SELECT COUNT(*) FROM code_knowledge "
                "WHERE engine=%s AND primary_category=%s",
                (engine, category))
            cur_count = cur.fetchone()[0]
            if cur_count <= cap:
                print(f"  {engine}.{category}: {cur_count} <= {cap}, skip")
                continue
            cur.execute(
                """SELECT id FROM (
                       SELECT id, ROW_NUMBER() OVER (
                           ORDER BY (quality_score + reusability_score) DESC,
                                    loc DESC, id) AS rn
                       FROM code_knowledge
                       WHERE engine=%s AND primary_category=%s
                   ) t WHERE rn > %s""",
                (engine, category, cap))
            ids = [r[0] for r in cur.fetchall()]
            print(f"  {engine}.{category}: cut {len(ids)} "
                  f"({cur_count} -> {cap})")
            backup["cuts"].append({
                "engine": engine, "category": category,
                "cap": cap, "cut_ids": ids,
            })
            total_cut += len(ids)
            if args.apply:
                cur.execute(
                    "DELETE FROM code_knowledge WHERE id = ANY(%s::uuid[])",
                    (ids,))
        if args.apply:
            conn.commit()
        cur.execute("SELECT COUNT(*) FROM code_knowledge")
        post_total = cur.fetchone()[0]

    BACKUP_PATH.write_text(
        json.dumps(backup, indent=2, default=str), encoding="utf-8")
    print()
    print(f"Total cut: {total_cut}  "
          f"({'APPLIED' if args.apply else 'DRY-RUN'})")
    print(f"code_knowledge after: {post_total}")
    print(f"Backup written: {BACKUP_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
