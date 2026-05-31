# CONCURRENT AI DEVELOPMENT MANIFESTO v2 — FINAL

_v2 aggiunta 2026-05-31 dopo audit Pietra v4 + v5 + blueprint v2 + repo
reale. Differenze chiave dalla v1: (a) include i 6 orphans che la v1
aveva mancato, (b) parte dal repo reale (non greenfield), (c) usa
higgsfield.ai + tesana.ai come ispirazione UI, (d) scarta 21st.dev per
auto-build da $0, (e) mappa ogni BaaS per Workstream._

## §00 — Stato di partenza (verificato 2026-05-31)

Non siamo greenfield. Eredità:

| Cosa esiste | Dove | Stato |
|---|---|---|
| Repo Git + GitHub remoto | `github.com/DocAllfix/gamestudio-ai` (public) | 50 commit, branch attivi `master` e `feat/phase-2-asset-library` |
| TypeScript client KB | `lib/knowledge.ts`, `lib/types.ts` | Foundationale, READ-ONLY per Workstream |
| Python ingestion | `scripts/ingestion/`, `scripts/ingestion_assets/`, `scripts/shared/` | ~60 file, fase 1 chiusa, fase 2 quasi conclusa |
| Supabase schema | migrations 001-004 applicate | code_knowledge 7336 chunk, asset_library_index 4968 |
| RAG dataset | 7336 chunk code 100% allowlist, 4968 asset CC0 | 9/10 RPC test PASS |
| Docs canoniche | `docs/pietra_v4 (1).md`, `docs/PIETRA_v5_ADDENDUM.md`, `docs/GAME_REASONING_ENGINE_BLUEPRINT_v2.md` | Pietra v5 è la fonte autoritativa più aggiornata |
| OGA full scrape | In background, ~135/1200 asset | Quando finisce → audio_bgm in DB → 10/10 PASS |

**Conseguenza**: Fase 0 non è "scrivere da zero", è "merge feat/phase-2-asset-library in master, rinomina in main, crea contratti, scrivi migration 005, pulisci docs morti, parti".

---

## §01 — The BaaS Perimeter (cosa NON scriviamo)

Tutti i servizi qui sono cloud — le 4 sessioni li **consumano via SDK**,
mai duplicano. Cross-referenziato con Pietra §11.1 e v5 §B/§D.

| Concern | BaaS | SDK | Costo MVP | Workstream owner |
|---|---|---|---|---|
| Auth + org | **Clerk** | `@clerk/nextjs` | Free 10k MAU | W4 |
| DB + pgvector + RPC | **Supabase** | `@supabase/supabase-js` | Free 500MB / Pro $25 | tutti (lecture) |
| Job queue / workflow | **Trigger.dev** | `@trigger.dev/sdk` | Free $5 credit | W3 |
| Object storage | **Cloudflare R2** | `@aws-sdk/client-s3` | Free 10GB | W3 |
| Sandbox code exec | **E2B** | `@e2b/code-interpreter` | Pay-per-second | W3 |
| LLM gateway | **OpenRouter** | `openai` SDK + baseURL | Pay-per-token | W2 |
| LLM observability | **Helicone** | proxy header | Free 100k req | W2 |
| Embedding | **OpenAI** | `openai` SDK | $0.02/1M | foundation (già in `lib/knowledge.ts`) |
| Image gen | **Replicate** (SDXL + LoRA) | `replicate` SDK | $0.002-0.008/img | W2 |
| Music gen | **Suno API** | HTTP | $0.05-0.10/track | W2 |
| SFX + voice | **ElevenLabs** | `elevenlabs` SDK | $0.02-0.10/line | W2 |
| 3D model gen | **Meshy.ai / Tripo / Replicate TRELLIS.2** | HTTP/`replicate` SDK | $0.005-0.20/asset | W2 |
| Analytics + feature flags | **PostHog** | `posthog-js` + `posthog-node` | Free 1M events | W4 |
| Email transactional | **Resend** | `resend` SDK | Free 3k email | W4 |
| Email marketing | **Loops** | HTTP API | Free 1k contacts | W4 |
| In-app notifications | **Knock** | `@knocklabs/node` | Free 1k notifs | W4 |
| Live chat | **Crisp** | script tag | Free unlimited | W4 |
| Link analytics | **Dub.co** | `@dub/dubco` | Free | W4 |
| Billing | **Stripe** | `stripe` SDK | 2.9% + 30¢ | W4 |
| Rate limiting | **Upstash Redis** | `@upstash/redis` | Free 10k cmd/day | W2 |
| Deploy edge | **Vercel** | `vercel` CLI | Free Hobby | W4 |
| Frontend monitoring (Phase 2) | **Sentry** | `@sentry/nextjs` | Free 5k events | W4 |

**Regola d'oro**: se un task chiede "scrivere un worker che ascolta una
queue", STOP — Trigger.dev. Se chiede "validare JWT", STOP — Clerk.
Implementazione duplicata di un BaaS = debito tecnico immediato.

---

## §02 — Bounded Contexts + Git + Mocking

### 02.1 Directory ownership

```
PHASE 1 (CONGELATO, READ-ONLY PER TUTTI):
- lib/knowledge.ts, lib/types.ts
- scripts/shared/**, scripts/ingestion/**, scripts/ingestion_assets/**
- supabase/migrations/00[1-5]_*.sql
- docs/pietra_v*.md, docs/GAME_REASONING_*.md, docs/SUPREME_RAG_*.md
- package.json, tsconfig.json, requirements.txt, .gitignore
- CLAUDE.md (solo Fase 0 lo modifica per Phase 2 governance)

FASE 0 (CONTRATTI, scritti UNA volta in main, poi READ-ONLY):
- lib/contracts/**       Zod schemas + TypeScript interfaces
- lib/_mocks/**          stub condivisi per il parallelismo
- supabase/migrations/005_game_reasoning_v1_schema.sql
- supabase/fixtures/005_seed_catalogs.sql

WORKSTREAM 1 (W1) — Reasoning + Orchestrator:
- lib/reasoning/**       D.1 Intent, D.2 Design, D.3 Consistency,
                         D.4 Balance, D.5 Execution, D.6 Evaluation
- lib/orchestrator/**    Hermes pattern: 3-level memory, planner→executor
- lib/episodic-memory/** EMA success_score, voyager-style decay
- supabase/migrations/0XX_reasoning_*.sql (numerazione coordinata)

WORKSTREAM 2 (W2) — Tools + LLM Routing + Asset Resolver:
- lib/tools/**           48 tool come moduli singoli
- lib/llm/**             OpenRouter router + Helicone proxy + cost cap
- lib/asset-resolver/**  D.5 Asset Resolver tool-side (RAG asset query)
- lib/style-inference/** Style Pack picker (Vision + librosa)
- supabase/migrations/0XX_tools_*.sql

WORKSTREAM 3 (W3) — Runtime + Sandbox + Assembler + Publishers:
- lib/runtime/engines/   8 EngineAdapter (godot, phaser, renpy, defold,
                         monogame, love, threejs, stride)
- lib/runtime/sandbox/   wrapper E2B
- lib/runtime/assembler/ combina output Tool → build giocabile + .zip
- lib/runtime/publishers/ itch_packager, store_page_gen, steam_pipeline
- supabase/migrations/0XX_runtime_*.sql

WORKSTREAM 4 (W4) — Frontend + Auth + Billing + Analytics + HITL:
- app/                   Next.js App Router (Creator / Studio / Code Mode)
- components/            UI primitives + feature components
- lib/billing/           Stripe wrapper + quota check + plan tier
- lib/analytics/         PostHog wrapper
- lib/auth/              Clerk helpers
- lib/notifications/     Resend + Knock + Loops + Crisp
- lib/multitenancy/      Clerk org + Supabase RLS per org_id (Phase 2)
- lib/versioning/        Game Plan diff timeline UI (Phase 2)
- lib/hitl/              pause/review UI per moderation gates
- supabase/migrations/0XX_users_billing_*.sql
```

### 02.2 Git strategy operativa

```
ATTUALE:
  master @ 55a96e3 (phase-1quater, RAG KB ready)
  feat/phase-2-asset-library @ 8800c22 (7 commit ahead, asset+tests done)

FASE 0:
  Step 1: aspetta che OGA scrape finisca + RAG-4 follow-up commit su
          feat/phase-2-asset-library (T02 audio_bgm canary diventa PASS)
  Step 2: merge feat/phase-2-asset-library → master (squash o ff-merge,
          come preferisci)
  Step 3: rinomina master → main (modern standard)
  Step 4: applica commits di Fase 0 (contratti + migration 005 + cleanup
          docs + CLAUDE.md governance refresh) DIRETTAMENTE su main
  Step 5: tag v0.0.0-contracts
  Step 6: da v0.0.0-contracts nascono i 4 branch Workstream:
            git checkout -b ws/w1-reasoning-orchestrator v0.0.0-contracts
            git checkout -b ws/w2-tools-llm v0.0.0-contracts
            git checkout -b ws/w3-runtime-engines v0.0.0-contracts
            git checkout -b ws/w4-frontend-billing v0.0.0-contracts
            git push -u origin <branch>

REGOLE:
- Commit SOLO sul proprio branch durante parallelismo
- Pull main --rebase ogni mattina
- Mai cherry-pick fra Workstream prima del merge sequenziale (§06)
- Force push su main VIETATO
- main protetto su GitHub: require PR + 1 review + status checks green
```

### 02.3 Mocking Protocol

Quando A ha bisogno di una funzione che B sta scrivendo:

1. La **firma** esiste già in `lib/contracts/` (Fase 0). Es:
   `lib/contracts/orchestrator.ts` esporta
   `type RunHermesPlan = (input: HermesInput) => Promise<HermesOutput>`.
2. A importa il mock da `lib/_mocks/<dominio>.mock.ts` (scritto in
   Fase 0 ma aggiornato da chi è dueño del modulo reale).
3. L'import è dietro alias condizionale env (`process.env.USE_MOCKS === 'true'`).
4. Al merge §06, gli alias spariscono, gli import puntano al reale.

**Le firme contratto non cambiano mai durante il parallelismo.** Se
serve modifica → STOP, issue GitHub `contract proposal: <nome>`,
attendi consensus dagli altri 3.

### 02.4 Nuove migration Supabase

005 è scritta in Fase 0. Da 006+ in poi, ogni Workstream:

1. Apre issue `claim migration 0XX`.
2. Se preso, prende il successivo.
3. Committa il file PRIMA dell'apply (CLAUDE.md sync).
4. Notifica via commit message: `feat(w2-tools): migration 008 — tool_executions`.

### 02.5 Cross-cutting files (NO touch concurrent)

Nessun Workstream tocca senza coordinamento esplicito:

- `CLAUDE.md`, `package.json`, `tsconfig.json`, `requirements.txt`,
  `.env.example`, `.gitignore`
- `lib/types.ts`, `lib/knowledge.ts`, `lib/contracts/**`
- `scripts/shared/**`, `scripts/ingestion/**`,
  `scripts/ingestion_assets/**`
- `supabase/migrations/00[1-5]_*.sql` (immutabili, già applicate)

---

## §03 — Phase 0 (Contract Phase, 4-5 giorni)

**Vincolo bloccante**: nessun branch parallelo nasce prima di
`v0.0.0-contracts`.

### 03.1 Sequenza Fase 0 (in una sola finestra Claude Code)

**Step A — Merge + Rename + Cleanup**

```bash
# 1. Aspetta che FASE RAG-4 OGA finisca + commit follow-up
#    (audio_bgm in DB → T02 canary PASS → 10/10)

# 2. Merge feat/phase-2-asset-library in master
git checkout master
git merge feat/phase-2-asset-library

# 3. Rinomina master → main
git branch -m master main
git push -u origin main
# Su GitHub: cambia default branch master → main

# 4. Cleanup docs morti (commit dedicato)
git rm docs/GEMINI_DEEP_RESEARCH_PROMPT.md
git rm docs/GEMINI_DEEP_RESEARCH_PROMPT_v2.md
git rm docs/GEMINI_REASONING_REPORT_REVIEW.md
git rm docs/GEMINI_REASONING_REPORT_REVIEW_v2.md
git rm docs/GAME_REASONING_ENGINE_BLUEPRINT_v1.md
git rm docs/LORA_LIBRARY_EXPANDED.md
git rm docs/CLEANUP_LEDGER.md docs/CLEANUP_LEDGER_URLS.json
git rm dry_run_full.txt
git commit -m "chore: remove pre-development research artifacts"
```

**Step B — Dipendenze (`package.json`)**

Aggiungere senza implementarle:
```
@clerk/nextjs, @trigger.dev/sdk, @trigger.dev/nextjs
@aws-sdk/client-s3 (R2), @e2b/code-interpreter
posthog-node, posthog-js
next@14, react@18, tailwindcss
zod (validazione contratti)
vitest (test framework)
replicate, elevenlabs, resend, stripe
@knocklabs/node, @upstash/redis, @sentry/nextjs (Phase 2)
react-flow @xyflow/react (Studio Mode canvas)
shadcn-ui (via init script)
```

**Step C — Directory scaffolding**

Creazione cartelle vuote + `__init__` / `index.ts` placeholder per
ogni Workstream area documentata in §02.1.

**Step D — Contratti `lib/contracts/`**

6 file (totale ~1300 LOC, tutte interfacce, zero implementazione):

1. `game-plan.contract.ts` (~200 LOC) — Zod schema `GamePlanSchema`
   da Pietra v5 §E: meta, core_loop, world_graph, pacing, aesthetics,
   rules, execution_dag, asset_bindings, aesthetic_coherence_metrics,
   plan_version, template_origin
2. `game-graph.contract.ts` (~150 LOC) — `WorldGraphSchema`,
   `EntitySchema`, `RelationSchema`, validator DFS no-cycle, gating DAG
3. `reasoning-engine.contract.ts` (~250 LOC) — interfacce di 6 modules
   D.1-D.6 + Hermes 3-level memory (`memory.short_term`,
   `memory.long_term`, `memory.episodic`)
4. `tool-registry.contract.ts` (~300 LOC) — 48 tool stub con
   `inputSchema`, `outputSchema`, `costEstimate`, `timeEstimate`,
   handler stub `throw new Error("Not implemented")`
5. `assembly-pipeline.contract.ts` (~200 LOC) — `EngineAdapterInterface`
   con 8 assembler stub (Godot, Phaser, RenPy, Defold, MonoGame, LÖVE,
   Three.js, Stride)
6. `evaluation-metrics.contract.ts` (~180 LOC) — WOW promise da v5 §A.1:
   `AESTHETIC_COHERENCE_MIN=0.75`, `STRESS_RMSE_MAX=0.15`,
   `SMOKE_TEST_PASS_RATE_MIN=0.95`, `SOFT_LOCK_COUNT=0`

Test unitari per ogni contratto con esempi reali dai docs.

**Step E — Migration 005**

`supabase/migrations/005_game_reasoning_v1_schema.sql`:

Tabelle:
- `users` (id, clerk_user_id UNIQUE, org_id, tier, created_at)
- `projects` (id, user_id, org_id, title, engine, status, game_plan
  jsonb, game_graph jsonb, created_at, updated_at)
- `game_plan_versions` (id, project_id, version_no, plan_diff jsonb,
  parent_version_id, created_at) — RFC 6902 chain
- `tool_executions` (id, project_id, tool_name, input jsonb, output
  jsonb, cost_usd, latency_ms, status, created_at)
- `usage_events` (id, user_id, event_name, metadata jsonb, created_at)
- `episodic_memory` (id, user_id, skill_name, success_score numeric,
  times_used int, last_used_at) — EMA decay
- `style_packs` (id, name, palette jsonb, lora_refs text[], fonts
  jsonb, asset_library_ids uuid[], genres text[]) — seed 30 da
  STYLE_PACK_REFERENCES.md
- `genre_templates` (id, genre, engine_primary, engine_alts, world_graph
  baseline jsonb, pacing_curve jsonb, rules_ranges jsonb,
  reference_game_ids uuid[], repo_references text[]) — seed 14 da
  blueprint v2 N.3
- `audio_moods` (id, mood_name, bpm_range jsonb, musical_key,
  suno_prompt_template, layering_pattern jsonb, sfx_bank_queries
  text[]) — seed 12 da AUDIO_MOOD_LIBRARY.md
- `reference_games_visual` (id, title, steam_url, style_pack_id,
  engine_plausible, visual_analysis jsonb) — seed 80 da
  REFERENCE_GAMES_VISUAL.md (78/80 già visual_analysis OK per FASE 2)
- `lora_library` (id, hf_repo, license, base_model, style_pack_ids,
  asset_types, success_score) — seed 40 da LORA_VERIFIED_MAP.md
- `hitl_pauses` (id, project_id, reason, payload jsonb, resumed_at) —
  human-in-the-loop checkpoints (Phase 2)

RPC stub (corpi placeholder, body finito dai Workstream):
- `record_tool_execution(project_id, tool_name, input, output, cost,
  latency, status)`
- `check_quota(user_id, tool_name) → bool`
- `increment_quota_usage(user_id, tool_name)`
- `apply_game_plan_diff(project_id, diff jsonb) → uuid` (RFC 6902)
- `update_episodic_memory(user_id, skill_name, success bool)` —
  EMA `new = old * 0.95 + (success ? 1.0 : 0.0) * 0.05`

RLS:
- `projects`, `tool_executions`, `usage_events`, `episodic_memory`,
  `hitl_pauses`: scoped by `auth.uid() = user_id` (read+write)
- `style_packs`, `genre_templates`, `audio_moods`,
  `reference_games_visual`, `lora_library`: public read
- Multi-tenancy: aggiungi `org_id` su tabelle utente, RLS check
  `auth.uid() IN (SELECT user_id FROM users WHERE org_id = projects.org_id)`

Seed fixture: `supabase/fixtures/005_seed_catalogs.sql`.

**Step F — Variabili `.env.example`**

Aggiungere chiavi BaaS vuote:
```
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
TRIGGER_API_KEY=
TRIGGER_PROJECT_REF=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_ENDPOINT=
E2B_API_KEY=
HELICONE_API_KEY=
POSTHOG_KEY=
POSTHOG_HOST=
REPLICATE_API_TOKEN=
SUNO_API_KEY=
ELEVENLABS_API_KEY=
MESHY_API_KEY=
RESEND_API_KEY=
LOOPS_API_KEY=
KNOCK_API_KEY=
CRISP_WEBSITE_ID=
DUB_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=
SENTRY_DSN=
NEXT_PUBLIC_APP_URL=
```

**Step G — Mock SDK `lib/_mocks/`**

Mock object per ogni BaaS + ogni contratto, validato Zod, così ogni
Workstream può fare `import { x } from '@/lib/_mocks/<y>'` durante
sviluppo.

**Step H — CLAUDE.md governance refresh**

Sostituire "Phase 1 only — no product code" con la sezione "Phase 2 —
4-Way Parallel" che lista i 4 Workstream + le directory di proprietà.

**Step I — Tag**

`git tag v0.0.0-contracts` su main. Da qui nascono i 4 branch.

---

## §04 — 4-Way Split Architecture v2 (con orphans esplicitati)

### W1 — Reasoning + Orchestrator + Episodic Memory + Versioning Backend

**Why grouped**: Reasoning Engine produce GamePlan, Hermes lo consuma
per chiamare i Tool, episodic memory governa `success_score` come
feedback loop, versioning Game Plan (RFC 6902 diff) è naturalmente
backend.

**Directory owned (write)**:
- `lib/reasoning/` (6 modules D.1-D.6)
- `lib/orchestrator/` (Hermes router + DAG planner)
- `lib/episodic-memory/` (EMA decay 0.95/0.05, Voyager pattern)
- `lib/game-plan-versioning/` (RFC 6902 diff backend)
- `supabase/migrations/0XX_reasoning_*.sql`

**Read-only**:
- `lib/contracts/**`, `lib/types.ts`, `lib/knowledge.ts`
- `scripts/**`, `supabase/migrations/00[1-5]_*.sql`
- tutte le altre dir Workstream

**BaaS che usa**:
- Supabase RPC (read+write su projects, game_plan_versions,
  episodic_memory, tool_executions)
- Trigger.dev (W1 Reasoning Engine gira come task lungo)
- OpenRouter (LLM via lib/llm/router.ts esposto da W2)

**Mock che consuma**:
- `lib/_mocks/tools.mock.ts` (W2)
- `lib/_mocks/runtime.mock.ts` (W3)

**Branch**: `ws/w1-reasoning-orchestrator`

---

### W2 — 48 Tools + LLM Router + Asset Resolver + Style Inference

**Why grouped**: i 48 tool sono LLM/API calls; routing OpenRouter +
Helicone + cost cap è cross-cutting; Asset Resolver (D.5 tool-side) e
Style Inference (D.1 sub) sono tool LLM/Vision specializzati.

**Directory owned**:
- `lib/tools/` (48 tool come moduli singoli):
  - `lib/tools/code/` — 8 code_gen (godot_gdscript, phaser_js,
    renpy_py, defold_lua, monogame_cs, love_lua, threejs_ts, stride_cs,
    + luau per Roblox Phase 2)
  - `lib/tools/sprite/` — sprite_gen (SDXL+LoRA), tileset_gen,
    ui_element_gen, icon_gen
  - `lib/tools/audio/` — bgm_gen (Suno), sfx_gen (Freesound query +
    ElevenLabs fallback), voice_gen (ElevenLabs)
  - `lib/tools/3d/` — model_3d_gen (Meshy/Tripo/TRELLIS.2),
    anim_3d_gen, texture_gen
  - `lib/tools/shader/` — shader_gen (Claude per math + engine-specific
    codegen)
  - `lib/tools/level/` — level_layout_2d (WFC + Random Walker),
    tilemap_populate, entity_placement, heightmap_gen
  - `lib/tools/qa/` — code_validator, project_validator, playtest_sim_tool
  - `lib/tools/publishers/` — itch_packager, store_page_gen
  - `lib/tools/extras/` — stream_mode, portfolio_gen, jam_mode,
    ai_coach, npc_plugin (Hermes 3 8B) — Phase 2
- `lib/llm/` (router OpenRouter + Helicone proxy + retry + cost cap +
  structured output Zod)
- `lib/asset-resolver/` (D.5 RAG asset query, match_assets RPC)
- `lib/style-inference/` (D.1 Style Pack picker: Vision per
  storyboard utente + librosa per audio)
- `supabase/migrations/0XX_tools_*.sql` se serve `tool_registry`

**Read-only**:
- `lib/contracts/`, `lib/knowledge.ts`
- RPC: `search_code_knowledge`, `match_assets`, `match_loras`,
  `record_tool_execution`, `check_quota`, `increment_quota_usage`

**BaaS che usa**:
- OpenRouter (default LLM gateway)
- Helicone (proxy + observability)
- Replicate (sprite + 3D)
- Suno API (music)
- ElevenLabs (SFX + voice)
- Meshy.ai / Tripo (3D character/prop)
- Upstash Redis (rate limit per-tool)
- Trigger.dev (ogni tool come task)
- OpenAI embeddings (text-embedding-3-small per RAG queries)

**Mock che esporta**:
- `lib/_mocks/tools.mock.ts` per W1 (sempre in sync con firme reali)
- `lib/_mocks/llm.mock.ts` per W1/W3/W4 in test mode

**Branch**: `ws/w2-tools-llm`

---

### W3 — Runtime + Sandbox + Assembler + Publishers + Smoke Test

**Why grouped**: 8 Engine Adapter + E2B sandbox + Assembler finale +
exporters (itch/Steam) + smoke test runner sono tutti dietro la stessa
astrazione di "runtime che prende output Tool e produce build
giocabile".

**Directory owned**:
- `lib/runtime/engines/` — 8 adapter (godot.ts, phaser.ts, renpy.ts,
  defold.ts, monogame.ts, love.ts, threejs.ts, stride.ts)
- `lib/runtime/sandbox/` — wrapper E2B (boot, exec, timeout, FS,
  cleanup, kill)
- `lib/runtime/assembler/` — combina output Tool → file structure →
  build → .zip in R2
- `lib/runtime/publishers/` — itch_packager (butler CLI), store_page_gen,
  steam_pipeline (Phase 2)
- `lib/runtime/smoke-test/` — Godot headless + Phaser headless + custom
  per altri engine (10s play, crash detection)
- `lib/runtime/playtest-runner/` — esegue il Playtest Simulator
  (W1 dueño della logica, W3 della esecuzione)
- `supabase/migrations/0XX_runtime_*.sql` — `build_artifacts` (ref R2),
  `playtest_runs` (output del Playtester per D.6)

**Read-only**:
- `lib/contracts/runtime.ts`, `lib/contracts/game-plan.contract.ts`,
  `lib/contracts/assembly-pipeline.contract.ts`

**BaaS che usa**:
- E2B (sandbox)
- Cloudflare R2 (storage .zip)
- Trigger.dev (assembly job = task lungo 2-5 min)
- GitHub API (Phase 3: auto-create repo per progetto utente)

**Mock che esporta**:
- `lib/_mocks/runtime.mock.ts` per W1
- `lib/_mocks/assembler.mock.ts` per W1/W4

**Branch**: `ws/w3-runtime-engines`

---

### W4 — Frontend + Auth + Billing + Analytics + Notifications + Multitenancy + HITL + Versioning UI + BYOA

**Why grouped**: tutto user-facing — Clerk + Stripe + PostHog +
notifications + Next.js App Router. Include i 5 orphans aggiunti:
multitenancy (Clerk org), HITL pause/review, Game Plan diff timeline UI,
BYOA (asset upload utente), onboarding tutorial.

**Directory owned**:
- `app/` — Next.js App Router
  - `app/(creator)/` — Creator Mode (prompt → progress → output)
  - `app/(studio)/` — Studio Mode (React Flow canvas — Phase 2)
  - `app/(code)/` — Code Mode (editor + diff — Phase 2)
  - `app/(dashboard)/` — progetti utente, billing, settings
  - `app/(admin)/` — admin dashboard (Phase 2)
  - `app/api/` — server actions, Stripe webhook, Trigger.dev callback
- `components/` — UI primitives + feature components
  - `components/ui/` — shadcn primitives (Button, Dialog, ...)
  - `components/creator/` — PromptInput, ProgressBar, OutputPreview
  - `components/studio/` — ReactFlowCanvas, NodeEditor, PropertyPanel
  - `components/diff-timeline/` — Game Plan version history viewer
  - `components/hitl/` — pause/review modals
- `lib/billing/` — Stripe (checkout, webhook, quota check)
- `lib/analytics/` — PostHog (events, feature flags, A/B)
- `lib/auth/` — Clerk (middleware, server helpers)
- `lib/notifications/` — Resend + Knock + Loops + Crisp + Dub.co
- `lib/multitenancy/` — Clerk org switcher + Supabase RLS scoping
- `lib/versioning-ui/` — Game Plan diff timeline frontend
- `lib/hitl/` — frontend per pause/review checkpoint
- `lib/byoa/` — Bring Your Own Asset upload (concept art per Style
  Inference, eventualmente full asset library Phase 2)
- `lib/onboarding/` — tutorial interattivo
- `supabase/migrations/0XX_users_billing_*.sql`

**Read-only**:
- `lib/contracts/`, `lib/types.ts`, `lib/knowledge.ts`
- tutte le altre Workstream dir

**BaaS che usa**:
- Clerk (auth + org)
- Stripe (billing)
- PostHog (analytics + feature flags + session replay)
- Resend (transactional)
- Loops (marketing)
- Knock (in-app)
- Crisp (live chat)
- Dub.co (link analytics)
- Trigger.dev (long jobs visibility)
- Vercel (deploy)
- Sentry (Phase 2 error tracking)

**Mock che consuma**:
- `lib/_mocks/orchestrator.mock.ts` (W1)
- `lib/_mocks/runtime.mock.ts` (W3)

**Branch**: `ws/w4-frontend-billing`

---

### Mappa dipendenze (invariato dalla v1)

```
  W4 (Frontend) ──► W1 (Orchestrator) ──► W2 (Tools)
                          │                    │
                          └──► W3 (Runtime/Sandbox)
                                  │
                                  └──► W2 outputs
```

Contratti = unico ponte.

---

## §05 — Ignition Prompts v2

I 4 prompt vanno copia-incollati in 4 terminali Claude Code separati.
Ogni prompt è autosufficiente, lista esattamente cosa il Workstream
possiede e cosa è vietato.

### IGNITION W1 v2 — Reasoning + Orchestrator + Memory + Versioning

```
Sei la sessione W1 di un progetto a 4 finestre parallele Claude Code.

REPO: https://github.com/DocAllfix/gamestudio-ai
BRANCH:
  git fetch origin
  git checkout -b ws/w1-reasoning-orchestrator v0.0.0-contracts
  git push -u origin ws/w1-reasoning-orchestrator

OBIETTIVO: implementare il Reasoning Engine (6 moduli D.1-D.6 da
docs/GAME_REASONING_ENGINE_BLUEPRINT_v2.md), l'Hermes Orchestrator
(3-level memory), il backend del Game Plan diff versioning (RFC 6902),
e l'Episodic Memory EMA.

DIRECTORY TUE (write only):
- lib/reasoning/**
- lib/orchestrator/**
- lib/episodic-memory/**
- lib/game-plan-versioning/**
- supabase/migrations/ (chiedi numero PRIMA tramite issue
  "W1 claims migration 0XX")

DIRECTORY READ-ONLY (vietato modificare):
- lib/contracts/**, lib/types.ts, lib/knowledge.ts
- lib/tools/**, lib/llm/**, lib/asset-resolver/**, lib/style-inference/**
- lib/runtime/**, app/**, components/**
- lib/billing/**, lib/analytics/**, lib/auth/**, lib/notifications/**,
  lib/multitenancy/**, lib/versioning-ui/**, lib/hitl/**, lib/byoa/**,
  lib/onboarding/**
- scripts/**, supabase/migrations/00[1-5]_*.sql
- package.json, tsconfig.json, requirements.txt, .env.example, CLAUDE.md

CONTRATTI:
- GamePlanSchema, GameGraphSchema (lib/contracts/game-plan.contract.ts,
  game-graph.contract.ts)
- HermesPlanRequestSchema, HermesPlanResponseSchema
  (lib/contracts/reasoning-engine.contract.ts)
- ToolInputBaseSchema, ToolOutputBaseSchema (lib/contracts/tool-registry.contract.ts)

MOCK FINCHÉ W2 NON MERGE:
- import { invokeTool } from '@/lib/_mocks/tools.mock'
- import { llmRouter } from '@/lib/_mocks/llm.mock'

MOCK FINCHÉ W3 NON MERGE:
- import { runtimeBuild } from '@/lib/_mocks/runtime.mock'

SUPABASE LETTURE:
- RPC search_code_knowledge, match_assets, match_loras,
  get_reference_parameters

SUPABASE SCRITTURE:
- INSERT/UPDATE su projects, game_plan_versions, tool_executions,
  episodic_memory

REGOLE:
- Commit frequenti sul branch. Mai push su main.
- Pull main --rebase ogni mattina.
- Per modificare un contratto, STOP e apri issue
  "contract proposal" GitHub. Aspetta OK degli altri.

START:
1. Leggi docs/GAME_REASONING_ENGINE_BLUEPRINT_v2.md (PARTI C-K).
2. Leggi docs/PIETRA_v5_ADDENDUM.md (§A, §B, §E).
3. TodoWrite: Intent Interpreter (D.1), Design Planner (D.2),
   Consistency Manager (D.3), Balance Controller (D.4),
   Execution Orchestrator (D.5), Evaluation Agent (D.6),
   Episodic Memory EMA, Hermes router, Game Plan diff backend.
4. Inizia da D.1 (più piccolo) per validare il pattern.

Quando hai dubbi, STOP e chiedi.
```

### IGNITION W2 v2 — Tools + LLM Router + Asset Resolver + Style Inference

```
Sei la sessione W2 di un progetto a 4 finestre parallele Claude Code.

REPO: https://github.com/DocAllfix/gamestudio-ai
BRANCH:
  git fetch origin
  git checkout -b ws/w2-tools-llm v0.0.0-contracts
  git push -u origin ws/w2-tools-llm

OBIETTIVO: implementare i 48 AI Tools (suddivisi in code/sprite/audio/
3d/shader/level/qa/publishers/extras), il LLM Router (OpenRouter +
Helicone proxy + cost cap), il D.5 Asset Resolver (RAG query asset),
la D.1 Style Inference (Vision + librosa).

DIRECTORY TUE:
- lib/tools/**
- lib/llm/**
- lib/asset-resolver/**
- lib/style-inference/**
- supabase/migrations/ (chiedi numero PRIMA)

DIRECTORY READ-ONLY:
- lib/contracts/**, lib/types.ts, lib/knowledge.ts
- lib/reasoning/**, lib/orchestrator/**, lib/episodic-memory/**,
  lib/game-plan-versioning/**
- lib/runtime/**, app/**, components/**, lib/billing/**, lib/analytics/**,
  lib/auth/**, lib/notifications/**, lib/multitenancy/**, ecc.
- scripts/**, supabase/migrations/00[1-5]_*.sql
- package.json, tsconfig.json, requirements.txt, .env.example, CLAUDE.md

CONTRATTI:
- ToolInputBaseSchema, ToolOutputBaseSchema (Zod base)
- Ogni tool: schema specifico in lib/tools/<categoria>/<tool>/schema.ts

MOCK CHE ESPORTI (per altri Workstream):
- lib/_mocks/tools.mock.ts (sempre in sync con firme reali)
- lib/_mocks/llm.mock.ts (per test mode)

BAAS CHE INTEGRI:
- OpenRouter via openai SDK con baseURL OpenRouter
- Helicone via proxy header
- Replicate via replicate SDK (sprite + 3D + TRELLIS.2)
- Suno API via HTTP (music)
- ElevenLabs via elevenlabs SDK (SFX + voice)
- Meshy.ai via HTTP (3D character)
- Upstash Redis (rate limit per-tool)
- OpenAI text-embedding-3-small (RAG queries)

START:
1. lib/llm/router.ts (OpenRouter + Helicone wrapper, retry, cost cap,
   structured output via Zod).
2. lib/llm/embed.ts (text-embedding-3-small).
3. lib/llm/cost-tracker.ts (per-user budget cap, Upstash Redis).
4. Tool pilota: lib/tools/code/godot_gdscript/index.ts (usa
   getReferences() per RAG, ritorna GDScript validato Zod). È il
   template per gli altri 47.
5. lib/asset-resolver/ (match_assets RPC, fallback generativo via
   TRELLIS.2 quando similarity < 0.85).
6. lib/style-inference/ (Vision per storyboard utente, librosa per
   audio reference).
7. TodoWrite con i 48 tool divisi per categoria.
8. Procedi tool-per-tool. Aggiorna sempre lib/_mocks/tools.mock.ts
   quando aggiungi un tool.

Quando hai dubbi, STOP e chiedi.
```

### IGNITION W3 v2 — Runtime + Sandbox + Assembler + Publishers + Smoke

```
Sei la sessione W3 di un progetto a 4 finestre parallele Claude Code.

REPO: https://github.com/DocAllfix/gamestudio-ai
BRANCH:
  git fetch origin
  git checkout -b ws/w3-runtime-engines v0.0.0-contracts
  git push -u origin ws/w3-runtime-engines

OBIETTIVO: 8 Engine Adapter (godot/phaser/renpy/defold/monogame/love/
threejs/stride), wrapper E2B sandbox, Assembler finale (combina output
Tool → .zip in R2), publishers (itch_packager con butler CLI,
store_page_gen, steam_pipeline in Phase 2), smoke test runner per ogni
engine, playtest runner (esegue logica Playtester Agent di W1).

DIRECTORY TUE:
- lib/runtime/engines/**
- lib/runtime/sandbox/**
- lib/runtime/assembler/**
- lib/runtime/publishers/**
- lib/runtime/smoke-test/**
- lib/runtime/playtest-runner/**
- supabase/migrations/ (chiedi PRIMA)
- Integrazione R2 (upload + signed URL)

DIRECTORY READ-ONLY:
- lib/contracts/**, lib/types.ts, lib/knowledge.ts
- lib/tools/**, lib/reasoning/**, lib/orchestrator/**, app/**,
  components/**, lib/billing/**, lib/analytics/**, lib/auth/**, ecc.
- scripts/**, supabase/migrations/00[1-5]_*.sql

CONTRATTI:
- EngineAdapterInterface (lib/contracts/assembly-pipeline.contract.ts)
- AssemblerInputSchema, AssemblerOutputSchema

MOCK CHE ESPORTI:
- lib/_mocks/runtime.mock.ts
- lib/_mocks/assembler.mock.ts

BAAS CHE INTEGRI:
- E2B via @e2b/code-interpreter (E2B_API_KEY)
- Cloudflare R2 via @aws-sdk/client-s3 (R2_*)
- Trigger.dev per assembly job (può durare 2-5 min)
- GitHub API solo Phase 3 (auto-create repo per progetto utente)
- butler CLI per itch.io publishing

START:
1. lib/runtime/engines/_base.ts (interface comune EngineAdapter).
2. godot.ts come primo (writeFile, runHeadless, package as PCK).
3. lib/runtime/sandbox/e2b.ts (boot, exec, timeout, FS, cleanup).
4. lib/runtime/assembler/index.ts (GamePlan + tool outputs mock →
   build .zip in R2 + manifest).
5. lib/runtime/smoke-test/godot-headless.ts (10s play, crash check).
6. Replica engines per Phaser + RenPy + Defold + MonoGame + LÖVE +
   Three.js + Stride.
7. publishers/itch_packager.ts (butler CLI + .zip upload).
8. playtest-runner/ (esegue script Playtest Simulator di W1 in sandbox).

Quando hai dubbi, STOP e chiedi.
```

### IGNITION W4 v2 — Frontend + Auth + Billing + Analytics + Multitenancy + HITL + Versioning UI + BYOA

```
Sei la sessione W4 di un progetto a 4 finestre parallele Claude Code.

REPO: https://github.com/DocAllfix/gamestudio-ai
BRANCH:
  git fetch origin
  git checkout -b ws/w4-frontend-billing v0.0.0-contracts
  git push -u origin ws/w4-frontend-billing

OBIETTIVO: frontend Next.js 14 App Router con 3 modi (Creator/Studio/
Code), integrazione Clerk auth (+ multitenancy via Clerk org), Stripe
billing, PostHog analytics + feature flags, Resend transactional,
Loops marketing, Knock notifications, Crisp chat, Dub.co link
analytics, Sentry error tracking (Phase 2), HITL pause/review UI, Game
Plan diff timeline UI, BYOA (asset upload utente), onboarding
tutorial.

DIRECTORY TUE:
- app/**
- components/**
- lib/billing/**, lib/analytics/**, lib/auth/**, lib/notifications/**,
  lib/multitenancy/**, lib/versioning-ui/**, lib/hitl/**, lib/byoa/**,
  lib/onboarding/**
- supabase/migrations/ (chiedi PRIMA)

DIRECTORY READ-ONLY:
- lib/contracts/**, lib/types.ts, lib/knowledge.ts
- lib/tools/**, lib/reasoning/**, lib/orchestrator/**, lib/runtime/**
- scripts/**, supabase/migrations/00[1-5]_*.sql

CONTRATTI:
- HermesPlanRequestSchema, HermesPlanResponseSchema
- UserTier, QuotaCheckSchema, UsageEventSchema

MOCK CHE CONSUMI:
- import { runHermesPlan } from '@/lib/_mocks/orchestrator.mock'
- import { runtimeBuild } from '@/lib/_mocks/runtime.mock'

BAAS CHE INTEGRI:
- Clerk via @clerk/nextjs (middleware + ClerkProvider + org switcher)
- Stripe via stripe SDK (checkout + webhook
  app/api/stripe/webhook/route.ts)
- PostHog (posthog-js client + posthog-node server + feature flags)
- Resend, Loops, Knock, Crisp, Dub.co
- Trigger.dev (jobs visibility per long generation)
- Sentry @sentry/nextjs (Phase 2)
- Vercel deploy

UI/UX RIFERIMENTI DA CLONARE (vedi §12 per workflow):
- Creator Mode → higgsfield.ai (prompt-to-output progress UX,
  ChatGPT/Claude per chat conversazionale)
- Studio Mode → n8n + tesana.ai (canvas React Flow nodi-edge)
- Code Mode → cursor.com / bolt.new (split view + AI side panel)
- Tema visivo generale → tesana.ai (game-related, gradient bold)

START:
1. npx create-next-app@latest . --typescript --tailwind --app
   --eslint --no-src-dir (verifica con altri Workstream PRIMA).
2. Clerk: middleware.ts + layout.tsx con ClerkProvider + OrgSwitcher.
3. components/ui/* (shadcn primitives via CLI).
4. app/(creator)/page.tsx — Creator Mode (prompt input → mock
   runHermesPlan → progress → output download).
5. lib/auth/, lib/multitenancy/ (org_id scoping).
6. lib/billing/ (Stripe webhook + quota check).
7. lib/analytics/ (PostHog wrapper + feature flags).
8. lib/notifications/ (Resend + Knock + Loops + Crisp + Dub.co).
9. lib/versioning-ui/ (diff timeline component).
10. lib/hitl/ (pause/review modals).
11. lib/byoa/ (asset upload UI + Vision analyze).
12. lib/onboarding/ (interactive tutorial).
13. app/(studio) — React Flow canvas (Phase 2).
14. app/(code) — editor + diff (Phase 2).
15. app/(admin) — admin dashboard (Phase 2).

Quando hai dubbi, STOP e chiedi.
```

---

## §06 — The Merge Protocol (invariato dalla v1)

Ordine "dal fondo verso l'alto":

1. **W2 → main** → tag `v0.1.0-tools`
2. **W3 → main** (pull main con W2, rimuovi tools.mock) → tag
   `v0.2.0-runtime`
3. **W1 → main** (pull main con W2+W3, rimuovi tutti i mock) → tag
   `v0.3.0-reasoning`
4. **W4 → main** (pull main con W2+W3+W1, rimuovi orchestrator.mock)
   → tag `v1.0.0-alpha`

Pre-merge check per ogni Workstream:
- `npx tsc --noEmit && npm run test`
- `npm run test -- --coverage` (≥70% sui moduli nuovi)
- `npm run lint`
- `npm run smoke`

Reconciliazione contratti: STOP, issue GitHub, modifica su main come
commit dedicato `feat(contracts): <nome> v2`, tutti rebasano.

Rollback se main rotto: `git revert <merge-commit>` immediato +
post-mortem + Workstream colpevole fixa nel branch.

---

## §07 — Cross-cutting non in nessun Workstream

| Concern | Coverage attuale | Owner alpha | Owner beta |
|---|---|---|---|
| LLM observability | Helicone (W2) | ✓ coperto | ✓ |
| Backend error tracking | — (orphan in v1) | nessuno alpha | **Sentry in W4 Phase 2** |
| Frontend monitoring | PostHog session replay (W4) | ✓ coperto | ✓ |
| Feature flags | PostHog (W4) | ✓ coperto | ✓ |
| Uptime monitoring | — (orphan) | nessuno alpha | UptimeRobot Phase 2 |
| Database monitoring | Supabase built-in | ✓ coperto | ✓ |
| Email transactional | Resend (W4) | ✓ coperto | ✓ |
| Marketing site SEO | fuori scope codebase | separato | separato |
| Documentation site | fuori scope codebase | Notion alpha | MDX site Phase 3 |
| Secret management | Supabase Vault + env | ✓ coperto | ✓ |

---

## §08 — Verifica finale (gate per uscire da alpha)

1. `npx tsc --noEmit` su main → 0 errori
2. `npm run test` → tutti green, coverage ≥70%
3. `python scripts/ingestion/07_test_queries.py` → 20/20
4. `python scripts/ingestion_assets/08_test_asset_queries.py` →
   10/10 (T02 audio_bgm canary OK dopo RAG-4 finale)
5. Smoke E2E manuale: utente Clerk → genera platformer Godot →
   build giocabile su E2B → .zip in R2 → PostHog logga evento
6. Tutte le migration 005+ committate + applicate + verificate
7. Nessun file cross-cutting modificato senza coordinamento
8. `.env.example` allineato a `.env` reale (chiavi vuote)
9. README setup + CLAUDE.md aggiornato Phase 2
10. WOW metrics di v5 §A.1 verificate: aesthetic ≥0.75, soft-lock=0,
    stress RMSE <0.15, smoke ≥0.95, costo <$1.50/game, time <15 min

---

## §09 — Anti-pattern (rinforzati dalla v1)

- Editare `lib/contracts/` durante parallelismo
- Due Workstream stesso numero migration
- Cherry-pick fra Workstream prima del merge ordinato
- Modificare `scripts/shared/**` o `scripts/ingestion/**`
- Cambio unilaterale contratto
- Implementare logica di un BaaS in custom code
- Mock divergenti dal contratto reale
- Commit con `.env`, `data/`, API keys
- Force push su main
- Skip test pre-merge

---

## §10 — Cosa NON facciamo in alpha (deferred a beta/Phase 3)

- Multi-tenancy avanzato con team workspace condivisi (alpha = 1 user
  o 1 org max)
- Stripe full tier matrix (alpha = Free + Pro, Studio/Enterprise Phase 2)
- I18n
- Mobile-optimized UI
- Realtime multiplayer editing
- TRELLIS.2 image-to-3D in produzione (resta come opzione fallback
  D.5; decidiamo dopo A/B su 3 prompt reali, vedi sezione TRELLIS.2)
- A11y compliance completa
- Penetration testing
- Load testing sotto stress
- Marketplace creator monetization (Polar.sh — Phase 2)
- Steam publishing pipeline (Phase 2)
- Mobile export iOS/Android (Phase 2)
- Stream Mode (Twitch/YouTube overlay)
- Portfolio gen pubbliche
- Jam Mode (timer + leaderboard)
- AI Coach
- NPC Plugin (Hermes 3 8B runtime)
- Custom domain hosting per giochi utente
- Public APIs third-party plugin
- Branded build / white-label

---

## §11 — Note operative

- **Sync mattutina**: ogni Workstream `git pull origin main --rebase`
- **Daily standup async**: `docs/standup/YYYY-MM-DD_wN.md`, le altre
  sessioni leggono prima di iniziare
- **Issue dispatcher**: l'utente è dispatcher per "contract proposal"
  e "claim migration N"
- **Budget API**: ~$5/giorno per Workstream cap, Helicone dashboard =
  fonte di verità
- **Pre-condizione**: OGA full scrape finito → commit follow-up
  RAG-4 → main rilasciato → Fase 0 PARTE

---

## §12 — Frontend Cloning Workflow (higgsfield.ai + tesana.ai)

### 12.1 Riferimenti UI (decisione utente)

| Mode | Reference principale | Reference secondario | Cosa rubare |
|---|---|---|---|
| **Creator Mode** | **higgsfield.ai** | chat.openai.com / claude.ai | Prompt input centrale, progress bar live, output side-by-side con prompt, micro-animazioni durante generation. Higgsfield è prompt-to-video → noi prompt-to-game con lo stesso "feel" di anticipazione/sorpresa. |
| **Studio Mode** | **n8n** | **tesana.ai** | Canvas con nodi-edge (React Flow), property panel destra, top toolbar minimal. Tesana per il tema visivo gaming (gradient bold, colori vivi) |
| **Code Mode** | cursor.com | bolt.new | Split view editor + AI chat side panel (Phase 2) |
| **Dashboard** | Linear | tesana.ai | Liste progetti puliti, sidebar nav, top metric cards |
| **Tema visivo** | **tesana.ai** | higgsfield.ai | Game-related aesthetic: gradient bold, dark mode default, accent neon |

### 12.2 Workflow di cloning (zero costo, NO 21st.dev)

Decisione: **21st.dev scartato**. Costo $20/mese e i loro componenti
sono web UI generiche (button, form, pricing) — non utili per game UI.
Auto-build con Claude Vision è gratis e più adatto.

Workflow operativo per W4:

**Step 1 — Reference capture**
- Screenshot fullscreen di 3 reference: higgsfield.ai homepage,
  n8n editor, tesana.ai generate page
- Salvare in `docs/ui-references/` (committato)

**Step 2 — Vision analysis**
- W4 sessione apre Claude Code con i screenshot
- Prompt: "Analizza questa UI. Estrai: layout grid, gerarchia
  componenti, palette esadecimale, font famiglia, spacing scale,
  micro-interazioni visibili"
- Output: documento `docs/ui-references/<reference>_analysis.md`

**Step 3 — Component generation con shadcn/ui**
- Init shadcn-ui: `npx shadcn@latest init` (CSS variables, slate base,
  Inter font)
- Generation componenti specifici: `npx shadcn@latest add button card
  dialog form input progress slider tabs ...`
- Costo: $0 (shadcn è MIT, copia codice nel repo, no SDK runtime)

**Step 4 — Adattamento al brand Game Studio**
- W4 modifica i tokens shadcn (`components.json` + `globals.css`):
  - Tema dark di default (game audience)
  - Accent gradient (mutuato da tesana.ai)
  - Font monospace per Code Mode (JetBrains Mono via Google Fonts)
- Custom components: `components/creator/PromptInput.tsx`,
  `components/creator/GenerationProgress.tsx`,
  `components/studio/ReactFlowCanvas.tsx`

**Step 5 — Iterative refinement con Claude Vision**
- Screenshot del componente prodotto da Next.js
- Side-by-side con reference originale
- Prompt: "Cosa manca? Allinea il MIO al reference"
- Iterazione finché coerente

**Step 6 — Tools open-source di supporto (opzionali, gratis)**

| Tool | Cosa fa | Costo |
|---|---|---|
| **shadcn/ui CLI** | Componenti React + Tailwind copia-incolla, MIT | $0 |
| **abi/screenshot-to-code** (GitHub MIT) | Screenshot → HTML+Tailwind raw, self-host | $0 |
| **Claude Code Vision** | Già nativo nella sessione, analisi screenshot | incluso |
| **React Flow** (`@xyflow/react`) | Canvas nodi-edge per Studio Mode, MIT | $0 |
| **Lucide React** | Icon set, MIT | $0 |
| **Framer Motion** | Animazioni per micro-interazioni higgsfield-style | MIT $0 |

**Costo totale workflow UI**: **$0/mese**, no SaaS subscription.

### 12.3 Caveat licenze
- shadcn-ui: MIT (componenti copiati nel repo, no attribution
  runtime obbligatoria)
- React Flow: MIT
- Tesana.ai / higgsfield.ai: SOLO ispirazione visiva. Non copiare
  asset/codice loro (proprietari). Il "look and feel" non è
  copyright-protetto, le risorse specifiche sì.

---

## §13 — Migration path concreta dal repo attuale

### 13.1 Pre-Fase 0 (aspettare OGA + sistemare RAG-4)

```bash
# 1. Aspetta che FASE RAG-4 OGA finisca (task background ~3h)
# 2. Sul branch feat/phase-2-asset-library:
python scripts/ingestion_assets/02_filter_assets.py --library opengameart
python scripts/ingestion_assets/03_classify_assets.py --library opengameart \
    --cost-cap-usd 2.50
python scripts/ingestion_assets/04_embed_assets.py --library opengameart
python scripts/ingestion_assets/05_store_assets.py --library opengameart

# 3. Verifica test
python scripts/ingestion_assets/08_test_asset_queries.py
# Atteso: 10/10 PASS (T02 audio_bgm ora OK)

# 4. Commit finale RAG-4
git add PROJECT_STATUS.md
git commit -F /path/to/commit_msg_rag4_complete.txt

# 5. Push
git push origin feat/phase-2-asset-library
```

### 13.2 Fase 0 (su main)

```bash
# A. Merge feat → master, rinomina in main
git checkout master
git merge feat/phase-2-asset-library
git branch -m master main
git push -u origin main
# Su GitHub: Settings → Branches → Default branch master → main
# (delete old master ref)

# B. Cleanup docs morti (commit 1)
git rm docs/GEMINI_DEEP_RESEARCH_PROMPT*.md
git rm docs/GEMINI_REASONING_REPORT_REVIEW*.md
git rm docs/GAME_REASONING_ENGINE_BLUEPRINT_v1.md
git rm docs/LORA_LIBRARY_EXPANDED.md
git rm docs/CLEANUP_LEDGER.md docs/CLEANUP_LEDGER_URLS.json
git rm dry_run_full.txt
git commit -m "chore(phase-0): remove pre-development research artifacts"

# C. Dipendenze + scaffolding directory (commit 2)
# Modifica package.json + requirements.txt + crea directory vuote
git add package.json requirements.txt lib/contracts lib/tools \
    lib/reasoning lib/orchestrator lib/runtime lib/billing \
    lib/_mocks app components
git commit -m "feat(phase-0): scaffold directories + dependencies for Phase 2"

# D. Contratti + test (commit 3)
# Scrivi 6 file in lib/contracts/ + test in lib/contracts/__tests__/
git add lib/contracts/
git commit -m "feat(phase-0): canonical Zod contracts (game-plan, game-graph, reasoning, tools, assembly, metrics)"

# E. Migration 005 + fixture (commit 4)
git add supabase/migrations/005_game_reasoning_v1_schema.sql \
    supabase/fixtures/005_seed_catalogs.sql
git commit -m "feat(phase-0): migration 005 — product tables + seed catalogs"

# F. Apply migration (manuale)
python scripts/apply_migrations.py
# Verifica: SELECT COUNT(*) FROM style_packs (= 30), etc.

# G. CLAUDE.md governance refresh (commit 5)
# Sostituisci "Phase 1 only" con "Phase 2 — 4-Way Parallel"
git add CLAUDE.md
git commit -m "docs(phase-0): governance refresh for Phase 2 parallel dev"

# H. Tag
git tag v0.0.0-contracts
git push origin v0.0.0-contracts

# I. Crea 4 branch Workstream
for ws in w1-reasoning-orchestrator w2-tools-llm w3-runtime-engines w4-frontend-billing; do
  git checkout -b ws/$ws v0.0.0-contracts
  git push -u origin ws/$ws
done

# J. Proteggi main su GitHub (Settings → Branches → Branch protection):
# - Require PR before merging
# - Require 1 approval
# - Require status checks (tsc, vitest, lint)
# - Require linear history
# - Restrict direct pushes
```

### 13.3 Post-Fase 0: avvio dei 4 terminali

Apri 4 finestre VS Code (o 4 tab terminale), una per Workstream.
In ognuna:

1. Clone repo + checkout branch:
   ```bash
   git clone https://github.com/DocAllfix/gamestudio-ai
   cd gamestudio-ai
   git checkout ws/<workstream-id>
   ```
2. Apri Claude Code in quel terminal.
3. Copia-incolla il prompt §05 corrispondente al Workstream.
4. Lascia che la sessione lavori in autonomia sulla sua slice
   verticale.

---

## §14 — Stati di avanzamento atteso (timeline realistica)

| Fase | Durata | Output |
|---|---|---|
| Pre-Fase 0 (RAG-4 completion) | ~3-6h (OGA finish + 4 step pipeline) | T02 canary PASS, 10/10 test |
| Fase 0 (contract) | 4-5 giorni (1 sessione singola) | tag `v0.0.0-contracts` |
| Parallelismo W1-W4 | 8-10 giorni wall | 4 branch attivi |
| Merge W2 → main | 4h | tag `v0.1.0-tools` |
| Merge W3 → main | 6h | tag `v0.2.0-runtime` |
| Merge W1 → main | 8h | tag `v0.3.0-reasoning` |
| Merge W4 → main | 8h | tag `v1.0.0-alpha` |
| **Totale (Fase 0 → alpha)** | ~14-18 giorni | alpha giocabile (Creator Mode + 1 engine + Godot/Phaser) |

Phase 2 features (Studio Mode, Code Mode, Stripe full tier matrix,
Sentry, marketplace ecc.) viene dopo il `v1.0.0-alpha`.

---

_Fine del Concurrent AI Development Manifesto v2. Da salvare in
`docs/CONCURRENT_DEVELOPMENT_MANIFESTO.md` quando il piano viene
approvato e si esce da plan mode. La v1 sopra è obsoleta; usa solo
questa v2._
