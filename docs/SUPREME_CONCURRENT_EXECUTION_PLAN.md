# SUPREME CONCURRENT EXECUTION PLAN — 4× TERMINAL ORCHESTRATION

_Aggiunto 2026-05-31. Operativizza il Manifesto v2 (sopra) in
sotto-fasi numerate. Per OGNI sotto-fase: prompt esatto copia-incolla,
checklist verifica, BaaS richiesti, comandi Playwright/MCP, logging
strutturato. È il livello di esecuzione del manifesto v2 (che resta
livello architetturale)._

## Context

Il manifesto v2 dice "W1 fa il Reasoning Engine" — questo Supreme Plan
dice "W1 fase 1.1 fa Intent Interpreter D.1 incollando il prompt X,
verificando con la checklist Y, integrando OpenRouter via key Z,
loggando in `data/standup/W1-YYYY-MM-DD.jsonl`". Granularità maniacale.

**Stato pre-condizione (verificato 2026-05-31):**
- Manifesto v2 salvato in `docs/CONCURRENT_DEVELOPMENT_MANIFESTO.md`
  (1187 righe, committato).
- 6 contratti Zod in `lib/contracts/` (commit `59201bf`,
  29 test PASS, `tsc --noEmit` 0 errori).
- `package.json` ha zod + vitest. Aggiungere le altre 20 deps in
  Phase 0.
- Branch attivi: `master`, `feat/phase-2-asset-library`,
  `feat/phase-0-contracts` (HEAD). PR aperta nessuna.
- Default GitHub `master` (rinomina in Phase 0).
- OGA scrape in background `becjnapkv` — circa 410/1200, finisce verso
  19:30.

## §01 — The Strategy (non-overlap + mock + logging + branch)

### Rule 1: Directory ownership esclusiva (riassunto manifesto §02.1)

Ogni Workstream tocca **solo** le sue directory. Cross-touch = race
condition = riavvolgimento commit. Le directory cross-cutting
(`package.json`, `tsconfig.json`, `lib/contracts/`, `scripts/shared/`,
`supabase/migrations/00[1-5]_*.sql`) sono **READ-ONLY durante
parallelismo**.

### Rule 2: Mock-first development

Quando il Workstream A chiama funzione che B deve ancora finire:
- A importa da `lib/_mocks/<dominio>.mock.ts` (Fase 0 lo scaffolda).
- I mock validano contratto Zod su input/output.
- Al merge, gli import puntano al reale (vedi §07).

### Rule 3: Branch immutabili durante parallelismo

```
main                              [protetto, solo merge da PR]
v0.0.0-contracts                  [tag, sorgente dei 4 branch]
ws/w1-reasoning-orchestrator      [W1 commit + push solo qui]
ws/w2-tools-llm                   [W2 commit + push solo qui]
ws/w3-runtime-engines             [W3 commit + push solo qui]
ws/w4-frontend-billing            [W4 commit + push solo qui]
```

`git pull origin main --rebase` ogni mattina. Mai cherry-pick fra W.

### Rule 4: Logging strutturato obbligatorio

Ogni sotto-fase deve scrivere un file JSONL in
`data/standup/W<N>-YYYY-MM-DD.jsonl` con righe del tipo:
```json
{"ts":"2026-06-01T09:14:22Z","ws":"W2","phase":"2.1","action":"start","tool_id":"code_gen_godot_gdscript","model":"deepseek-chat","cost_estimate_usd":0.05}
{"ts":"2026-06-01T09:18:47Z","ws":"W2","phase":"2.1","action":"done","duration_s":265,"cost_actual_usd":0.043,"tokens_in":4521,"tokens_out":880,"qa_pass":true}
```

`data/standup/` è gitignored (dati locali) ma le sessioni nemiche dei
silenzi: cosa non è loggato non è successo.

### Rule 5: Skill/MCP usage

- **`webapp-testing`** (Playwright skill): solo W4 lo richiama nei test
  E2E in §06. Non serve a W1/W2/W3.
- **`brainstorming`**: usabile prima di ogni sotto-fase per fissare
  l'approccio. Opzionale.
- **`systematic-debugging`**: obbligatorio quando un test fallisce.
- **`code-review`**: chiamato in §07 prima del merge ordinato.
- **`verify`**: chiamato prima di chiudere una sotto-fase per
  validare che gira davvero (non solo passa typecheck).

### Rule 6: Convergenza ordinata (riassunto §06 manifesto)

Merge sequenziale: W2 → W3 → W1 → W4. Ogni passaggio:
1. Pull `main` (con i precedenti merged).
2. Rimuovi import da `lib/_mocks/*` sostituiti dal codice reale.
3. PR + review + Playwright E2E (vedi §07) + tag.

---

## §02 — Phase 0 (Single Window Setup, ~4-5 giorni)

**Esegui in UNA SOLA finestra Claude Code.** Nessun parallelismo qui.
Crea il fondamento immutabile dei 4 branch.

### Prerequisiti (BLOCCANTI)

```bash
# 1. OGA scrape deve essere finito
ls -la data/assets_raw/opengameart/manifest.jsonl
# Atteso: >=1000 righe (o il limite voluto)

# 2. Pipeline RAG-4 applicata
python scripts/ingestion_assets/02_filter_assets.py --library opengameart
python scripts/ingestion_assets/03_classify_assets.py --library opengameart --cost-cap-usd 2.50
python scripts/ingestion_assets/04_embed_assets.py --library opengameart
python scripts/ingestion_assets/05_store_assets.py --library opengameart

# 3. Test 10/10
python scripts/ingestion_assets/08_test_asset_queries.py
# Atteso: 10/10 PASS (T02 audio_bgm canary OK)

# 4. Commit finale RAG-4 su feat/phase-2-asset-library
git add PROJECT_STATUS.md
git commit -m "feat(phase-rag-4): complete OGA ingestion — 10/10 RPC PASS"
git push origin feat/phase-2-asset-library
```

### Phase 0.A — Merge + rename (10 min)

**Prompt copia-incolla in 1 sessione:**

```
Sei l'agente di Phase 0 del Game Studio AI.

Fai queste azioni in ordine, fermando e chiedendo conferma fra una e
l'altra:

1. Verifica che siamo sul branch corretto e che il lavoro recente è
   tutto pushato:
   git status --short    (deve essere vuoto)
   git log --oneline -5

2. Merge feat/phase-2-asset-library (con tutto RAG-1..RAG-5 finiti)
   in master:
   git checkout master
   git pull origin master
   git merge feat/phase-2-asset-library --no-ff
     -m "merge: Phase 1 + Asset Library + RAG-1..5 into master"
   git push origin master

3. Rinomina master → main:
   git branch -m master main
   git push -u origin main
   git push origin --delete master
   # Su GitHub web: Settings → Branches → cambia default branch a main

4. Verifica:
   git branch -a
   gh api repos/DocAllfix/gamestudio-ai --jq '.default_branch'
   (deve dire "main")

5. Merge anche feat/phase-0-contracts (contratti + manifesto) in main:
   git checkout main
   git merge feat/phase-0-contracts --no-ff
     -m "merge: Phase 0 contracts + manifesto into main"
   git push origin main

LOGGING:
Scrivi in data/standup/PHASE0-YYYY-MM-DD.jsonl una riga per ogni
step (start, done, sha del commit risultante).

CHECKLIST PRIMA DI PASSARE A 0.B:
- [ ] git status pulito
- [ ] git log --oneline -3 mostra il merge commit
- [ ] gh api default_branch ritorna "main"
- [ ] github.com/DocAllfix/gamestudio-ai mostra "main" come default
```

### Phase 0.B — Cleanup docs morti (30 min)

```
Cancella i 7 file documentali resi obsoleti dalle versioni v2/v5:

git rm docs/GEMINI_DEEP_RESEARCH_PROMPT.md
git rm docs/GEMINI_DEEP_RESEARCH_PROMPT_v2.md
git rm docs/GEMINI_REASONING_REPORT_REVIEW.md
git rm docs/GEMINI_REASONING_REPORT_REVIEW_v2.md
git rm docs/GAME_REASONING_ENGINE_BLUEPRINT_v1.md
git rm docs/LORA_LIBRARY_EXPANDED.md
git rm docs/CLEANUP_LEDGER.md docs/CLEANUP_LEDGER_URLS.json
git rm dry_run_full.txt 2>/dev/null || true

git commit -m "chore(phase-0): remove pre-development research artifacts"
git push origin main

CHECKLIST:
- [ ] ls docs/ non mostra più i 7 file
- [ ] grep -r "GAME_REASONING_ENGINE_BLUEPRINT_v1" docs/ → vuoto
```

### Phase 0.C — Dipendenze + scaffolding (1h)

```
Modifica package.json aggiungendo le 20 deps Phase 2:

dependencies (aggiungi):
  "@clerk/nextjs": "^5.7.0",
  "@trigger.dev/sdk": "^3.0.0",
  "@aws-sdk/client-s3": "^3.700.0",
  "@e2b/code-interpreter": "^1.0.0",
  "next": "^14.2.0",
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "posthog-js": "^1.180.0",
  "posthog-node": "^4.2.0",
  "stripe": "^17.4.0",
  "resend": "^4.0.0",
  "@upstash/redis": "^1.34.0",
  "replicate": "^1.0.0",
  "elevenlabs": "^1.50.0",
  "@knocklabs/node": "^0.6.0",
  "@xyflow/react": "^12.3.0",
  "framer-motion": "^11.11.0",
  "lucide-react": "^0.460.0",
  "tailwind-merge": "^2.5.0",
  "clsx": "^2.1.0"

devDependencies (aggiungi):
  "@types/react": "^18.3.0",
  "@types/react-dom": "^18.3.0",
  "tailwindcss": "^3.4.0",
  "postcss": "^8.4.0",
  "autoprefixer": "^10.4.0",
  "@playwright/test": "^1.48.0"

Poi:
  npm install

Scaffold directory vuote (ogni con .gitkeep):
  mkdir -p lib/reasoning lib/orchestrator lib/episodic-memory \
    lib/game-plan-versioning lib/tools/code lib/tools/sprite \
    lib/tools/audio lib/tools/3d lib/tools/shader lib/tools/level \
    lib/tools/qa lib/tools/publishers lib/tools/extras \
    lib/llm lib/asset-resolver lib/style-inference \
    lib/runtime/engines lib/runtime/sandbox lib/runtime/assembler \
    lib/runtime/publishers lib/runtime/smoke-test \
    lib/runtime/playtest-runner \
    lib/billing lib/analytics lib/auth lib/notifications \
    lib/multitenancy lib/versioning-ui lib/hitl lib/byoa \
    lib/onboarding lib/_mocks app components

  find lib app components -type d -empty -exec touch {}/.gitkeep \;

Commit:
  git add package.json package-lock.json lib app components
  git commit -m "feat(phase-0): scaffold directories + Phase 2 deps"
  git push origin main

CHECKLIST:
- [ ] npm install completa senza errori
- [ ] npx tsc --noEmit → 0 errori
- [ ] ls lib/tools/ mostra 9 sotto-directory
- [ ] tutti i .gitkeep committati
```

### Phase 0.D — .env.example update (15 min)

```
Apri .env.example. Aggiungi le 26 chiavi nuove (manifesto §03.1 step F).
Lascia tutti i VALORI VUOTI. Mantieni le 13 esistenti.

Commit:
  git add .env.example
  git commit -m "feat(phase-0): scaffold env vars for all BaaS integrations"
  git push origin main

CHECKLIST:
- [ ] cat .env.example mostra 39 chiavi totali (13 + 26 nuove)
- [ ] nessun valore reale committato (tutte =)
```

### Phase 0.E — Migration 005 + seed (3h)

```
Scrivi supabase/migrations/005_game_reasoning_v1_schema.sql con le 12
tabelle prodotto del manifesto §03.1 step E (users, projects,
game_plans, game_plan_versions, tool_executions, usage_events,
episodic_memory, style_packs, genre_templates, audio_moods,
reference_games_visual, lora_library, hitl_pauses) + 5 RPC stub
(record_tool_execution, check_quota, increment_quota_usage,
apply_game_plan_diff, update_episodic_memory) + RLS policies.

Poi scrivi supabase/fixtures/005_seed_catalogs.sql con i seed:
- 30 style_packs da docs/STYLE_PACK_REFERENCES.md
- 14 genre_templates da docs/GAME_REASONING_ENGINE_BLUEPRINT_v2.md §N.3
- 12 audio_moods da docs/AUDIO_MOOD_LIBRARY.md
- 80 reference_games_visual da docs/REFERENCE_GAMES_VISUAL.md (78 con
  visual_analysis già fatto in FASE RAG-2)
- 40 lora_library da docs/LORA_VERIFIED_MAP.md

Commit prima di apply:
  git add supabase/migrations/005_*.sql supabase/fixtures/005_*.sql
  git commit -m "feat(phase-0): migration 005 — product tables + seeds"
  git push origin main

Apply:
  python scripts/apply_migrations.py
  # poi seed fixture via psql diretto

Verifica:
  python -c "
  import sys; sys.path.insert(0, '.')
  from scripts.shared.db import get_connection
  from dotenv import load_dotenv; load_dotenv()
  with get_connection() as conn:
      cur = conn.cursor()
      for tbl in ('users','projects','game_plans','style_packs',
                  'genre_templates','audio_moods','reference_games_visual',
                  'lora_library'):
          cur.execute(f'SELECT COUNT(*) FROM {tbl}')
          print(f'{tbl}: {cur.fetchone()[0]}')
  "
  # Atteso: style_packs=30, genre_templates=14, audio_moods=12,
  #         reference_games_visual=80, lora_library=40

CHECKLIST:
- [ ] migration 005 committata PRIMA dell'apply (CLAUDE.md protocol)
- [ ] schema_migrations contiene "005_game_reasoning_v1_schema"
- [ ] seed counts verificati
- [ ] PROJECT_STATUS.md aggiornato con stato 005=APPLIED
```

### Phase 0.F — CLAUDE.md governance refresh (1h)

```
Riscrivi la sezione "CURRENT MISSION" di CLAUDE.md per riflettere Phase 2.
Mantieni le Code Quality Rules + Anti-Hallucination Protocol + DB
Migration Sync Protocol invariati.

Nuova sezione "CURRENT MISSION: PHASE 2 — 4-WAY PARALLEL DEV":
- Riassumi i 4 Workstream (1 paragrafo ognuno).
- Lista le directory ownership.
- Riferisci a docs/CONCURRENT_DEVELOPMENT_MANIFESTO.md per dettagli.

Commit:
  git add CLAUDE.md
  git commit -m "docs(phase-0): governance refresh for Phase 2 4-way parallel"
  git push origin main

CHECKLIST:
- [ ] grep "Phase 1 only" CLAUDE.md → vuoto
- [ ] grep "Phase 2" CLAUDE.md → presente
- [ ] grep "Workstream" CLAUDE.md → presente
```

### Phase 0.G — Mock SDK + tag + 4 branch (30 min)

```
Scrivi in lib/_mocks/:
- tools.mock.ts (export stub per ogni ToolId; ognuno throws "not implemented" finché W2 non finisce)
- llm.mock.ts (router stub: returns canned response shaped per Zod)
- orchestrator.mock.ts (runHermesPlan stub: returns mock HermesPlanResponse)
- runtime.mock.ts (assembler stub: returns mock AssemblerOutput)
- baas.mock.ts (Clerk, Stripe, R2, E2B stub minimi)

Ogni mock VALIDA Zod su input e output. Failures in test mode = bug.

Test rapido:
  npm run test    # deve passare 31/31 (esistenti) + nuovi dei mock

Commit + tag:
  git add lib/_mocks/
  git commit -m "feat(phase-0): mock SDK boilerplate + Zod-validated stubs"
  git push origin main

  git tag v0.0.0-contracts
  git push origin v0.0.0-contracts

Crea i 4 branch Workstream da v0.0.0-contracts:
  for ws in w1-reasoning-orchestrator w2-tools-llm \
            w3-runtime-engines w4-frontend-billing; do
    git checkout -b ws/$ws v0.0.0-contracts
    git push -u origin ws/$ws
    git checkout main
  done

Su GitHub web: Settings → Branches → Branch protection rules su main:
- Require PR before merging
- Require 1 approval
- Require status checks (typecheck, test)
- Require linear history
- Restrict direct pushes

CHECKLIST:
- [ ] git tag --list | grep v0.0.0-contracts → presente
- [ ] git branch -a | grep "ws/" → 4 branch
- [ ] gh api ".../branches/main/protection" → ok
- [ ] FASE 0 COMPLETA. Possiamo aprire le 4 finestre Claude Code.
```

---

## §03 — Workstream 1: Reasoning Engine + Hermes Orchestrator

**Branch**: `ws/w1-reasoning-orchestrator`
**Tempo stimato totale**: 12-15 giorni
**Mock consumati**: tools.mock, runtime.mock
**Output**: D.1-D.6 implementate, Hermes pattern, episodic memory EMA, Game Plan diff backend.

### Fase 1.1 — Boot session + Intent Interpreter (D.1) (2 giorni)

**Prompt copia-incolla:**

```
Sei la sessione W1 di Game Studio AI. Apri questa finestra Claude Code.

PRELIMINARI (esegui SUBITO):
  git fetch origin
  git checkout ws/w1-reasoning-orchestrator
  git pull --rebase origin main
  npm install
  npx tsc --noEmit  # deve essere 0 errori
  npm run test       # 31+ pass

DOCUMENTAZIONE DA LEGGERE PRIMA DI SCRIVERE CODICE:
- docs/CONCURRENT_DEVELOPMENT_MANIFESTO.md §04 W1
- docs/GAME_REASONING_ENGINE_BLUEPRINT_v2.md PARTE D.1 (Intent Interpreter)
- docs/PIETRA_v5_ADDENDUM.md §B.1 (cost ~$0.02-0.05)
- lib/contracts/reasoning-engine.contract.ts (firme Zod che devi implementare)

OBIETTIVO FASE 1.1: implementare lib/reasoning/intent-interpreter.ts
che soddisfa l'interfaccia IntentInterpreter di reasoning-engine.contract.

DIRECTORY PERMESSE (write):
- lib/reasoning/
- lib/episodic-memory/  (solo per leggere da Supabase, non scrivere)

DIRECTORY READ-ONLY:
- lib/contracts/**, lib/_mocks/**, lib/types.ts, lib/knowledge.ts
- TUTTO il resto

IMPLEMENTAZIONE:
1. lib/reasoning/intent-interpreter.ts deve:
   - leggere user_prompt + moodboard_image_urls + reference_game_ids
   - consultare style_inference tramite invokeTool('style_inference', ...)
     (chiamata via lib/_mocks/tools.mock — W2 implementerà il reale)
   - consultare RAG via getReferences() (lib/knowledge.ts esistente)
   - emettere un draft GamePlan parziale (meta, genre, engine, style_pack_id)
   - validare output via GamePlanSchema.parse() PRIMA del return
   - persistere in projects + game_plan_versions

2. Scrivi 5+ test in lib/reasoning/__tests__/intent-interpreter.test.ts

INTEGRAZIONI BaaS:
- Supabase via @supabase/supabase-js (env: NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY)
- OpenRouter via openai SDK con baseURL OpenRouter (env: OPENROUTER_API_KEY)
- Helicone proxy header per observability (env: HELICONE_API_KEY)
- Mock: import { invokeTool } from '@/lib/_mocks/tools.mock'

LOGGING:
Crea un helper lib/_internal/logger.ts (riusabile) che esporta
`logStep(ws, phase, payload)` che append-a a
data/standup/W1-YYYY-MM-DD.jsonl. Ogni invocazione del modulo logga:
- {phase: "1.1", action: "intent_start", project_id, model, ...}
- {phase: "1.1", action: "intent_done", duration_ms, cost_usd, tokens, ...}
- Errori: {phase: "1.1", action: "intent_error", error: stack, ...}

CHECKLIST PER CHIUDERE FASE 1.1:
- [ ] lib/reasoning/intent-interpreter.ts esiste e esporta default IntentInterpreter
- [ ] 5+ test green in lib/reasoning/__tests__/intent-interpreter.test.ts
- [ ] npx tsc --noEmit → 0 errori
- [ ] npm run test → tutti green
- [ ] data/standup/W1-YYYY-MM-DD.jsonl mostra righe per il run di esempio
- [ ] commit: `feat(w1-reasoning): D.1 Intent Interpreter`
- [ ] push: git push origin ws/w1-reasoning-orchestrator
- [ ] standup async: docs/standup/YYYY-MM-DD_w1.md (riassunto 5 righe)

QUANDO HAI DUBBI: STOP. Apri issue GitHub "W1 question: <topic>".
Mai modificare lib/contracts/ o cross-cutting files.
```

### Fase 1.2 — Design Planner (D.2) (3 giorni)

**Prompt (template, abbreviato — segue stesso schema di 1.1):**

```
Sei W1, fase 1.2. Continui sul branch ws/w1-reasoning-orchestrator.

git pull --rebase origin main
npx tsc --noEmit && npm run test

OBIETTIVO: lib/reasoning/design-planner.ts (interfaccia DesignPlanner).
Implementa "Dormans grammar + Tree-of-Thought branching" da blueprint v2
§D.2.

PUNTI CHIAVE:
- input: GamePlan (output di D.1) + opzionale refinement_request
- emette: full_plan (prima volta) o GamePlanPatch RFC 6902 (refine)
- Tree-of-Thought: 3 branch paralleli via Promise.all su LLM, scegli
  il migliore via score interno
- Persiste game_plan_versions con parent_version

INTEGRAZIONI:
- Supabase RPC apply_game_plan_diff per i refine
- OpenRouter (preferenza Claude Sonnet su questo, costo $0.10-0.25/call)

LOGGING: stesso pattern di 1.1 (phase: "1.2").

CHECKLIST: 5+ test, refine + full_plan path entrambi coperti, RFC 6902
diff round-trip verificato, commit + push.
```

### Fase 1.3 — Consistency Manager (D.3) (2 giorni)

```
Sei W1, fase 1.3.

OBIETTIVO: lib/reasoning/consistency-manager.ts che implementa
ConsistencyManager. NON LLM (cost ~$0). Usa findDirectedGatingCycle()
del contratto + ASP solver via clingo (subprocess) per soft-lock check.

DEPS NUOVE (se necessarie, vai prima da utente per ok):
- nessuna (clingo è binario di sistema)

INPUT: world_graph + dialogues
OUTPUT: ConsistencyManagerOutput (valid bool + soft_locks + corrections)

LOGGING: phase: "1.3", action: cycle_check / asp_solve.

CHECKLIST:
- [ ] passa il caso canonico "Metroidvania crystal_cave → dark_forest → ruins"
- [ ] rileva soft-lock noto "boss room richiede chiave che non puoi
       recuperare dopo aver lottato"
- [ ] emette corrections come RFC 6902 patch
- [ ] 5+ test
```

### Fase 1.4 — Balance Controller (D.4) (2 giorni)

```
Sei W1, fase 1.4.

OBIETTIVO: lib/reasoning/balance-controller.ts (interfaccia
BalanceController). Property-test su numeric ranges + small LLM judge
per qualitative decisions.

INPUT: GamePlan + rules_ranges (dal genre_templates)
OUTPUT: balanced_plan + adjustments[]

INTEGRAZIONI:
- DeepSeek V4 Flash per il judge (più economico, $0.05/run)
- Supabase get_reference_parameters RPC per le baseline numeriche

LOGGING: phase: "1.4", ogni aggiustamento {rule, before, after, reason}.

CHECKLIST:
- [ ] gestisce caso "player_hp fuori range" → clamp
- [ ] gestisce caso qualitative "boss_phase troppo difficile per
       beginner" → LLM decide
- [ ] 5+ test inc. property tests con fast-check
```

### Fase 1.5 — Execution Orchestrator (D.5) (3 giorni)

```
Sei W1, fase 1.5.

OBIETTIVO: lib/orchestrator/hermes.ts che esporta HermesOrchestrator.
Questo è il LOOP ESTERNO: D.1 → D.2 → D.3 → D.4 → D.5 → D.6 → refine.

INTEGRAZIONI:
- Trigger.dev per i task lunghi (TRIGGER_API_KEY, TRIGGER_PROJECT_REF)
- Supabase tool_executions table per persist outputs
- Hermes 3-level memory dal contratto (short_term, long_term, episodic)

DAG SCHEDULER:
- topologico su execution_dag del GamePlan
- chiamate parallele per nodi indipendenti
- retry max 3, backoff esponenziale
- early-stop su cost cap (per_game_cost_exceeded da billing.contract)

MOCK ANCORA NECESSARI:
- import { invokeTool } from '@/lib/_mocks/tools.mock'  # W2
- import { runtimeBuild } from '@/lib/_mocks/runtime.mock'  # W3

LOGGING: phase: "1.5", ogni nodo DAG = 1 riga, ogni iterazione = 1
"summary" line.

CHECKLIST:
- [ ] simula un GamePlan minimo (1 nodo DAG, mock invokeTool) end-to-end
- [ ] cost cap respected (test con cap=$0.10)
- [ ] retry/backoff funziona (mock invokeTool che fallisce 2 volte)
- [ ] 5+ test
```

### Fase 1.6 — Evaluation Agent (D.6) (2 giorni)

```
Sei W1, fase 1.6.

OBIETTIVO: lib/reasoning/evaluation-agent.ts (interfaccia
EvaluationAgent). Esegue Playtest Simulator + raccoglie i 6 metriche
WOW.

INTEGRAZIONI:
- runtime.mock per la simulazione (W3 implementerà reale)
- evaluation-metrics.contract per i threshold

OUTPUT: EvaluationReport conforme al contratto.
Se overall_passed=false → genera refinement_request testo per D.2.

LOGGING: phase: "1.6", una riga per metrica con verdict.

CHECKLIST:
- [ ] tutti i 6 metric verdicts presenti
- [ ] refinement_request emessa quando metrica fail (es. stress RMSE
      misurato 0.20 > 0.15 cap)
- [ ] 5+ test
```

### Fase 1.7 — Episodic Memory EMA (1 giorno)

```
Sei W1, fase 1.7.

OBIETTIVO: lib/episodic-memory/index.ts che gestisce success_score EMA.

FORMULA (da Pietra v4 §1.3, Voyager): new = old * 0.95 + (success?1:0)*0.05

INTEGRAZIONI:
- Supabase RPC update_episodic_memory (creato in migration 005)
- Letto da D.1 Intent Interpreter per biasare tool selection

LOGGING: phase: "1.7", ogni update {user_id, skill, before, after,
times_used}.

CHECKLIST:
- [ ] update_episodic_memory RPC call funziona
- [ ] EMA matematicamente corretta (test con sequenze success/fail)
- [ ] D.1 lo legge tramite getEpisodic(user_id)
- [ ] 5+ test
```

### Fase 1.8 — Game Plan Diff Backend (1 giorno)

```
Sei W1, fase 1.8.

OBIETTIVO: lib/game-plan-versioning/diff-backend.ts.
- applyPatch(parent_plan, patch) → new_plan (RFC 6902 standard)
- store in game_plan_versions table

INTEGRAZIONI:
- npm install fast-json-patch (RFC 6902 reference impl, MIT)
- Supabase apply_game_plan_diff RPC

LOGGING: phase: "1.8", ogni patch {project_id, parent_version, ops_count, summary}.

CHECKLIST:
- [ ] add/remove/replace ops round-trip
- [ ] optimistic concurrency (parent_version mismatch → reject)
- [ ] 5+ test inc. patch reversal

FINE WORKSTREAM 1. Ready per merge in §07.
```

---

## §04 — Workstream 2: 48 Tools + LLM Routing + Asset Resolver + Style Inference

**Branch**: `ws/w2-tools-llm`
**Tempo stimato totale**: 18-22 giorni (è il più carico)
**Mock esportati**: tools.mock, llm.mock
**Output**: 48 tool functioning, OpenRouter+Helicone router, Asset Resolver, Style Inference.

### Fase 2.1 — LLM Router + Helicone proxy (2 giorni)

**Prompt copia-incolla:**

```
Sei la sessione W2 di Game Studio AI.

PRELIMINARI:
  git fetch origin
  git checkout ws/w2-tools-llm
  git pull --rebase origin main
  npm install
  npx tsc --noEmit && npm run test

DOCS:
- docs/CONCURRENT_DEVELOPMENT_MANIFESTO.md §04 W2
- docs/PIETRA_v5_ADDENDUM.md §B (cost routing)
- lib/contracts/tool-registry.contract.ts (firme ToolDescriptor)

OBIETTIVO 2.1: lib/llm/router.ts + lib/llm/cost-tracker.ts.

ARCHITETTURA:
- router.ts: wrapper su `openai` SDK con baseURL=https://openrouter.ai/api/v1
  + Helicone come proxy via header "Helicone-Auth: Bearer $HELICONE_API_KEY"
- supporta 4 famiglie: deepseek (cheap, default), claude (reasoning),
  gpt-4o-mini (vision), gemini (long context)
- structured output con Zod schema → tool si dichiara con schema, router
  forza response_format={type: "json_schema", strict: true, schema}
- cost-tracker.ts: per-trace cost accumulation, hard cap (throw quando
  superato), persist in tool_executions

INTEGRAZIONI BaaS:
- OPENROUTER_API_KEY env
- HELICONE_API_KEY env
- UPSTASH_REDIS_URL/TOKEN per cost cap distribuito
- Supabase tool_executions table per audit

LOGGING: phase: "2.1", ogni call {model, input_tokens, output_tokens,
cost_usd, latency_ms, cache_hit}.

CHECKLIST:
- [ ] router.ts gestisce 4 providers
- [ ] Zod validation rifiuta output malformato (LLM hallucinations)
- [ ] cost cap throws quando superato
- [ ] Helicone dashboard mostra le call
- [ ] 10+ test inc. retry + provider fallback
- [ ] commit + push
- [ ] AGGIORNA lib/_mocks/llm.mock.ts con la stessa firma reale
```

### Fase 2.2 — Tool pilota: code_gen_godot_gdscript (3 giorni)

```
Sei W2, fase 2.2. Questo è IL TEMPLATE per gli altri 47 tool.
Curare molto.

OBIETTIVO: lib/tools/code/code_gen_godot_gdscript/
  ├── index.ts        (esporta ToolDescriptor)
  ├── schema.ts       (estende ToolInputBase/Output con campi specifici)
  ├── handler.ts      (logica reale)
  └── __tests__/*.test.ts

INPUT SCHEMA (estende ToolInputBaseSchema):
- mechanic: enum (player_controller, enemy_ai, save_load, audio_manager...)
- context: GamePlan ridotto (engine='godot', genre, rules)

OUTPUT SCHEMA (estende ToolOutputBaseSchema):
- code: stringa GDScript validata sintatticamente (regex base + check
  che `extends ...` sia presente)
- file_structure: {path, contents}[] da scrivere in sandbox W3
- qa_log: array di check {check, passed, detail}

PIPELINE:
1. getReferences({engine: 'godot', primary_category}) → top 3 chunk
2. buildReferenceContext(refs)
3. router.complete({model: 'deepseek-chat', system: "You are a Godot
   4 expert. Return ONLY GDScript that compiles.", user: prompt +
   context, schema: outputSchema})
4. QA self-check: parse GDScript per error syntactic, conta nodi
   sospetti

INTEGRAZIONI:
- KB via lib/knowledge.ts (esistente)
- LLM via lib/llm/router (2.1)
- Cost cap per call

LOGGING: phase: "2.2", uno per call.

CHECKLIST:
- [ ] genera GDScript per "player_controller platformer 2D" che
       contiene movement + jump + gravity
- [ ] structured output Zod validation OK
- [ ] cost <= $0.05/call (DeepSeek)
- [ ] 5+ test
- [ ] EXPORT in lib/_mocks/tools.mock.ts come stub conforme (lo
       sostituirà l'import reale al merge)
- [ ] documentato in docs/tools/code_gen_godot_gdscript.md
- [ ] commit + push
```

### Fase 2.3-2.9 — Altri 7 code generators (7 giorni, 1/giorno)

```
Replica lo schema di 2.2 per:
- code_gen_phaser_js (engine=phaser, language=js)
- code_gen_renpy_python (engine=renpy)
- code_gen_defold_lua
- code_gen_monogame_csharp
- code_gen_love2d_lua
- code_gen_threejs_ts
- code_gen_stride_csharp

Per ognuno: schema specifico + handler che usa getReferences() filtrato
per engine + 5 test + voce in tools.mock.

LOGGING ogni run + standup giornaliero su data/standup/W2-YYYY-MM-DD.jsonl
```

### Fase 2.10 — Sprite Tools (3 giorni)

```
Implementa in parallelo:
- sprite_gen (SDXL via Replicate + LoRA da style_pack_id, costo $0.002-0.008/img)
- tileset_gen (SDXL tile-mode + WFC post-process)
- ui_element_gen (button, dialog, HUD)
- icon_gen (32x32 pixel art)
- concept_art_gen (FLUX, costo $0.04/img, solo Pro tier)

INTEGRAZIONI:
- REPLICATE_API_TOKEN env
- match_loras RPC per scegliere LoRA per style_pack
- R2 per upload output (via @aws-sdk/client-s3)

LOGGING: ogni gen image_url + LoRA usata + costo.

CHECKLIST per tool:
- [ ] genera output ≥ 256x256
- [ ] respect style_pack LoRA
- [ ] upload R2 e ritorna signed URL
- [ ] 3+ test (mocked Replicate)
```

### Fase 2.11 — Audio Tools (2 giorni)

```
- bgm_gen (Suno API, SUNO_API_KEY env, costo $0.05-0.10/track)
  - usa audio_moods table per Suno prompt template
- sfx_gen (Freesound search RPC + ElevenLabs fallback)
  - usa Freesound già wired in Phase 1
- voice_gen (ElevenLabs, costo $0.02-0.10/line)

LOGGING + 3 test ciascuno.
```

### Fase 2.12 — 3D Tools (2 giorni)

```
- model_3d_gen (Meshy/Tripo/Replicate TRELLIS.2, vedi memoria
  reference_trellis2)
- animation_3d_gen (Mixamo API o Replicate)
- texture_gen (SDXL texture mode)
- hdri_gen (poly haven già wired)

DEFER: TRELLIS.2 production routing (vedi memoria, decisione al D.5)
```

### Fase 2.13 — Shader/Level/QA Tools (3 giorni)

```
Shader (Claude Sonnet per math):
- shader_gen_glsl, shader_gen_hlsl, shader_gen_godot

Level:
- level_layout_2d (DeBroglie WFC tramite Python subprocess)
- level_layout_3d (heightmap + voronoi)
- tilemap_populate
- entity_placement

QA:
- code_validator (compila in sandbox W3)
- project_validator (struttura file engine-specific)
- playtest_simulator (test stress curve)
- smoke_test_runner

LOGGING + 3 test ciascuno.
```

### Fase 2.14 — Publishers + Extras (2 giorni)

```
Publishers (8 assembler + 2 publisher):
- godot_assembler, phaser_assembler, ... (delega a W3 via runtime
  contract; W2 ne fa la wrapper che chiama runtime.mock fino al merge)
- itch_packager (butler CLI in W3 sandbox)
- store_page_gen (markdown + screenshot)

Extras (Phase 2, opzionali per alpha):
- stream_mode, portfolio_gen, jam_mode, ai_coach, npc_plugin,
  byoa_analyzer

asset_resolver (CRITICAL):
- legge GamePlan.asset_bindings
- per ogni slot: match_assets RPC (similarity ≥0.85) → if pass, usa
  catalog asset; else fallback a generative tool
- pre-compute total asset cost
```

### Fase 2.15 — Style Inference (1 giorno)

```
OBIETTIVO: lib/style-inference/index.ts.

INPUT: moodboard_image_urls + audio_reference_urls + reference_game_ids
OUTPUT: style_pack_id (1 del catalog)

PIPELINE:
1. Per ogni image: gpt-4o-mini Vision con prompt strutturato → estrai
   palette, lighting, mood
2. Per ogni audio: librosa Python subprocess → BPM, mood
3. CLIP embedding di moodboard → match contro style_packs.palette
   (calcola distance)
4. Vota: il style_pack più vicino vince

USATO DA: D.1 Intent Interpreter (W1)

LOGGING + 3 test (mocked Vision).
```

---

## §05 — Workstream 3: Runtime + Sandbox + Assembler + Publishers

**Branch**: `ws/w3-runtime-engines`
**Tempo stimato totale**: 14-16 giorni
**Mock esportati**: runtime.mock, assembler.mock
**Output**: 8 EngineAdapter, E2B sandbox, Assembler, butler publisher, smoke test.

### Fase 3.1 — E2B Sandbox wrapper (2 giorni)

```
Sei la sessione W3.

PRELIMINARI:
  git fetch origin
  git checkout ws/w3-runtime-engines
  git pull --rebase origin main
  npm install
  npx tsc --noEmit && npm run test

DOCS:
- docs/CONCURRENT_DEVELOPMENT_MANIFESTO.md §04 W3
- lib/contracts/assembly-pipeline.contract.ts (EngineAdapter interface)

OBIETTIVO 3.1: lib/runtime/sandbox/e2b.ts.
- boot(): apre Sandbox E2B (env E2B_API_KEY)
- writeFile(path, content)
- runCommand(cmd, timeoutMs) → CommandResult
- close()

INTEGRAZIONI:
- @e2b/code-interpreter SDK
- timeout default 60s
- log stdout/stderr in struct

LOGGING: phase: "3.1", ogni call {sandbox_id, command, exit_code,
duration_ms}.

CHECKLIST:
- [ ] boot + write + run + close ciclo verde
- [ ] timeout handling
- [ ] errori sandbox propagati
- [ ] 5+ test (con E2B reale, env mock per CI)
- [ ] export in lib/_mocks/runtime.mock.ts
- [ ] commit + push
```

### Fase 3.2 — EngineAdapter base + Godot (3 giorni)

```
OBIETTIVO:
- lib/runtime/engines/_base.ts: classe astratta EngineAdapter
- lib/runtime/engines/godot.ts: implementazione Godot 4

GODOT SPECIFICS:
- bootSandbox: E2B con godot 4.3 preinstallato (preflight: installa
  godot 4.3 nel sandbox se non c'è)
- build: `godot --headless --quit --export-release "Linux/X11"`
- smokeTest: `godot --headless --no-window` con timeout 10s,
  parse stderr per "ERROR:" o segfault
- package: zip della cartella build → upload R2

INTEGRAZIONI:
- R2 via @aws-sdk/client-s3 (env R2_*)
- build_artifacts table su Supabase

LOGGING + 5 test (mocked sandbox).
```

### Fase 3.3-3.9 — Altri 7 EngineAdapter (7 giorni, 1/giorno)

```
- phaser.ts: build via webpack, smoke via headless chromium
- renpy.ts: distribute via launcher, smoke via auto-skip
- defold.ts: bob CLI build
- monogame.ts: dotnet publish
- love2d.ts: love-release zip
- threejs.ts: vite build + headless chrome
- stride.ts: stride-build CLI

Stesso pattern di 3.2 per ognuno.
```

### Fase 3.10 — Assembler (2 giorni)

```
OBIETTIVO: lib/runtime/assembler/index.ts.

INPUT: AssemblerInput (game_plan, engine, tool_outputs)
OUTPUT: AssemblerOutput (artifact_id, download_url, smoke_test result)

PIPELINE:
1. EngineAdapter.bootSandbox() per il `engine` richiesto
2. Per ogni tool_output: writeFile in path engine-conventional
3. EngineAdapter.build()
4. (se run_smoke_test) EngineAdapter.smokeTest()
5. EngineAdapter.package() → .zip in R2
6. Persist build_artifacts row + return AssemblerOutput

INTEGRAZIONI:
- Trigger.dev per il job (può durare 5 min)
- Supabase build_artifacts table

LOGGING: phase: "3.10", una riga per step.

CHECKLIST:
- [ ] end-to-end con 1 engine (Godot) + mock tool_outputs ridotti
- [ ] artifact .zip scaricabile da R2
- [ ] smoke_test propagato in AssemblerOutput
- [ ] 5+ test
```

### Fase 3.11 — Publishers (2 giorni)

```
OBIETTIVO: lib/runtime/publishers/itch.ts

PIPELINE:
- Input: artifact_id, target_url, channel, butler_api_key
- Download .zip da R2
- run `butler push <zip> <target>:<channel>` nel sandbox
- Parse stdout per build_url

INTEGRAZIONI:
- butler CLI in sandbox
- Supabase usage_events log

Steam pipeline = Phase 2 deferred.

LOGGING + 3 test (mocked butler).
```

### Fase 3.12 — Smoke Test Runner + Playtest Runner (2 giorni)

```
Smoke test runner: già parzialmente in EngineAdapter.smokeTest. Qui
wrapper batch:
- run smoke test su tutti gli 8 engine in parallelo
- output SmokeTestReport conforme al contract

Playtest runner:
- esegue logica del Playtester Agent (di W1) nel sandbox
- N=10 run con seed diversi
- raccoglie stress samples per Balance Controller

LOGGING + 5 test.

FINE WORKSTREAM 3.
```

---

## §06 — Workstream 4: Frontend + Auth + Billing + Analytics + HITL + Versioning UI + BYOA

**Branch**: `ws/w4-frontend-billing`
**Tempo stimato totale**: 14-16 giorni
**Mock consumati**: orchestrator.mock, runtime.mock
**Output**: Next.js app con 3 mode, Clerk + Stripe + PostHog, etc.

### Fase 4.1 — Next.js boot + Clerk (2 giorni)

**Prompt:**

```
Sei la sessione W4.

PRELIMINARI:
  git fetch origin
  git checkout ws/w4-frontend-billing
  git pull --rebase origin main
  npm install
  npx tsc --noEmit && npm run test

DOCS:
- docs/CONCURRENT_DEVELOPMENT_MANIFESTO.md §04 W4 e §12 frontend cloning
- lib/contracts/billing.contract.ts (UserTier, QuotaCheck)
- lib/contracts/reasoning-engine.contract.ts (HermesPlanRequest/Response)

OBIETTIVO 4.1: scaffold Next.js 14 + integra Clerk.

COMANDI:
  # IMPORTANTE: NON usare `npx create-next-app` su . perché distrugge
  # struttura. Invece scaffolda manualmente:
  
  # 1. Aggiungi config Next.js
  scrivi next.config.ts (TypeScript, ESM, strict mode)
  scrivi tailwind.config.ts + postcss.config.js
  scrivi app/layout.tsx con ClerkProvider
  scrivi app/page.tsx (landing minima)
  scrivi middleware.ts con clerkMiddleware (auth gate)
  
  # 2. Aggiungi script package.json:
  "dev": "next dev",
  "build": "next build",
  "start": "next start"

INTEGRAZIONI BaaS:
- @clerk/nextjs (env: CLERK_SECRET_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
- middleware protegge /(creator), /(studio), /(code), /(dashboard) routes

LOGGING:
- usa console.error structured per errori server
- PostHog non ancora integrato (4.6)

SKILL: webapp-testing per smoke test iniziale.
  ATTIVA quando UI è pronta:
    /skill webapp-testing
  Comando per testare:
    npm run dev (in altro terminale)
    poi Playwright apre http://localhost:3000 verifica landing carica
    e Clerk redirect funziona

CHECKLIST:
- [ ] npm run dev parte su :3000
- [ ] http://localhost:3000 mostra landing
- [ ] Clerk redirect a /sign-in funzionante
- [ ] middleware blocca /dashboard se non auth
- [ ] Playwright test: landing + sign-in flow verde
- [ ] 5+ test (Vitest + Playwright misto)
- [ ] commit + push
```

### Fase 4.2 — Creator Mode UI (Higgsfield-style) (3 giorni)

```
Sei W4, fase 4.2.

DOCS UI REFERENCE:
- §12 manifesto: Creator Mode → ispirazione higgsfield.ai
  (prompt-to-output con progress bar e anticipazione)
- screenshot higgsfield.ai → docs/ui-references/higgsfield_creator.png
  (carica TU lo screenshot)

OBIETTIVO: app/(creator)/page.tsx + componenti.

LAYOUT:
- Center stage: PromptInput (textarea grande, controlli style/genre)
- Sotto: progress timeline (D.1 → D.2 → D.3 → D.4 → D.5 → D.6)
  con Framer Motion micro-animations
- Side panel destro: live preview output via Supabase Realtime

INTEGRAZIONI:
- import { runHermesPlan } from '@/lib/_mocks/orchestrator.mock'  # W1 mock
- Supabase Realtime sub a `game_plans` channel
- PostHog event "game_started" (anche se non ancora integrato, prep
  hook per 4.6)

SKILL webapp-testing:
  /skill webapp-testing
  
  Test Playwright:
  1. Naviga /(creator)
  2. Inserisci prompt "platformer pixel art with cats"
  3. Click "Generate"
  4. Verifica progress timeline si anima
  5. Aspetta ~30s (mock fa response in 5s)
  6. Verifica preview panel mostra GamePlan output

LOGGING: console.error strutturato + PostHog stub (skip se key vuota).

CHECKLIST:
- [ ] PromptInput accetta input
- [ ] Generate button chiama runHermesPlan
- [ ] progress timeline anima 6 step
- [ ] Playwright E2E test verde
- [ ] mobile responsive (md+ breakpoint)
- [ ] 5+ test mix Vitest + Playwright
```

### Fase 4.3 — Studio Mode (n8n + Tesana style) (3 giorni)

```
Sei W4, fase 4.3.

DOCS UI:
- §12 manifesto: Studio Mode → n8n canvas + tesana.ai gaming tema
- screenshot in docs/ui-references/n8n_canvas.png e
  docs/ui-references/tesana_generate.png (carica TU)

OBIETTIVO: app/(studio)/page.tsx — Canvas React Flow del GamePlan
execution_dag.

LIBRERIE:
- @xyflow/react (già in deps, MIT)
- React Flow custom node types per ToolCategory

UI:
- top toolbar (back / save / share)
- left sidebar: node palette (48 tool draggable)
- center: canvas con execution_dag corrente
- right panel: node inspector (input/output per node selezionato)

INTEGRAZIONI:
- Game Plan da Supabase via project_id (router params)
- mutazione: update_game_plan via mock fino al merge W1

SKILL webapp-testing:
  Test:
  1. Apri /(studio)/<project_id> (con project esistente seedato)
  2. Verifica canvas mostra nodi del execution_dag
  3. Drag un nodo "sprite_gen" dalla palette → drop sul canvas
  4. Verifica node inspector mostra schema input
  5. Click "Save" → verifica patch RFC 6902 emessa

LOGGING.

CHECKLIST:
- [ ] canvas carica execution_dag
- [ ] drag-drop + connect funziona
- [ ] save genera patch
- [ ] Playwright E2E test
- [ ] 5+ test
```

### Fase 4.4 — Code Mode (Phase 2 deferred per alpha)

```
Phase 2. Skip per ora.
Stub: app/(code)/page.tsx con messaggio "Coming soon".
```

### Fase 4.5 — Dashboard + Project list (2 giorni)

```
OBIETTIVO: app/(dashboard)/page.tsx.

UI:
- lista progetti utente (query projects scoped by user_id via RLS)
- ogni card: titolo, engine, status badge, ultima modifica
- top right: quota usage (X/3 games this month per Free tier)
- top metrics: total generations, success rate, total spent

INTEGRAZIONI:
- Clerk useUser()
- Supabase scoped query

SKILL webapp-testing:
  Test:
  1. Auth come user fake
  2. Verifica vede solo suoi progetti
  3. Click su progetto → naviga in (creator)

CHECKLIST + 5 test + Playwright E2E.
```

### Fase 4.6 — PostHog + Stripe billing (2 giorni)

```
OBIETTIVO:
- lib/analytics/posthog.ts (client + server helper)
- lib/billing/stripe.ts (checkout + webhook)
- app/api/stripe/webhook/route.ts

INTEGRAZIONI BaaS:
- POSTHOG_KEY, POSTHOG_HOST env
- STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET env
- 4 prodotti Stripe (Free $0, Creator $19, Pro $49, Studio $99) creati
  manualmente in dashboard Stripe (issue per utente)

WEBHOOK FLOW:
- POST /api/stripe/webhook
- valida signature
- aggiorna users.tier in Supabase
- log usage_events

PostHog hooks: pageView + game_started + game_completed + upgrade_clicked.

LOGGING + 5 test + webhook test con stripe CLI.

CHECKLIST:
- [ ] checkout session crea Stripe checkout URL
- [ ] webhook su test event funziona
- [ ] users.tier aggiornata
- [ ] PostHog eventi visibili in dashboard
```

### Fase 4.7 — Notifications + HITL + Versioning UI + BYOA + Onboarding (3 giorni)

```
In parallelo (sotto-sotto-fasi mini):

4.7.a notifications:
- Resend per email transactional (RESEND_API_KEY)
- Knock per in-app (KNOCK_API_KEY)
- Loops drip campaigns onboarding

4.7.b hitl:
- lib/hitl/ — pause/review modals quando game_plan ha proposed
  refinement_request
- inserisce in hitl_pauses table

4.7.c versioning-ui:
- timeline component che mostra game_plan_versions
- diff viewer (libreria diff2html, MIT)

4.7.d byoa:
- form upload asset utente
- chiama byoa_analyzer tool (W2) via mock

4.7.e onboarding:
- tutorial interattivo prima interazione
- localStorage flag + step queue

LOGGING + ognuno 3+ test.

FINE WORKSTREAM 4.
```

---

## §07 — The Convergence & E2E Testing

### Phase 7.1 — Pre-merge per Workstream (1h cad.)

Per OGNI Workstream prima della sua PR, esegui sul branch:

```bash
git pull --rebase origin main      # ultima versione mainstream
npx tsc --noEmit                    # 0 errori
npm run test                        # tutti green
npm run test -- --coverage          # ≥70% sui moduli nuovi
npm run lint                        # 0 errori (se lint configurato)

# Test Playwright se W4
npm run test:e2e                    # (script da aggiungere in W4)

# Verifica logging
ls data/standup/W<N>-*.jsonl        # deve esistere e crescere
```

Apri PR su GitHub con:
- Titolo: `feat(w<N>): <descrizione fase>`
- Descrizione: link al manifesto §0X + lista sotto-fasi completate
- Etichette: `workstream-<N>`, `ready-for-review`

### Phase 7.2 — Merge sequenziale (4-6h totali)

Ordine **immutabile**: W2 → W3 → W1 → W4.

#### W2 → main (primo)

```
1. Maintainer review della PR W2
2. /skill code-review --depth high
3. Pre-merge: pull main into ws/w2-tools-llm, resolve conflicts
4. Merge PR (squash) → main
5. Tag: git tag v0.1.0-tools && git push origin v0.1.0-tools
6. Annuncia agli altri 3: "W2 merged, pull main"
```

#### W3 → main

```
1. W3 sessione: git pull origin main --rebase
2. RIMUOVI tutti i `lib/_mocks/runtime` import (se ne avevi)
   E SOSTITUISCI con import reali da lib/runtime/. W3 owns them.
3. Sostituisci `from '@/lib/_mocks/tools.mock'` con
   `from '@/lib/tools/<actual_id>/index.js'` ovunque W3 li
   usa.
4. typecheck + test
5. PR + review + merge → main
6. Tag: v0.2.0-runtime
7. Annuncia
```

#### W1 → main

```
1. W1: git pull origin main --rebase (con W2+W3)
2. RIMUOVI import da lib/_mocks/tools.mock, lib/_mocks/runtime.mock,
   lib/_mocks/llm.mock. SOSTITUISCI con i reali.
3. typecheck + test
4. PR + review + merge → main
5. Tag: v0.3.0-reasoning
6. Annuncia
```

#### W4 → main

```
1. W4: git pull origin main --rebase (con W2+W3+W1)
2. RIMUOVI lib/_mocks/orchestrator.mock import. SOSTITUISCI con
   `runHermesPlan` da lib/orchestrator/hermes.ts (reale).
3. typecheck + test
4. PR + review + merge → main
5. Tag: v1.0.0-alpha
6. Annuncia: GAME STUDIO AI ALPHA READY
```

### Phase 7.3 — E2E test finale con Playwright MCP (2h)

In una sessione singola dopo `v1.0.0-alpha`:

```
Sei l'agente di E2E test finale. Sei sul main aggiornato.

PRELIMINARI:
  git checkout main
  git pull
  npm install
  npm run build
  # avvia il server in background:
  npm start &
  SERVER_PID=$!

SKILL ATTIVA: webapp-testing

TEST E2E (manda al server live):

Test 1: User signup + free tier
  1. Apri https://localhost:3000/sign-up
  2. Compila form con email test
  3. Verifica redirect a /dashboard
  4. Verifica quota "0/3 games" visibile

Test 2: Creator Mode E2E
  1. Click "New project"
  2. Inserisci "platformer pixel art with cats"
  3. Click Generate
  4. Aspetta progress timeline completare (~3-5 min reali)
  5. Verifica download .zip pulsante appare
  6. Verifica PostHog event "game_completed" loggato

Test 3: Studio Mode load
  1. Da dashboard → apri progetto generato
  2. Switch a Studio Mode
  3. Verifica canvas React Flow mostra execution_dag
  4. Verifica click su nodo "sprite_gen" mostra preview asset

Test 4: Quota enforcement
  1. Genera 3 game come Free user
  2. Tenta 4° → verifica modal "Upgrade to Creator"
  3. Click Upgrade → Stripe checkout

Test 5: Smoke test su 3 engine principali
  1. Genera platformer Godot
  2. Genera browser arcade Phaser
  3. Genera VN Ren'Py
  4. Per ognuno verifica .zip scaricabile + smoke test pass nel UI

CLEANUP:
  kill $SERVER_PID

OUTPUT: docs/standup/E2E-YYYY-MM-DD.md con risultati 5 test +
screenshot allegati.

CHECKLIST FINALE PER LANCIO ALPHA:
- [ ] 5/5 Playwright E2E PASS
- [ ] python scripts/ingestion/07_test_queries.py → 20/20 PASS
- [ ] python scripts/ingestion_assets/08_test_asset_queries.py → 10/10
- [ ] PostHog dashboard mostra eventi
- [ ] Helicone dashboard mostra LLM costs
- [ ] Sentry dashboard 0 errori uncaught
- [ ] R2 bucket contiene .zip degli ultimi 3 progetti
- [ ] Supabase: SELECT COUNT(*) FROM projects = N_test_users
- [ ] WOW metrics: aesthetic ≥0.75, soft_lock=0, stress RMSE <0.15,
       smoke ≥0.95, costo <$1.50, time <15min — TUTTI PASS sul test
       finale

Se tutti i check passano → annuncia v1.0.0-alpha al pubblico.
```

### Phase 7.4 — Standup async + retrospective

Ogni Workstream a fine fase scrive `docs/standup/YYYY-MM-DD_w<N>.md`:
- 5 righe: cosa ho fatto / cosa farò / blocchi / dependencies
- Le altre sessioni leggono a inizio giornata

Alla fine dell'alpha:
- `docs/retrospective/v1.0.0-alpha.md` collaborative (un paragrafo per
  Workstream)
- Lezioni → input per Phase 2 (Studio Mode completo, Code Mode,
  Stripe full tier, Sentry, mobile export, Steam pipeline, ecc.)

---

## §08 — Riepilogo timing realistica

| Fase | Durata stimata | Output |
|---|---|---|
| Pre-Fase 0 (OGA finish + pipeline) | 6-8h | T02 canary PASS, dataset completo |
| Fase 0 (single window, 7 step A-G) | 4-5 giorni | tag v0.0.0-contracts + 4 branch creati |
| Parallel W1 | 12-15 giorni | 8 sotto-fasi 1.1-1.8 |
| Parallel W2 | 18-22 giorni | 15 sotto-fasi 2.1-2.15 (il più pesante) |
| Parallel W3 | 14-16 giorni | 12 sotto-fasi 3.1-3.12 |
| Parallel W4 | 14-16 giorni | 7 sotto-fasi 4.1-4.7 |
| Merge W2 → main | 4h | v0.1.0-tools |
| Merge W3 → main | 6h | v0.2.0-runtime |
| Merge W1 → main | 8h | v0.3.0-reasoning |
| Merge W4 → main | 8h | v1.0.0-alpha |
| E2E final test | 2h | go/no-go pubblico |
| **TOTALE (max workstream)** | **~23-25 giorni di parallelismo** | alpha giocabile |

(Workstream più lento determina il timing — W2 con 22 giorni.)

---

## §09 — Anti-pattern operativi (RIPETIZIONE per chiarezza)

1. ❌ Editare `lib/contracts/` durante parallelismo
2. ❌ Modificare `package.json` dependencies senza coordinare con altre
3. ❌ Aprire PR senza pull main aggiornato
4. ❌ Skip dei test pre-merge
5. ❌ Force push su main
6. ❌ Numerazione migration sovrapposta (sempre issue "claim 0XX" prima)
7. ❌ Commit con .env, data/, API keys
8. ❌ Mock non-validato Zod (silently passa errori a runtime)
9. ❌ Ignorare standup async (gli altri Workstream perdono contesto)
10. ❌ Cherry-pick fra Workstream invece di aspettare merge ordinato

---

_Fine del Supreme Concurrent Execution Plan. Quando approvato, salvare
in docs/SUPREME_CONCURRENT_EXECUTION_PLAN.md (come fatto col manifesto
v2)._
