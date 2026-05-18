# DATASET BOOST — MASTER EXECUTION PLAN
## Il Manuale Operativo per Claude Code — Game Studio AI

**Versione**: 1.0  
**Data**: 18 maggio 2026  
**Prerequisito**: SUPREME_RAG_BLUEPRINT.md (§01-§05)  
**Scopo**: Trasformare il Blueprint in azione. Zero ambiguità, zero allucinazioni, zero errori silenti.  
**Destinatario**: Lo sviluppatore + Claude Code nel terminale VS Code  

---

# ═══════════════════════════════════════════════════════
# §01 — RAG DEFENSE MECHANISM
# La strategia anti-allucinazione per la classificazione
# ═══════════════════════════════════════════════════════

## 1.1 Il problema

Il Blueprint §02 prevede che DeepSeek V4 Flash classifichi ~6000 chunk con un singolo prompt a risposta libera JSON. Questo è fragile per tre ragioni:

1. **Allucinazione tassonomica**: il modello potrebbe inventare categorie che non esistono nella nostra tassonomia (es. `"A07_swimming_system"` — non esiste).
2. **Misclassificazione silente**: un enemy AI classificato come player controller inquina i risultati di `getReferences()` per sempre, senza che nessuno se ne accorga.
3. **JSON malformato**: output con virgole mancanti, stringhe non chiuse, o campi assenti che fanno crashare il parser.

Un singolo chunk classificato male è accettabile. Cinquecento chunk classificati male rendono il RAG inutile. Dobbiamo blindare questa fase.

## 1.2 Difesa #1 — Constrained JSON Schema (Structured Output)

DeepSeek V4 supporta il parametro `response_format` con `type: "json_schema"`. Questo forza il modello a produrre SOLO JSON conforme allo schema definito. Nessuna allucinazione strutturale possibile.

Lo schema che il modello DEVE rispettare:

```json
{
  "type": "object",
  "required": [
    "domain", "primary_category", "subcategories",
    "genre_tags", "complexity", "design_patterns", "key_features",
    "quality_score", "reusability_score", "confidence_score",
    "one_line_summary", "extracted_parameters", "rejection_reason"
  ],
  "properties": {
    "domain": {
      "type": "string",
      "enum": ["A_core_gameplay", "B_world_level", "C_meta_game", "D_presentation", "E_architecture", "X_uncertain"]
    },
    "primary_category": {
      "type": "string",
      "enum": [
        "A01_player_controller", "A02_state_machine", "A03_combat",
        "A04_enemy_ai", "A05_camera",
        "B01_level_structure", "B02_procedural_gen", "B03_physics_collision", "B04_navigation",
        "C01_progression", "C02_inventory", "C03_dialogue_narrative", "C04_save_load",
        "D01_ui", "D02_audio", "D03_vfx",
        "E01_project_structure", "E02_signals_events", "E03_game_flow", "E04_genre_specific",
        "X00_uncertain", "X01_utility", "X02_trash"
      ]
    },
    "subcategories": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^[A-E][0-9]{2}\\.[0-9]{2}$"
      },
      "maxItems": 8
    },
    "genre_tags": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "platformer", "metroidvania", "roguelike", "rpg", "jrpg",
          "visual_novel", "puzzle", "card_game", "horror", "arcade",
          "sim", "tower_defense", "racing", "rhythm", "stealth",
          "bullet_hell", "fighting", "survival", "sandbox", "generic"
        ]
      }
    },
    "complexity": {
      "type": "string",
      "enum": ["basic", "intermediate", "advanced"]
    },
    "design_patterns": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "state_machine", "observer", "singleton", "component",
          "strategy", "command", "factory", "object_pool",
          "behavior_tree", "pub_sub", "mediator", "decorator", "none"
        ]
      }
    },
    "key_features": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "coyote_time", "wall_jump", "dash", "i_frames", "screen_shake",
          "hit_stop", "input_buffer", "combo", "patrol", "chase",
          "boss_phase", "typewriter_text", "branching_dialogue", "wave_spawner",
          "parallax", "day_night_cycle", "save_checkpoint", "inventory_grid",
          "crafting", "skill_tree", "procedural_gen", "pathfinding",
          "steering", "loot_drop", "xp_leveling", "camera_follow",
          "camera_shake", "dead_zone", "one_way_platform", "moving_platform",
          "destructible", "projectile", "knockback", "damage_number",
          "health_bar", "minimap", "audio_spatial", "bgm_crossfade",
          "footstep_system", "particle_effect", "shader_custom",
          "post_processing", "squash_stretch", "none"
        ]
      }
    },
    "quality_score": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5
    },
    "reusability_score": {
      "type": "integer",
      "minimum": 1,
      "maximum": 5
    },
    "confidence_score": {
      "type": "integer",
      "minimum": 0,
      "maximum": 100
    },
    "one_line_summary": {
      "type": "string",
      "maxLength": 120
    },
    "extracted_parameters": {
      "type": "object"
    },
    "rejection_reason": {
      "type": ["string", "null"]
    }
  },
  "additionalProperties": false
}
```

Cosa fa questo schema:

- **`domain`** ha un `enum` con 6 valori (5 domini + `X_uncertain`). Il modello NON PUÒ inventare un dominio.
- **`primary_category`** ha un `enum` con 22 categorie valide + 3 di sicurezza (`X00_uncertain`, `X01_utility`, `X02_trash`). Il modello NON PUÒ inventare una categoria.
- **`genre_tags`** ha un `enum` con 20 generi + `generic`. Nessun genere inventato.
- **`subcategories`** ha un `pattern` regex che accetta solo il formato `X00.00`. Il modello non può scrivere stringhe libere.
- **`key_features`** ha un `enum` con ~40 feature note. Se una feature non è nella lista, il modello deve scegliere la più vicina o `none`.
- **`confidence_score`** (0-100) è il campo critico per il filtro automatico.
- **`rejection_reason`** è `null` se il chunk è buono, altrimenti spiega perché andrebbe scartato.

Con questo schema, il JSON sarà SEMPRE valido, SEMPRE conforme alla tassonomia, e SEMPRE parsabile senza try/catch.

## 1.3 Difesa #2 — Classificazione gerarchica in 2 step

Il Blueprint originale fa una classificazione monolitica (un prompt, tutto insieme). Questo è rischioso perché il modello deve prendere troppe decisioni contemporaneamente. La soluzione è spezzare in due step:

### Step 1 — Domain Triage (veloce, deterministico + LLM leggero)

Prima dell'LLM, l'heuristic del parser (già previsto nel Blueprint §02.4) assegna un dominio basandosi su segnali nel codice:

```python
DOMAIN_HEURISTICS = {
    "A_core_gameplay": [
        "CharacterBody2D", "CharacterBody3D", "velocity", "move_and_slide",
        "input.is_action", "hitbox", "hurtbox", "damage", "health", "hp",
        "enemy", "patrol", "chase", "camera", "Camera2D", "Camera3D"
    ],
    "B_world_level": [
        "TileMap", "TileSet", "tilemap", "NavigationRegion", "NavigationAgent",
        "spawn", "level", "parallax", "collision_layer", "collision_mask",
        "RayCast", "Area2D", "trigger", "one_way"
    ],
    "C_meta_game": [
        "inventory", "item", "quest", "dialogue", "ink_story",
        "save", "load", "FileAccess", "ConfigFile", "xp", "level_up",
        "skill_tree", "crafting", "loot", "drop"
    ],
    "D_presentation": [
        "Control", "CanvasLayer", "Label", "TextureRect", "Button",
        "menu", "hud", "AudioStreamPlayer", "AudioServer", "AudioBus",
        "Particles", "GPUParticles", "shader", "CanvasItemMaterial",
        "ShaderMaterial", "post_process", "PointLight2D"
    ],
    "E_architecture": [
        "autoload", "singleton", "signal", "emit_signal", "EventBus",
        "GameManager", "SceneTree", "change_scene", "export_presets",
        "project.godot"
    ]
}
```

Se l'heuristic ha confidence "high" (almeno 3 keyword del dominio trovate), il dominio è fissato e l'LLM nella Step 2 lo riceve come vincolo. Se la confidence è "low" (0-1 keyword), il dominio è `X_uncertain` e l'LLM decide liberamente.

### Step 2 — Fine Classification (LLM con dominio vincolato)

Il prompt per l'LLM cambia in base al risultato dello Step 1:

**Se il dominio è noto (confidence high):**
```
Il dominio di questo codice è stato pre-identificato come: A_core_gameplay.
Classifica in dettaglio DENTRO questo dominio.
```

**Se il dominio è incerto:**
```
Il dominio di questo codice NON è stato identificato con certezza.
Determina prima il dominio, poi classifica in dettaglio.
```

Questo riduce drasticamente lo spazio di decisione dell'LLM: invece di scegliere tra 22 categorie, sceglie tra 5 (nel dominio A) o 4 (nel dominio B). L'errore cala proporzionalmente.

## 1.4 Difesa #3 — Confidence Gate & Quarantine

Dopo la classificazione, ogni chunk passa attraverso un gate a 3 livelli:

```
confidence_score >= 85  →  ✅ ACCEPT  →  va in code_knowledge
confidence_score 60-84  →  ⚠️ REVIEW  →  va in code_knowledge_quarantine
confidence_score < 60   →  ❌ REJECT  →  loggato e scartato
primary_category = X02_trash  →  ❌ REJECT  →  sempre scartato
primary_category = X00_uncertain  →  ⚠️ REVIEW  →  quarantine
rejection_reason != null  →  ❌ REJECT  →  sempre scartato
```

La tabella `code_knowledge_quarantine` ha lo schema identico a `code_knowledge`. I chunk in quarantena possono essere:
- Rivisti manualmente (1 minuto per chunk, basta leggere il summary e la category proposta)
- Ri-classificati con un modello più potente (Claude Sonnet) in batch
- Scartati in massa se il volume è gestibile

Stima: con le 3 difese attive, la distribuzione sarà circa:
- 80% ACCEPT (confidence ≥ 85)
- 12% REVIEW (confidence 60-84)
- 8% REJECT (confidence < 60 o trash)

Su 6000 chunk: ~4800 accettati, ~720 in quarantena, ~480 scartati. I 720 in quarantena si revisionano in circa 2 ore di lavoro manuale (10 secondi per chunk: leggi summary → accetta/scarta).

## 1.5 Difesa #4 — Post-Ingestion Validation Queries

Dopo aver caricato tutto in Supabase, uno script di validazione esegue query di sanity check:

```sql
-- ALERT se una categoria ha meno del 2% o più del 25% dei chunk
-- (distribuzione anomala = errore sistematico)
SELECT primary_category, COUNT(*) as n,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 1) as pct
FROM code_knowledge GROUP BY primary_category ORDER BY n DESC;

-- ALERT se un engine ha 0 chunk per una categoria critica
-- (es: godot deve avere A01_player_controller)
SELECT engine, primary_category, COUNT(*)
FROM code_knowledge
WHERE engine = 'godot'
GROUP BY engine, primary_category;

-- ALERT se i quality_score sono tutti uguali (LLM pigro)
SELECT quality_score, COUNT(*) FROM code_knowledge GROUP BY quality_score;

-- ALERT se >50% dei chunk ha confidence_score esattamente 85 o 90
-- (LLM che "arrotonda" invece di valutare realmente)
SELECT confidence_score, COUNT(*) FROM code_knowledge
GROUP BY confidence_score ORDER BY COUNT(*) DESC LIMIT 10;
```

Se una di queste query mostra anomalie, si riesamina il batch.

## 1.6 Schema di flusso completo della classificazione blindata

```
Chunk Raw (dal Parser)
    │
    ├── Heuristic Domain Triage (zero LLM)
    │   ├── Confidence HIGH → dominio fissato
    │   └── Confidence LOW → dominio = X_uncertain
    │
    ├── LLM Classification (DeepSeek V4 Flash)
    │   ├── Structured JSON Schema (enum vincolati)
    │   ├── Dominio passato come vincolo (se HIGH)
    │   └── Output: JSON conforme al 100%
    │
    ├── Confidence Gate
    │   ├── ≥85 → ACCEPT → code_knowledge
    │   ├── 60-84 → QUARANTINE → code_knowledge_quarantine
    │   └── <60 o X02_trash → REJECT → ingestion_log (status=rejected)
    │
    └── Post-Ingestion Validation
        ├── Distribuzione categorie (no anomalie)
        ├── Copertura per engine (no buchi)
        └── Distribuzione quality/confidence (no clustering sospetto)
```

---

# ═══════════════════════════════════════════════════════
# §02 — CLAUDE.md
# Il Sistema Operativo del Workspace
# ═══════════════════════════════════════════════════════

Il seguente è il contenuto completo del file `CLAUDE.md` da salvare nella root del progetto. Copialo esattamente.

---

```markdown
# CLAUDE.md — Game Studio AI Workspace

## ═══ SYSTEM INSTRUCTIONS ═══

### Identity
This workspace is **Game Studio AI** — an AI-powered platform that democratizes
game development. You are working inside this project as a senior engineer.

### Code Quality Rules
- **Language**: TypeScript (strict mode) for the product, Python 3.11+ for data scripts
- **No dead code**: never leave commented-out blocks, unused imports, or placeholder functions
- **No `any` type**: every variable, parameter, and return value must be typed
- **Error handling**: every async call wrapped in try/catch with meaningful error messages
- **Logging**: use structured logging (console.error with context object) for all failures
- **Environment variables**: always read from process.env, never hardcode secrets
- **File length**: no single file exceeds 400 lines. Split into modules if approaching limit
- **Naming**: camelCase for TS variables/functions, snake_case for Python, SCREAMING_SNAKE for constants
- **Comments**: explain WHY, not WHAT. No obvious comments like "// increment counter"
- **Testing**: every script must have a dry-run mode (--dry-run flag) that logs what would happen without executing

### Git Discipline
- Commit after every completed subtask with descriptive message
- Format: `feat(phase-N): description` or `fix(phase-N): description`
- Never commit .env files, API keys, or data/ directory contents

### Anti-Hallucination Protocol
When writing classification or labeling code that uses LLMs:
- ALWAYS use structured output (JSON Schema with enum constraints)
- ALWAYS include a confidence_score field (0-100)
- ALWAYS include a rejection/uncertain escape hatch category
- NEVER trust free-form string output from LLMs for categorical data
- NEVER parse LLM output with regex — use JSON.parse or json.loads only

### Dependencies
Before installing any package, check if the functionality already exists in:
1. Node.js / Python standard library
2. Already-installed packages
3. The project's existing utility functions
Only then consider adding a new dependency. Prefer zero-dependency solutions.

## ═══ CURRENT MISSION: PHASE 1 — RAG KNOWLEDGE BASE ═══

### What We're Building Right Now
A vector database (Supabase pgvector) containing dissected, classified, and
embedded code from the best open-source game projects across 8 engines.
This is the "Dataset Boost" — the foundation that makes every AI-generated
game dramatically better.

### The Pipeline
```
GitHub Scrape → Quality Filter → Engine-Specific Parse → LLM Classify → Embed → Store
```

### Reference Documents
- `docs/SUPREME_RAG_BLUEPRINT.md` — Full technical blueprint (taxonomy, schema, pipeline)
- `docs/MASTER_EXECUTION_PLAN.md` — This operational plan (anti-hallucination, prompts, phases)
- `docs/pietra_v4.md` — The foundational vision document for the entire product

### Directory Structure (Current Phase)
```
game-studio-ai/
├── CLAUDE.md                          ← you are here
├── .env                               ← API keys (never commit)
├── .gitignore
├── package.json                       ← minimal, for TS scripts
├── tsconfig.json
├── requirements.txt                   ← Python deps for ingestion scripts
│
├── docs/
│   ├── pietra_v4.md
│   ├── SUPREME_RAG_BLUEPRINT.md
│   └── MASTER_EXECUTION_PLAN.md
│
├── supabase/
│   └── migrations/
│       └── 001_knowledge_base.sql     ← pgvector schema
│
├── scripts/
│   └── ingestion/
│       ├── 01_scrape.py               ← GitHub + awesome lists scraper
│       ├── 02_filter.py               ← Quality gate (structural checks)
│       ├── 03_parse_godot.py          ← Godot .tscn/.gd parser
│       ├── 03_parse_phaser.py         ← Phaser scene parser
│       ├── 03_parse_renpy.py          ← Ren'Py .rpy parser
│       ├── 03_parse_generic.py        ← Defold/MonoGame/LÖVE/Three.js/Stride
│       ├── 04_classify.py             ← LLM classification (2-step + confidence gate)
│       ├── 05_embed_store.py          ← Embedding generation + Supabase insert
│       ├── 06_validate.py             ← Post-ingestion sanity checks
│       └── 07_test_queries.py         ← Query test suite
│
├── lib/
│   ├── knowledge.ts                   ← getReferences() + getReferenceParameters()
│   └── types.ts                       ← Shared TypeScript types
│
├── data/                              ← LOCAL ONLY, gitignored
│   ├── repos_raw/                     ← Cloned repos (Phase 1)
│   ├── repos_clean/                   ← Filtered repos (Phase 2)
│   ├── chunks_raw/                    ← Parsed chunks (Phase 3)
│   ├── chunks_classified/             ← LLM-classified chunks (Phase 4)
│   └── manifest.json                  ← Master repo manifest
│
└── test_output/                       ← Comparison test results
    ├── without_kb.gd
    └── with_kb.gd
```

### Key Constraints
- **Godot 4 ONLY**: filter `pushed:>=2025-01-01` on GitHub to exclude Godot 3 syntax
- **MIT/CC0/Apache/BSD/Zlib licenses ONLY**: no GPL, no proprietary, no unknown
- **Max 100MB per repo**: skip large repos with binary assets
- **Confidence gate**: chunks with LLM confidence < 85 go to quarantine, not main table

### Supabase Project
- URL: read from NEXT_PUBLIC_SUPABASE_URL env var
- Service key: read from SUPABASE_SERVICE_ROLE_KEY env var
- pgvector extension must be enabled before running migrations

### LLM APIs Used in This Phase
- **DeepSeek V4 Flash** (via OpenRouter or direct): classification of chunks
- **OpenAI text-embedding-3-small**: embedding generation (1536 dimensions)
- Both accessed through env vars: OPENROUTER_API_KEY, OPENAI_API_KEY

## ═══ FUTURE STATE: PHASE 2 — GAME STUDIO AI PRODUCT ═══

### What Comes After the Knowledge Base
Once the RAG is populated and tested, this same repository will grow into:

- **Hermes Agent Orchestrator** (lib/orchestrator.ts) — pattern from Nous Research
- **48 AI Tools** (lib/tools/) — code gen, sprite gen, audio gen, assemblers, QA
- **Game Reasoning Engine** — Game Plan + Game Graph before any generation
- **Next.js Frontend** — Creator Mode → Studio Mode → Code Mode
- **Multi-engine support** — Godot, Phaser, Ren'Py, Defold, MonoGame, LÖVE, Three.js, Stride
- **Full BaaS stack** — Clerk, Supabase, Trigger.dev, R2, E2B, OpenRouter, Helicone, PostHog, Vercel

### How the KB Connects to the Product
Every tool in lib/tools/ will call `getReferences()` from lib/knowledge.ts
BEFORE generating any code. The KB is the invisible foundation that makes
the AI output professional-grade instead of amateur.

### DO NOT build any product features during Phase 1.
Focus exclusively on the Knowledge Base pipeline. The product code comes in Phase 2.
```

---

# ═══════════════════════════════════════════════════════
# §03 — IL PIANO DI ESECUZIONE A FASI
# Roadmap tecnica con checklist rigide
# ═══════════════════════════════════════════════════════

## OVERVIEW

```
FASE 0 — Workspace Setup & DB Schema              [Giorno 1]
FASE 1 — GitHub Scraper                           [Giorno 2-4]
FASE 2 — Quality Filter                           [Giorno 5-6]
FASE 3 — Engine-Specific Parsers                  [Giorno 7-11]
FASE 4 — LLM Classifier (Blindato)                [Giorno 12-14]
FASE 5 — Embedding & Storage                      [Giorno 15-16]
FASE 6 — Validation & Test                        [Giorno 17-18]
FASE 7 — Integration & Comparison Test            [Giorno 19-21]
```

---

### FASE 0 — WORKSPACE SETUP & DB SCHEMA

**Obiettivo**: Inizializzare il progetto, creare lo schema Supabase, configurare l'ambiente.

**Sottofasi:**

| # | Task | Output atteso |
|---|---|---|
| 0.1 | Init progetto (package.json, tsconfig.json, requirements.txt, .gitignore, .env.example) | File di configurazione nella root |
| 0.2 | Creare la struttura directory (docs/, scripts/ingestion/, lib/, supabase/migrations/, data/) | Cartelle vuote con .gitkeep |
| 0.3 | Copiare i documenti fondativi in docs/ | pietra_v4.md, SUPREME_RAG_BLUEPRINT.md, MASTER_EXECUTION_PLAN.md |
| 0.4 | Salvare CLAUDE.md nella root | Il file che governa il workspace |
| 0.5 | Creare supabase/migrations/001_knowledge_base.sql | Schema completo con pgvector |
| 0.6 | Creare lib/knowledge.ts + lib/types.ts | Client KB e tipi condivisi |
| 0.7 | Configurare .env con tutte le API key | File locale, mai committato |
| 0.8 | Applicare la migration su Supabase (via Dashboard SQL Editor o CLI) | Tabelle create, indici attivi, RPC functions disponibili |

**✅ CHECKLIST DI VERIFICA FASE 0** (tutte devono essere TRUE per procedere):

```
[ ] package.json esiste con typescript e ts-node come devDependencies
[ ] requirements.txt esiste con: requests, supabase, openai, tqdm, python-dotenv
[ ] .gitignore contiene: .env, data/, node_modules/, __pycache__/
[ ] .env contiene: GITHUB_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
    OPENROUTER_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY
[ ] CLAUDE.md esiste nella root
[ ] supabase/migrations/001_knowledge_base.sql esiste e contiene:
    - CREATE EXTENSION vector
    - CREATE TABLE code_knowledge (con embedding vector(1536))
    - CREATE TABLE code_knowledge_quarantine (schema identico)
    - CREATE TABLE game_parameters
    - CREATE TABLE ingestion_log
    - Indici HNSW, GIN, B-tree
    - RPC functions search_code_knowledge e get_reference_parameters
[ ] lib/knowledge.ts esiste con funzioni getReferences() e getReferenceParameters()
[ ] lib/types.ts esiste con CodeReference, ParameterReference, ReferenceQuery, ParameterQuery
[ ] Le tabelle sono visibili nel Supabase Dashboard (Table Editor)
[ ] Una query SELECT COUNT(*) FROM code_knowledge ritorna 0 senza errori
```

---

### FASE 1 — GITHUB SCRAPER

**Obiettivo**: Scaricare ~400-800 repository open-source di giochi per tutti gli 8 engine.

**Sottofasi:**

| # | Task | Output atteso |
|---|---|---|
| 1.1 | Script `01_scrape.py`: interroga GitHub API con query per engine × genere | Manifest JSON con metadati di tutti i repo trovati |
| 1.2 | Filtro GitHub API: stars ≥ 20, pushed ≥ 2025-01-01, size ≤ 100MB, licenza whitelist | Repo Godot 3.x esclusi automaticamente |
| 1.3 | Scrape delle awesome lists per ogni engine (fetch README → extract links) | Link aggiuntivi aggiunti al manifest |
| 1.4 | Download dei repo ufficiali di demo/samples (lista hardcoded) | Demo godot, phaser examples, ecc. |
| 1.5 | `git clone --depth 1` per ogni repo in data/repos_raw/{engine}/{repo_name}/ | Repo scaricati senza history |
| 1.6 | Deduplica (stesso URL non scaricato due volte) | Manifest senza duplicati |
| 1.7 | Rate limiting (max 30 req/min GitHub API, sleep tra clone) | Nessun 429 / ban |

**Specifiche critiche dello script:**

- Usa `GITHUB_TOKEN` da .env (senza token: 60 req/ora; con token: 5000 req/ora)
- Query string: `q={query}+language:{lang}+stars:>=20+pushed:>=2025-01-01&sort=stars&per_page=30`
- Per le awesome list: fetch il raw README, regex per `github.com/[owner]/[repo]`, deduplica vs manifest
- Per ogni repo clonato: salva in manifest.json `{url, engine, stars, license, size_kb, topics[], cloned_at}`
- Flag `--dry-run` che mostra quanti repo verrebbero scaricati senza scaricarli
- Flag `--engine godot` per eseguire solo un engine specifico (utile per debug)
- Se un clone fallisce (repo privato, cancellato): logga errore, continua con il prossimo

**✅ CHECKLIST DI VERIFICA FASE 1:**

```
[ ] data/manifest.json esiste e contiene almeno 300 entry
[ ] data/repos_raw/ ha sottocartelle per almeno 6 engine
[ ] data/repos_raw/godot/ contiene almeno 60 repo
[ ] data/repos_raw/phaser/ contiene almeno 30 repo
[ ] Nessun repo ha pushed_at prima del 2025-01-01 nel manifest
[ ] Nessun repo ha licenza non nella whitelist (verifica manuale su 10 campioni random)
[ ] scrape_log.txt mostra 0 errori fatali (warning OK, error NO)
[ ] --dry-run funziona e mostra i conteggi senza scaricare nulla
```

---

### FASE 2 — QUALITY FILTER

**Obiettivo**: Ridurre i ~400-800 repo a ~150-200 di qualità verificata.

**Sottofasi:**

| # | Task | Output atteso |
|---|---|---|
| 2.1 | Script `02_filter.py`: applica 5 check strutturali per engine | Quality report JSON per ogni repo |
| 2.2 | Check struttura minima (file obbligatori per engine) | Repo senza project.godot o main.lua scartati |
| 2.3 | Check LOC range (300-30000) | Repo troppo piccoli o troppo grandi scartati |
| 2.4 | Check rapporto commenti/codice (≥ 3%) | Repo senza commenti penalizzati |
| 2.5 | Check dipendenze (max 5 plugin/addon per Godot) | Repo con 15 plugin scartati |
| 2.6 | Check licenza (whitelist MIT/CC0/Apache/BSD/Zlib/Unlicense/ISC) | GPL e sconosciuti scartati |
| 2.7 | Copia repo che passano in data/repos_clean/{engine}/ | Solo "Golden Repos" |

**Specifiche critiche:**

- Per il check Godot 4 specificamente: verifica che `project.godot` contenga `config_version=5` (Godot 4.x). Se contiene `config_version=4` è Godot 3 → scarta anche se pushed dopo il 2025.
- Per il check struttura Phaser: cerca `Phaser.Game` o `Phaser.Scene` nei file .js/.ts (non solo nel nome del file)
- Lo script produce data/quality_report.json: array con {repo, engine, pass: bool, reason_if_failed, loc, score}
- Flag `--engine godot` per filtrare un solo engine
- Flag `--verbose` per stampare motivo di esclusione di ogni repo scartato

**✅ CHECKLIST DI VERIFICA FASE 2:**

```
[ ] data/repos_clean/ ha sottocartelle per almeno 6 engine
[ ] data/repos_clean/godot/ contiene almeno 25 repo
[ ] data/quality_report.json esiste con entry per TUTTI i repo (passati e scartati)
[ ] Nessun repo in repos_clean/ ha config_version=4 nei project.godot
[ ] Verifica manuale su 5 repo Godot: aprirli in editor non dà errori di parsing
[ ] Verifica manuale su 5 repo Phaser: index.html si apre nel browser
[ ] Il rapporto scartati/totali è tra 40% e 70% (se troppo basso: filtri troppo lenti;
    se troppo alto: query di scraping troppo sporche)
```

---

### FASE 3 — ENGINE-SPECIFIC PARSERS

**Obiettivo**: Trasformare i ~150-200 repo in ~5000-7000 chunk raw con heuristic pre-classification.

**Sottofasi:**

| # | Task | Output atteso |
|---|---|---|
| 3.1 | Script `03_parse_godot.py`: parser per .tscn e .gd | Chunk con scene_context + code + heuristic category |
| 3.2 | Script `03_parse_phaser.py`: parser per scene Phaser | Chunk per Phaser.Scene con preload/create/update |
| 3.3 | Script `03_parse_renpy.py`: parser per .rpy | Chunk per route, screen, config |
| 3.4 | Script `03_parse_generic.py`: parser per Defold, MonoGame, LÖVE, Three.js, Stride | Chunk basati su import/class/function analysis |
| 3.5 | Raggruppamento file correlati in chunk singoli | Player spezzato in 3 file → 1 chunk concatenato |
| 3.6 | Statistiche: chunk prodotti per engine, per heuristic category | Report di copertura |

**Specifiche critiche del Godot Parser (il più complesso):**

Parsing `.tscn`:
- Il formato è testuale con sezioni `[gd_scene]`, `[ext_resource]`, `[sub_resource]`, `[node]`, `[connection]`
- Ogni `[node]` ha: `name`, `type`, `parent` (path relativo), e opzionalmente `script = ExtResource("N")`
- Le `[ext_resource]` mappano ID numerico a path di file (.gd, .png, .tres)
- Le `[connection]` definiscono i segnali: `signal="body_entered" from="Hitbox" to="." method="_on_hit"`
- Il parser deve costruire un albero di nodi e per ogni nodo con script, leggere il file .gd collegato

Heuristic rules (ordine di priorità):
1. Se il file .gd contiene `input.is_action` o `Input.get_axis` → `A01_player_controller` (confidence: high)
2. Se contiene `patrol` O `chase` O `detection_area` O `aggro` → `A04_enemy_ai` (confidence: high)
3. Se contiene `hitbox` E `damage` E `hurtbox` → `A03_combat` (confidence: high)
4. Se `extends Camera2D` o `extends Camera3D` → `A05_camera` (confidence: high)
5. Se `extends Control` O `extends CanvasLayer` → `D01_ui` (confidence: medium)
6. Se contiene `AudioStreamPlayer` O `AudioServer` → `D02_audio` (confidence: medium)
7. Se contiene `FileAccess` O `ConfigFile` O `save` and `load` → `C04_save_load` (confidence: medium)
8. Se contiene `NavigationAgent` → `B04_navigation` (confidence: high)
9. Se contiene `TileMap` → `B01_level_structure` (confidence: medium)
10. Se nessuna regola matcha → `X00_uncertain` (confidence: low)

Output chunk JSON:
```json
{
  "source_repo": "https://github.com/...",
  "engine": "godot",
  "file_paths": ["scripts/player/player_controller.gd"],
  "scene_context": "CharacterBody2D root > AnimatedSprite2D, CollisionShape2D, Hitbox(Area2D > CollisionShape2D)",
  "code": "extends CharacterBody2D\n...",
  "loc": 187,
  "heuristic_domain": "A_core_gameplay",
  "heuristic_category": "A01_player_controller",
  "heuristic_confidence": "high",
  "extends_type": "CharacterBody2D",
  "exports_found": ["speed: float = 120.0", "jump_force: float = -350.0"],
  "functions_found": ["_physics_process", "_on_hit", "jump", "dash", "apply_gravity"],
  "signals_defined": ["hit", "died"],
  "signals_connected_from_scene": ["body_entered → _on_hit"]
}
```

**✅ CHECKLIST DI VERIFICA FASE 3:**

```
[ ] data/chunks_raw/ ha sottocartelle per ogni engine processato
[ ] Conteggio totale chunk: tra 4000 e 8000
[ ] Per Godot: almeno 200 chunk con heuristic_confidence = "high"
[ ] Per Godot: almeno 30 chunk con heuristic_category = "A01_player_controller"
[ ] Per Godot: almeno 20 chunk con heuristic_category = "A04_enemy_ai"
[ ] Per Phaser: almeno 80 chunk totali
[ ] Per Ren'Py: almeno 40 chunk totali
[ ] Verifica manuale su 10 chunk Godot: il scene_context è coerente con il codice
[ ] Nessun chunk ha code vuoto o LOC = 0
[ ] Nessun chunk ha file_paths vuoto
```

---

### FASE 4 — LLM CLASSIFIER (BLINDATO)

**Obiettivo**: Classificare tutti i chunk con DeepSeek V4 Flash usando la strategia anti-allucinazione.

**Sottofasi:**

| # | Task | Output atteso |
|---|---|---|
| 4.1 | Script `04_classify.py` con JSON Schema vincolato | Structured Output attivato |
| 4.2 | Classificazione 2-step: domain triage heuristic → fine classification LLM | Dominio vincolato quando possibile |
| 4.3 | Confidence gate: ≥85 accept, 60-84 quarantine, <60 reject | 3 flussi separati |
| 4.4 | Retry logic: max 2 tentativi per chunk, exponential backoff su 429 | Zero crash per rate limit |
| 4.5 | Progress tracking: tqdm + log costi + ETA | Visibilità totale |
| 4.6 | Output in data/chunks_classified/ con merge dei dati raw + classificazione | Chunk arricchiti |
| 4.7 | Report finale: distribuzione per category, per confidence, per engine | Dati per validazione |

**Specifiche critiche dello script:**

Il prompt per DeepSeek (Step 2 del 2-step):

```
You are a game development expert. Classify this {engine} code.

DOMAIN CONSTRAINT: {domain_from_heuristic OR "Determine the domain yourself"}
Scene context: {scene_context}
Heuristic pre-classification: {heuristic_category} (confidence: {heuristic_confidence})

CODE:
```
{code — max 3000 tokens, truncated with "... [TRUNCATED]" if longer}
```

Classify this code. Be precise. If you're not sure, use X00_uncertain category
and set confidence_score below 60. It's better to be uncertain than wrong.
Quality: 1=buggy/messy, 3=functional, 5=exemplary/production-grade.
Reusability: 1=project-specific, 3=adaptable, 5=drop-in reusable.
```

Configurazione della chiamata API:

```python
response = client.chat.completions.create(
    model="deepseek-chat",  # DeepSeek V4 Flash
    messages=[{"role": "user", "content": prompt}],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "chunk_classification",
            "strict": True,
            "schema": CLASSIFICATION_SCHEMA  # Lo schema definito in §01.2
        }
    },
    temperature=0.1,  # Bassa per massima determinismo
    max_tokens=500
)
```

Se DeepSeek non supporta `json_schema` direttamente, fallback a:
```python
response_format={"type": "json_object"}
# + validazione post-hoc con jsonschema.validate()
# + reject se non valida
```

**✅ CHECKLIST DI VERIFICA FASE 4:**

```
[ ] data/chunks_classified/ contiene chunk per ogni engine
[ ] Nessun chunk ha primary_category fuori dall'enum definito
[ ] Nessun chunk ha genre_tags fuori dall'enum definito
[ ] Distribuzione confidence: almeno 75% dei chunk ha confidence ≥ 85
[ ] Distribuzione category: nessuna category ha > 30% dei chunk totali
[ ] Distribuzione category: nessuna category critica ha 0 chunk per Godot
    (A01, A03, A04, B01, D01, D02, E01 devono avere almeno 5 chunk ciascuna)
[ ] X02_trash è < 10% dei chunk totali
[ ] X00_uncertain è < 15% dei chunk totali
[ ] Il costo totale LLM è < $5 (come da stima)
[ ] Il report di classificazione è leggibile e coerente
```

---

### FASE 5 — EMBEDDING & STORAGE

**Obiettivo**: Generare embedding e caricare in Supabase.

**Sottofasi:**

| # | Task | Output atteso |
|---|---|---|
| 5.1 | Script `05_embed_store.py`: legge chunk classificati (solo ACCEPT, confidence ≥ 85) | Chunk filtrati |
| 5.2 | Costruisce searchable_text (summary + metadati, NON codice grezzo) | Testo per embedding |
| 5.3 | Genera embedding con OpenAI text-embedding-3-small (batch di 100) | Vettori 1536-dim |
| 5.4 | Insert in code_knowledge (batch di 50 righe) | Dati in Supabase |
| 5.5 | Chunk in quarantine (confidence 60-84) → insert in code_knowledge_quarantine | Separati dai golden data |
| 5.6 | Parametri numerici → insert in game_parameters | Tabella parametri popolata |
| 5.7 | Update ingestion_log per ogni repo | Tracciabilità completa |
| 5.8 | Report finale: conteggi per tabella, per engine, costo embedding | Statistiche |

**✅ CHECKLIST DI VERIFICA FASE 5:**

```
[ ] SELECT COUNT(*) FROM code_knowledge ritorna > 3000
[ ] SELECT COUNT(*) FROM code_knowledge_quarantine ritorna > 0 (quarantine funziona)
[ ] SELECT COUNT(*) FROM game_parameters ritorna > 200
[ ] SELECT DISTINCT engine FROM code_knowledge ritorna almeno 4 engine
[ ] SELECT COUNT(*) FROM code_knowledge WHERE embedding IS NULL ritorna 0
[ ] Una query search_code_knowledge con p_engine='godot', p_category='A01_player_controller'
    ritorna almeno 10 risultati
[ ] Una query get_reference_parameters con p_engine='godot', p_genre='platformer',
    p_parameter_group='player_physics' ritorna almeno 3 risultati
[ ] Il costo totale embedding è < $0.10
```

---

### FASE 6 — VALIDATION & TEST

**Obiettivo**: Verificare che la Knowledge Base sia sana e interrogabile.

**Sottofasi:**

| # | Task | Output atteso |
|---|---|---|
| 6.1 | Script `06_validate.py`: esegue le query di sanity check (distribuzione, copertura, clustering) | Report anomalie |
| 6.2 | Script `07_test_queries.py`: batteria di 20 query con risultati attesi | Report PASS/FAIL |
| 6.3 | Fix anomalie se trovate (ri-classificazione batch, pulizia dati) | DB pulito |
| 6.4 | Review manuale dei chunk in quarantine (top 100 per confidence desc) | Promozione o scarto |

**✅ CHECKLIST DI VERIFICA FASE 6:**

```
[ ] Validation report mostra 0 anomalie critiche
[ ] Test queries: almeno 16/20 PASS (80%)
[ ] Quarantine review completata (almeno top 100 chunk visti)
[ ] Nessuna category ha 0 risultati per Godot
[ ] Query semantica "player controller with wall jump" ritorna risultati con wall_jump nei key_features
[ ] Query semantica "boss fight multi phase" ritorna risultati con boss_phase nei key_features
```

---

### FASE 7 — INTEGRATION & COMPARISON TEST

**Obiettivo**: Dimostrare il boost della KB con un test A/B concreto.

**Sottofasi:**

| # | Task | Output atteso |
|---|---|---|
| 7.1 | Assicurarsi che lib/knowledge.ts funzioni end-to-end con Supabase | getReferences() ritorna risultati |
| 7.2 | Script comparison: generazione SENZA KB vs CON KB | Due file .gd da confrontare |
| 7.3 | Valutazione automatica con Claude Sonnet (5 criteri) | Score /5 per ciascuno |
| 7.4 | Documentare i risultati in test_output/COMPARISON_REPORT.md | Prova del boost |

**✅ CHECKLIST DI VERIFICA FASE 7:**

```
[ ] test_output/without_kb.gd esiste e contiene GDScript valido
[ ] test_output/with_kb.gd esiste e contiene GDScript valido
[ ] with_kb.gd ha score superiore a without_kb.gd su almeno 3/5 criteri
[ ] COMPARISON_REPORT.md documenta i risultati numerici
[ ] lib/knowledge.ts è testato e funzionante con il DB di produzione
```

---

# ═══════════════════════════════════════════════════════
# §04 — CLAUDE CODE IGNITION PROMPTS
# I prompt esatti da incollare nel terminale
# ═══════════════════════════════════════════════════════

## Come usare questi prompt

Ogni prompt è un blocco autonomo. Lo copi, lo incolli nel terminale di Claude Code dentro VS Code, e aspetti che venga eseguito. Non devi modificare nulla. L'ordine è sequenziale: completa un prompt, verifica la checklist, poi passa al successivo.

I prompt fanno sempre riferimento a CLAUDE.md (che Claude Code legge automaticamente dalla root) e ai documenti in docs/.

---

## PROMPT FASE 0 — Setup Workspace

```
Leggi CLAUDE.md e docs/SUPREME_RAG_BLUEPRINT.md.

Esegui il setup iniziale del workspace per la Fase 1 (RAG Knowledge Base):

1. Inizializza package.json con: name "game-studio-ai", typescript e ts-node 
   come devDependencies, @supabase/supabase-js e openai come dependencies.

2. Crea tsconfig.json con strict mode, ES2022 target, moduleResolution node.

3. Crea requirements.txt con: requests, python-dotenv, supabase, openai, 
   tqdm, jsonschema.

4. Crea .gitignore che escluda: .env, data/, node_modules/, __pycache__/, 
   *.pyc, .DS_Store, test_output/.

5. Crea .env.example con tutte le chiavi necessarie (valori vuoti):
   GITHUB_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
   OPENROUTER_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY.

6. Crea la struttura directory come specificato in CLAUDE.md:
   docs/, scripts/ingestion/, lib/, supabase/migrations/, data/ (con 
   sottocartelle repos_raw, repos_clean, chunks_raw, chunks_classified).

7. Crea lib/types.ts con i tipi TypeScript dalla sezione §04.2 del Blueprint:
   CodeReference, ParameterReference, ReferenceQuery, ParameterQuery.

8. Installa le dipendenze npm e verifica che tutto compili.

Non creare ancora gli script di ingestion o lo schema SQL — quelli vengono 
nelle fasi successive. Concentrati solo sul setup pulito del workspace.
```

---

## PROMPT FASE 0B — Database Schema

```
Leggi CLAUDE.md, docs/SUPREME_RAG_BLUEPRINT.md (sezione §03) e 
docs/MASTER_EXECUTION_PLAN.md (sezione §01 per le difese anti-allucinazione).

Crea il file supabase/migrations/001_knowledge_base.sql con:

1. Abilita pgvector: CREATE EXTENSION IF NOT EXISTS vector;

2. Tabella code_knowledge con TUTTI i campi dal Blueprint §03.1 PIÙ:
   - confidence_score smallint (0-100) — dalla strategia anti-allucinazione
   - CHECK constraints su quality_score (1-5), reusability_score (1-5), 
     confidence_score (0-100)

3. Tabella code_knowledge_quarantine — SCHEMA IDENTICO a code_knowledge.
   Questa ospita i chunk con confidence 60-84 in attesa di review.

4. Tabella game_parameters (dal Blueprint §03.1).

5. Tabella ingestion_log (dal Blueprint §03.1) con campo aggiuntivo:
   - classification_status text ('accepted', 'quarantined', 'rejected')

6. INDICI:
   - B-tree su: engine, primary_category, chunk_type, complexity, 
     quality_score DESC, confidence_score DESC
   - GIN su: genre_tags, key_features, subcategories, design_patterns
   - HNSW su embedding: vector_cosine_ops, m=16, ef_construction=64
   - Stessi indici sulla tabella quarantine

7. RPC function search_code_knowledge (dal Blueprint §03.1) con parametro 
   aggiuntivo p_min_confidence int default 85.

8. RPC function get_reference_parameters (dal Blueprint §03.1).

9. Helper function increment_retrieval_count(p_ids uuid[]) che incrementa 
   times_retrieved per gli ID passati.

10. RLS: enable su tutte le tabelle, policy SELECT per anon su 
    code_knowledge e game_parameters.

Dopo aver scritto il file SQL, mostrami il comando per applicarlo 
via Supabase CLI o indica che devo incollarlo nel SQL Editor del Dashboard.
```

---

## PROMPT FASE 0C — Knowledge Client

```
Leggi CLAUDE.md e docs/SUPREME_RAG_BLUEPRINT.md (sezione §04.2 e §04.3).

Crea lib/knowledge.ts — il client TypeScript per la Knowledge Base.

Implementa esattamente:

1. Import da @supabase/supabase-js e openai. Client inizializzati da env vars.

2. Funzione getReferences(query: ReferenceQuery): Promise<CodeReference[]>
   - Genera embedding della semanticQuery se fornita (text-embedding-3-small)
   - Chiama supabase.rpc('search_code_knowledge') con parametri mappati
   - Include p_min_confidence nel mapping (default 85)
   - Fire-and-forget increment_retrieval_count sugli ID ritornati
   - Return [] su errore (graceful degradation, non throw)

3. Funzione getReferenceParameters(query: ParameterQuery): Promise<ParameterReference[]>
   - Chiama supabase.rpc('get_reference_parameters')
   - Return [] su errore

4. Funzione buildReferenceContext(codeRefs, paramRefs): string
   - Formatta i riferimenti come blocco di testo per il prompt LLM
   - Formato: header "=== REFERENCE CODE ===" poi per ogni ref: 
     summary, source, quality, features, poi code block
   - Per i params: header "=== REFERENCE PARAMETERS ===" poi JSON

5. Tutti i tipi importati da ./types.ts (già creato nella Fase 0)

6. Logging: console.error con oggetto di contesto su ogni errore

7. Nessun any type. Ogni variabile tipizzata.

Testa che il file compili con: npx tsc --noEmit lib/knowledge.ts
```

---

## PROMPT FASE 1 — GitHub Scraper

```
Leggi CLAUDE.md e docs/SUPREME_RAG_BLUEPRINT.md (sezione §02.2).
Leggi docs/MASTER_EXECUTION_PLAN.md (Fase 1 checklist).

Crea scripts/ingestion/01_scrape.py — lo scraper GitHub + awesome lists.

Requisiti:

1. QUERIES: definisci un dizionario SEARCH_QUERIES con almeno 8 query per 
   ognuno degli 8 engine (godot, phaser, renpy, defold, monogame, love2d, 
   threejs, stride). Le query devono essere specifiche per genere 
   (es. "godot 4 metroidvania", "godot roguelike", "phaser puzzle game").

2. FILTRI GITHUB API:
   - stars:>=20
   - pushed:>=2025-01-01 (CRITICO: esclude Godot 3)
   - size:<=100000 (max 100MB)
   - sort=stars, per_page=30
   - Usa header Authorization con GITHUB_TOKEN da .env

3. AWESOME LISTS: per ogni engine, fetch il README della awesome list 
   (URL hardcoded), estrai link github.com con regex, aggiungi al manifest 
   se non già presente.

4. OFFICIAL SAMPLES: lista hardcoded di repo ufficiali per engine 
   (godot-demo-projects, phaser3-examples, defold-examples, ecc).

5. CLONE: per ogni repo nel manifest, git clone --depth 1 in 
   data/repos_raw/{engine}/{repo_name}/. Skip se cartella già esiste 
   (idempotenza).

6. RATE LIMITING: sleep 2 secondi tra ogni API call, sleep 1 secondo 
   tra ogni git clone. Log ogni richiesta.

7. OUTPUT: data/manifest.json — array di oggetti con:
   {url, engine, stars, license, size_kb, topics, pushed_at, cloned_at, 
    clone_status: "success"|"failed"|"skipped"}

8. FLAGS:
   --dry-run: mostra conteggi senza scaricare
   --engine X: esegui solo per engine X
   --skip-clone: aggiorna solo manifest senza clonare

9. LOGGING: tqdm progress bar per ogni fase. 
   File scrape_log.txt con timestamp per ogni azione.

10. ERROR HANDLING: se un clone fallisce, logga errore e continua. 
    Mai crash per un singolo repo fallito.

Lo script deve essere eseguibile con: python scripts/ingestion/01_scrape.py
E con: python scripts/ingestion/01_scrape.py --dry-run --engine godot
```

---

## PROMPT FASE 2 — Quality Filter

```
Leggi CLAUDE.md e docs/SUPREME_RAG_BLUEPRINT.md (sezione §02.3).
Leggi docs/MASTER_EXECUTION_PLAN.md (Fase 2 checklist).

Crea scripts/ingestion/02_filter.py — il quality gate strutturale.

Requisiti:

1. Legge data/manifest.json (generato dalla Fase 1).
2. Per ogni repo con clone_status="success" in data/repos_raw/:

   CHECK A — Struttura minima engine-specific:
   - Godot: project.godot esiste E contiene "config_version=5" (Godot 4.x).
     Se config_version=4 → SCARTA (è Godot 3). Almeno 3 file .gd.
   - Phaser: almeno 1 file .js/.ts con stringa "Phaser.Game" o "Phaser.Scene"
   - Ren'Py: almeno 1 file .rpy con "label start"
   - Defold: game.project esiste
   - MonoGame: .csproj con "MonoGame" nel contenuto
   - LÖVE: main.lua con "love." nel contenuto
   - Three.js: almeno 1 file .js/.ts con "THREE." nel contenuto
   - Stride: .csproj o .sdpkg esiste

   CHECK B — LOC: conta righe di codice dei file dell'engine 
   (solo .gd per Godot, .js/.ts per Phaser, ecc). Range: 300-30000.

   CHECK C — Commenti: rapporto linee commento / linee totali >= 0.03.
   Commenti: righe che iniziano con # (GDScript/Python), // (JS/C#/Lua)

   CHECK D — Plugin count (solo Godot): conta cartelle in addons/. 
   Max 5. Anche: conta entry [autoload] in project.godot, max 10.

   CHECK E — Licenza: cerca file LICENSE, LICENSE.md, COPYING nella root.
   Contenuto deve matchare whitelist: MIT, CC0, Apache-2.0, BSD-2-Clause,
   BSD-3-Clause, Unlicense, ISC, Zlib. Se assente → flag "unknown".

3. Scoring: assegna quality_score_structural (1-5) basato su:
   5: tutti i check passati, LOC 1000-10000, commenti > 8%
   4: tutti passati, LOC nel range, commenti > 5%
   3: tutti passati, margini (LOC vicino ai limiti, commenti bassi)
   2: 1 check fallito non critico (es. commenti bassi)
   1: check critico fallito → SCARTA

4. Copia repo con score >= 3 in data/repos_clean/{engine}/{repo_name}/

5. Output: data/quality_report.json — array con:
   {repo, engine, checks: {structure, loc, comments, plugins, license}, 
    quality_score, pass: bool, reason_if_failed}

6. FLAGS: --engine X, --verbose, --dry-run

7. Log: quanti repo per engine passano/falliscono, distribuzione score.

Eseguibile con: python scripts/ingestion/02_filter.py
```

---

## PROMPT FASE 3A — Godot Parser

```
Leggi CLAUDE.md e docs/SUPREME_RAG_BLUEPRINT.md (sezione §02.4.1 e §02.4.2).
Leggi docs/MASTER_EXECUTION_PLAN.md (Fase 3, specifiche Godot Parser).

Crea scripts/ingestion/03_parse_godot.py — il parser per progetti Godot 4.

Questo è lo script PIÙ COMPLESSO di tutta la pipeline. Implementa una classe 
GodotParser con metodi modulari.

Requisiti:

1. CLASS GodotParser:
   
   Metodo parse_project_godot(path) → dict:
   - Legge il file INI project.godot
   - Estrai sezioni: [autoload] (nomi e path singleton), 
     [input] (azioni con deadzone), [display] (width, height),
     [layer_names] (nomi collision layer)
   - Ritorna dizionario strutturato

   Metodo parse_tscn(path) → dict:
   - Parsa il formato .tscn (NON è INI, è un formato custom Godot):
     - Sezione [gd_scene]: metadata
     - Sezione [ext_resource]: id → {type, path} (script, textures, ecc)
     - Sezione [sub_resource]: risorse inline (shapes, materials)
     - Sezione [node]: name, type, parent, properties, script ref
     - Sezione [connection]: signal, from, to, method
   - Costruisci albero nodi come lista di dict: 
     [{name, type, parent_path, script_path, properties}]
   - Ritorna: {nodes, connections, ext_resources, scene_context_string}
   - Il scene_context_string è tipo: 
     "CharacterBody2D > AnimatedSprite2D, CollisionShape2D, Hitbox(Area2D)"

   Metodo parse_gdscript(path) → dict:
   - Estrai con regex da file .gd:
     - extends (la classe base)
     - class_name (se definito)
     - Tutte le func (nome + parametri)
     - Tutti i signal (nome + parametri)
     - Tutte le @export var (nome + tipo + valore default se presente)
     - Tutte le @onready var (nome + tipo)
     - Import/preload statements
   - Ritorna: {extends, class_name, functions[], signals[], exports[], 
     onready_vars[], preloads[]}

   Metodo heuristic_classify(gdscript_data, scene_context) → dict:
   - Applica le 10 regole di heuristic dal MASTER_EXECUTION_PLAN Fase 3
   - Ritorna: {domain, category, confidence}

   Metodo chunk_project(project_path) → list[dict]:
   - Per un intero progetto Godot:
     a) Parsa project.godot → chunk E01_project_structure
     b) Per ogni .tscn: parsa, identifica script collegati
     c) Per ogni .gd: parsa, classifica con heuristic
     d) Raggruppa file correlati (stesso nodo/scena) in chunk singoli
        - Se player.tscn ha player_movement.gd + player_combat.gd:
          concatena con "# === FILE: player_movement.gd ===" separatori
     e) Ritorna lista di chunk JSON conformi al formato output

2. MAIN: itera su data/repos_clean/godot/, chiama chunk_project per 
   ciascuno, salva output in data/chunks_raw/godot/{repo_name}/chunk_NNN.json

3. Statistiche finali: chunk per repo, chunk per heuristic_category, 
   distribuzione confidence.

4. FLAGS: --repo X (parsa solo un repo specifico per debug), --verbose

5. Il codice nei chunk NON deve essere troncato. Se un file supera 800 righe,
   dividilo in chunk separati per funzione logica (non per numero di riga).

Eseguibile con: python scripts/ingestion/03_parse_godot.py
E per debug: python scripts/ingestion/03_parse_godot.py --repo repo_name --verbose
```

---

## PROMPT FASE 3B — Altri Parser

```
Leggi CLAUDE.md e docs/SUPREME_RAG_BLUEPRINT.md (sezioni §02.4.3, §02.4.4, §02.4.5).

Crea 3 script parser per gli altri engine. Devono seguire la stessa struttura 
del Godot parser (classe con metodi modulari, heuristic classification, output 
chunk JSON identico nel formato).

1. scripts/ingestion/03_parse_phaser.py
   - Classe PhaserParser
   - Identifica entry point: file con "new Phaser.Game("
   - Estrai Phaser.GameConfig (width, height, physics, scene list)
   - Per ogni classe Phaser.Scene: analizza preload(), create(), update()
   - Heuristic: this.player + cursors → player, "Menu" nel nome → UI,
     this.tilemap → level, this.enemies → enemy system
   - Output: un chunk per scene class

2. scripts/ingestion/03_parse_renpy.py
   - Classe RenPyParser
   - Legge tutti i .rpy di un progetto
   - Identifica: label (con label start obbligatorio), menu (scelte),
     define/default (variabili), image (sprite declarations),
     screen (custom UI), transform (animazioni)
   - Chunk per: route narrativo (cluster di label collegati), 
     screen custom, config (gui.rpy + options.rpy)
   - Heuristic: label+menu → C03_dialogue_narrative, 
     screen → D01_ui, define characters → E04_genre_specific

3. scripts/ingestion/03_parse_generic.py
   - Classe GenericParser con sotto-metodi per: 
     Defold, MonoGame, LÖVE, Three.js, Stride
   - Approccio: analisi import/require/using + nomi funzioni/classi
   - Per LÖVE: analizza love.load, love.update, love.draw, love.keypressed
   - Per Three.js: analizza scene/camera/renderer setup, animate loop
   - Per MonoGame: analizza Game1.cs (Initialize, LoadContent, Update, Draw)
   - Per Defold: analizza .script (init, update, on_message, on_input)
   - Heuristic più semplice (medium/low confidence): il dominio sarà 
     spesso X_uncertain, e l'LLM nella Fase 4 farà il lavoro pesante.

Tutti gli script devono essere eseguibili singolarmente:
python scripts/ingestion/03_parse_phaser.py
python scripts/ingestion/03_parse_renpy.py
python scripts/ingestion/03_parse_generic.py
```

---

## PROMPT FASE 4 — LLM Classifier

```
Leggi CLAUDE.md e docs/MASTER_EXECUTION_PLAN.md (TUTTA la sezione §01 
"RAG Defense Mechanism" — è la parte più critica).
Leggi docs/SUPREME_RAG_BLUEPRINT.md (sezione §02.5).

Crea scripts/ingestion/04_classify.py — il classificatore LLM blindato.

REQUISITI CRITICI (anti-allucinazione):

1. CLASSIFICATION_SCHEMA: definisci il JSON Schema ESATTO dalla sezione §01.2 
   del MASTER_EXECUTION_PLAN come costante Python. Tutti gli enum, pattern, 
   minItems, maxItems devono essere IDENTICI al documento.

2. DOMAIN TRIAGE (Step 1, zero LLM):
   - Leggi heuristic_domain e heuristic_confidence dal chunk raw
   - Se confidence = "high": il dominio è fissato, passalo come vincolo all'LLM
   - Se confidence = "low" o "medium": dominio = "determine yourself"

3. LLM CALL (Step 2):
   - Usa DeepSeek V4 Flash (modello "deepseek-chat") via API diretta o OpenRouter
   - Attiva response_format con JSON Schema se supportato,
     altrimenti response_format={"type": "json_object"} + validazione post-hoc
   - Temperature: 0.1 (massimo determinismo)
   - Max tokens: 500
   - Il prompt DEVE includere il vincolo di dominio dallo Step 1
   - Il codice nel prompt è TRONCATO a max 3000 token (conta i caratteri / 4)
     con nota "[... TRUNCATED]" se troncato

4. VALIDAZIONE POST-HOC (se non c'è strict JSON Schema):
   - Parsa JSON con json.loads()
   - Valida con jsonschema.validate(data, CLASSIFICATION_SCHEMA)
   - Se non valida: retry 1 volta con prompt che aggiunge 
     "CRITICAL: respond with VALID JSON matching the schema exactly"
   - Se secondo tentativo fallisce: logga errore, marca chunk come rejected

5. CONFIDENCE GATE:
   - confidence_score >= 85 → salva in data/chunks_classified/{engine}/ 
     con campo classification_status = "accepted"
   - confidence_score 60-84 → salva con classification_status = "quarantined"
   - confidence_score < 60 → salva con classification_status = "rejected"
   - primary_category = "X02_trash" → always "rejected"
   - rejection_reason != null → always "rejected"

6. MERGE: l'output JSON combina i dati del chunk raw + la classificazione LLM.
   Il file risultante ha TUTTI i campi necessari per l'insert in Supabase.

7. RATE LIMITING: max 50 requests/minuto. Sleep 1.2 secondi tra ogni call.
   Su errore 429: exponential backoff (2s, 4s, 8s, max 3 retry).

8. PROGRESS: tqdm progress bar, stima costo running, ETA.

9. REPORT FINALE: stampa distribuzione per category, per confidence range, 
   per classification_status. Stampa costo totale.

10. FLAGS: --engine X, --dry-run (mostra primo chunk che verrebbe classificato),
    --sample N (classifica solo N chunk random per test), --verbose

Eseguibile con: python scripts/ingestion/04_classify.py
E per test: python scripts/ingestion/04_classify.py --engine godot --sample 20 --verbose
```

---

## PROMPT FASE 5 — Embedding & Storage

```
Leggi CLAUDE.md e docs/SUPREME_RAG_BLUEPRINT.md (sezione §02.6 e §03).
Leggi docs/MASTER_EXECUTION_PLAN.md (Fase 5 checklist).

Crea scripts/ingestion/05_embed_store.py — embedding e insert in Supabase.

Requisiti:

1. Legge SOLO i chunk con classification_status = "accepted" da 
   data/chunks_classified/

2. Per ogni chunk, costruisce searchable_text:
   "{summary}\nEngine: {engine}\nCategory: {primary_category}\n
    Subcategories: {', '.join(subcategories)}\nGenres: {', '.join(genre_tags)}\n
    Features: {', '.join(key_features)}\nPatterns: {', '.join(design_patterns)}\n
    Complexity: {complexity}"

3. Genera embedding in BATCH (OpenAI supporta fino a 2048 input per chiamata):
   - Batch size: 100 testi per chiamata
   - Modello: text-embedding-3-small
   - Output: array di 1536 float per testo

4. INSERT in Supabase tabella code_knowledge:
   - Batch size: 50 righe per insert
   - Mappi TUTTI i campi dal chunk classificato ai campi della tabella
   - Il campo embedding è il vettore generato
   - confidence_score incluso

5. Per chunk con classification_status = "quarantined":
   - INSERT in code_knowledge_quarantine (stessa struttura)

6. Per chunk con extracted_parameters non vuoto:
   - INSERT in game_parameters
   - parameter_group derivato da primary_category con mapping:
     A01 → player_physics, A02 → player_physics, A03 → combat_stats,
     A04 → enemy_stats, A05 → camera_settings, C01 → progression_economy,
     D02 → audio_config, altro → "general"

7. UPDATE ingestion_log per ogni repo con:
   chunks_produced, classification_status conteggi, status = "embedded"

8. REPORT: totale inseriti per tabella, per engine, per category. 
   Costo embedding totale. Tempo totale.

9. FLAGS: --engine X, --dry-run, --skip-quarantine (ignora quarantine)

10. IDEMPOTENZA: prima di inserire, controlla se source_repo + file_paths 
    esiste già (per evitare duplicati in caso di re-run).

Eseguibile con: python scripts/ingestion/05_embed_store.py
```

---

## PROMPT FASE 6 — Validation

```
Leggi CLAUDE.md e docs/MASTER_EXECUTION_PLAN.md (sezioni §01.5 e Fase 6).

Crea due script:

1. scripts/ingestion/06_validate.py — Sanity check post-ingestion:
   
   Esegue queste query su Supabase e verifica:
   
   a) Distribuzione categorie: nessuna > 30% del totale, 
      nessuna critica a 0 per Godot
   b) Distribuzione quality_score: non tutti uguali (LLM pigro)
   c) Distribuzione confidence_score: no clustering sospetto 
      (>50% con stesso valore)
   d) Copertura engine: almeno 4 engine con > 50 chunk ciascuno
   e) Copertura per Godot specificamente: 
      A01, A03, A04, B01, D01, D02, E01 tutti con ≥ 5 chunk
   f) game_parameters: almeno 3 engine con parametri, 
      player_physics ha almeno 10 entry
   
   Output: report testuale con PASS/FAIL per ogni check.
   Exit code 0 se tutto ok, exit code 1 se ci sono FAIL.

2. scripts/ingestion/07_test_queries.py — Test suite per getReferences():
   
   NOTA: questo script è in Python ma chiama direttamente le RPC functions 
   di Supabase (non passa per lib/knowledge.ts). Per testare il client TS 
   creeremo un test separato nella Fase 7.
   
   Definisci 20 test case, ciascuno con:
   - Nome test
   - Parametri query (engine, category, genres, features)
   - Criterio di successo (es: "almeno 1 risultato con A01 in category")
   
   Test case obbligatori:
   1. "Godot player controller" → category A01, engine godot → ≥ 3 risultati
   2. "Godot enemy AI" → category A04 → ≥ 3 risultati  
   3. "Godot boss fight" → features ["boss_phase"] → ≥ 1 risultato
   4. "Godot camera system" → category A05 → ≥ 1 risultato
   5. "Godot save system" → category C04 → ≥ 1 risultato
   6. "Godot UI menu" → category D01 → ≥ 2 risultati
   7. "Godot audio manager" → category D02 → ≥ 1 risultato
   8. "Godot level structure" → category B01 → ≥ 2 risultati
   9. "Phaser game scene" → engine phaser → ≥ 3 risultati
   10. "Ren'Py dialogue" → engine renpy, category C03 → ≥ 1 risultato
   11-15. Query con features specifiche (wall_jump, dash, coyote_time, etc)
   16-18. Query parametri (player_physics platformer, enemy_stats, combat_stats)
   19. Query semantica con embedding: "2D platformer movement with double jump"
   20. Query cross-genre: metroidvania features → deve trovare risultati
   
   Output: report con PASS/FAIL per ogni test. Conteggio finale.
   Exit code 0 se ≥ 16/20 PASS.
```

---

## PROMPT FASE 7 — Integration Test

```
Leggi CLAUDE.md e docs/SUPREME_RAG_BLUEPRINT.md (sezione §04.3).

Crea un test end-to-end che dimostra il boost della Knowledge Base.

1. Crea scripts/ingestion/08_comparison_test.ts (TypeScript):

   TASK: "Generate a player controller in GDScript for a Godot 4 metroidvania 
   platformer with: horizontal movement with acceleration/deceleration, 
   variable height jump with coyote time and input buffering, wall slide 
   and wall jump, dash with invincibility frames, state machine for all states"

   GENERATION A — SENZA KB:
   - Chiama DeepSeek V4 Pro via OpenRouter con SOLO il task come prompt
   - Salva in test_output/without_kb.gd

   GENERATION B — CON KB:
   - Importa getReferences e getReferenceParameters da lib/knowledge.ts
   - Query 1: full_recipe, engine=godot, category=A01_player_controller, 
     genres=["metroidvania", "platformer"], maxResults=2
   - Query 2: single_mechanic, features=["wall_jump", "dash", "coyote_time"], 
     maxResults=3
   - Query 3: getReferenceParameters engine=godot, genre=platformer, 
     parameterGroup=player_physics
   - Costruisci prompt arricchito con buildReferenceContext()
   - Chiama DeepSeek V4 Pro con prompt arricchito
   - Salva in test_output/with_kb.gd

   EVALUATION:
   - Chiama Claude Sonnet (via OpenRouter, model "anthropic/claude-sonnet-4-20250514")
   - Prompt: "Evaluate these two GDScript files on 5 criteria. 
     Score each 0 or 1. Respond JSON only.
     Criteria: 
     1. Has coyote time implementation (a timer that allows jumping briefly after leaving edge)
     2. Has input buffering (jump input registered slightly before landing)
     3. Has variable jump height (shorter jump on button release)
     4. Uses acceleration/deceleration curves (not instant velocity)
     5. Has realistic numerical values (gravity 600-1200, speed 80-200)
     
     FILE A (without KB):
     [code A]
     
     FILE B (with KB):
     [code B]
     
     Respond: {"file_a": {"coyote_time": 0|1, ...}, "file_b": {...}}"
   
   - Salva risultati in test_output/COMPARISON_REPORT.md con:
     - Tabella score A vs B
     - Codice di entrambi i file
     - Conclusione

2. Eseguibile con: npx ts-node scripts/ingestion/08_comparison_test.ts

Questo è il test che dimostra che 3 settimane di lavoro valgono.
Se File B batte File A su almeno 3/5 criteri, il Dataset Boost funziona.
```

---

## RIEPILOGO DEI PROMPT

| # | Prompt | Script/File creato | Fase |
|---|---|---|---|
| 0 | Setup Workspace | package.json, tsconfig, requirements, dirs, types.ts | 0 |
| 0B | Database Schema | supabase/migrations/001_knowledge_base.sql | 0 |
| 0C | Knowledge Client | lib/knowledge.ts | 0 |
| 1 | GitHub Scraper | scripts/ingestion/01_scrape.py | 1 |
| 2 | Quality Filter | scripts/ingestion/02_filter.py | 2 |
| 3A | Godot Parser | scripts/ingestion/03_parse_godot.py | 3 |
| 3B | Other Parsers | 03_parse_phaser.py, 03_parse_renpy.py, 03_parse_generic.py | 3 |
| 4 | LLM Classifier | scripts/ingestion/04_classify.py | 4 |
| 5 | Embedding & Storage | scripts/ingestion/05_embed_store.py | 5 |
| 6 | Validation & Test | 06_validate.py, 07_test_queries.py | 6 |
| 7 | Comparison Test | 08_comparison_test.ts | 7 |

**Tempo totale stimato**: 21 giorni  
**Costo totale stimato**: < $5 in API  
**Output**: Knowledge Base con ~5000 chunk di codice reale, classificati, vettorizzati, interrogabili in <50ms  

---

*Il piano è completo. Apri VS Code, lancia Claude Code, e incolla il Prompt Fase 0.*

*Ogni prompt si porta dietro il contesto di CLAUDE.md. Ogni fase ha una checklist. Nessun passo è ambiguo. Nessuna allucinazione è tollerata.*

*Costruisci il cervello prima del corpo.*
