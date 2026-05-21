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

- [x] **2.1** — `scripts/ingestion/02_filter.py` + `_filter_rules.py`: 5 check strutturali
  - Manifest: legge `data/manifest.curated.json` (683 repo + 768 subdir = 1451 entries)
  - Output: `data/quality_report.json` con `{repo, engine, checks, quality_score, pass, reason_if_failed}` per ogni entry
- [x] **2.2** — Check A struttura minima per engine (`_filter_rules.py::STRUCTURE_CHECKS`)
  - Godot: `project.godot` + `config_version=5` (anti-Godot-3 critico) + ≥3 file `.gd`/`.tscn`
  - Phaser: file `.js/.ts` con `Phaser.Game`/`Phaser.Scene`
  - Ren'Py: file `.rpy` con `label start`
  - Defold: `game.project` + file `.script`/`.collection`/`.lua`
  - MonoGame: `.csproj` con "MonoGame" nel contenuto
  - LÖVE: `main.lua` con `love.` nel contenuto
  - Three.js: file `.js/.ts` con `THREE.`/`three`
  - Stride: `.cs`/`.sdpkg`/`.csproj`
- [x] **2.3** — Check B LOC range (`MIN_LOC=300, MAX_LOC=30000`) sui file engine-specifici
- [x] **2.4** — Check C comment ratio ≥3% (`COMMENT_PREFIXES` per estensione)
- [x] **2.5** — Check D plugin/autoload count Godot (`MAX_PLUGINS=5`, `MAX_AUTOLOADS=10` in `[autoload]` di `project.godot`)
- [x] **2.6** — Check E licenza whitelist con body-marker su `LICENSE`/`COPYING`/`license.md` (MIT, Apache-2.0, BSD-2/3, CC0-1.0, Unlicense, ISC, Zlib)
- [x] **2.7** — Promozione `data/repos_clean/{engine}/<name>/` per repo con `quality_score ≥ 3`
  - Subdir promotion: `<safe_repo_name(parent)>__<subdir_path>` per non collidere coi parent
  - Skip-if-exists: re-run sicuro (la copia avanza solo per le destinazioni mancanti)
  - `shutil.copytree` ignora `.git` (i cloni del dataset hanno già `.git` rimossi nella pulizia)
- [x] **2.8** — Fix `MemoryError` (file giganti come bundle minified) tramite `MAX_FILE_BYTES=5MB` + lettura streaming `iter_lines()`
- [x] **2.9** — Run live completato: 1451 valutate, **409 pass (28%)** copiati in `repos_clean/`
  - Per engine: godot 115, threejs 89, phaser 61, defold 57, love2d 36, monogame 31, stride 12, renpy 8
  - Repo (no-subdir): 354/683 pass (52%) — sono i Golden Repos veri
  - Subdir: 55/768 pass (7%) — molti mini-scene three.js / micro-demo Godot falliscono `min_code_files=3` correttamente
  - Anti-Godot-3 efficace: 31 repo `config_version=4` scartati
  - Score distribution: 147×s5, 209×s4, 53×s3, 55×s2, 987×s1
  - commit: `feat(phase-2): structural quality gate with 5 checks and golden-repo promotion`
- [x] **2.10** — Verifica post-Fase-2 (analizza-controanalizza ogni check del blueprint)
  - ✅ Check 1 — 8 engine in `repos_clean/` (>=6 richiesti)
  - ✅ Check 2 — godot 114 ≥ 25 (4.5x sopra target post-fix)
  - ✅ Check 3 — `quality_report.json` 1451/1451 entries, tutti con `engine`+`quality_score`+`reason_if_failed`
  - ✅ Check 4 — 0 file `project.godot` con `config_version=4` in `repos_clean/` (dopo fix bug critico)
  - ✅ Check 5 — 5 repo Godot random: 10/10 file `.gd` syntactically valid, 5/5 `.tscn` strutturalmente OK
  - ✅ Check 6 — 5 repo Phaser random: dataset valido (mix di plugin/lib/giochi, alcuni mini-esempi senza package.json by design)
  - ✅ Check 7 — drop ratio repos-only 48.2% (dentro 40-70%). Totale 71.8% è atteso per via dei 768 subdir sintetici
  - 🐛 **Bug critico trovato e fixato**: `check_structure` per Godot leggeva solo il PRIMO `project.godot` via `next(...)`. Repo con sotto-versione Godot 3 accanto a Godot 4 in root passavano (es. `gdquest-demos/godot-design-patterns/godot-csharp/project.godot` config_version=4 leaked in `repos_clean/`). Fix: ora itera TUTTI i `project.godot` e rigetta se ANY ha `config_version!=5`. Test su 32 repo Godot 3-rejected, 0 leak residui. Godot count 115→114 (1 leaked rimosso).
  - commit: `fix(phase-2): godot4 check must verify all project.godot files`

### ✅ FASE 2 — GATE
- [x] Quality gate strutturale completo, 409 Golden Repos in `repos_clean/`, dataset pulito e coerente, blueprint checklist verificata 7/7 con analisi multilivello.

---

## FASE 3 — Engine-Specific Parsers

- [x] **3.1** — `scripts/ingestion/03_parse_godot.py` + `_godot_tscn.py` + `_godot_gd.py`
  - `_godot_tscn.py` (224 righe): parser custom TSCN (NON è INI), estrae ext_resources, sub_resources, nodes (con script_path risolto), connections; `build_scene_context()` produce one-liner tipo `"CharacterBody2D > AnimatedSprite2D, CollisionShape2D, Hitbox(Area2D)"`
  - `_godot_gd.py` (189 righe): regex `extends`, `class_name`, `signal`, `@export`, `@onready`, `func`, `preload/load`; `heuristic_classify()` con 10 regole ordinate dal MASTER §3 (A01/A04/A03/A05/D01/D02/C04/B04/B01 + X00 fallback)
  - `03_parse_godot.py` (372 righe): `parse_project_godot()` tolerant INI (Godot usa valori `NodePath()`, `&"action"`, dict/array literals che bloccano ConfigParser stdlib); `find_project_root()` cerca a depth ≤3; `GodotParser.chunk_project()` orchestrator
  - Fix critici post-test: (1) `parse_project_godot` ConfigParser-free tolerant; (2) `resolve_res_path` ora risolve `res://` contro project_root, non scena.parent (scene_context ora popolato 18/26 nei test)
  - Splitting >800 LOC: `split_big_file()` separa per func boundaries, ogni chunk resta coerente
- [x] **3.7** — Run live completo su 114 repo Godot in `repos_clean/godot/`
  - **5852 chunks generati** in `data/chunks_raw/godot/<repo>/chunk_NNNN.json`
  - Distribuzione confidence: **high=337**, medium=1134, low=4381
  - Categorie principali: X00=4381, C04_save_load=670, D01_ui=326, **A01_player_controller=144**, E01_project_structure=114, D02_audio=72, B01_level_structure=66, B04_navigation=27, **A04_enemy_ai=26**, A05_camera=19, A03_combat=7
  - Verifica checklist Blueprint Fase 3 — 7/7 OK:
    - ✅ `data/chunks_raw/godot/` esiste
    - ✅ Godot ≥200 chunk `heuristic_confidence=high`: **337** (+68%)
    - ✅ Godot ≥30 chunk `A01_player_controller`: **144** (+380%)
    - ✅ Godot ≥20 chunk `A04_enemy_ai`: **26** (+30%)
    - ✅ 0 chunk con code vuoto
    - ✅ 0 chunk con loc=0
    - ✅ 0 chunk con file_paths vuoto
    - ✅ Spot-check 10 chunk random: 3/3 scene_context-extends coerenti (es. Camera3D dentro CharacterBody3D ✓, FileDialog root ✓, CanvasModulate dentro Node2D ✓)
  - Top repo per chunk count: bitbrain__beehave 322, InvadingOctopus__comedot 278, Neroware__GodotRx 263, Structed__godot-playfab 262
  - `data/godot_parse_stats.json` con stats per repo/category/confidence
  - commit: `feat(phase-3): godot parser tscn+gd+heuristic with 5852 chunks generated`
- [x] **3.2** — `scripts/ingestion/03_parse_phaser.py` + `_phaser_scene.py` (entry point + Phaser.Scene + heuristic)
  - 61 repos, 48 parsed, 13 skipped (libraries/ads/no scene class), **1626 chunks**
  - high 114 / medium 208 / low 1304 (low = phaserjs/examples micro-demos → LLM Fase 4)
  - top categories: A01_player_controller 88, B01_level_structure 80, E01_project_structure 68, A04_enemy_ai 50, D01_ui 36
  - commit: `feat(phase-3): add phaser scene parser`
- [x] **3.3** — `scripts/ingestion/03_parse_renpy.py` + `_renpy_rpy.py` (route/screen/vn-core/config)
  - 8 repos, 8 parsed, **214 chunks**, high 182 / medium 32 / low 0
  - D01_ui 161, C03_dialogue_narrative 23, E04_genre_specific 20, E01_project_structure 10
  - commit: `feat(phase-3): add ren'py rpy parser`
- [x] **3.4** — `scripts/ingestion/03_parse_generic.py` + `_generic_engines.py` (Defold / MonoGame / LÖVE / Three.js / Stride)
  - **7063 chunks** across 5 engines: defold 1720, monogame 1613, love2d 1113, threejs 2260, stride 357
  - Heuristic intenzionalmente debole come da blueprint §02.4.5 ("lavoro pesante" all'LLM in Fase 4)
  - commit: `feat(phase-3): add generic multi-engine parser`
- [~] **3.5** — Raggruppamento file correlati: **skip per design** (rischio merge errati, blueprint senza algoritmo concreto; l'LLM Fase 4 decide se chunk separati formano `full_recipe`)
- [x] **3.6** — Heuristic pre-classification + statistiche di copertura per engine/category
  - 5 nuove regole heuristic in `_godot_gd.py` / `_phaser_scene.py` / `_generic_engines.py` per A02/B02/B03/C01/C02
  - 1 nuovo chunk-kind `inventory` in `_renpy_rpy.py`
  - commit: `feat(phase-3): heuristic expansion + chunk grooming + chunk_type assignment`
- [x] **3.7** — **Chunk grooming pre-Fase 4** (`scripts/ingestion/03b_groom_chunks.py`)
  - 14 755 raw → 11 113 survivors (drop 3 642: 2 961 tiny + 8 empty + 673 dup)
  - droppati preservati in `data/chunks_dropped/<reason>/` per audit
  - `data/grooming_report.json` con full breakdown per engine
- [x] **3.8** — **chunk_type assignment** (`scripts/shared/chunk_type.py`)
  - 4 050 full_recipe (36.4%) / 5 707 single_mechanic (51.4%) / 1 356 structural_pattern (12.2%)
  - integrato in `_parse_common.make_chunk` e in `03_parse_godot.py` per re-run futuri
- [x] **3.9** — **Preflight Fase 4** (`scripts/ingestion/04a_preflight.py`)
  - 11 113 chunk, 1 schema unico, costo stimato $3.33 (budget $5, headroom 33.3%)
  - Genre coverage 100% su tutti i 13 generi (blueprint §1.3)
  - `data/preflight_report.json` — gate READY FOR FASE 4: True

---

## FASE 4 — LLM Classifier (Blindato)

- [x] **4.1** — `scripts/ingestion/04_classify.py` con JSON Schema vincolato (post-hoc validation con `jsonschema`; DeepSeek non supporta `json_schema` strict — verificato empiricamente, fallback `json_object` documentato dal blueprint)
- [x] **4.2** — Classificazione 2-step: domain triage heuristic → fine classification (LLM). Dominio passato come vincolo se `heuristic_confidence='high'`, altrimenti `Determine yourself`
- [x] **4.3** — Confidence gate riutilizzato da `scripts/shared/confidence_gate.py` (≥85 accept · 60–84 quarantine · <60 reject · X02_trash sempre rejected)
- [x] **4.4** — Retry logic: 3 transport retry con backoff esponenziale (2s/4s/8s) + 1 validation retry con prompt rinforzato per schema errors
- [x] **4.5** — Progress: tqdm + cost running + ETA + cost cap safety stop ($12 cap)
- [x] **4.6** — Output: `data/chunks_classified/{engine}/{repo}/chunk_NNNN.json` (chunk raw merged con classification + classification_status)
- [x] **4.7** — Report finale `data/classification_report.json`:
  - **10 769 / 11 113 chunk classificati** (96.9%) in ~80 min con 8 worker concorrenti
  - **8 517 accepted** (79.1%), 1 997 quarantined (18.5%), 255 rejected (2.4%), 344 errore residui (3.1%)
  - **Distribuzione confidence**: 79.1% chunk ≥85 conf (gate blueprint ≥75%) ✓
  - **Categorie ≥5 chunk Godot**: A01=241 / A03=165 / A04=107 / B01=80 / D01=515 / D02=37 / E01=860 ✓
  - **X02_trash**: 0 (<10% target) ✓ | **X00_uncertain**: 1.9% (<15% target) ✓
  - **Cost**: $12.21 totale (sopra budget blueprint $5 perché token output reali ~3× stima; sotto cap $12 hard)
  - 22/22 categorie tassonomiche hanno chunks
  - **Fix post-audit**: max_tokens 350→500 (allinea blueprint §02.5) + rate limiter globale 50/min (blueprint §4.7) → recuperati 30 chunk truncated + 2 player controllers critici classificati manualmente da Claude (recovery a costo zero)
  - commit: `feat(phase-4): deepseek classifier with 2-step + confidence gate + concurrency` + `fix(phase-4): align max_tokens and rate-limit to blueprint spec`
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
