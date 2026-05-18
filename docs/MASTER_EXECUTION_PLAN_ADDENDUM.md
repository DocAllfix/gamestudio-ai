# MASTER EXECUTION PLAN — ADDENDUM OPERATIVO v1.1
## Checklist con commit, RAG Defense integration, Project Status, Environment Init

**Data**: 18 maggio 2026  
**Integra**: MASTER_EXECUTION_PLAN.md v1.0  
**Correzione critica**: filtro data GitHub da 2025-01-01 → 2022-06-01 + config_version check  

---

# ═══════════════════════════════════════════════════════
# §00 — CORREZIONE FILTRO DATA GITHUB
# ═══════════════════════════════════════════════════════

## Il problema

Il filtro `pushed:>=2025-01-01` nel Blueprint originale esclude ~70% dei migliori 
progetti Godot 4 (rilasciato marzo 2023). Per gli altri engine il danno è anche peggiore.

## La correzione

```python
# PRIMA (troppo restrittivo)
PUSHED_FILTER = "2025-01-01"  # ❌ Esclude 2 anni di Godot 4

# DOPO (corretto)
PUSHED_FILTERS = {
    "godot":    "2022-06-01",  # Godot 4 beta stabile, include tutto Godot 4.x
    "phaser":   "2021-01-01",  # Phaser 3 maturo dal 2018, include 4+ anni
    "renpy":    "2021-01-01",  # Ren'Py stabile da anni
    "defold":   "2021-01-01",  # Defold stabile dal 2020
    "monogame": "2021-01-01",  # MonoGame/FNA stabile da anni
    "love2d":   "2021-01-01",  # LÖVE stabile da sempre
    "threejs":  "2022-01-01",  # Three.js r125+ con ES modules
    "stride":   "2021-01-01",  # Stride (ex Xenko) rinascita 2020+
}
```

La protezione contro Godot 3 NON è il filtro data. È il check strutturale:

```python
# Nel quality filter (02_filter.py), check A per Godot:
def is_godot_4(project_godot_path: str) -> bool:
    content = open(project_godot_path).read()
    # Godot 4.x → config_version=5
    # Godot 3.x → config_version=4
    return "config_version=5" in content
```

Questo è infallibile: non esiste un progetto Godot 3 con `config_version=5` né un Godot 4 con `config_version=4`.

**Questa correzione deve essere applicata in 01_scrape.py e 02_filter.py.**

---

# ═══════════════════════════════════════════════════════
# §01 — RAG DEFENSE MECHANISM: INTEGRAZIONE NELL'AMBIENTE
# Come l'agente lo segue automaticamente
# ═══════════════════════════════════════════════════════

## Il problema

Il RAG Defense Mechanism (JSON Schema vincolato, 2-step classification, confidence gate) 
è descritto nel MASTER_EXECUTION_PLAN.md ma non è "eseguibile" dall'agente se resta solo 
prosa in un documento. Deve diventare **codice condiviso** che ogni script importa e usa.

## La soluzione: modulo Python `shared/`

Creiamo un modulo condiviso che contiene la tassonomia, lo schema JSON, le costanti 
e le funzioni di validazione. Ogni script di ingestion lo importa. L'agente non può 
"dimenticare" le regole perché sono codice, non commenti.

### Struttura

```
scripts/
├── shared/
│   ├── __init__.py
│   ├── taxonomy.py          ← Tutte le costanti della tassonomia (domini, categorie, enum)
│   ├── classification_schema.py  ← Il JSON Schema completo come dict Python
│   ├── confidence_gate.py   ← Funzione che smista accept/quarantine/reject
│   ├── heuristics.py        ← Regole heuristic per ogni engine
│   └── validators.py        ← Funzioni di validazione post-classificazione
└── ingestion/
    ├── 01_scrape.py          ← importa da shared.taxonomy (PUSHED_FILTERS)
    ├── 02_filter.py          ← importa da shared.taxonomy (STRUCTURE_CHECKS)
    ├── 03_parse_godot.py     ← importa da shared.heuristics
    ├── 04_classify.py        ← importa da shared.classification_schema, shared.confidence_gate
    ├── 05_embed_store.py     ← importa da shared.confidence_gate (per filtrare)
    └── ...
```

### `scripts/shared/taxonomy.py` — Le costanti

```python
"""
Tassonomia del Dataset — Game Studio AI
Fonte di verità unica per domini, categorie, generi, feature.
Ogni script importa da qui. Mai hardcodare questi valori altrove.
"""

DOMAINS = [
    "A_core_gameplay",
    "B_world_level",
    "C_meta_game",
    "D_presentation",
    "E_architecture",
    "X_uncertain",
]

PRIMARY_CATEGORIES = [
    "A01_player_controller", "A02_state_machine", "A03_combat",
    "A04_enemy_ai", "A05_camera",
    "B01_level_structure", "B02_procedural_gen", "B03_physics_collision", "B04_navigation",
    "C01_progression", "C02_inventory", "C03_dialogue_narrative", "C04_save_load",
    "D01_ui", "D02_audio", "D03_vfx",
    "E01_project_structure", "E02_signals_events", "E03_game_flow", "E04_genre_specific",
    "X00_uncertain", "X01_utility", "X02_trash",
]

GENRE_TAGS = [
    "platformer", "metroidvania", "roguelike", "rpg", "jrpg",
    "visual_novel", "puzzle", "card_game", "horror", "arcade",
    "sim", "tower_defense", "racing", "rhythm", "stealth",
    "bullet_hell", "fighting", "survival", "sandbox", "generic",
]

KEY_FEATURES = [
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
    "post_processing", "squash_stretch", "none",
]

DESIGN_PATTERNS = [
    "state_machine", "observer", "singleton", "component",
    "strategy", "command", "factory", "object_pool",
    "behavior_tree", "pub_sub", "mediator", "decorator", "none",
]

COMPLEXITY_LEVELS = ["basic", "intermediate", "advanced"]

ENGINES = ["godot", "phaser", "renpy", "defold", "monogame", "love2d", "threejs", "stride"]

PUSHED_FILTERS = {
    "godot":    "2022-06-01",
    "phaser":   "2021-01-01",
    "renpy":    "2021-01-01",
    "defold":   "2021-01-01",
    "monogame": "2021-01-01",
    "love2d":   "2021-01-01",
    "threejs":  "2022-01-01",
    "stride":   "2021-01-01",
}

ALLOWED_LICENSES = [
    "MIT", "CC0-1.0", "Apache-2.0", "BSD-2-Clause",
    "BSD-3-Clause", "Unlicense", "ISC", "Zlib",
]

# Mapping category → parameter_group per game_parameters
CATEGORY_TO_PARAM_GROUP = {
    "A01_player_controller": "player_physics",
    "A02_state_machine": "player_physics",
    "A03_combat": "combat_stats",
    "A04_enemy_ai": "enemy_stats",
    "A05_camera": "camera_settings",
    "C01_progression": "progression_economy",
    "D02_audio": "audio_config",
}
```

### `scripts/shared/classification_schema.py` — Lo schema vincolante

```python
"""
JSON Schema per la classificazione LLM.
Importato da 04_classify.py. Usato come response_format constraint.
"""
from .taxonomy import (
    DOMAINS, PRIMARY_CATEGORIES, GENRE_TAGS,
    KEY_FEATURES, DESIGN_PATTERNS, COMPLEXITY_LEVELS,
)

CLASSIFICATION_SCHEMA = {
    "type": "object",
    "required": [
        "domain", "primary_category", "subcategories",
        "genre_tags", "complexity", "design_patterns", "key_features",
        "quality_score", "reusability_score", "confidence_score",
        "one_line_summary", "extracted_parameters", "rejection_reason"
    ],
    "properties": {
        "domain": {"type": "string", "enum": DOMAINS},
        "primary_category": {"type": "string", "enum": PRIMARY_CATEGORIES},
        "subcategories": {
            "type": "array",
            "items": {"type": "string", "pattern": r"^[A-E][0-9]{2}\.[0-9]{2}$"},
            "maxItems": 8
        },
        "genre_tags": {
            "type": "array",
            "items": {"type": "string", "enum": GENRE_TAGS}
        },
        "complexity": {"type": "string", "enum": COMPLEXITY_LEVELS},
        "design_patterns": {
            "type": "array",
            "items": {"type": "string", "enum": DESIGN_PATTERNS}
        },
        "key_features": {
            "type": "array",
            "items": {"type": "string", "enum": KEY_FEATURES}
        },
        "quality_score": {"type": "integer", "minimum": 1, "maximum": 5},
        "reusability_score": {"type": "integer", "minimum": 1, "maximum": 5},
        "confidence_score": {"type": "integer", "minimum": 0, "maximum": 100},
        "one_line_summary": {"type": "string", "maxLength": 120},
        "extracted_parameters": {"type": "object"},
        "rejection_reason": {"type": ["string", "null"]}
    },
    "additionalProperties": False
}
```

### `scripts/shared/confidence_gate.py` — Il filtro automatico

```python
"""
Confidence Gate: smista chunk in accept / quarantine / reject.
Importato da 04_classify.py e 05_embed_store.py.
"""

def gate_classification(classification: dict) -> str:
    """
    Ritorna: "accepted" | "quarantined" | "rejected"
    """
    # Reject immediati (nessuna negoziazione)
    if classification.get("primary_category") == "X02_trash":
        return "rejected"
    if classification.get("rejection_reason") is not None:
        return "rejected"
    
    confidence = classification.get("confidence_score", 0)
    
    if confidence >= 85:
        return "accepted"
    elif confidence >= 60:
        return "quarantined"
    else:
        return "rejected"
```

## Come l'agente lo usa

Quando Claude Code sviluppa `04_classify.py`, il CLAUDE.md dice:

> "Anti-Hallucination Protocol: ALWAYS use structured output with enum constraints"

E il prompt per la Fase 4 dice esplicitamente:

> "Importa CLASSIFICATION_SCHEMA da scripts/shared/classification_schema.py"

L'agente non può "inventare" enum diversi perché lo schema è definito una volta sola 
in `taxonomy.py` e importato ovunque. Se l'agente volesse aggiungere una categoria, 
dovrebbe modificare `taxonomy.py` — e il CLAUDE.md dice "no dead code, no modifications 
without explicit instruction".

---

# ═══════════════════════════════════════════════════════
# §02 — PROJECT_STATUS.md
# Il file che l'agente spunta man mano
# ═══════════════════════════════════════════════════════

Questo file va nella root del progetto. L'agente aggiorna i checkbox dopo ogni 
sottofase completata. Tu puoi vedere lo stato del progetto in qualsiasi momento.

---

```markdown
# PROJECT STATUS — Game Studio AI: Dataset Boost
## Fase Pre-Alpha: Knowledge Base Construction

Ultimo aggiornamento: [DATA]

---

## FASE 0 — ENVIRONMENT SETUP

### 0.1 — Git & Repository
- [ ] Repository Git inizializzato (`git init`)
- [ ] Remote origin configurato (GitHub/GitLab)
- [ ] Branch `main` protetto, lavoro su `develop`
- [ ] `.gitignore` creato e verificato
- [ ] Primo commit: `feat(phase-0): initialize repository`

### 0.2 — Project Configuration
- [ ] `package.json` creato con dipendenze TS
- [ ] `tsconfig.json` creato con strict mode
- [ ] `requirements.txt` creato con dipendenze Python
- [ ] `npm install` completato senza errori
- [ ] `pip install -r requirements.txt` completato senza errori
- [ ] Commit: `feat(phase-0): add project configuration`

### 0.3 — Directory Structure
- [ ] `docs/` creata con documenti fondativi copiati dentro
- [ ] `scripts/ingestion/` creata
- [ ] `scripts/shared/` creata con `__init__.py`
- [ ] `lib/` creata
- [ ] `supabase/migrations/` creata
- [ ] `data/` creata con sottocartelle (repos_raw, repos_clean, chunks_raw, chunks_classified)
- [ ] `test_output/` creata
- [ ] Commit: `feat(phase-0): create directory structure`

### 0.4 — Workspace Governance Files
- [ ] `CLAUDE.md` nella root
- [ ] `PROJECT_STATUS.md` nella root (questo file)
- [ ] `.env.example` con tutte le chiavi vuote
- [ ] `.env` locale con chiavi reali (NON committato)
- [ ] Commit: `feat(phase-0): add workspace governance files`

### 0.5 — Shared Module
- [ ] `scripts/shared/taxonomy.py` con tutte le costanti
- [ ] `scripts/shared/classification_schema.py` con JSON Schema
- [ ] `scripts/shared/confidence_gate.py` con funzione gate
- [ ] `scripts/shared/heuristics.py` (placeholder, completato in Fase 3)
- [ ] `scripts/shared/validators.py` (placeholder, completato in Fase 6)
- [ ] Test: `python -c "from scripts.shared.taxonomy import ENGINES; print(ENGINES)"` funziona
- [ ] Commit: `feat(phase-0): add shared taxonomy and classification modules`

### 0.6 — Database Schema
- [ ] `supabase/migrations/001_knowledge_base.sql` creato
- [ ] Contiene: CREATE EXTENSION vector
- [ ] Contiene: tabella code_knowledge con embedding vector(1536)
- [ ] Contiene: tabella code_knowledge_quarantine (schema identico)
- [ ] Contiene: tabella game_parameters
- [ ] Contiene: tabella ingestion_log
- [ ] Contiene: indici HNSW, GIN, B-tree
- [ ] Contiene: RPC function search_code_knowledge
- [ ] Contiene: RPC function get_reference_parameters
- [ ] Contiene: RPC function increment_retrieval_count
- [ ] SQL applicato su Supabase (via Dashboard o CLI)
- [ ] Verifica: `SELECT COUNT(*) FROM code_knowledge` ritorna 0 senza errori
- [ ] Commit: `feat(phase-0): add Supabase pgvector schema`

### 0.7 — TypeScript Knowledge Client
- [ ] `lib/types.ts` con CodeReference, ParameterReference, ReferenceQuery, ParameterQuery
- [ ] `lib/knowledge.ts` con getReferences(), getReferenceParameters(), buildReferenceContext()
- [ ] Compila senza errori: `npx tsc --noEmit`
- [ ] Commit: `feat(phase-0): add knowledge base TypeScript client`

### FASE 0 GATE — Tutte le checkbox sopra sono spuntate?
- [ ] **FASE 0 COMPLETATA** → Procedi a Fase 1

---

## FASE 1 — GITHUB SCRAPER

### 1.1 — Script Scraper
- [ ] `scripts/ingestion/01_scrape.py` creato
- [ ] Usa PUSHED_FILTERS da shared/taxonomy.py (NON 2025-01-01)
- [ ] Query per tutti gli 8 engine (almeno 8 query ciascuno)
- [ ] Supporta awesome list scraping
- [ ] Supporta repo ufficiali hardcoded
- [ ] Rate limiting implementato (sleep tra richieste)
- [ ] Flag --dry-run funziona
- [ ] Flag --engine funziona
- [ ] Commit: `feat(phase-1): add GitHub scraper`

### 1.2 — Esecuzione Scraping
- [ ] Dry run completato: `python scripts/ingestion/01_scrape.py --dry-run`
- [ ] Scraping completo eseguito
- [ ] `data/manifest.json` creato con almeno 300 entry
- [ ] `data/repos_raw/` ha sottocartelle per almeno 6 engine
- [ ] `data/repos_raw/godot/` ha almeno 80 repo
- [ ] `data/repos_raw/phaser/` ha almeno 40 repo
- [ ] `scrape_log.txt` mostra 0 errori fatali
- [ ] Commit: `feat(phase-1): complete GitHub scraping`

### FASE 1 GATE
- [ ] **FASE 1 COMPLETATA** → Procedi a Fase 2

---

## FASE 2 — QUALITY FILTER

### 2.1 — Script Filter
- [ ] `scripts/ingestion/02_filter.py` creato
- [ ] Check Godot 4: verifica `config_version=5` (NON filtro data)
- [ ] Check struttura minima per ogni engine
- [ ] Check LOC range (300-30000)
- [ ] Check commenti (≥ 3%)
- [ ] Check plugin count (Godot, max 5)
- [ ] Check licenza (whitelist)
- [ ] Scoring 1-5 implementato
- [ ] Flag --dry-run, --engine, --verbose funzionano
- [ ] Commit: `feat(phase-2): add quality filter`

### 2.2 — Esecuzione Filter
- [ ] Filter eseguito su tutti i repo
- [ ] `data/quality_report.json` creato
- [ ] `data/repos_clean/` popolato
- [ ] `data/repos_clean/godot/` ha almeno 30 repo
- [ ] Nessun repo Godot 3 in repos_clean/ (verifica config_version)
- [ ] Rapporto scartati/totali tra 30% e 65%
- [ ] Commit: `feat(phase-2): complete quality filtering`

### FASE 2 GATE
- [ ] **FASE 2 COMPLETATA** → Procedi a Fase 3

---

## FASE 3 — ENGINE-SPECIFIC PARSERS

### 3.1 — Godot Parser
- [ ] `scripts/ingestion/03_parse_godot.py` creato
- [ ] Classe GodotParser con metodi: parse_project_godot, parse_tscn, parse_gdscript, heuristic_classify, chunk_project
- [ ] Parsing .tscn funziona (nodi, connections, ext_resources estratti)
- [ ] Parsing .gd funziona (extends, functions, signals, exports estratti)
- [ ] Heuristic classification implementata (10 regole)
- [ ] Raggruppamento file correlati funziona
- [ ] Flag --repo e --verbose funzionano
- [ ] Test su 3 repo campione: output coerente
- [ ] Commit: `feat(phase-3): add Godot parser`

### 3.2 — Godot Parsing Execution
- [ ] Parser eseguito su tutti i repo Godot
- [ ] `data/chunks_raw/godot/` popolato
- [ ] Almeno 30 chunk con heuristic A01_player_controller
- [ ] Almeno 20 chunk con heuristic A04_enemy_ai
- [ ] Almeno 200 chunk totali con confidence "high"
- [ ] Nessun chunk con code vuoto
- [ ] Commit: `feat(phase-3): complete Godot parsing`

### 3.3 — Phaser Parser
- [ ] `scripts/ingestion/03_parse_phaser.py` creato
- [ ] Classe PhaserParser funzionante
- [ ] Parser eseguito su tutti i repo Phaser
- [ ] `data/chunks_raw/phaser/` ha almeno 80 chunk
- [ ] Commit: `feat(phase-3): add and run Phaser parser`

### 3.4 — Ren'Py Parser
- [ ] `scripts/ingestion/03_parse_renpy.py` creato
- [ ] Classe RenPyParser funzionante
- [ ] Parser eseguito
- [ ] `data/chunks_raw/renpy/` ha almeno 40 chunk
- [ ] Commit: `feat(phase-3): add and run RenPy parser`

### 3.5 — Generic Parser (Defold, MonoGame, LÖVE, Three.js, Stride)
- [ ] `scripts/ingestion/03_parse_generic.py` creato
- [ ] Sotto-metodi per ogni engine
- [ ] Parser eseguito su tutti gli engine rimanenti
- [ ] Chunk totali tra 4000 e 8000 (tutti gli engine sommati)
- [ ] Commit: `feat(phase-3): add and run generic parsers`

### 3.6 — Statistiche Parsing
- [ ] Report chunk per engine generato
- [ ] Report chunk per heuristic_category generato
- [ ] Nessun engine con 0 chunk
- [ ] Commit: `feat(phase-3): parsing statistics report`

### FASE 3 GATE
- [ ] **FASE 3 COMPLETATA** → Procedi a Fase 4

---

## FASE 4 — LLM CLASSIFIER (BLINDATO)

### 4.1 — Script Classifier
- [ ] `scripts/ingestion/04_classify.py` creato
- [ ] Importa CLASSIFICATION_SCHEMA da shared/
- [ ] Importa gate_classification da shared/
- [ ] 2-step classification implementata (domain triage + fine LLM)
- [ ] Structured output attivato (json_schema o json_object + validation)
- [ ] Retry logic con exponential backoff
- [ ] Confidence gate: accept/quarantine/reject
- [ ] Progress bar + cost tracking
- [ ] Flag --engine, --sample, --dry-run, --verbose
- [ ] Commit: `feat(phase-4): add LLM classifier with anti-hallucination`

### 4.2 — Test Classificazione (sample)
- [ ] Test su 20 chunk campione: `--engine godot --sample 20 --verbose`
- [ ] JSON output è sempre valido (zero errori di parsing)
- [ ] Nessuna category fuori dall'enum
- [ ] Nessun genre fuori dall'enum
- [ ] Confidence scores distribuiti (non tutti uguali)
- [ ] Commit: `feat(phase-4): verify classifier on sample`

### 4.3 — Classificazione Completa
- [ ] Classificazione eseguita su TUTTI i chunk
- [ ] `data/chunks_classified/` popolato per ogni engine
- [ ] Distribuzione: almeno 75% chunk con confidence ≥ 85
- [ ] Distribuzione: X02_trash < 10%
- [ ] Distribuzione: X00_uncertain < 15%
- [ ] Per Godot: A01, A03, A04, B01, D01, D02, E01 hanno ≥ 5 chunk ciascuno
- [ ] Costo totale LLM < $5
- [ ] Commit: `feat(phase-4): complete LLM classification`

### FASE 4 GATE
- [ ] **FASE 4 COMPLETATA** → Procedi a Fase 5

---

## FASE 5 — EMBEDDING & STORAGE

### 5.1 — Script Embed & Store
- [ ] `scripts/ingestion/05_embed_store.py` creato
- [ ] Filtra solo classification_status = "accepted"
- [ ] Costruisce searchable_text (summary + metadati, non codice)
- [ ] Batch embedding (100 per chiamata)
- [ ] Batch insert Supabase (50 per insert)
- [ ] Quarantine → tabella separata
- [ ] game_parameters inseriti
- [ ] Idempotenza (check duplicati prima di insert)
- [ ] Flag --engine, --dry-run, --skip-quarantine
- [ ] Commit: `feat(phase-5): add embedding and storage script`

### 5.2 — Esecuzione Storage
- [ ] Script eseguito su tutti i chunk classificati
- [ ] `SELECT COUNT(*) FROM code_knowledge` > 3000
- [ ] `SELECT COUNT(*) FROM code_knowledge_quarantine` > 0
- [ ] `SELECT COUNT(*) FROM game_parameters` > 200
- [ ] `SELECT DISTINCT engine FROM code_knowledge` ritorna ≥ 4
- [ ] `SELECT COUNT(*) FROM code_knowledge WHERE embedding IS NULL` = 0
- [ ] Costo embedding < $0.10
- [ ] Commit: `feat(phase-5): complete embedding and storage`

### FASE 5 GATE
- [ ] **FASE 5 COMPLETATA** → Procedi a Fase 6

---

## FASE 6 — VALIDATION & TEST

### 6.1 — Validation Script
- [ ] `scripts/ingestion/06_validate.py` creato
- [ ] Distribuzione categorie verificata (nessuna > 30%, nessuna critica a 0)
- [ ] Distribuzione quality_score verificata (non tutti uguali)
- [ ] Distribuzione confidence_score verificata (no clustering)
- [ ] Copertura engine verificata (≥ 4 con > 50 chunk)
- [ ] Exit code 0 (tutti i check passati)
- [ ] Commit: `feat(phase-6): add validation script`

### 6.2 — Test Queries
- [ ] `scripts/ingestion/07_test_queries.py` creato
- [ ] 20 test case definiti
- [ ] Almeno 16/20 PASS
- [ ] Query semantica con embedding funziona
- [ ] Query parametri funziona
- [ ] Commit: `feat(phase-6): add and pass test queries`

### 6.3 — Quarantine Review
- [ ] Top 100 chunk in quarantine revisionati
- [ ] Chunk buoni promossi a code_knowledge
- [ ] Chunk cattivi eliminati
- [ ] Commit: `feat(phase-6): complete quarantine review`

### FASE 6 GATE
- [ ] **FASE 6 COMPLETATA** → Procedi a Fase 7

---

## FASE 7 — INTEGRATION & COMPARISON TEST

### 7.1 — TypeScript Integration
- [ ] `lib/knowledge.ts` testato end-to-end con Supabase reale
- [ ] getReferences() ritorna risultati per query Godot
- [ ] getReferenceParameters() ritorna risultati per player_physics
- [ ] buildReferenceContext() produce testo formattato
- [ ] Commit: `feat(phase-7): verify TypeScript KB client`

### 7.2 — Comparison Test
- [ ] `scripts/ingestion/08_comparison_test.ts` creato
- [ ] Generazione SENZA KB completata → test_output/without_kb.gd
- [ ] Generazione CON KB completata → test_output/with_kb.gd
- [ ] Valutazione Claude Sonnet completata
- [ ] File B (con KB) batte File A su almeno 3/5 criteri
- [ ] `test_output/COMPARISON_REPORT.md` generato
- [ ] Commit: `feat(phase-7): Dataset Boost validated`

### 7.3 — Final Documentation
- [ ] PROJECT_STATUS.md aggiornato con tutte le spunte
- [ ] Tutti i conteggi finali documentati
- [ ] Commit: `feat(phase-7): Knowledge Base construction complete`

### FASE 7 GATE
- [ ] **FASE 7 COMPLETATA** → ✅ KNOWLEDGE BASE PRONTA PER FASE 2 (PRODOTTO)

---

## CONTATORI FINALI (compilare a fine progetto)

| Metrica | Valore |
|---|---|
| Repo scaricati (Fase 1) | ___ |
| Repo dopo quality filter (Fase 2) | ___ |
| Chunk raw totali (Fase 3) | ___ |
| Chunk accepted (Fase 4) | ___ |
| Chunk quarantined (Fase 4) | ___ |
| Chunk rejected (Fase 4) | ___ |
| Righe in code_knowledge (Fase 5) | ___ |
| Righe in game_parameters (Fase 5) | ___ |
| Test queries PASS/20 (Fase 6) | ___ |
| Comparison score without KB (Fase 7) | ___/5 |
| Comparison score with KB (Fase 7) | ___/5 |
| Costo totale API | $___ |
| Tempo totale di sviluppo | ___ giorni |
```

---

# ═══════════════════════════════════════════════════════
# §03 — PROMPT CON CHECKLIST E COMMIT INTEGRATI
# Ogni prompt include verifica e commit alla fine
# ═══════════════════════════════════════════════════════

## PROMPT FASE 0A — Inizializzazione Ambiente

Questo è il primissimo prompt da dare a Claude Code. Crea tutto da zero.

```
Leggi CLAUDE.md.

Stiamo inizializzando il workspace per Game Studio AI — Fase Pre-Alpha 
(Knowledge Base Construction). Esegui tutti questi step in ordine:

STEP 1 — GIT:
  git init
  Crea .gitignore con: .env, data/, node_modules/, __pycache__, *.pyc,
  .DS_Store, test_output/, *.egg-info/

STEP 2 — STRUTTURA DIRECTORY:
  Crea queste cartelle (con .gitkeep dove vuote):
  docs/
  scripts/ingestion/
  scripts/shared/
  lib/
  supabase/migrations/
  data/repos_raw/
  data/repos_clean/
  data/chunks_raw/
  data/chunks_classified/
  test_output/

STEP 3 — CONFIGURAZIONE PROGETTO:
  Crea package.json:
    name: "game-studio-ai"
    private: true
    scripts: { "typecheck": "tsc --noEmit" }
    dependencies: @supabase/supabase-js, openai
    devDependencies: typescript, ts-node, @types/node

  Crea tsconfig.json:
    strict: true, target: ES2022, module: ES2022,
    moduleResolution: node, esModuleInterop: true,
    outDir: dist/, rootDir: ., skipLibCheck: true

  Crea requirements.txt:
    requests>=2.31
    python-dotenv>=1.0
    supabase>=2.0
    openai>=1.30
    tqdm>=4.66
    jsonschema>=4.20

STEP 4 — ENV:
  Crea .env.example con:
    GITHUB_TOKEN=
    NEXT_PUBLIC_SUPABASE_URL=
    SUPABASE_SERVICE_ROLE_KEY=
    OPENROUTER_API_KEY=
    OPENAI_API_KEY=
    DEEPSEEK_API_KEY=

STEP 5 — INSTALLA DIPENDENZE:
  npm install
  (Non fare pip install, lo faccio io con il mio Python)

STEP 6 — VERIFICA:
  Conferma che tutte le cartelle esistono.
  Conferma che npm install è andato senza errori.
  Conferma che .gitignore contiene data/ e .env.

STEP 7 — COMMIT:
  git add -A
  git commit -m "feat(phase-0): initialize workspace and project structure"

Alla fine, aggiorna PROJECT_STATUS.md spuntando le checkbox 0.1, 0.2, 0.3 
relative ai task completati.
```

---

## PROMPT FASE 0B — Documenti Fondativi e Governance

```
Leggi CLAUDE.md.

STEP 1 — Copia i documenti fondativi nella cartella docs/:
  (Nota: i contenuti di questi file li fornirò io manualmente copiandoli.
   Tu crea i file vuoti con un commento placeholder per ora:)
  docs/pietra_v4.md           → "# Pietra Fondativa v4 — [da copiare]"
  docs/SUPREME_RAG_BLUEPRINT.md → "# Supreme RAG Blueprint — [da copiare]"
  docs/MASTER_EXECUTION_PLAN.md → "# Master Execution Plan — [da copiare]"

STEP 2 — Crea PROJECT_STATUS.md nella root con il contenuto completo
  del Project Status che trovi in docs/MASTER_EXECUTION_PLAN.md
  nella sezione "§02 — PROJECT_STATUS.md".
  (Se non lo trovi nel contesto, crealo con la struttura: 
   Fase 0 a Fase 7, ogni fase con sottofasi e checkbox vuote [ ].
   Ogni sottofase ha un task + un commit message.)

STEP 3 — Verifica che CLAUDE.md esista nella root (creato precedentemente).

STEP 4 — COMMIT:
  git add -A
  git commit -m "feat(phase-0): add governance files and project status"

Aggiorna PROJECT_STATUS.md: spunta 0.4.
```

---

## PROMPT FASE 0C — Shared Module (RAG Defense)

```
Leggi CLAUDE.md e docs/MASTER_EXECUTION_PLAN.md (sezione §01 RAG Defense Mechanism).

Crea il modulo shared che contiene la tassonomia e il sistema anti-allucinazione.
Ogni script di ingestion importerà da qui. Questo è il "sistema immunitario" del RAG.

STEP 1 — scripts/shared/__init__.py:
  File vuoto (marca la cartella come modulo Python).

STEP 2 — scripts/shared/taxonomy.py:
  Tutte le costanti della tassonomia come nel MASTER_EXECUTION_PLAN:
  DOMAINS, PRIMARY_CATEGORIES, GENRE_TAGS, KEY_FEATURES, DESIGN_PATTERNS,
  COMPLEXITY_LEVELS, ENGINES, PUSHED_FILTERS (con date corrette, NON 2025-01-01),
  ALLOWED_LICENSES, CATEGORY_TO_PARAM_GROUP.
  
  ATTENZIONE al PUSHED_FILTERS:
  - godot: "2022-06-01" (include tutto Godot 4.x)
  - tutti gli altri: "2021-01-01"
  NON usare 2025-01-01 — è troppo restrittivo.

STEP 3 — scripts/shared/classification_schema.py:
  Il JSON Schema completo per la classificazione LLM.
  Importa tutti gli enum da taxonomy.py (non duplicare le liste).
  Lo schema deve avere "additionalProperties": False.

STEP 4 — scripts/shared/confidence_gate.py:
  Funzione gate_classification(classification: dict) -> str
  Ritorna "accepted" | "quarantined" | "rejected"
  Logica: confidence >= 85 → accepted, 60-84 → quarantined, < 60 → rejected
  X02_trash → always rejected, rejection_reason != null → always rejected

STEP 5 — scripts/shared/heuristics.py:
  Dizionario DOMAIN_HEURISTICS con keyword per dominio (dal MASTER_EXECUTION_PLAN §01.3).
  Funzione heuristic_domain_triage(code: str, engine: str) -> tuple[str, str]
  che ritorna (domain, confidence_level).
  Per ora implementa solo le keyword-based rules. Sarà esteso in Fase 3.

STEP 6 — scripts/shared/validators.py:
  Placeholder con funzione validate_chunk(chunk: dict) -> bool
  che per ora ritorna True. Sarà implementata in Fase 6.

STEP 7 — VERIFICA:
  Esegui: python -c "from scripts.shared.taxonomy import ENGINES, PUSHED_FILTERS; print(ENGINES); print(PUSHED_FILTERS)"
  Deve stampare la lista engine e i filtri data CORRETTI.
  Esegui: python -c "from scripts.shared.classification_schema import CLASSIFICATION_SCHEMA; print(list(CLASSIFICATION_SCHEMA['properties'].keys()))"
  Deve stampare i 12 campi dello schema.

STEP 8 — COMMIT:
  git add -A
  git commit -m "feat(phase-0): add shared taxonomy and RAG defense modules"

Aggiorna PROJECT_STATUS.md: spunta 0.5 e tutte le sotto-checkbox.
```

---

## PROMPT FASE 0D — Database Schema Supabase

```
Leggi CLAUDE.md e docs/SUPREME_RAG_BLUEPRINT.md (sezione §03).
Leggi docs/MASTER_EXECUTION_PLAN.md (sezione §01 per la tabella quarantine).

Crea supabase/migrations/001_knowledge_base.sql.

Il file deve contenere, in quest'ordine:

1. CREATE EXTENSION IF NOT EXISTS vector;

2. Tabella code_knowledge con:
   - id uuid PK default gen_random_uuid()
   - engine text NOT NULL
   - language text NOT NULL
   - primary_category text NOT NULL
   - subcategories text[] NOT NULL DEFAULT '{}'
   - chunk_type text NOT NULL (full_recipe | single_mechanic | structural_pattern)
   - genre_tags text[] NOT NULL DEFAULT '{}'
   - complexity text NOT NULL DEFAULT 'intermediate'
   - design_patterns text[] NOT NULL DEFAULT '{}'
   - key_features text[] NOT NULL DEFAULT '{}'
   - quality_score smallint NOT NULL CHECK (1-5)
   - reusability_score smallint NOT NULL CHECK (1-5)
   - confidence_score smallint NOT NULL DEFAULT 85 CHECK (0-100)
   - summary text NOT NULL
   - code text NOT NULL
   - loc int NOT NULL DEFAULT 0
   - source_repo text
   - source_license text
   - source_file_paths text[] NOT NULL DEFAULT '{}'
   - scene_context text
   - embedding vector(1536)
   - times_retrieved int NOT NULL DEFAULT 0
   - positive_feedback int NOT NULL DEFAULT 0
   - negative_feedback int NOT NULL DEFAULT 0
   - created_at timestamptz NOT NULL DEFAULT now()
   - updated_at timestamptz NOT NULL DEFAULT now()

3. Tabella code_knowledge_quarantine — ESATTAMENTE stesso schema di code_knowledge.

4. Tabella game_parameters (dal Blueprint).

5. Tabella ingestion_log con classification_status text.

6. Indici:
   - B-tree: engine, primary_category, chunk_type, complexity, quality_score DESC, 
     confidence_score DESC
   - GIN: genre_tags, key_features, subcategories, design_patterns
   - HNSW: embedding vector_cosine_ops (m=16, ef_construction=64)
   - Stessi indici (tranne HNSW) su quarantine
   - B-tree su game_parameters (engine+genre, parameter_group)
   - B-tree su ingestion_log (status, engine)

7. RPC search_code_knowledge con parametro p_min_confidence int default 85
   (dal Blueprint, ma con confidence filter aggiuntivo).

8. RPC get_reference_parameters (dal Blueprint).

9. RPC increment_retrieval_count(p_ids uuid[]) che fa:
   UPDATE code_knowledge SET times_retrieved = times_retrieved + 1 WHERE id = ANY(p_ids)

10. RLS: enable su tutte, policy SELECT su code_knowledge e game_parameters.

DOPO aver scritto il file, dimmi il comando per applicarlo.
Se Supabase CLI non è configurato, il comando è:
"Incolla il contenuto nel SQL Editor del Supabase Dashboard ed esegui."

COMMIT:
  git add -A
  git commit -m "feat(phase-0): add Supabase pgvector schema with quarantine table"

Aggiorna PROJECT_STATUS.md: spunta 0.6 e tutte le sotto-checkbox.
```

---

## PROMPT FASE 0E — TypeScript Knowledge Client

```
Leggi CLAUDE.md e docs/SUPREME_RAG_BLUEPRINT.md (sezione §04.2).

Crea i file TypeScript per il client della Knowledge Base.

STEP 1 — lib/types.ts:
  Esporta le seguenti interfacce:
  
  CodeReference: id, engine, primary_category, subcategories, chunk_type,
    genre_tags, key_features, complexity, quality_score, reusability_score,
    confidence_score, summary, code, source_repo, source_license, similarity
  
  ParameterReference: id, source_repo, parameters (Record<string, unknown>),
    context, quality_score
  
  ReferenceQuery: engine (required), category?, genres?, features?,
    complexity?, chunkType?, minQuality?, minConfidence?, semanticQuery?,
    maxResults?
  
  ParameterQuery: engine, genre, parameterGroup, minQuality?, maxResults?

STEP 2 — lib/knowledge.ts:
  Implementa come da Blueprint §04.2:
  - getReferences(query): genera embedding se semanticQuery presente,
    chiama supabase.rpc, fire-and-forget increment_retrieval_count
  - getReferenceParameters(query): chiama supabase.rpc
  - buildReferenceContext(codeRefs, paramRefs): formatta per prompt
  
  REGOLE:
  - Zero any types
  - Ogni errore loggato con console.error({context, error})
  - Return [] su errore, mai throw
  - Env vars lette con process.env

STEP 3 — VERIFICA:
  npx tsc --noEmit
  Deve compilare senza errori.

STEP 4 — COMMIT:
  git add -A
  git commit -m "feat(phase-0): add TypeScript knowledge base client"

Aggiorna PROJECT_STATUS.md: spunta 0.7 e tutte le sotto-checkbox.
Poi spunta il FASE 0 GATE.
```

---

## PROMPT FASE 1 — GitHub Scraper

```
Leggi CLAUDE.md e docs/SUPREME_RAG_BLUEPRINT.md (sezione §02.2).
Leggi docs/MASTER_EXECUTION_PLAN.md (Fase 1 e la correzione filtro data in §00).

Crea scripts/ingestion/01_scrape.py.

IMPORTA da scripts.shared.taxonomy: ENGINES, PUSHED_FILTERS, ALLOWED_LICENSES

SPECIFICHE:

1. SEARCH_QUERIES: dizionario con almeno 10 query per ognuno degli 8 engine.
   Combina engine + genere: "godot 4 platformer", "godot 4 metroidvania",
   "godot roguelike", "godot rpg top-down", "godot horror", ecc.
   Per Phaser: "phaser 3 game", "phaser platformer", "phaser puzzle html5", ecc.
   (Vai specifico — "godot 4 game" da solo porta troppo rumore)

2. GITHUB API:
   URL: https://api.github.com/search/repositories
   Headers: Authorization: token {GITHUB_TOKEN}, Accept: application/vnd.github.v3+json
   Query params: q={query}+stars:>=20+pushed:>={PUSHED_FILTERS[engine]}&sort=stars&per_page=30
   NON mettere il filtro language nella query (troppi falsi negativi).
   Controlla il linguaggio dal campo "language" nella response.

3. AWESOME LISTS: fetch raw README da URL hardcoded per engine.
   Regex per estrarre link github.com. Aggiungi al manifest se non duplicato.

4. OFFICIAL REPOS: lista hardcoded (godot-demo-projects, phaser3-examples, ecc).

5. CLONE: git clone --depth 1 --quiet in data/repos_raw/{engine}/{repo_name}/
   Se la cartella esiste già → skip (log "already cloned").

6. MANIFEST: data/manifest.json — array di oggetti:
   {url, engine, stars, license, size_kb, topics, pushed_at, 
    clone_status, scraped_at}

7. RATE LIMIT: sleep(2) dopo ogni API call, sleep(0.5) dopo ogni git clone.

8. FLAGS: --dry-run, --engine, --skip-clone

9. LOGGING: tqdm per progress, file scrape_log.txt per dettagli.

10. ERROR HANDLING: try/except su ogni clone. Se fallisce, 
    clone_status="failed", continua.

DOPO lo script, VERIFICA:
  python scripts/ingestion/01_scrape.py --dry-run
  (deve mostrare conteggi per engine senza scaricare nulla)

COMMIT:
  git add scripts/ingestion/01_scrape.py
  git commit -m "feat(phase-1): add GitHub scraper with corrected date filters"

Aggiorna PROJECT_STATUS.md: spunta 1.1.
```

---

## NOTE SUI PROMPT SUCCESSIVI (Fase 2-7)

I prompt per le Fasi 2 a 7 sono nel MASTER_EXECUTION_PLAN.md originale.
Aggiungi a CIASCUNO di essi, alla fine, questo blocco standard:

```
DOPO aver completato lo script:

VERIFICA: [esegui i check dalla checklist di quella fase nel PROJECT_STATUS.md]

COMMIT:
  git add -A
  git commit -m "feat(phase-N): [descrizione fase]"

AGGIORNA PROJECT_STATUS.md: spunta tutte le checkbox completate di questa sottofase.
```

I commit message specifici per ogni fase sono già definiti nel PROJECT_STATUS.md.

---

# ═══════════════════════════════════════════════════════
# §04 — RIEPILOGO COMPLETO DEI DELIVERABLE
# ═══════════════════════════════════════════════════════

## File da mettere nella root del progetto PRIMA di iniziare

| File | Fonte | Dove va |
|---|---|---|
| CLAUDE.md | Output di questa sessione | Root del repo |
| PROJECT_STATUS.md | Generato dal Prompt 0B | Root del repo |
| pietra_v4.md | Il tuo documento originale | docs/ |
| SUPREME_RAG_BLUEPRINT.md | Output sessione precedente | docs/ |
| MASTER_EXECUTION_PLAN.md | Output sessione precedente | docs/ |
| MASTER_EXECUTION_PLAN_ADDENDUM.md | QUESTO documento | docs/ |

## Ordine dei prompt per Claude Code

| # | Prompt | Cosa crea | Commit |
|---|---|---|---|
| 0A | Init Ambiente | git, cartelle, package.json, tsconfig | `feat(phase-0): initialize workspace` |
| 0B | Governance | docs placeholder, PROJECT_STATUS.md | `feat(phase-0): add governance files` |
| 0C | Shared Module | taxonomy.py, schema, confidence gate | `feat(phase-0): add shared RAG defense` |
| 0D | DB Schema | 001_knowledge_base.sql | `feat(phase-0): add Supabase schema` |
| 0E | TS Client | types.ts, knowledge.ts | `feat(phase-0): add TS KB client` |
| 1 | Scraper | 01_scrape.py | `feat(phase-1): add GitHub scraper` |
| 1-exec | Run scraping | data/repos_raw/ populated | `feat(phase-1): complete scraping` |
| 2 | Filter | 02_filter.py | `feat(phase-2): add quality filter` |
| 2-exec | Run filter | data/repos_clean/ populated | `feat(phase-2): complete filtering` |
| 3A | Godot Parser | 03_parse_godot.py | `feat(phase-3): add Godot parser` |
| 3B | Other Parsers | 03_parse_*.py | `feat(phase-3): add remaining parsers` |
| 3-exec | Run all parsers | data/chunks_raw/ populated | `feat(phase-3): complete parsing` |
| 4 | Classifier | 04_classify.py | `feat(phase-4): add LLM classifier` |
| 4-exec | Run classification | data/chunks_classified/ populated | `feat(phase-4): complete classification` |
| 5 | Embed & Store | 05_embed_store.py | `feat(phase-5): add embed script` |
| 5-exec | Run embedding | Supabase populated | `feat(phase-5): complete storage` |
| 6 | Validate & Test | 06_validate.py, 07_test_queries.py | `feat(phase-6): add validation` |
| 7 | Comparison | 08_comparison_test.ts | `feat(phase-7): Dataset Boost validated` |

---

*Questo addendum completa il Master Execution Plan. Ora hai:*
*1. Filtro data corretto (2022, non 2025)*
*2. RAG Defense come codice condiviso (shared/), non solo documentazione*
*3. PROJECT_STATUS.md con checkbox spuntabili dall'agente*
*4. Prompt con verifiche e commit integrati*
*5. Prompt specifici per l'inizializzazione dell'ambiente (git, cartelle, deps)*

*Apri il terminale. Incolla il Prompt 0A. Il primo commit è a 10 minuti da adesso.*
