# EXECUTION PLAN — Prompt operativi per fase/workstream

**Data**: 2026-06-03 · **Target**: gate di lancio day-1 (§7 `docs/WOW_CONTRACT.md`).
**23 blocchi**: FASE 0 (3) · W1 (5) · W2 (4) · W3 (5) · W4 (5) = 22 fase + Gate (1).
Ogni blocco: Dipendenze · Prompt operativo (auto-contenuto) · Criteri DONE
(binari) · Output di fase.

## Vincoli trasversali (valgono per OGNI blocco)

- **Merge order immutabile** (`CONCURRENT_DEVELOPMENT_MANIFESTO.md` §06):
  **W2 → W3 → W1 → W4**. I 4 branch sviluppano in parallelo contro i mock; a
  ogni merge gli import `@/lib/_mocks/*` vengono sostituiti col reale in un
  commit dedicato.
- **Mock = stunt double Zod-validati**: ogni WX compila e gira da solo contro le
  controfigure degli altri. I mock validano input/output col contratto, quindi
  una divergenza emerge a test-time, non al merge. Mock disponibili:
  `lib/_mocks/llm.mock.ts` (`complete`, `embed`), `tools.mock.ts` (`invokeTool`,
  `invokeToolBatch`), `runtime.mock.ts` (`runtimeBuild`, `pushToItch`),
  `orchestrator.mock.ts` (`runHermesPlan`), `baas.mock.ts` (`clerkMock`,
  `stripeMock`, `r2Mock`, `e2bMock`, `triggerMock`, `posthogMock`), +
  `generative.mock.ts` e `worldgen.mock.ts` (creati in FASE 0.2).
- **Ermeticità**: criterio minimo per ogni fase = `npx tsc --noEmit` (0 errori) +
  `npx vitest run` (verde) sul proprio branch. **Vitest**, non Jest.
- **Single source of truth**: numeri KB da `docs/KB_STATE.md` (7336 chunk); le
  soglie da `lib/contracts/evaluation-metrics.contract.ts` — si CITANO, mai
  ridefinite (`AESTHETIC_COHERENCE_MIN=0.75`, `STRESS_CURVE_RMSE_MAX=0.15`,
  `SMOKE_TEST_PASS_RATE_MIN=0.95`, `SOFT_LOCK_COUNT_MAX=0`,
  `GENERATION_COST_USD_MAX=1.5`, `GENERATION_TIME_SECONDS_MAX=900`).
- **LLM routing**: Azure AI Foundry adattatore primario in testing (deployment
  per modello; Claude via Marketplace; vincoli parametri Claude — vedi
  `EXECUTION_ARCHITECTURE.md` Parte A); OpenRouter alternativa. Helicone NON
  cablato (maintenance mode). Observability granulare = Langfuse (F2).
- **Scope**: esattamente §4 "DENTRO" di `docs/WOW_CONTRACT.md`. Feature FF/F2
  (multiplayer Nakama, .apk Godot, Marble feature-utente, Playtester completo,
  motori renpy/monogame/love2d/stride) NON entrano in questo piano.
<!-- FIX A1: l'evento `fork` (loop virale/flywheel §5) NON è nell'enum usage_events di migration 005 → aggiunto via migration 006 (G.0 in [0.1]), prerequisito di [5-W1]/[5-W4]. -->
- **Evento `fork`**: usato dal flywheel/loop virale ([5-W1], [5-W4]). NON è nell'
  enum `event_name` di `usage_events` (migration 005, valori: game_started,
  game_completed, game_failed, tool_executed, plan_refined, asset_uploaded,
  game_exported_itch, game_exported_steam, upgrade_clicked, downgrade_clicked).
  Viene aggiunto dalla **migration 006** (contract proposal G.0 in `[0.1]`) +
  `UsageEventSchema` in `billing.contract.ts`. Finché 006 non è applicata, `fork`
  non è valido.
- **`[dipende da v0.1.0-contracts]`**: marca i riferimenti che esistono solo dopo
  FASE 0 (babylon, `webExport()`, porte generative, evento `fork`).

---

## FASE 0 — Contratti condivisi (prerequisito di tutti i branch)

### [0.1] — Contract proposals G.1–G.3 su main

**Dipendenze**: `main` a HEAD (contratti 001-005 applicati); branch dedicato
`feat/phase-0-contracts-v2`.

**Prompt operativo**:
```
Applica i contract proposal G.0, G.1, G.2, G.3 di docs/EXECUTION_ARCHITECTURE.md
Parte G. NON modificare i contratti esistenti oltre a queste aggiunte additive.

G.0 — evento `fork` (additivo, per il flywheel/loop virale):
  crea supabase/migrations/006_add_fork_event.sql che ALTER il CHECK constraint
  di usage_events.event_name aggiungendo 'fork' ai 10 valori esistenti (idempotente:
  DROP CONSTRAINT IF EXISTS … ADD CONSTRAINT …). Aggiorna l'enum di
  UsageEventSchema in lib/contracts/billing.contract.ts aggiungendo "fork".
  Committa la migration PRIMA di applicarla (CLAUDE.md sync protocol); applica via
  scripts/apply_migrations.py; aggiorna PROJECT_STATUS.md con lo stato applicato.

G.1 — lib/contracts/game-plan.contract.ts:
  aggiungi "babylon" a EngineEnum (z.enum).
  lib/contracts/tool-registry.contract.ts: aggiungi "code_gen_babylon_ts"
  (categoria code) e "babylon_assembler" (categoria publishers) a ToolIdEnum.

G.2 — lib/contracts/assembly-pipeline.contract.ts:
  aggiungi interface WebBuildArtifact { iframe_url: string; bundle_size_bytes:
  number; target: "browser" | "pwa"; mobile_apk_url: string | null }.
  Aggiungi a interface EngineAdapter il metodo:
  webExport(sandbox: SandboxHandle): Promise<WebBuildArtifact>.

G.3 — crea lib/contracts/generative.contract.ts con 4 interfacce + i loro
  schemi Zod input/output (estendi ToolInputBaseSchema/ToolOutputBaseSchema di
  tool-registry.contract.ts): AudioGenPort (generateBgm/generateSfx/generateVoice),
  Model3DPort (generateModel/generateAnimation/generateTexture),
  ImageGenPort (generateSprite/generateTileset),
  WorldGenPort (generateWorld → output con glb_url + collider_url).

Aggiungi test in lib/contracts/__tests__/ che validano un esempio per ogni nuovo
schema Zod (pattern: i test esistenti contracts.smoke.test.ts).
```

**Criteri DONE**:
- [ ] `npx tsc --noEmit` → 0 errori
- [ ] `npx vitest run lib/contracts/__tests__/` → tutti verdi, inclusi i nuovi assert
- [ ] `grep -c "babylon" lib/contracts/game-plan.contract.ts` → ≥1
- [ ] `grep -c "webExport" lib/contracts/assembly-pipeline.contract.ts` → ≥1
- [ ] `ls lib/contracts/generative.contract.ts` → esiste
<!-- FIX A1: verifica binaria che 'fork' è nell'enum DB e nel contratto -->
- [ ] `grep -c "'fork'" supabase/migrations/006_add_fork_event.sql` → ≥1; dopo apply, query `SELECT 'fork'::text` ammesso da un INSERT di prova in `usage_events` (poi rollback)
- [ ] `grep -c "fork" lib/contracts/billing.contract.ts` → ≥1 (in `UsageEventSchema`)

**Output di fase**: contratti estesi (babylon + webExport + 4 porte generative) su
`feat/phase-0-contracts-v2`.

---

### [0.2] — Mock delle porte nuove

**Dipendenze**: `[0.1]` completata (le porte esistono).

**Prompt operativo**:
```
Crea i mock per le porte introdotte in 0.1, sullo stesso pattern dei mock
esistenti in lib/_mocks/ (validano input con lo schema Zod del contratto e
ritornano output shape-conforme; nessuna rete/LLM/DB).

lib/_mocks/generative.mock.ts: implementa AudioGenPort, Model3DPort, ImageGenPort
  da lib/contracts/generative.contract.ts. Ogni metodo fa Schema.parse(input) e
  ritorna un output finto valido (es. url placeholder, cost_usd: 0).

lib/_mocks/worldgen.mock.ts: implementa WorldGenPort. generateWorld ritorna un
  glb_url placeholder + collider_url placeholder, validati.

Aggiungi smoke test in lib/_mocks/__tests__/mocks.smoke.test.ts (estendi quello
esistente) per ogni nuovo mock.
```

**Criteri DONE**:
- [ ] `npx vitest run lib/_mocks/__tests__/` → verde (vecchi + nuovi)
- [ ] `npx tsc --noEmit` → 0 errori
<!-- FIX A4: criterio binario al posto di "verifica a vista" — prova che la validazione Zod è attiva -->
- [ ] test: `expect(() => generativeMock.generateBgm(invalidInput)).toThrow()`
      (ZodError) — analogo per ogni metodo di generative.mock + worldgen.mock:
      un input malformato fa lanciare il `.parse()` del mock

**Output di fase**: `generative.mock.ts` + `worldgen.mock.ts` → ogni workstream
può consumare le porte generative/world prima del reale.

---

### [0.3] — .env + tag v0.1.0-contracts + ricrea i 4 branch

**Dipendenze**: `[0.1]` `[0.2]` complete. (NB: tag `v0.0.0-contracts` esiste già
e i 4 branch `ws/w1..w4` vuoti sono nati da lì → vanno ricreati dal nuovo tag.)

**Prompt operativo**:
```
1. Aggiungi a .env.example (coordina, è cross-cutting):
   WORLDLABS_API_KEY=        (Marble, account API paid)
   LANGFUSE_PUBLIC_KEY=      (observability F2)
   LANGFUSE_SECRET_KEY=
   LANGFUSE_HOST=
   AZURE già presente (AZURE_OPENAI_*) — verifica i deployment necessari:
   crea 1 deployment per gpt-4o-mini, 1 per deepseek (V4-Flash/Pro), 1 per
   claude-sonnet-4-6 (via Marketplace). Documenta i nomi deployment in .env.example.
2. Merge feat/phase-0-contracts-v2 in main (PR + review).
3. git tag v0.1.0-contracts su main; git push origin v0.1.0-contracts.
4. Ricrea i 4 branch dal nuovo tag (i vecchi sono vuoti):
   per ogni W in {w1-reasoning-orchestrator, w2-tools-llm, w3-runtime-engines,
   w4-frontend-billing}:
     git branch -D ws/W ; git push origin --delete ws/W
     git checkout -b ws/W v0.1.0-contracts ; git push -u origin ws/W
5. Aggiorna PROJECT_STATUS.md con lo stato FASE 0 v2.
```

**Criteri DONE**:
- [ ] `git tag | grep v0.1.0-contracts` → presente
- [ ] `git log v0.1.0-contracts -1 --oneline` include il merge dei contratti
<!-- FIX A1: il tag deve includere la migration 006 committata + applicata (G.0) -->
- [ ] `ls supabase/migrations/006_add_fork_event.sql` esiste ed è nel commit taggato; 006 applicata su Supabase e registrata in `schema_migrations` (PROJECT_STATUS.md aggiornato)
- [ ] i 4 branch `ws/w*` puntano a `v0.1.0-contracts` (`git log ws/w1... -1`)
- [ ] `grep WORLDLABS_API_KEY .env.example` e `grep LANGFUSE .env.example` → presenti
- [ ] `npx tsc --noEmit` + `npx vitest run` su main → verdi

**Output di fase**: **tag `v0.1.0-contracts`** + 4 branch ermetici pronti. Sblocca
TUTTI i workstream.

---

## W1 — Reasoning Engine + Hermes + Flywheel

> Branch `ws/w1-reasoning-orchestrator`. Interfacce in
> `lib/contracts/reasoning-engine.contract.ts`. Consuma `llm.mock.ts`,
> `tools.mock.ts`, `runtime.mock.ts` (offline finché W2/W3 non mergiano).

### [1-W1] — D.1 Intent Interpreter + D.2 Design Planner

**Dipendenze**: `v0.1.0-contracts`; mock `llm.mock.ts`.

**Prompt operativo**:
```
Implementa in lib/reasoning/ i moduli D.1 e D.2 che soddisfano le interfacce
IntentInterpreter (propose) e DesignPlanner (refine) di
lib/contracts/reasoning-engine.contract.ts.

D.1 IntentInterpreter.propose(input: IntentInterpreterInput): da user_prompt
  (+ moodboard_image_urls, forced_engine, memory) produce IntentInterpreterOutput
  con draft_plan (GamePlanSchema valido), rationale, memory. Usa la genre template
  baseline come scheletro (genre_templates in Supabase, RPC di lettura). LLM via
  import { complete } from '@/lib/_mocks/llm.mock' (sostituito al merge W2).

D.2 DesignPlanner.refine(input: DesignPlannerInput): produce DesignPlannerOutput
  con result discriminato (full_plan | patch). Il patch valida GamePlanPatchSchema
  (RFC 6902, ops add/remove/replace).

Test: dato un brief di esempio, GamePlanSchema.parse(output.draft_plan) passa;
un refine produce un patch che GamePlanPatchSchema.parse() accetta.
```

**Criteri DONE**:
- [ ] `npx vitest run lib/reasoning/__tests__/intent.test.ts` → `GamePlanSchema.parse(draft_plan)` non lancia
- [ ] `npx vitest run lib/reasoning/__tests__/design.test.ts` → `GamePlanPatchSchema.parse(patch)` non lancia
- [ ] `npx tsc --noEmit` → 0 errori

**Output di fase**: `lib/reasoning/intent.ts` + `lib/reasoning/design.ts` (brief → GamePlan v0 + refine).

---

### [2-W1] — Gate D.3 Consistency Manager + D.4 Balance Controller

**Dipendenze**: `[1-W1]`.

**Prompt operativo**:
```
Implementa D.3 e D.4 in lib/reasoning/.

D.3 ConsistencyManager.validate(input: ConsistencyManagerInput) →
  ConsistencyManagerOutput { valid, soft_locks[], corrections[] }. Riusa
  findDirectedGatingCycle(graph) da lib/contracts/game-graph.contract.ts come
  pre-filtro rapido. Un world_graph con un gating ciclico/irraggiungibile deve
  produrre soft_locks non vuoto e valid=false. È il GATE: enforce
  SOFT_LOCK_COUNT_MAX (=0) da evaluation-metrics.contract.ts.

D.4 BalanceController.balance(input: BalanceControllerInput) →
  BalanceControllerOutput { balanced_plan, adjustments[], memory }. Clampa
  plan.rules dentro rules_ranges; ogni clamp produce un adjustment
  {rule_name, before, after, reason}.
```

**Criteri DONE**:
- [ ] test: world_graph con soft-lock → `output.soft_locks.length > 0` e `valid === false`
- [ ] test: world_graph valido → `soft_locks.length === 0`
- [ ] test: una rule fuori range → presente in `adjustments` e `balanced_plan` clampato
- [ ] `npx tsc --noEmit` + `npx vitest run` → verdi

**Output di fase**: `lib/reasoning/consistency.ts` (gate soft-lock) + `lib/reasoning/balance.ts`.

---

### [3-W1] — D.5 Execution Orchestrator + Hermes loop

**Dipendenze**: `[2-W1]`; mock `tools.mock.ts`, `runtime.mock.ts`.

**Prompt operativo**:
```
Implementa D.5 ExecutionOrchestrator.materialize + l'Hermes loop
(HermesOrchestrator.run) in lib/orchestrator/.

D.5: esegue plan.execution_dag topologicamente. Per ogni nodo invoca il tool via
  import { invokeTool, invokeToolBatch } from '@/lib/_mocks/tools.mock'
  (sostituito al merge W2). Costruisce la build via
  import { runtimeBuild } from '@/lib/_mocks/runtime.mock' (sostituito al merge W3).
  Ritorna ExecutionOrchestratorOutput { build_artifact_id, node_results[],
  smoke_test_report, total_cost_usd, total_latency_ms, memory }.

Hermes loop: lib/orchestrator/hermes.ts implementa HermesOrchestrator.run
  (HermesPlanRequest → HermesPlanResponse): D.1 → D.2 → D.3 (gate) → D.4 → D.5 →
  D.6 (mock per ora), con memoria 3-livelli (HermesMemorySchema). Questa funzione
  sostituirà runHermesPlan di orchestrator.mock.ts.

<!-- FIX A2: scope esplicito del backend game-plan-versioning (day-1 vs F2) -->
Game-plan versioning (lib/game-plan-versioning/, BOM B.1 di EXECUTION_ARCHITECTURE.md):
  scope DAY-1 = persistere una nuova versione del piano dato un GamePlanPatch
  (RFC 6902 emesso da D.2) via la RPC public.apply_game_plan_diff(p_project_id,
  p_parent_version, p_new_version, p_patch, p_materialized_plan, p_summary) di
  migration 005, con il controllo di optimistic-concurrency su parent_version.
  Scope F2 (NON in questo piano) = applicazione/replay interattivo del patch chain
  + undo/redo nello Studio Mode UI (W4).
```

**Criteri DONE**:
- [ ] test: `HermesPlanResponseSchema.parse(await run(request))` non lancia
- [ ] test: `node_results` ha un entry per ogni nodo del dag; status ∈ enum contratto
- [ ] test: il dag rispetta `depends_on` (ordine topologico verificato)
<!-- FIX A2: criterio per il backend versioning (day-1 = persist patch via apply_game_plan_diff) -->
- [ ] test: dato un `GamePlanPatch`, `apply_game_plan_diff(...)` crea una nuova
      `game_plan_versions` row; un parent_version errato → l'RPC solleva
      `parent_version_mismatch` (optimistic concurrency)
- [ ] `npx tsc --noEmit` + `npx vitest run` → verdi

**Output di fase**: `lib/orchestrator/hermes.ts` (sostituto reale di `orchestrator.mock.ts`) + `lib/reasoning/execution.ts` + `lib/game-plan-versioning/` (persist patch day-1; replay/UI = F2).

---

### [4-W1] — D.6 Evaluation Agent (smoke gate)

<!-- FIX A3: nota merge-order resa precisa (W1 è terzo a mergiare: W2 e W3 già reali) -->
**Dipendenze**: `[3-W1]`. I mock di W1 (`llm.mock`, `tools.mock`, `runtime.mock`)
vengono sostituiti col reale **al merge di W1 stesso** — che nel merge order
W2→W3→W1→W4 avviene dopo W2 e W3, già integrati su `main`.

**Prompt operativo**:
```
Implementa D.6 EvaluationAgent.evaluate(input: EvaluationAgentInput) →
  EvaluationAgentOutput { report: EvaluationReport, refinement_request, memory }.
Il report contiene verdicts (MetricVerdictSchema) per le 6 metriche di
evaluation-metrics.contract.ts; overall_passed = tutti passati. Lo smoke gate usa
SmokeTestReportSchema (da runtime). num_playtests default 10 (Playtester completo
= FF: per il day-1 basta lo smoke pass + i verdetti deterministici su
soft_lock/cost/time). Se overall_passed=false, emette refinement_request per D.2.
```

**Criteri DONE**:
- [ ] test: `EvaluationReportSchema.parse(output.report)` non lancia
- [ ] test: smoke fail → `overall_passed === false` e `refinement_request !== null`
- [ ] test: tutti i verdetti pass → `overall_passed === true`
- [ ] `npx tsc --noEmit` + `npx vitest run` → verdi

**Output di fase**: `lib/reasoning/evaluation.ts` (gate finale del loop).

---

### [5-W1] — Flywheel EMA: usage_events → success_score

<!-- FIX A1: aggiunta migration 006 (evento fork) alle dipendenze -->
**Dipendenze**: `[4-W1]`; migration 005 (RPC `update_episodic_memory`); 003
(`increment_asset_usage`); **migration 006** (evento `fork`, da G.0 in `[0.1]`).

**Prompt operativo**:
```
Implementa lib/episodic-memory/ che chiude l'anello del flywheel.
Quando un evento utente di valore arriva in usage_events (game_completed,
game_exported_itch, fork — fork richiede migration 006 applicata), aggiorna il
success_score:
- per skill (user, skill_name): RPC public.update_episodic_memory(p_user_id,
  p_skill_name, p_success) — formula EMA new = old*0.95 + (success?1:0)*0.05.
- per asset usati nella generazione: RPC public.increment_asset_usage(p_asset_id,
  p_success).
Definisci la mappa evento→success: game_completed/exported/fork = success=true;
rigenerazione entro X = success=false. Documenta la regola.
```

**Criteri DONE**:
- [ ] test integrazione: dopo `update_episodic_memory(u, s, true)`, query
      `SELECT success_score FROM episodic_memory WHERE user_id=u AND skill_name=s`
      → valore = `old*0.95 + 0.05` (verifica formula)
- [ ] test: secondo evento success → score cresce monotonicamente verso 1
- [ ] `npx tsc --noEmit` + `npx vitest run` → verdi

**Output di fase**: `lib/episodic-memory/` — il moat di auto-miglioramento acceso dal primo evento utente.

---

## W2 — Tools / LLM Router / Porte generative

> Branch `ws/w2-tools-llm`. **Primo nel merge order.** Espone i mock
> `tools.mock.ts` / `llm.mock.ts` agli altri (li tiene in sync con le firme reali).

### [1-W2] — LLM Router (Azure primario + cost cap)

**Dipendenze**: `v0.1.0-contracts`; env `AZURE_OPENAI_*`, `UPSTASH_REDIS_*`.

**Prompt operativo**:
```
Implementa lib/llm/router.ts come adattatore della porta LlmPort.
- Adattatore primario: Azure AI Foundry (openai SDK con baseURL Azure +
  api-version + deployment per modello). Gestisci NELL'adattatore i vincoli
  Claude-su-Azure: per claude-opus/sonnet NON inviare temperature/top_k/thinking;
  top_p=0.99. Routing: ≥60% task → DeepSeek (bulk/code), reasoning → Claude Sonnet.
- Adattatore alternativo: OpenRouter (openai SDK + baseURL openrouter) dietro
  flag/env. NON usare Helicone.
- structured output: valida l'output col response_schema Zod passato (come
  fa llm.mock.ts: complete() con response_schema).
- lib/llm/embed.ts: text-embedding-3-small (riusa il pattern di lib/knowledge.ts).
- lib/llm/cost-tracker.ts: budget per-utente su Upstash Redis; blocca sopra
  GENERATION_COST_USD_MAX (per Free) leggendo evaluation-metrics.contract.ts.
Aggiorna lib/_mocks/llm.mock.ts se le firme cambiano (resta in sync).
```

**Criteri DONE**:
- [ ] test: `complete({model, user, response_schema, trace_id})` ritorna output che
      `response_schema.parse()` accetta
- [ ] test: cost-tracker blocca quando il budget supererebbe la soglia (assert su throw/return)
- [ ] test (mock Azure): nessun `temperature` nel payload quando model = claude-*
- [ ] `npx tsc --noEmit` + `npx vitest run` → verdi

**Output di fase**: `lib/llm/{router,embed,cost-tracker}.ts` — `LlmPort` reale.

---

### [2-W2] — Tool verticale FREE (5 code_gen + resolver + validator + byoa)

**Dipendenze**: `[1-W2]`; `lib/knowledge.ts` (`getReferences`); RPC `match_assets`
(003); babylon tool-id `[dipende da v0.1.0-contracts]`.

**Prompt operativo**:
```
Implementa in lib/tools/ i tool FREE della verticale wow. Ogni tool è un
ToolDescriptor (lib/contracts/tool-registry.contract.ts): id, inputSchema,
outputSchema (estendono ToolInput/OutputBase), handler. handler ritorna
ToolExecutionResultSchema valido.

code/ : code_gen_godot_gdscript, code_gen_phaser_js, code_gen_threejs_ts,
  code_gen_babylon_ts, code_gen_defold_lua.
  - I code_gen chiamano getReferences() di lib/knowledge.ts per il RAG grounding
    (Godot/Defold hanno KB densa; Phaser/Three.js generano bene anche senza).
  - code_gen_babylon_ts: NESSUN harvest KB. Includi nel prompt un grounding
    curato (file lib/tools/code/babylon/_grounding.ts) con snippet canonici per
    NullEngine / fisica Havok / GLTFLoader presi dalla doc ufficiale Babylon.
  - usano il router lib/llm/router.ts (reale, già su questo branch).
sprite/ : sprite_gen (preferisce CC0 via asset_resolver; FLUX solo se paywall).
extras/ : byoa_analyzer (Vision sull'immagine utente → palette/stile per style pack).
asset-resolver/ : asset_resolver — query match_assets RPC (CC0-first, soglia 0.78;
  usa CC0 se score>0.85, altrimenti segnala fallback generativo).
qa/ : code_validator, project_validator (lint/parse engine-specifico).
Aggiorna lib/_mocks/tools.mock.ts in sync.
```

**Criteri DONE**:
- [ ] test: ogni tool handler ritorna oggetto che `ToolExecutionResultSchema.parse()` accetta
- [ ] test: `code_gen_godot_gdscript` chiama `getReferences()` (spy/mock assertion)
- [ ] test: `asset_resolver` con match≥0.85 ritorna `source:"catalog"`; sotto → segnala generativo
- [ ] `grep -r "NullEngine" lib/tools/code/babylon/` → grounding presente
<!-- FIX A7: vincolo economico — sprite_gen su tier free NON deve usare FLUX (solo CC0) -->
- [ ] test: `sprite_gen` con tier=free NON istanzia/chiama `ImageGenPort` (FLUX);
      usa solo `asset_resolver`/CC0 (assert che l'adattatore generativo non è invocato)
- [ ] `npx tsc --noEmit` + `npx vitest run` → verdi

**Output di fase**: `lib/tools/` (verticale FREE) — `ToolPort` reale per i 5 motori.

---

### [3-W2] — Porte generative PAY (Audio / 3D / Image)

**Dipendenze**: `[1-W2]`; `generative.contract.ts` + `generative.mock.ts`
`[dipende da v0.1.0-contracts]`; RPC `check_quota` (005).

**Prompt operativo**:
```
Implementa gli adattatori reali delle porte generative di
lib/contracts/generative.contract.ts (sostituiscono generative.mock.ts):
- lib/tools/audio/ → AudioGenPort: bgm_gen (Suno HTTP), sfx_gen + voice_gen
  (ElevenLabs SDK).
- lib/tools/3d/ → Model3DPort: model_3d_gen (Meshy / Replicate TRELLIS.2),
  animation_3d_gen, texture_gen.
- lib/tools/sprite/ → ImageGenPort: sprite premium / tileset (Replicate FLUX/SDXL
  + LoRA da match_loras).
Tutti gated: prima di eseguire, chiama RPC public.check_quota(clerk_user_id,
tool_id, estimated_cost_usd, counts_toward_monthly); se tier=free → rifiuta con
reason. Registra il costo reale via record_tool_execution.
```

**Criteri DONE**:
- [ ] test: ogni adattatore ritorna la shape della porta (Zod parse ok)
- [ ] test: `check_quota` con tier free + tool generativo → `allowed=false`
- [ ] test: tier creator → `allowed=true`
- [ ] `npx tsc --noEmit` + `npx vitest run` → verdi

**Output di fase**: `lib/tools/{audio,3d,sprite}/` — `AudioGenPort`/`Model3DPort`/`ImageGenPort` reali, gated.

---

### [4-W2] — WorldGenPort (Marble) — adattatore + smoke interno

**Dipendenze**: `[1-W2]`; `worldgen.mock.ts` `[dipende da v0.1.0-contracts]`;
env `WORLDLABS_API_KEY` (account API paid).

**Prompt operativo**:
```
Implementa lib/asset-resolver/worldgen.ts (o lib/tools/world/) come adattatore
reale di WorldGenPort (generative.contract.ts). generateWorld(input) chiama la
World Labs Marble API (~$1.20/mondo), ritorna { glb_url (collider GLB),
splat_url } validati. SOLO test di integrazione interno (account API paid è
legale per il test; NON è ancora feature-utente — serve Order Form per il volume,
vedi COMPETITIVE_LANDSCAPE_2026.md §6). Marca chiaramente come "internal test".
```

**Criteri DONE**:
- [ ] test integrazione: `generateWorld()` ritorna un `glb_url` non vuoto
- [ ] il GLB scaricato è caricabile (smoke: header glTF valido)
- [ ] codice marcato "internal test — not user-facing (Order Form gate)"
- [ ] `npx tsc --noEmit` + `npx vitest run` → verdi

**Output di fase**: `WorldGenPort` reale (test interno) — valida tecnicamente Marble per la Fase 2.

---

## W3 — Runtime / Engine Adapters / Sandbox / Storage

> Branch `ws/w3-runtime-engines`. **Secondo nel merge order.** Interfacce in
> `lib/contracts/assembly-pipeline.contract.ts`. Espone `runtime.mock.ts`.

### [1-W3] — E2B sandbox + R2 storage + Trigger.dev base

**Dipendenze**: `v0.1.0-contracts`; env `E2B_API_KEY`, `R2_*`, `TRIGGER_*`; mock
`baas.mock.ts` (`e2bMock`, `r2Mock`, `triggerMock`) per i test.

**Prompt operativo**:
```
Implementa lib/runtime/sandbox/e2b.ts: wrapper E2B che soddisfa SandboxHandle
(assembly-pipeline.contract.ts): bootSandbox, writeFile, runCommand, close.
Implementa l'upload R2 (@aws-sdk/client-s3) → r2_object_key + signed URL.
Implementa l'entrypoint Trigger.dev per il job di assembly (task lungo).
In test usa e2bMock/r2Mock/triggerMock di baas.mock.ts (no rete).
```

**Criteri DONE**:
- [ ] test (mock): boot → writeFile → runCommand ritorna CommandResult valido
- [ ] test (mock): upload R2 → signed URL non vuoto
- [ ] `npx tsc --noEmit` + `npx vitest run` → verdi

**Output di fase**: `lib/runtime/sandbox/` + R2 helper — fondamenta runtime.

---

### [2-W3] — Engine adapter Phaser + Three.js (browser-native)

**Dipendenze**: `[1-W3]`.

**Prompt operativo**:
```
Implementa lib/runtime/engines/phaser.ts e threejs.ts come EngineAdapter
(assembly-pipeline.contract.ts): build, smokeTest, package. Essendo JS/TS
browser-native, build ≈ bundle (esbuild/vite) e smokeTest = avvio headless con
un JS runner (es. headless Chromium/playwright nel sandbox) che carica il bundle
e rileva errori console/crash per ~10s. package = .zip in R2.
```

**Criteri DONE**:
- [ ] test: progetto Phaser di prova → `build()` exit_code 0
- [ ] test: `smokeTest()` su progetto sano → `passed=true`; su progetto con throw → `passed=false, crash_reason!=null`
- [ ] `npx tsc --noEmit` + `npx vitest run` → verdi

**Output di fase**: adapter Phaser + Three.js funzionanti.

---

### [3-W3] — Engine adapter Godot (WASM headless) + Defold (.apk native)

**Dipendenze**: `[1-W3]`; template E2B con toolchain Godot headless + Defold (bob).

**Prompt operativo**:
```
Implementa lib/runtime/engines/godot.ts e defold.ts come EngineAdapter.
godot.ts: build = export Godot headless (godot --headless --export-release) verso
  preset Web (WASM) + iniezione coi-serviceworker; smokeTest = caricamento WASM
  headless + crash detection.
defold.ts: build = bob.jar headless; .apk native via export Android; smokeTest =
  smoke headless ufficiale Defold "senza grafica/suono" (unit/smoke su CI exe).
Documenta i binari richiesti nel template E2B (W3 owns il template).
```

**Criteri DONE**:
- [ ] test: Godot progetto di prova → export WASM produce i file attesi
- [ ] test: Defold → `.apk` prodotto + smoke headless `passed=true`
- [ ] `npx tsc --noEmit` + `npx vitest run` → verdi

**Output di fase**: adapter Godot (WASM) + Defold (.apk native verificato).

---

### [4-W3] — Engine adapter Babylon (NullEngine headless)

**Dipendenze**: `[1-W3]`; babylon in EngineEnum `[dipende da v0.1.0-contracts]`.

**Prompt operativo**:
```
Implementa lib/runtime/engines/babylon.ts come EngineAdapter. build = bundle TS;
smokeTest = esegue la scena in BABYLON.NullEngine (headless, no GPU/canvas) in
Node nel sandbox, fa avanzare N frame, rileva eccezioni/crash. È il vantaggio
unico di Babylon per la verifica server-side. package = .zip in R2.
```

**Criteri DONE**:
- [ ] test: scena Babylon valida → NullEngine avanza i frame, `passed=true`
- [ ] test: scena con errore → `passed=false, crash_reason!=null`
- [ ] `npx tsc --noEmit` + `npx vitest run` → verdi

**Output di fase**: adapter Babylon con verifica NullEngine.

---

### [5-W3] — webExport() su tutti e 5 + smoke end-to-end

**Dipendenze**: `[2-W3]` `[3-W3]` `[4-W3]`; `webExport`/`WebBuildArtifact`
`[dipende da v0.1.0-contracts]`.

**Prompt operativo**:
```
Implementa webExport(sandbox) su tutti e 5 gli adapter (ritorna WebBuildArtifact:
iframe_url servito da R2, bundle_size_bytes, target browser|pwa, mobile_apk_url
per Defold). Per Phaser/Three.js/Babylon ≈ identità del bundle; per Godot/Defold
= export WASM. Implementa l'Assembler (lib/runtime/assembler/) che soddisfa
AssemblerInput/Output e sostituisce runtimeBuild di runtime.mock.ts. Calcola la
smoke test pass rate aggregata e confrontala con SMOKE_TEST_PASS_RATE_MIN.
```

**Criteri DONE**:
- [ ] test: ogni adapter `webExport()` ritorna `WebBuildArtifact` con `iframe_url` non vuoto
- [ ] test: l'Assembler ritorna `AssemblerOutputSchema` valido (sostituto del mock)
- [ ] test: pass rate calcolata e confrontata con `SMOKE_TEST_PASS_RATE_MIN`
- [ ] `npx tsc --noEmit` + `npx vitest run` → verdi

**Output di fase**: `lib/runtime/assembler/` reale + `webExport` su 5 motori → `RuntimePort` completo.

---

## W4 — Frontend / Auth / Billing / Feed

> Branch `ws/w4-frontend-billing`. **Ultimo nel merge order.** Consuma
> `orchestrator.mock.ts` (`runHermesPlan`) e `runtime.mock.ts`. SDK diretti per
> Clerk/Stripe/PostHog (no porte — `EXECUTION_ARCHITECTURE.md` Parte A).

### [1-W4] — Clerk auth + Vercel deploy + layout shell

**Dipendenze**: `v0.1.0-contracts`; env `CLERK_*`; mock `baas.mock.ts` (`clerkMock`).

**Prompt operativo**:
```
Scaffolda app/ (Next.js 14 App Router) + components/ (Tailwind + shadcn).
Integra Clerk (@clerk/nextjs) per auth: ClerkProvider, middleware, sign-in/up.
Webhook Clerk → upsert in tabella users (clerk_user_id). Layout shell con
sidebar dipartimenti. Deploy su Vercel. In test usa clerkMock di baas.mock.ts.
Strategia UI: parti dai cloni di riferimento (AI Website Cloner + Frontend Design
plugin) per landing/dashboard; Higgsfield Cinema Studio come pattern per lo
Studio Mode (Fase 2). Vedi EXECUTION_ARCHITECTURE.md Parte D.
```

**Criteri DONE**:
- [ ] `npx tsc --noEmit` → 0; build Next.js `next build` → success
<!-- FIX A5: criterio binario al posto di "(manuale)" — verifica programmatica del webhook -->
- [ ] test: il webhook handler, dato un payload Clerk simulato (via `clerkMock`),
      fa upsert in `users`; query `SELECT count(*) FROM users WHERE clerk_user_id='<test_id>'` → 1.
      (Il login Clerk reale è verificato solo nel Gate E2E.)
- [ ] deploy Vercel → URL live

**Output di fase**: shell auth + deploy — base del frontend.

---

### [2-W4] — Creator Mode 5-step (con mock)

**Dipendenze**: `[1-W4]`; mock `orchestrator.mock.ts` (`runHermesPlan`).

**Prompt operativo**:
```
Implementa il Creator Mode (app/(creator)/) nei 5 step di WOW_CONTRACT.md §10:
1) welcome: campo prompt + upload BYOA (moodboard_image_urls);
2) engine picker (5 motori, badge "consigliato");
3) piano: mostra execution_dag + costi/tempi stimati;
4) generazione live: progress per node_results;
5) output: player + download + "Apri in Studio".
Backend via import { runHermesPlan } from '@/lib/_mocks/orchestrator.mock'
(sostituito al merge W1). Bind la UI ai CAMPI di HermesPlanResponse, non ai valori.
```

**Criteri DONE**:
- [ ] test e2e (playwright/webapp-testing): flusso 5-step gira coi mock
- [ ] la UI mostra un `node_results`/progress da `HermesPlanResponse`
- [ ] `npx tsc --noEmit` + `next build` → verdi

**Output di fase**: Creator Mode funzionante (coi mock) — la verticale UI del wow.

---

### [3-W4] — Feed iframe player + PWA + touch

**Dipendenze**: `[2-W4]`; `webExport`/`iframe_url` `[dipende da v0.1.0-contracts]`
(consumato via `runtime.mock` finché W3 non merge).

**Prompt operativo**:
```
Implementa il feed play-in-place: lista scrollabile di giochi; tap → carica
WebBuildArtifact.iframe_url in un <iframe sandbox> (origine separata, es.
games.<dominio>). SDK iniettato nel gioco emette postMessage(eventi) → la webapp
li traccia in usage_events. Aggiungi PWA manifest + service worker (installabile
su mobile) + input touch. Il bundle viene da runtime.mock (runtimeBuild) finché
W3 non merge.
```

**Criteri DONE**:
- [ ] test: gioco mock carica in `<iframe sandbox>`; `postMessage` ricevuto → riga in `usage_events`
<!-- FIX A6: criterio PWA unico e programmatico (no "o ..." ambiguo, no Lighthouse interattivo) -->
- [ ] test: `manifest.json` valido secondo la W3C Web App Manifest spec (campi
      obbligatori name/short_name/start_url/display/icons presenti e ben formati)
      E service worker registrato e attivo (assert su `navigator.serviceWorker`
      o equivalente script CI)
- [ ] `npx tsc --noEmit` + `next build` → verdi

**Output di fase**: feed + player iframe + PWA — il consumo stile Astrocade con output posseduto.

---

### [4-W4] — Paywall a crediti + Stripe + Tip Jar

**Dipendenze**: `[1-W4]`; RPC `check_quota` (005); env `STRIPE_*`; mock `stripeMock`.

**Prompt operativo**:
```
Implementa lib/billing/: Stripe checkout per i tier (free/creator/pro/studio,
TIER_DEFINITIONS di billing.contract.ts), webhook Stripe → aggiorna users.tier.
Paywall: il generativo (audio/3d/sprite premium) è gated via check_quota — Free =
solo CC0+LLM. Modello a budget-crediti, MAI illimitato sul generativo (WOW_CONTRACT
§9). Tip Jar: Stripe diretto, 0% fee (stile Rosebud). In test usa stripeMock.
```

**Criteri DONE**:
- [ ] test: utente free + azione generativa → bloccato (`check_quota allowed=false`)
- [ ] test: checkout Stripe (mock) → ritorna url; webhook → `users.tier` aggiornato
- [ ] Tip Jar: flusso Stripe diretto presente
- [ ] `npx tsc --noEmit` + `next build` → verdi

**Output di fase**: `lib/billing/` — paywall bootstrap-safe + monetizzazione creator.

---

### [5-W4] — PostHog flywheel + badge/fork + analytics

<!-- FIX A1: aggiunta migration 006 (evento fork) alle dipendenze -->
**Dipendenze**: `[2-W4]` `[4-W4]`; env `POSTHOG_*`; tabella `usage_events`;
**migration 006** (evento `fork`, da G.0 in `[0.1]`).

**Prompt operativo**:
```
Implementa lib/analytics/ (posthog-js + posthog-node): cattura gli eventi
usage_events (game_started/completed/exported/fork) → PostHog E Supabase (il
flywheel di W1 li consuma). Badge "verificato: gira / bilanciato / 0 soft-lock"
renderizzato da EvaluationReport.verdicts. Bottone "Fork" → crea un nuovo project
dallo stesso brief/template (evento fork = success per il flywheel).
```

**Criteri DONE**:
- [ ] test: un'azione utente → evento in PostHog (mock) + riga in `usage_events`
- [ ] badge mostra i verdetti da un `EvaluationReport` di esempio
- [ ] fork → nuovo `projects` row + evento `fork`
- [ ] `npx tsc --noEmit` + `next build` → verdi

**Output di fase**: analytics + badge wow + loop virale fork — chiude il ciclo di crescita.

---

## GATE DI LANCIO — verifica end-to-end (run reali, no mock)

**Dipendenze**: merge completo **W2 → W3 → W1 → W4** su `main`; tutti gli env reali
(Azure deployment, E2B, R2, Trigger.dev, Clerk, Stripe, Supabase).

**Prompt operativo**:
```
Esegui la verifica end-to-end di lancio su run REALI (nessun mock), su una
matrice di 5 motori (godot, phaser, threejs, babylon, defold) × 3-5 generi del
WOW_CONTRACT (es. platformer, roguelike, browser-arcade, 3D-showcase, mobile-
puzzle). Per ogni run: brief → Hermes → genera → assembla → webExport → smoke.
Raccogli per ogni run i 6 verdetti di evaluation-metrics.contract.ts + i 3
criteri prerogativa (webExport ok / PWA installabile / .apk Defold smoke pass).
Logga costi reali in tool_executions e build in build_artifacts. Produci un
report go/no-go.
```

**Criteri DONE (binari)**:
- [ ] smoke test pass rate ≥ `SMOKE_TEST_PASS_RATE_MIN` (0.95) sulle run
- [ ] `soft_lock_count` = 0 su tutte le run (`SOFT_LOCK_COUNT_MAX`)
- [ ] stress curve RMSE < `STRESS_CURVE_RMSE_MAX` (0.15) dove misurato
- [ ] aesthetic coherence ≥ `AESTHETIC_COHERENCE_MIN` (0.75)
- [ ] costo/gioco Free < `GENERATION_COST_USD_MAX` (1.5)
- [ ] tempo/gioco < `GENERATION_TIME_SECONDS_MAX` (900s)
- [ ] `webExport` ritorna `iframe_url` valido su 100% delle run
<!-- FIX A6-bis: prerogativa PWA aggiunta ai criteri del Gate (10° criterio) -->
- [ ] PWA installabile verificata (manifest valido + service worker attivo): ✅ su tutte le build
- [ ] ≥1 .apk Defold passa lo smoke headless
- [ ] ≥80% delle run passano TUTTI i verdetti (evaluation gate)

**Output di fase**: report **go/no-go** di lancio day-1. Se go → annuncio + Founding
Worlds (`COMPETITIVE_LANDSCAPE_2026.md` / GTM).
