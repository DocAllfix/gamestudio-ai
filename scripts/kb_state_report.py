"""Generate docs/KB_STATE.md from the live Supabase DB — the single numeric
source of truth for the Knowledge Base.

The historical docs disagree on KB counts (7336 vs 7503 vs 8517) because they
are snapshots from different dates. This script queries the DB directly so the
numbers are always current. Re-run it whenever the KB changes; never hand-edit
the generated KB_STATE.md.

Read-only: SELECTs only, no writes.

Usage:
    python scripts/kb_state_report.py            # write docs/KB_STATE.md
    python scripts/kb_state_report.py --dry-run  # print to stdout, write nothing
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from shared.db import get_connection

OUTPUT = Path(__file__).resolve().parent.parent / "docs" / "KB_STATE.md"


def fetch(cur, sql: str) -> list[tuple]:
    cur.execute(sql)
    return cur.fetchall()


def build_report(cur) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    total = fetch(cur, "select count(*) from code_knowledge;")[0][0]

    per_engine = fetch(cur, """
        select engine,
               count(*),
               count(*) filter (where quality_score >= 4),
               round(avg(quality_score)::numeric, 2)
        from code_knowledge
        group by engine
        order by count(*) desc;
    """)

    per_category = fetch(cur, """
        select primary_category, count(*)
        from code_knowledge
        group by primary_category
        order by count(*) desc;
    """)

    licenses = fetch(cur, """
        select coalesce(source_license, 'NULL'), count(*)
        from code_knowledge
        group by source_license
        order by count(*) desc;
    """)

    params = fetch(cur, "select count(*) from game_parameters;")[0][0]
    quarantine = fetch(cur, "select count(*) from code_knowledge_quarantine;")[0][0]

    assets = fetch(cur, "select count(*) from asset_library_index;")[0][0]
    assets_by_type = fetch(cur, """
        select asset_type, count(*)
        from asset_library_index
        group by asset_type
        order by count(*) desc;
    """)

    catalogs = {}
    for tbl in ("style_packs", "genre_templates", "reference_games",
                "audio_mood_library", "lora_library"):
        catalogs[tbl] = fetch(cur, f"select count(*) from {tbl};")[0][0]

    lines: list[str] = []
    lines.append("# KB STATE — fonte numerica unica della Knowledge Base")
    lines.append("")
    lines.append(f"**Generato**: {now} — da `scripts/kb_state_report.py` "
                 "(query dirette al DB).")
    lines.append("")
    lines.append("> ⚠️ **AUTO-GENERATO — non editare a mano.** I documenti "
                 "storici (pietra v4/v5, blueprint, coverage snapshot) "
                 "divergono sui conteggi (7336 / 7503 / 8517) perché sono "
                 "snapshot di date diverse. **Questo file è l'unica fonte "
                 "numerica corrente.** Rigenera con "
                 "`python scripts/kb_state_report.py` quando la KB cambia.")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append(f"## code_knowledge — totale: **{total}** chunk")
    lines.append("")
    lines.append("| Engine | Chunk | Qualità ≥4 | Qualità media |")
    lines.append("|---|---:|---:|---:|")
    for engine, cnt, q4, avg in per_engine:
        lines.append(f"| {engine} | {cnt} | {q4} | {avg} |")
    lines.append("")
    lines.append(f"Quarantine (`code_knowledge_quarantine`, confidence 60-84): "
                 f"**{quarantine}** | game_parameters: **{params}**")
    lines.append("")
    lines.append("## Distribuzione per categoria primaria")
    lines.append("")
    lines.append("| Categoria | Chunk |")
    lines.append("|---|---:|")
    for cat, cnt in per_category:
        lines.append(f"| {cat} | {cnt} |")
    lines.append("")
    lines.append("## Licenze (deve essere 100% allowlist, 0 NULL/GPL)")
    lines.append("")
    lines.append("| Licenza | Chunk |")
    lines.append("|---|---:|")
    for lic, cnt in licenses:
        lines.append(f"| {lic} | {cnt} |")
    lines.append("")
    lines.append(f"## asset_library_index — totale: **{assets}** asset CC0")
    lines.append("")
    lines.append("| Tipo asset | Count |")
    lines.append("|---|---:|")
    for atype, cnt in assets_by_type:
        lines.append(f"| {atype} | {cnt} |")
    lines.append("")
    lines.append("## Cataloghi seedati (migration 003)")
    lines.append("")
    lines.append("| Tabella | Righe |")
    lines.append("|---|---:|")
    for tbl, cnt in catalogs.items():
        lines.append(f"| {tbl} | {cnt} |")
    lines.append("")
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="print to stdout, write nothing")
    args = parser.parse_args()

    with get_connection() as conn, conn.cursor() as cur:
        report = build_report(cur)

    if args.dry_run:
        # Force UTF-8 on stdout: the report contains non-cp1252 chars (⚠️, ≥)
        # that break the default Windows console encoding.
        sys.stdout.reconfigure(encoding="utf-8")
        print(report)
        return

    OUTPUT.write_text(report, encoding="utf-8")
    print(f"Wrote {OUTPUT} ({len(report)} bytes)")


if __name__ == "__main__":
    main()
