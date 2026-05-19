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
- [x] **0.6** — `supabase/migrations/001_knowledge_base.sql` (pgvector + quarantine + RPC + RLS)
  - [x] `CREATE EXTENSION vector`
  - [x] `code_knowledge` con `confidence_score` (default 85, gate ≥85)
  - [x] `code_knowledge_quarantine` (schema identico, lane 60-84)
  - [x] `game_parameters` (parameter_group + jsonb parameters)
  - [x] `ingestion_log` con `classification_status` (accepted/quarantined/rejected)
  - [x] Indici B-tree (engine, category, chunk_type, complexity, quality, confidence)
  - [x] Indici GIN (genre_tags, key_features, subcategories, design_patterns) su entrambe le tabelle code_knowledge*
  - [x] Indice HNSW `vector_cosine_ops` (m=16, ef_construction=64) su `code_knowledge.embedding`
  - [x] RPC `search_code_knowledge` con `p_min_confidence int default 85`
  - [x] RPC `get_reference_parameters`
  - [x] RPC `increment_retrieval_count(p_ids uuid[])`
  - [x] RLS attiva su tutte e 4 le tabelle + policy SELECT su `code_knowledge` e `game_parameters`
  - apply: incollare il file nel SQL Editor del Supabase Dashboard ed eseguire (Supabase CLI non configurata)
  - commit: `feat(phase-0): add Supabase pgvector schema with quarantine table`
- [x] **0.7** — `lib/knowledge.ts` + `lib/types.ts` (TypeScript client per la KB)
  - [x] `lib/types.ts` esporta `CodeReference`, `ParameterReference`, `ReferenceQuery`, `ParameterQuery` (più `ChunkType`/`Complexity` literal types per strict mode)
  - [x] `CodeReference` include `confidence_score` (post-migration field)
  - [x] `ReferenceQuery` include `minConfidence?` (default 85 al call site)
  - [x] `ParameterReference.parameters` è `Record<string, unknown>` (zero `any`)
  - [x] `lib/knowledge.ts` espone `getReferences()`, `getReferenceParameters()`, `buildReferenceContext()`
  - [x] Embedding lazy con `text-embedding-3-small`; fire-and-forget `increment_retrieval_count`
  - [x] Errori loggati con `console.error({context, ...})`, return `[]` su qualunque fallimento (zero throw)
  - [x] Env vars lette tramite `process.env` con `requireEnv()` guard
  - [x] `npx tsc --noEmit` ritorna exit code 0
  - commit: `feat(phase-0): add TypeScript knowledge base client`
- [x] **0.8** — `.env` popolato e smoke-testato (`.env` gitignored, no commit del file)
  - [x] `GITHUB_TOKEN` — rate limit 5000/h verificato, search funzionante
  - [x] `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — connessione PostgREST OK
  - [x] `SUPABASE_DB_*` — credenziali pooler Postgres (host `aws-1-eu-central-1`, port 5432, session pooler)
  - [x] `OPENAI_API_KEY` — `text-embedding-3-small` ritorna 1536 dim
  - [x] `DEEPSEEK_API_KEY` — `deepseek-chat` con `response_format=json_object` OK
- [x] **0.9** — Migration `001_knowledge_base` applicata su Supabase
  - [x] `scripts/shared/db.py` (psycopg2 pooler connection)
  - [x] `scripts/apply_migrations.py` (--dry-run, tracking via `public.schema_migrations`, transazioni atomiche)
  - [x] Migration 001 applicata, registrata in `schema_migrations`
  - [x] Verifica remota: extension `vector` ✓, 4 tabelle prodotto + bookkeeping ✓, 25 indici (B-tree+GIN+HNSW) ✓, 3 RPC ✓, RLS su tutte le 4 tabelle ✓, 2 policy di lettura ✓, `SELECT COUNT(*) FROM code_knowledge` = 0 ✓
  - [x] Smoke test end-to-end TypeScript: `getReferences({engine:'godot'})` ritorna `[]` senza errori
  - commit: `chore(phase-0): apply migration 001 and add migration runner`

### ✅ FASE 0 — GATE

- [x] Workspace, governance, shared module, DB schema e TypeScript client pronti per la Fase 1
  - Tutto il codice della Fase 0 è committato; le sotto-fasi 0.8 (`.env` reale) e 0.9 (migration applicata su Dashboard) restano operazioni manuali utente e non bloccano l'inizio della Fase 1 da parte dell'agente (gli script di scraping/filter non toccano Supabase finché 0.9 non è fatta).

---

## FASE 1 — GitHub Scraper

- [x] **1.1** — `scripts/ingestion/01_scrape.py`: scraper GitHub multi-source con filtri corretti
  - [x] ≥10 query per ognuno degli 8 engine (godot=13, altri=12) — `_sources.py:SEARCH_QUERIES`
  - [x] GitHub API: `Authorization: Bearer`, `Accept: application/vnd.github+json`, paginazione fino a 60 results/query, sleep 2s post-call
  - [x] Filtri server-side nella query: `stars:>=20`, `pushed:>={PUSHED_FILTERS[engine]}`, `size:<=100000`
  - [x] Filtri client-side: license whitelist (`ALLOWED_LICENSES`), engine language match (`ENGINE_LANGUAGES`), no fork/archived/private
  - [x] Awesome lists hardcoded per 6 engine (godot/phaser/renpy/defold/monogame/love2d) con regex `github.com/owner/repo`
  - [x] Official samples hardcoded per 7 engine (godot-demo-projects, phaser3-examples, MonoGame.Samples, ecc.)
  - [x] Clone `git clone --depth 1 --quiet` con skip-if-exists e sleep 0.5s
  - [x] Manifest `data/manifest.json` con `{url, engine, stars, license, size_kb, topics, pushed_at, language, clone_status, scraped_at}`
  - [x] Flag `--dry-run`, `--engine`, `--skip-clone`
  - [x] Logging tqdm + file `scrape_log.txt`
  - [x] Error handling per ogni clone (`clone_status` su `cloned` / `already_cloned` / `failed` / `failed_timeout` / `failed_exception`)
  - [x] Splittato in 3 moduli (`01_scrape.py` orchestrator + `_scrape_helpers.py` + `_sources.py`) per rispettare il 400-line file limit di CLAUDE.md
  - [x] Verifica `--dry-run --engine godot`: 50 candidati validi, 41 rejected, 0 scritture
  - commit: `feat(phase-1): add GitHub scraper with corrected date filters`
- [x] **1.2** — Filtri scraper completi (server-side + client-side)
  - Server-side query: `stars:>=20`, `pushed:>={PUSHED_FILTERS[engine]}` (godot 2022-06-01, threejs 2022-01-01, altri 2021-01-01 — `taxonomy.py`), `size:<=100MB`
  - Client-side: `ALLOWED_LICENSES` whitelist + `LICENSE_BYPASS_ORGS` per ~41 org open-source con SPDX detector buggato, `ENGINE_LANGUAGES` whitelist con fix RenPy apostrofo + fallback su topic alias quando `language=null`, drop fork/archived/private
  - commit: `feat(phase-1): expand harvest sources, add analyzer + adaptive curator`
- [x] **1.3** — Awesome lists + Topic harvesting + Org harvesting + Curated + Notable
  - Awesome: 6 engine (godot/phaser/renpy/defold/monogame/love2d — 4 URL morte ma il sistema le tollera)
  - Topic: 8 engine, 2-3 topic/engine (`topic:godot-4`, `topic:phaser3`, `topic:visual-novel`, `topic:love2d`, ecc.)
  - Org: 8 engine, 1-7 org/engine (godotengine, GDQuest, KoBeWi, phaserjs, photonstorm, britzl, MonoGame, rxi, mrdoob, ecc.)
  - Curated: 8 engine, repo-engine root (es. `godotengine/godot-demo-projects`, `renpy/renpy`)
  - Notable: 8 engine, 32 repo hand-vetted (Mari0, hawkthorne, FNA, lovr, cannon.js, three-mesh-ui, Nez, godot_dialogue_manager, ecc.)
- [x] **1.4** — Repo ufficiali via OFFICIAL_SAMPLES (7 engine)
- [x] **1.5** — Clone `--from-curated`: 683/683 clonati in `data/repos_raw/<engine>/<safe_repo_name>/`
  - 680 alla prima passata, 3 timeout (`phaserjs/examples` 2GB, 2 piccoli flaky) → retry mirato → tutti recuperati
  - 1451 entries totali nel manifest (683 repo + 768 subdir Stage 2)
- [x] **1.6** — Deduplica multi-livello
  - In-scrape via `seen_urls` set (dedup ogni source)
  - Post-scrape in `03_curate_manifest.py`: hard dedup su URL normalizzato (risolve es. `phaserjs/examples` x2 source)
  - Subdir dedup automatico via `seen_rel` set in `expand_subdirs`
- [x] **1.7** — Rate limiting + retry logic
  - GitHub Search API: `SLEEP_AFTER_API_CALL=2s` post-call, 30/min cap rispettato
  - 403 rate-limited → sleep via `X-RateLimit-Reset` header (handled)
  - Clone: `SLEEP_AFTER_CLONE=0.5s`, timeout 180s per clone, retry 3 timeout in clone manuale per repo grandi
  - Bumped `SEARCH_MAX_RESULTS_PER_QUERY` 60→120 (4 pagine invece di 2), espanse SEARCH_QUERIES a 17-23 per engine ricchi

### ✅ Harvest Expansion + Stage 2 + Cleanup (commit `dce7488`, `681d31d`)

- [x] **Stage 0+1+2 implementati** in 3 file (`_sources.py`, `_scrape_helpers.py`, `01_scrape.py`) + 4 nuovi script (`02_analyze_manifest.py`, `03_curate_manifest.py`, `04_sample_inspect.py`, `05_deep_analyze.py`, `_clone_phase.py`)
- [x] **Manifest finale**: 1451 entries (683 repo + 768 subdir di mono-repo)
  - 683 repo distribuzione: godot 232, phaser 78, renpy 19, defold 61, monogame 58, love2d 71, threejs 158, stride 6
  - 768 subdir: godot-demo-projects 137 (mini-games veri), phaser3-examples 34 (categorie), three.js 581 (scene HTML standalone), stride samples 11, defold-examples 5
- [x] **Deep content analysis** (`05_deep_analyze.py` su tutti i 683 cloni reali): **80.8% usable media (552/683)**
  - stride 100%, monogame 93%, defold 90%, threejs 88%, renpy 79%, phaser 79%, godot 76%, love2d 63%
  - `data/deep_analysis.json` contiene record per-repo: anchor, LOC, comment_ratio, ext_counts, verdict, respect_score
- [x] **Top "respect score"** identificati per engine (combo log-stars + LOC sweet-band + commenti + anchor + tests). I notable hand-vettati confermati nei top 5 di ogni engine.
- [x] **Disco**: cleanup operato in sicurezza (drop .git da 683 cloni +6.32 GB, installer obsoleti +2.55 GB, duplicati MD5-verified +0.45 GB). Da 12.9 → 22.3 GB liberi. Dataset integro al 100%.

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
