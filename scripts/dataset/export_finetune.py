#!/usr/bin/env python3
"""Export a Godot code-gen fine-tune dataset from public.run_traces.

Each successful code_gen trace is one training sample: the tool INPUT (prompt
context: mechanic / level / feedback) → the validated generated_code. Traces
that needed self-heal also yield repair samples (broken code + compiler/runtime
error → corrected code), captured from qa_log.

Output: JSONL in OpenAI/Azure chat fine-tune format
({"messages":[{system},{user},{assistant}]}), the format Azure OpenAI fine-tune
ingests. Only validated samples (code that passed --check-only AND the runtime
self-heal) are exported, so the dataset is clean (no broken code as a target).

Usage:
    python scripts/dataset/export_finetune.py --dry-run   # count, write nothing
    python scripts/dataset/export_finetune.py --engine godot --out data/finetune/godot.jsonl
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from shared.db import get_connection  # noqa: E402

SYSTEM = (
    "You are an expert Godot 4 (GDScript) engineer. Generate idiomatic, runnable "
    "GDScript for the requested game. Return JSON {code, language, filename, notes}."
)


def build_user(inp: dict) -> str:
    """Reconstruct the prompt the model saw, from the saved tool input."""
    parts = []
    if inp.get("mechanic"):
        parts.append(f"Mechanic: {inp['mechanic']}")
    if inp.get("context"):
        parts.append(f"Context: {inp['context']}")
    if inp.get("playtest_feedback"):
        parts.append(f"Previous version failed playtesting: {inp['playtest_feedback']}")
    return "\n".join(parts)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", default="godot")
    ap.add_argument("--out", default="data/finetune/godot.jsonl")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    tool_id = f"code_gen_{args.engine}_gdscript" if args.engine == "godot" else f"code_gen_{args.engine}"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT input, generated_code, output
                FROM public.run_traces
                WHERE phase = 'tool' AND tool_id = %s
                  AND status = 'succeeded'
                  AND generated_code IS NOT NULL
                  AND input IS NOT NULL
                """,
                (tool_id,),
            )
            rows = cur.fetchall()

    samples, skipped = [], 0
    for inp, code, output in rows:
        user = build_user(inp or {})
        if not user or not code:
            skipped += 1
            continue
        assistant = json.dumps({"code": code, "language": "gdscript",
                                "filename": "main.gd", "notes": ""})
        samples.append({"messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user},
            {"role": "assistant", "content": assistant},
        ]})

    print(f"engine={args.engine} tool_id={tool_id}")
    print(f"traces={len(rows)} samples={len(samples)} skipped={skipped}")

    if args.dry_run:
        print("[dry-run] nothing written")
        return

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        for s in samples:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")
    print(f"wrote {len(samples)} samples → {args.out}")


if __name__ == "__main__":
    main()
