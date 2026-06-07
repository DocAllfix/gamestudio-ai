# Fine-Tune Dataset — Godot code-gen (the data moat)

Every real generation collects training data automatically. Over volume this
becomes a Godot-4 code model fine-tuned on OUR validated games → a moat
competitors can't copy (see memory: fine-tune-godot-azure, 100% playable).

## What we collect (per generation, in `public.run_traces`)
For each `code_gen` tool step the tracer writes one row with:
- **`input`** — the exact tool input (mechanic / context / level_layout /
  playtest_feedback). This is the PROMPT side of the pair. *(Added 2026-06-07;
  before, input wasn't saved, so codes had no matching prompt — unusable.)*
- **`generated_code`** — the final code the model produced.
- **`output.qa_log`** — every self-heal attempt with its exact compiler/runtime
  error (`code_validates: attempt N: <error>`), so repairs (broken+error→fixed)
  are recoverable too.
- **`status`** — only `succeeded` rows passed BOTH `--check-only` (syntax) and
  the runtime self-heal (actually runs headless) → clean targets, no broken code.

Plus the run-level signals already there: build pass, smoke crash_reason,
playtest verdict, cost, latency, model. So a sample can be filtered by "actually
playable" (playtest passed), not just "compiled".

## Why this is clean (not polluted)
- Targets are validated: a code that crashes at runtime is NOT status=succeeded,
  so it never becomes a training target.
- The (input → code) pair is exact (same input the model saw).
- Repair pairs come from qa_log: the broken attempt + its real error + the fix.

## Export
```bash
python scripts/dataset/export_finetune.py --dry-run            # count, write nothing
python scripts/dataset/export_finetune.py --engine godot \
    --out data/finetune/godot.jsonl                            # Azure chat FT format
```
Output = JSONL `{"messages":[{system},{user},{assistant}]}` — the format Azure
OpenAI fine-tune ingests directly.

## Roadmap
1. Now: collection is live + correct (input + code + errors per attempt).
2. At volume (hundreds of validated games): export → Azure fine-tune a Godot-4
   model → A/B vs Claude (quality + cost + latency). Ship the cheaper/faster one
   if it matches quality; Claude stays the fallback.
3. Repair-tuning: train on (broken+error→fixed) so the self-heal converges in
   fewer attempts.
