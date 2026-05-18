# Game Studio AI — Project Status

Operational tracker for the pre-alpha pipeline. Phases and sub-phases mirror
[docs/MASTER_EXECUTION_PLAN.md](docs/MASTER_EXECUTION_PLAN.md) §03.

Conventions:
- Tick a sub-phase only when its checklist in MASTER_EXECUTION_PLAN passes.
- Commit message format: `feat(phase-N): <description>` or `fix(phase-N): ...`.
- Never skip ahead — every phase has hard verification gates.

---

## FASE 0 — Workspace Setup & DB Schema

- [x] **0.1** — Init progetto (`package.json`, `tsconfig.json`, `requirements.txt`, `.gitignore`, `.env.example`)
  - commit: `feat(phase-0): initialize workspace and project structure`
- [x] **0.2** — Struttura directory (`docs/`, `scripts/ingestion/`, `scripts/shared/`, `lib/`, `supabase/migrations/`, `data/*`, `test_output/`) con `.gitkeep`
  - commit: `feat(phase-0): scaffold project directory layout`
- [x] **0.3** — Documenti fondativi in `docs/` (`pietra_v4.md`, `SUPREME_RAG_BLUEPRINT.md`, `MASTER_EXECUTION_PLAN.md`)
  - commit: `feat(phase-0): import foundational design docs`
- [x] **0.4** — `CLAUDE.md` + `PROJECT_STATUS.md` nella root (governance del workspace)
  - commit: `feat(phase-0): add governance files and project status`
- [x] **0.5** — Shared module: tassonomia + RAG defense modules
  - [x] `scripts/shared/__init__.py`
  - [x] `scripts/shared/taxonomy.py` (DOMAINS, PRIMARY_CATEGORIES, GENRE_TAGS, KEY_FEATURES, DESIGN_PATTERNS, COMPLEXITY_LEVELS, ENGINES, PUSHED_FILTERS con date corrette, ALLOWED_LICENSES, CATEGORY_TO_PARAM_GROUP)
  - [x] `scripts/shared/classification_schema.py` (CLASSIFICATION_SCHEMA con `additionalProperties: False`, enum importati da taxonomy)
  - [x] `scripts/shared/confidence_gate.py` (`gate_classification()` → accepted/quarantined/rejected)
  - [x] `scripts/shared/heuristics.py` (`DOMAIN_HEURISTICS` + `heuristic_domain_triage()`, Godot vocab; estensione Phase 3)
  - [x] `scripts/shared/validators.py` (placeholder `validate_chunk()`, implementazione Phase 6)
  - commit: `feat(phase-0): add shared taxonomy and RAG defense modules`
- [ ] **0.5-db** — `supabase/migrations/001_knowledge_base.sql` (pgvector schema + quarantine + parameters + ingestion_log + indici HNSW/GIN/BTREE + RPC `search_code_knowledge`, `get_reference_parameters`)
  - commit: `feat(phase-0): add pgvector knowledge-base schema migration`
- [ ] **0.6** — `lib/knowledge.ts` + `lib/types.ts` (client KB + tipi `CodeReference`, `ParameterReference`, `ReferenceQuery`, `ParameterQuery`)
  - commit: `feat(phase-0): add knowledge-base client and shared types`
- [ ] **0.7** — `.env` popolato con tutte le API key (`GITHUB_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`)
  - commit: *no commit — `.env` è gitignored*
- [ ] **0.8** — Migration applicata su Supabase (tabelle, indici, RPC visibili nel Dashboard; `SELECT COUNT(*) FROM code_knowledge` ritorna 0 senza errori)
  - commit: `chore(phase-0): record supabase migration applied`

---

## FASE 1 — GitHub Scraper

- [ ] **1.1** — `scripts/ingestion/01_scrape.py`: query GitHub API per engine × genere
  - commit: `feat(phase-1): add github api scraper with engine x genre queries`
- [ ] **1.2** — Filtro GitHub API: `stars ≥ 20`, `pushed ≥ 2025-01-01`, `size ≤ 100MB`, licenza whitelist
  - commit: `feat(phase-1): enforce stars/date/size/license filters in scraper`
- [ ] **1.3** — Scrape awesome lists per ogni engine (fetch README → regex `github.com/owner/repo`)
  - commit: `feat(phase-1): harvest repos from per-engine awesome lists`
- [ ] **1.4** — Repo ufficiali di demo/samples (lista hardcoded: godot-demo-projects, phaser examples, ecc.)
  - commit: `feat(phase-1): seed scraper with official demo/sample repos`
- [ ] **1.5** — `git clone --depth 1` in `data/repos_raw/{engine}/{repo_name}/`
  - commit: `feat(phase-1): shallow-clone harvested repos into data/repos_raw`
- [ ] **1.6** — Deduplica per URL nel manifest
  - commit: `feat(phase-1): deduplicate manifest entries by repo url`
- [ ] **1.7** — Rate limiting (max 30 req/min GitHub API + sleep tra clone)
  - commit: `feat(phase-1): add rate limiting and backoff to scraper`

---

## FASE 2 — Quality Filter

- [ ] **2.1** — `scripts/ingestion/02_filter.py`: 5 check strutturali per engine
  - commit: `feat(phase-2): add structural quality filter pipeline`
- [ ] **2.2** — Check struttura minima (file obbligatori per engine, es. `project.godot`, `main.lua`)
  - commit: `feat(phase-2): enforce per-engine required-file checks`
- [ ] **2.3** — Check LOC range (300–30 000)
  - commit: `feat(phase-2): reject repos outside 300-30000 LOC band`
- [ ] **2.4** — Check rapporto commenti/codice (≥ 3%)
  - commit: `feat(phase-2): penalize repos below 3% comment ratio`
- [ ] **2.5** — Check dipendenze (max 5 plugin/addon per Godot)
  - commit: `feat(phase-2): cap godot plugins/addons at 5`
- [ ] **2.6** — Check licenza whitelist (MIT/CC0/Apache/BSD/Zlib/Unlicense/ISC)
  - commit: `feat(phase-2): enforce permissive-license whitelist`
- [ ] **2.7** — Copia repo che passano in `data/repos_clean/{engine}/` ("Golden Repos")
  - commit: `feat(phase-2): promote passing repos to data/repos_clean`

---

## FASE 3 — Engine-Specific Parsers

- [ ] **3.1** — `scripts/ingestion/03_parse_godot.py` (parser `.tscn` + `.gd` con scene tree)
  - commit: `feat(phase-3): add godot tscn/gd parser with scene-tree linking`
- [ ] **3.2** — `scripts/ingestion/03_parse_phaser.py` (parser scene Phaser: preload/create/update)
  - commit: `feat(phase-3): add phaser scene parser`
- [ ] **3.3** — `scripts/ingestion/03_parse_renpy.py` (parser `.rpy`: route, screen, config)
  - commit: `feat(phase-3): add ren'py rpy parser`
- [ ] **3.4** — `scripts/ingestion/03_parse_generic.py` (Defold / MonoGame / LÖVE / Three.js / Stride)
  - commit: `feat(phase-3): add generic multi-engine parser`
- [ ] **3.5** — Raggruppamento file correlati in chunk singoli (es. Player sparso su 3 file → 1 chunk concatenato)
  - commit: `feat(phase-3): merge related files into cohesive chunks`
- [ ] **3.6** — Heuristic pre-classification + statistiche di copertura per engine/category
  - commit: `feat(phase-3): heuristic pre-classify chunks and emit coverage report`

---

## FASE 4 — LLM Classifier (Blindato)

- [ ] **4.1** — `scripts/ingestion/04_classify.py` con JSON Schema vincolato (Structured Output)
  - commit: `feat(phase-4): add deepseek classifier with constrained json schema`
- [ ] **4.2** — Classificazione 2-step: domain triage (heuristic) → fine classification (LLM)
  - commit: `feat(phase-4): implement 2-step domain-then-category classification`
- [ ] **4.3** — Confidence gate: ≥85 accept · 60–84 quarantine · <60 reject
  - commit: `feat(phase-4): add confidence gate with accept/quarantine/reject lanes`
- [ ] **4.4** — Retry logic: max 2 tentativi per chunk, exponential backoff su 429
  - commit: `feat(phase-4): retry classifier calls with exponential backoff`
- [ ] **4.5** — Progress tracking: `tqdm` + log costi + ETA
  - commit: `feat(phase-4): add progress, cost and eta tracking to classifier`
- [ ] **4.6** — Output in `data/chunks_classified/` (merge raw + classificazione)
  - commit: `feat(phase-4): persist enriched chunks to data/chunks_classified`
- [ ] **4.7** — Report finale: distribuzione per category / confidence / engine
  - commit: `feat(phase-4): emit classification distribution report`

---

## FASE 5 — Embedding & Storage

- [ ] **5.1** — `scripts/ingestion/05_embed_store.py` legge solo chunk ACCEPT (confidence ≥ 85)
  - commit: `feat(phase-5): load only accepted chunks for embedding`
- [ ] **5.2** — Costruzione `searchable_text` (summary + metadati, NON codice grezzo)
  - commit: `feat(phase-5): build searchable_text from summary and metadata`
- [ ] **5.3** — Embedding con OpenAI `text-embedding-3-small` (batch da 100, 1536 dim)
  - commit: `feat(phase-5): batch-embed chunks with text-embedding-3-small`
- [ ] **5.4** — Insert in `code_knowledge` (batch da 50)
  - commit: `feat(phase-5): bulk-insert embeddings into code_knowledge`
- [ ] **5.5** — Quarantine (confidence 60–84) → `code_knowledge_quarantine`
  - commit: `feat(phase-5): route low-confidence chunks to quarantine table`
- [ ] **5.6** — Parametri numerici → `game_parameters`
  - commit: `feat(phase-5): extract numeric parameters into game_parameters`
- [ ] **5.7** — Update `ingestion_log` per ogni repo
  - commit: `feat(phase-5): track per-repo ingestion in ingestion_log`
- [ ] **5.8** — Report finale: conteggi per tabella / engine + costo embedding
  - commit: `feat(phase-5): emit storage and cost report`

---

## FASE 6 — Validation & Test

- [ ] **6.1** — `scripts/ingestion/06_validate.py` (sanity checks: distribuzione, copertura, clustering)
  - commit: `feat(phase-6): add post-ingestion validation queries`
- [ ] **6.2** — `scripts/ingestion/07_test_queries.py` (20 query con risultati attesi → report PASS/FAIL)
  - commit: `feat(phase-6): add test-query suite with pass/fail report`
- [ ] **6.3** — Fix anomalie (ri-classificazione batch, pulizia dati)
  - commit: `fix(phase-6): resolve anomalies surfaced by validation`
- [ ] **6.4** — Review manuale top 100 chunk quarantine (promozione o scarto)
  - commit: `chore(phase-6): review and adjudicate quarantine top-100`

---

## FASE 7 — Integration & Comparison Test

- [ ] **7.1** — `lib/knowledge.ts` end-to-end con Supabase (`getReferences()` ritorna risultati reali)
  - commit: `feat(phase-7): wire knowledge.ts to production supabase`
- [ ] **7.2** — Script comparison: generazione SENZA KB vs CON KB
  - commit: `feat(phase-7): add a/b code-generation comparison script`
- [ ] **7.3** — Valutazione automatica con Claude Sonnet (5 criteri)
  - commit: `feat(phase-7): score comparison outputs across 5 criteria`
- [ ] **7.4** — `test_output/COMPARISON_REPORT.md` con risultati numerici
  - commit: `docs(phase-7): publish comparison report`

---

## Riferimenti

- [CLAUDE.md](CLAUDE.md) — regole di workspace (auto-iniettato a ogni sessione e prima della compaction via `.claude/settings.json`)
- [docs/SUPREME_RAG_BLUEPRINT.md](docs/SUPREME_RAG_BLUEPRINT.md) — taxonomy, schema, pipeline
- [docs/MASTER_EXECUTION_PLAN.md](docs/MASTER_EXECUTION_PLAN.md) — sezione §03 (questa roadmap), §01 (anti-allucinazione), §04 (ignition prompts)
- [docs/pietra_v4 (1).md](docs/pietra_v4%20%281%29.md) — vision document
