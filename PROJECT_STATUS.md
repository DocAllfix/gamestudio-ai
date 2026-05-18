# Game Studio AI — Project Status

Tracks pre-alpha milestones for the Knowledge Base pipeline.

---

## Phase 0 — Workspace Bootstrap

- [x] 0.1 — Git repo initialized with `.gitignore` (excludes `.env`, `data/`, `test_output/`, `node_modules/`, Python caches)
- [x] 0.2 — Directory structure scaffolded (`docs/`, `scripts/ingestion/`, `scripts/shared/`, `lib/`, `supabase/migrations/`, `data/*`, `test_output/`)
- [x] 0.3 — Project configuration in place (`package.json`, `tsconfig.json` strict mode, `requirements.txt`, `.env.example`) and dependencies installed (npm + pip)

---

## Phase 1 — RAG Knowledge Base

### 1.A — Foundations
- [ ] 1.1 — Reference docs imported: `docs/pietra_v4.md`, `docs/SUPREME_RAG_BLUEPRINT.md`, `docs/MASTER_EXECUTION_PLAN.md`
- [ ] 1.2 — Supabase migration `001_knowledge_base.sql` (pgvector schema + quarantine table)
- [ ] 1.3 — Shared Python utilities in `scripts/shared/` (env loader, logging, dry-run helper)

### 1.B — Ingestion Pipeline
- [ ] 1.4 — `01_scrape.py` — GitHub + awesome-lists scraper (license + size filters)
- [ ] 1.5 — `02_filter.py` — Structural quality gate (Godot 4 `config_version=5`, license whitelist, <=100MB)
- [ ] 1.6 — `03_parse_godot.py` — `.tscn` / `.gd` parser
- [ ] 1.7 — `03_parse_phaser.py` — Phaser scene parser
- [ ] 1.8 — `03_parse_renpy.py` — Ren'Py `.rpy` parser
- [ ] 1.9 — `03_parse_generic.py` — Defold / MonoGame / LÖVE / Three.js / Stride
- [ ] 1.10 — `04_classify.py` — 2-step LLM classification with JSON Schema + confidence gate (<85 -> quarantine)
- [ ] 1.11 — `05_embed_store.py` — OpenAI `text-embedding-3-small` -> Supabase pgvector

### 1.C — Validation
- [ ] 1.12 — `06_validate.py` — Post-ingestion sanity checks
- [ ] 1.13 — `07_test_queries.py` — Query test suite
- [ ] 1.14 — `lib/knowledge.ts` — `getReferences()` + `getReferenceParameters()`
- [ ] 1.15 — `lib/types.ts` — Shared TS types
- [ ] 1.16 — Comparison test: `test_output/without_kb.gd` vs `test_output/with_kb.gd`

---

## Phase 2 — Product (deferred)

Locked until Phase 1 validation passes.
