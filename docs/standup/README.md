# docs/standup/ — Per-day, per-workstream activity log

Daily, async standup notes for the 4-way parallel development phase.

Each workstream writes one **5-line Markdown summary** at the end of
its working day:

- `YYYY-MM-DD_w1.md`  Reasoning + Orchestrator
- `YYYY-MM-DD_w2.md`  Tools + LLM
- `YYYY-MM-DD_w3.md`  Runtime + Sandbox
- `YYYY-MM-DD_w4.md`  Frontend + Billing

Template:

```markdown
# 2026-06-03 — W2 standup

**Done today**
- Phase 2.2 GDScript tool first revision. Smoke-tested on a stub Game Plan.

**Doing tomorrow**
- Phase 2.3 (phaser_js code generator).

**Blockers**
- Need W1 to confirm the GDScript chunk_type tag taxonomy.

**Dependencies emitted**
- Updated `lib/_mocks/tools.mock.ts` with the real
  `code_gen_godot_gdscript` signature.

**Cost burned today**
- ~$0.18 (DeepSeek classify + Helicone trace).
```

The structured machine-readable log lives in `data/standup/W<N>-YYYY-MM-DD.jsonl`
(gitignored).
