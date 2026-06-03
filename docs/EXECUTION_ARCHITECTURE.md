# EXECUTION ARCHITECTURE — l'inventario esagonale del day-1 MVP

**Data**: 2026-06-03
**Status**: documento certosino di architettura esecutiva. È il bill-of-materials
dell'MVP day-1: ogni cosa da integrare → porta esagonale → workstream → fase →
done. **Base per generare il piano di esecuzione** (prompt per fase/sottofase,
verifiche, diviso ermeticamente per workstream).
**Companion**: [WOW_CONTRACT.md](WOW_CONTRACT.md) (il "cosa"),
[COMPETITIVE_LANDSCAPE_2026.md](COMPETITIVE_LANDSCAPE_2026.md) (il "perché"),
[KB_STATE.md](KB_STATE.md) (numeri KB dal DB),
[CONCURRENT_DEVELOPMENT_MANIFESTO.md](CONCURRENT_DEVELOPMENT_MANIFESTO.md) (W1-W4 + BaaS).

> Tutto qui è ancorato al codice reale (7 contratti, 48 tool-id, 19 tabelle, 10
> RPC, 5 mock, ~19 directory workstream, 50 env var) — non alla memoria. Le
> aggiunte non ancora a contratto sono marcate **[PROPOSTA Fase 0]** (Parte G).

---

## Parte A — Architettura esagonale (lista CHIUSA di porte)

Il **dominio** (W1: reasoning + Hermes + GamePlan + flywheel) è puro: opera su
`GamePlan`/`GameGraph` (già tipati) e parla al mondo SOLO via porte. I motori,
i provider generativi, i BaaS sono **adattatori** intercambiabili alla periferia.
Questo è ciò che rende il dominio testabile offline e i provider sostituibili.

### Le porte (lista chiusa — non aggiungerne senza motivo)

| Porta | Adattatori day-1 | Mock | Owner | Stato contratto |
|---|---|---|---|---|
| `LlmPort` | **Azure AI Foundry (primario in testing)** / OpenRouter (alt/prod) | `llm.mock.ts` ✅ | W2 | da formalizzare (mock esiste) |
| `ToolPort` | i tool via Trigger.dev | `tools.mock.ts` ✅ | W2 | `ToolInvocation`/`ToolExecutionResult` ✅; per-tool **[PROPOSTA]** |
| `KnowledgePort` | `lib/knowledge.ts` | — (foundation) | foundation | ✅ esiste (`getReferences` ecc.) |
| `AssetPort` | `match_assets`/`match_loras` RPC + gen fallback | — | W2 | RPC ✅ (migration 003) |
| `RuntimePort` / `EngineAdapter` | 5 engine adapter | `runtime.mock.ts` ✅ | W3 | `EngineAdapter` ✅; `webExport()` **[PROPOSTA]** |
| `AudioGenPort` | Suno (BGM) + ElevenLabs (SFX/voci) | — | W2 | **[PROPOSTA]** generative.contract.ts |
| `Model3DPort` | Meshy / TRELLIS.2 / Tripo | — | W2 | **[PROPOSTA]** |
| `ImageGenPort` | Replicate (FLUX/SDXL + LoRA) | — | W2 | **[PROPOSTA]** |
| `WorldGenPort` | World Labs Marble | — | W3 | **[PROPOSTA]** |
| `MemoryStore` | Supabase (episodic/long-term) | `baas.mock.ts` parz. | W1 | tabelle ✅ (005) |
| `Telemetry` | PostHog + standup JSONL + `tool_executions` (Langfuse opz. F2) | `baas.mock.ts` parz. | W4 | — |

> **Nota `LlmPort` (decisione giugno 2026)**: in testing l'adattatore primario è
> **Azure AI Foundry** (account con quote alte, fatturazione a fine mese, no fee
> — vs OpenRouter pay-per-token + 5.5% fee). Catalogo Azure verificato: Claude
> (Opus 4.8/Sonnet 4.6/Haiku 4.5), DeepSeek (V4-Pro/Flash), GPT, Codestral —
> copre tutto il routing. Sfumature da gestire NELL'adattatore: (a) ogni modello
> partner = un deployment + sottoscrizione Marketplace (Claude); (b) Claude su
> Azure ha vincoli (`temperature`/`top_k`/`thinking` non supportati su Opus,
> `top_p`=0.99); (c) serve account pay-as-you-go reale, non a soli crediti.
> OpenRouter resta adattatore alternativo (prod / BYOK). Cambiare gateway =
> cambiare adattatore, non il dominio.

> **Nota `Telemetry` (decisione giugno 2026)**: **Helicone è in maintenance mode**
> (acquisito da Mintlify, mar-2026) e il suo proxy classico copre solo Azure
> OpenAI, non i partner Claude/DeepSeek → **NON cablarlo**. Per il testing basta
> `tool_executions` (cost_usd/latency_ms/trace_id, migration 005) + Azure Monitor
> + standup JSONL. Per observability granulare in Fase 2: **Langfuse** (MIT,
> attivo, self-host gratis senza limiti, supporta Azure+Claude+DeepSeek, trace
> multi-step per costo-per-generazione) come adattatore raccomandato.

### DOVE NON mettere porte (regola anti-over-engineering)

Il rischio dell'esagonale fatto male è l'astrazione inutile. La regola del
progetto (CLAUDE.md §2 "No abstractions for single-use code") vince:

- **Clerk, Stripe, Resend, Knock, Loops, Crisp, Dub, Sentry → SDK diretti in W4.**
  Il dominio (reasoning) non li tocca mai. Avvolgerli in porte di dominio è
  indirezione a valore zero.
- **Niente mapper DTO↔dominio**: gli schemi Zod di `lib/contracts/` SONO i
  modelli di confine. Non duplicare con un secondo layer di "domain entities".
- **Niente container DI pesante** (Inversify ecc.): un **composition root**
  leggero per ambiente — una funzione `buildHermesEngine({ llm, tools, knowledge,
  asset, runtime, audioGen, model3d, imageGen, worldGen, memory, telemetry })`
  che riceve gli adattatori e li passa al dominio. In test → i mock; in prod →
  i reali. Il pattern `process.env.USE_MOCKS` del Manifesto §02.3 è il seme.

**Payoff**: il Reasoning Engine (il cuore di valore) gira end-to-end offline
contro adattatori mock, a costo zero — cruciale per un sistema dove ogni run
reale costa tempo e denaro.

---

## Parte B — Bill of materials del day-1 MVP

Ogni elemento → porta → adattatore/provider → workstream → fase → done.
Marcatura: **FREE** (day-1, tier gratuito) · **PAY** (day-1, dietro paywall) ·
**FF** (fast-follow) · **F2** (Fase 2).

### B.1 — Reasoning Engine + Orchestrator (W1)

Interfacce già in [`reasoning-engine.contract.ts`](../lib/contracts/reasoning-engine.contract.ts).

| Modulo | Porta interfaccia | Marcatura | Done quando |
|---|---|---|---|
| D.1 Intent Interpreter | `IntentInterpreter.propose` | FREE | da brief+BYOA → `GamePlan` v0 + rationale |
| D.2 Design Planner | `DesignPlanner.refine` | FREE | full_plan o RFC-6902 patch |
| D.3 Consistency Manager | `ConsistencyManager.validate` | FREE **(gate)** | `soft_locks=[]` (ASP); usa `findDirectedGatingCycle` |
| D.4 Balance Controller | `BalanceController.balance` | FREE | rules clampate nei range del genre template |
| D.5 Execution Orchestrator | `ExecutionOrchestrator.materialize` | FREE | esegue `execution_dag` → `build_artifact_id` |
| D.6 Evaluation Agent | `EvaluationAgent.evaluate` | FREE **(gate)** | smoke pass; Playtester completo = FF |
| Hermes Orchestrator | `HermesOrchestrator.run` | FREE | loop 3-memory; emette `HermesPlanResponse` |
| Episodic Memory (EMA) | `MemoryStore` + `update_episodic_memory` | FREE | EMA 0.95/0.05 su (user, skill) |
| Game-Plan versioning | `apply_game_plan_diff` (RPC 005) | FREE | patch chain RFC 6902 |

### B.2 — Tool (W2) — sottoinsieme dei 48 di [`tool-registry.contract.ts`](../lib/contracts/tool-registry.contract.ts)

| Tool-id | Porta | Marcatura |
|---|---|---|
| `code_gen_godot_gdscript` | ToolPort + KnowledgePort | FREE |
| `code_gen_phaser_js` | ToolPort | FREE |
| `code_gen_threejs_ts` | ToolPort | FREE |
| `code_gen_babylon_ts` **[PROPOSTA]** | ToolPort | FREE |
| `code_gen_defold_lua` | ToolPort + KnowledgePort | FREE |
| `sprite_gen` | ImageGenPort (o AssetPort se CC0) | FREE (CC0) / PAY (FLUX) |
| `asset_resolver` | AssetPort | FREE |
| `code_validator`, `project_validator` | ToolPort | FREE |
| `smoke_test_runner` | RuntimePort | FREE **(gate)** |
| `godot/phaser/threejs/babylon*/defold _assembler` | RuntimePort | FREE |
| `itch_packager` | RuntimePort (butler) | FREE |
| `byoa_analyzer` | ImageGenPort/Vision + style-inference | FREE |
| `model_3d_gen`, `animation_3d_gen`, `texture_gen`, `hdri_gen` | Model3DPort | PAY |
| `bgm_gen`, `sfx_gen`, `voice_gen` | AudioGenPort | PAY |
| `tileset_gen`, `ui_element_gen`, `icon_gen`, `concept_art_gen` | ImageGenPort | PAY |
| `playtest_simulator` (completo) | RuntimePort | FF |
| `level_layout_2d/3d`, `tilemap_populate`, `entity_placement`, `heightmap_gen` | ToolPort | FF/F2 |
| `shader_gen_glsl/hlsl/godot` | ToolPort | F2 |
| `store_page_gen`, `stream_mode`, `portfolio_gen`, `jam_mode`, `ai_coach`, `npc_plugin` | ToolPort | F2 |
| `code_gen_renpy/monogame/love2d/stride` + relativi assembler | ToolPort/RuntimePort | F2 (altri 3 motori) |

> **Grounding Babylon (decisione giugno 2026)**: NON fare harvest KB per Babylon
> (materiale OSS scarso, ~29 repo-gioco; e l'LLM è già forte su TS — i finding
> `kb_value_eval` danno 0/8 gate sui mainstream). `code_gen_babylon_ts` si genera
> con la competenza LLM. La **doc/Playground ufficiali Babylon** SONO utili ma
> come **grounding curato nel prompt** (un piccolo file di snippet canonici per
> API specifiche es. `NullEngine`/fisica/GLTF), NON come dataset RAG — e solo se
> i test mostrano debolezze. È un task leggero di W2, non un riapertura della
> pipeline Fase 1 (frozen).

### B.3 — LLM router (W2)

`lib/llm/router.ts` (**adattatore `LlmPort`: Azure primario in testing**,
OpenRouter alt — vedi nota Parte A; + cost cap + structured-output Zod) ·
`lib/llm/embed.ts` (text-embedding-3-small) · `lib/llm/cost-tracker.ts`
(budget per-utente su Upstash Redis). Marcatura: FREE (infrastruttura).

### B.4 — Runtime / 5 motori (W3)

| Elemento | Porta/metodo | Marcatura |
|---|---|---|
| EngineAdapter godot/phaser/threejs/babylon*/defold | `build`/`smokeTest`/`package` ✅ | FREE |
| `webExport()` su tutti **[PROPOSTA]** | RuntimePort | FREE |
| smoke headless: NullEngine (Babylon), headless export (Godot/Defold), JS runner (Phaser/Three.js) | `smokeTest` | FREE **(gate)** |
| `.apk native` Defold (build + smoke "senza grafica/suono") | RuntimePort | FREE |
| `.apk` Godot (template pre-baked + emulatore) | RuntimePort | FF |
| E2B sandbox wrapper | `SandboxHandle` | FREE |
| Assembler → R2 .zip | `AssemblerInput/Output` ✅ | FREE |
| Marble `WorldGenPort` adapter + smoke integrazione | WorldGenPort | da testare day-1 (feature utente F2) |

### B.5 — Foundation: KB + Asset (già pronti, READ-ONLY)

- KB client: `getReferences`, `getReferenceParameters`, `buildReferenceContext`
  ([`knowledge.ts`](../lib/knowledge.ts)).
- Asset/LoRA: `match_assets`, `match_loras`, `increment_asset_usage` (migration 003).
- Dati (da [KB_STATE.md](KB_STATE.md)): 7336 chunk code; **6107 asset CC0**
  (incl. **554 model_3d**, 19 animation_3d, 966 hdri, 759 texture, 2488 audio_sfx,
  1238 sprite); 30 style pack, 14 genre template, 12 mood, 80 reference games, 40 LoRA.

### B.6 — Foundation: prodotto/DB (migration 005 applicata, READ-ONLY)

Tabelle: `users`, `projects`, `game_plan_versions`, `tool_executions`,
`usage_events`, `episodic_memory`, `build_artifacts`, `hitl_pauses`. RPC:
`record_tool_execution`, `check_quota`, `increment_quota_usage`,
`update_episodic_memory`, `apply_game_plan_diff`, `current_clerk_user_id`.

### B.7 — Il flywheel (anello mancante — priorità W1)

Collegare `usage_events` (`game_completed`, `game_exported_itch`, fork, non-rigen)
→ `update_episodic_memory` + `success_score` (chunk/asset). L'infrastruttura EMA
esiste su 3 livelli; manca l'anello evento-utente→success. Vedi
[WOW_CONTRACT.md §5](WOW_CONTRACT.md). Marcatura: FREE (alta leva).

---

## Parte C — Mappa backend → frontend (ogni funzionalità → posto UI, W4)

Per ogni capacità che il backend espone, dove vive nel frontend. Garantisce che
nessuna funzionalità resti senza casa nell'UI (anche quelle Fase 2 hanno il posto
già previsto).

| Funzionalità backend (contratto) | Dove vive nel frontend | Modalità |
|---|---|---|
| `HermesPlanRequest` (prompt + `moodboard_image_urls` + `forced_engine`) | campo testo + **upload BYOA** + engine picker | Creator (day-1) |
| `IntentInterpreterOutput.rationale` | testo "ho scelto Godot perché…" (explainability) | Creator |
| `GamePlan.meta` (style_pack, genre, difficulty) | pannelli di "regia" pre-generazione (**pattern Cinema Studio**) | Creator/Studio |
| `execution_dag` + `node_results` | progress live per nodo (in coda→corso→fatto) | Creator |
| `GamePlan.world_graph` (nodi+edge+gating) | **canvas a nodi** (React Flow) | Studio (F2) |
| `GamePlan.pacing_curve` | **timeline/curva di tensione editabile** | Studio (F2) |
| `GamePlan.rules` | form con slider min/max | Studio (F2) |
| @-tag Game Elements (Pietra §8.1) + world_graph nodes | **@-tag Personaggi/Location/Props riutilizzabili** (pattern Higgsfield) | Studio (F2) |
| `asset_bindings` (catalog vs generative) | asset browser: CC0 (free) vs "genera" (paywall) | Creator/Studio |
| `GamePlanPatch` (RFC 6902) | diff timeline + micro-edit ("rendi il boss più facile") | Studio (F2) |
| `build_artifacts` + `webExport` | **player iframe** (browser/PWA) + download .zip/.apk | Creator (day-1) |
| feed play-in-place | feed scrollabile + iframe sandboxed + `postMessage`→`usage_events` | Creator (day-1) |
| `EvaluationReport.verdicts` | badge "verificato: gira / bilanciato / 0 soft-lock" | Creator (il wow visibile) |
| `check_quota` + `TIER_DEFINITIONS` | paywall a crediti + Tip Jar + upgrade prompt | Billing |
| `tool_executions.output` (file generati) | editor + diff viewer | Code (F2) |
| `hitl_pauses` | modali pausa/review | HITL (F2) |

---

## Parte D — Strategia frontend (clone-and-merge + Cinema Studio pattern)

### Workflow di costruzione (verificato giugno 2026)

1. **Clone**: `AI Website Cloner` (skill Claude Code, `/clone-website <url>`) su
   2-3 riferimenti in cartelle separate → builder paralleli in git worktree →
   **merge automatico** con visual diff. Output: Next.js + Tailwind + shadcn
   (= stack W4).
2. **Coerenza anti-slop**: `Frontend Design Plugin` (Anthropic ufficiale) per
   tipografia/spacing/layout intenzionali (no Frankenstein).
3. **Sezioni puntuali**: v0 / Replifine / Windframe (screenshot/URL → React+shadcn).
4. **Personalizzazione**: palette/branding nostri — il clone è il punto di
   partenza, non di arrivo.

### Riferimenti da clonare/fondere

- **Higgsfield Cinema Studio** → per lo Studio Mode (interfaccia di regia).
- 1-2 per landing/dashboard (es. linear.app, vercel/v0 — Pietra §11-ter).
- **Canvas**: `@xyflow/react` (React Flow). Modelli UX reali: **Tersa** (canvas
  AI open-source), **n8n** (180k★), **Langflow**, **ComfyUI**.

### Il pattern Cinema Studio mappato sul NOSTRO dominio (decisione utente)

Higgsfield Cinema Studio risolve, per il video, lo stesso problema UX che noi
abbiamo per i giochi: dare un controllo "da regista" su un processo generativo.
Cloniamo il **pattern**, NON i controlli video:

| Higgsfield (video) | Game Studio AI (giochi) |
|---|---|
| Mr. Higgs scompone scena in shot | D.1/D.2 scompone brief → GamePlan + execution_dag |
| controlli di regia prima di generare (camera/lente/apertura) | GamePlan editabile prima della materializzazione: **genere, style pack, world_graph, rules, pacing** (NON camera/lente) |
| @-tag Personaggi/Location/Props riutilizzabili | @-tag Game Elements + nodi world_graph riutilizzabili |
| co-direttore AI in tempo reale | Hermes + explainability (rationale) |

**Modalità**: Creator Mode = day-1 (i 5 step §10 del WOW_CONTRACT). Studio Mode
(canvas) + Code Mode = Fase 2 — ma la Parte C garantisce che ogni funzionalità
ha già il suo posto previsto, così la Fase 2 è un'estensione, non una riscrittura.

---

## Parte E — Sequenza di convergenza (4 workstream → primo prototipo)

1. **Prerequisiti Fase 0** = i contract proposal di **Parte G** (landati su `main`
   con i mock, PRIMA del tag `v0.0.0-contracts` e dei branch). Senza questi, i
   workstream non sono ermetici.
2. **Merge order immutabile** (Manifesto §06): **W2 → W3 → W1 → W4**. Ogni merge
   sostituisce i mock con l'implementazione reale in un commit dedicato.
3. **Thin slice del wow**: definire UNA verticale che attraversa tutti e 4 i
   workstream e dimostra il wow — es. **platformer Godot**: brief → D.1/D.2 (W1)
   → code_gen_godot + asset_resolver (W2) → assembler + smoke + webExport (W3) →
   Creator Mode + player iframe (W4). Poi allargare ai 5 motori e ai generi.
4. **Criterio "primo prototipo"** = i gate di [WOW_CONTRACT §3/§7](WOW_CONTRACT.md)
   su 1 motore/genere: gira (smoke 95%), 0 soft-lock, giocabile in browser, è
   scaricabile. Marble: solo smoke test di integrazione (segnale precoce).

---

## Parte F — Credenziali, abbonamenti, registrazioni (guida operativa per workflow)

Ancorata a `.env.example` (50 var già definite). **Dove registrarsi · env var ·
free tier · costo MVP · quando serve.** Le librerie/engine (Babylon/Three.js/
Phaser/Defold/Godot) NON hanno credenziali (npm / binari nel template E2B).

### Fondamenta (servono SUBITO, a tutti)

| Servizio | Dove registrarsi | Env var | Free tier | Quando |
|---|---|---|---|---|
| GitHub | github.com (token: Settings→Developer) | `GITHUB_TOKEN` | gratis | subito |
| Supabase | supabase.com | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_*` | 500MB / Pro $25 | subito (DB già migrato) |
| OpenAI (embeddings) | platform.openai.com | `OPENAI_API_KEY` | pay-per-use ($0.02/1M) | subito (KB client) |

### W2 — Tools + LLM + generativi

| Servizio | Dove | Env var | Free tier | Quando |
|---|---|---|---|---|
| **Azure AI Foundry (gateway LLM primario)** | portal.azure.com / ai.azure.com | `AZURE_OPENAI_*` (+ deployment per modello) | fine mese, quote alte | **day-1 — crea i deployment** (GPT + Claude via Marketplace + DeepSeek) |
| OpenRouter (alt/prod) | openrouter.ai | `OPENROUTER_API_KEY` | pay-per-token +5.5% fee | alternativa / BYOK |
| Langfuse (observability) | langfuse.com (o self-host MIT) | `LANGFUSE_*` ⚠️ DA AGGIUNGERE | 50k eventi/mese; self-host gratis | FF/F2 (in testing basta `tool_executions`+Azure Monitor) |
| ~~Helicone~~ | — | `HELICONE_API_KEY` (in .env, ma non cablare) | — | **deprecato**: maintenance mode + copre solo Azure OpenAI |
| Replicate | replicate.com | `REPLICATE_API_TOKEN` | pay-per-use ($0.002-0.008/img) | day-1 PAY (sprite/3D) |
| Suno API | suno.com / sunoapi.org | `SUNO_API_KEY` | pay ($0.02-0.11/traccia) | day-1 PAY (BGM) |
| ElevenLabs | elevenlabs.io | `ELEVENLABS_API_KEY` | free tier + crediti | day-1 PAY (SFX/voci) |
| Meshy | meshy.ai | `MESHY_API_KEY` | da $20/mese ($0.005-0.20/asset) | day-1 PAY (3D) |
| Upstash Redis | upstash.com | `UPSTASH_REDIS_URL`, `_TOKEN` | 10k cmd/giorno | day-1 (rate limit/budget) |
| HuggingFace | huggingface.co | `HF_TOKEN` | gratis | day-1 (LoRA metadata) |
| Freesound | freesound.org/apiv2 | `FREESOUND_API_KEY` | gratis (API) | FF (SFX bank) |
| Azure OpenAI (opz.) | portal.azure.com | `AZURE_OPENAI_*` | pay | opzionale (fallback) |

### W3 — Runtime + Sandbox + Storage

| Servizio | Dove | Env var | Free tier | Quando |
|---|---|---|---|---|
| E2B | e2b.dev | `E2B_API_KEY` | $100 credito | day-1 (sandbox build/smoke) |
| Cloudflare R2 | dash.cloudflare.com | `R2_ACCESS_KEY_ID`, `_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` | 10GB | day-1 (.zip storage) |
| Trigger.dev | trigger.dev | `TRIGGER_API_KEY`, `TRIGGER_PROJECT_REF` | $5 credito | day-1 (job lunghi) |
| itch.io / butler | itch.io (OAuth) | (OAuth, no env) | gratis | day-1 (publish) |
| **World Labs Marble** | worldlabs.ai (API paid) | **`WORLDLABS_API_KEY`** ⚠️ DA AGGIUNGERE | $5 min, ~$1.20/mondo | test day-1; feature utente F2 (Order Form per volume) |

### W4 — Frontend + Auth + Billing + Analytics + Notifiche

| Servizio | Dove | Env var | Free tier | Quando |
|---|---|---|---|---|
| Clerk | clerk.com | `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | 10k MAU | day-1 (auth) |
| Stripe | stripe.com | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | 2.9%+30¢ | day-1 (paywall/Tip Jar) |
| PostHog | posthog.com | `POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_HOST` | 1M eventi/mese | day-1 (analytics/flywheel) |
| Vercel | vercel.com | (deploy CLI) | Hobby gratis | day-1 (deploy) |
| Resend | resend.com | `RESEND_API_KEY` | 3k email/mese | FF (transazionali) |
| Loops | loops.so | `LOOPS_API_KEY` | 1k contatti | FF (marketing) |
| Knock | knock.app | `KNOCK_API_KEY` | 10k notif/mese | FF (in-app) |
| Crisp | crisp.chat | `CRISP_WEBSITE_ID` | 2 seat | FF (chat) |
| Dub.co | dub.co | `DUB_API_KEY` | gratis | FF (link analytics) |
| Sentry | sentry.io | `SENTRY_DSN` | 5k eventi | FF (error tracking) |

**Ordine di registrazione per il thin-slice del wow**: prima le Fondamenta +
E2B + R2 + Trigger.dev + **Azure AI Foundry (deployment GPT/Claude/DeepSeek)** +
Clerk + Vercel (bastano per il prototipo platformer-Godot end-to-end). I provider
PAY (Suno/Meshy/ElevenLabs/FLUX) e i servizi FF (Resend/Loops/Knock/Crisp/Dub/
Sentry/Langfuse/Marble) si attivano quando la feature corrispondente entra.

**Gap noti in `.env.example`**: mancano `WORLDLABS_API_KEY` (Marble) e `LANGFUSE_*`
(observability F2) — aggiunte cross-cutting da coordinare. Le toolchain engine
(Godot headless, Defold, .NET per builds) NON sono credenziali ma binari da
installare nel template E2B (W3). `HELICONE_API_KEY` resta in `.env.example` ma
**non va cablato** (maintenance mode; per l'observability vedi Langfuse / nota
`Telemetry` Parte A).

---

## Parte G — Contract proposals con firme concrete (prerequisiti Fase 0)

I contratti sono l'unico confine condiviso tra i 4 branch. Per workstream
ermetici servono firme esatte, da **landare su `main` prima del tag
`v0.0.0-contracts`** (processo "contract proposal" Manifesto §02.3). Sotto, le
bozze — **[PROPOSTA]**, non ancora applicate.

### G.1 — Babylon nell'enum motori

File: `lib/contracts/game-plan.contract.ts` + `tool-registry.contract.ts`.
```ts
// EngineEnum: aggiungere "babylon"
export const EngineEnum = z.enum([
    "godot","phaser","renpy","defold","monogame","love2d","threejs","stride",
    "babylon", // [PROPOSTA Fase 0]
]);
// ToolIdEnum: aggiungere
//   "code_gen_babylon_ts" (categoria code)
//   "babylon_assembler"   (categoria publishers)
```
Impatto: **W1** (può emettere `engine: "babylon"`), **W2** (tool), **W3** (adapter).

### G.2 — `webExport()` su EngineAdapter

File: `lib/contracts/assembly-pipeline.contract.ts`.
```ts
export interface WebBuildArtifact {           // [PROPOSTA Fase 0]
    iframe_url: string;                       // bundle servito da R2, embeddabile
    bundle_size_bytes: number;
    target: "browser" | "pwa";
    mobile_apk_url: string | null;            // valorizzato per Defold .apk
}
export interface EngineAdapter {
    // ...metodi esistenti...
    webExport(sandbox: SandboxHandle): Promise<WebBuildArtifact>; // [PROPOSTA]
}
```
Impatto: **W3** (implementa per i 5 motori: ≈identità per Phaser/Three.js/Babylon,
export WASM per Godot/Defold), **W1** (lo richiede nel dag), **W4** (monta
`iframe_url` nel feed/player).

### G.3 — Porte generative (nuovo file)

File: `lib/contracts/generative.contract.ts` **[PROPOSTA Fase 0]**. Ogni metodo
con input/output Zod che estendono `ToolInputBaseSchema`/`ToolOutputBaseSchema`.
```ts
export interface AudioGenPort {
    generateBgm(input: BgmGenInput): Promise<AudioOutput>;   // Suno
    generateSfx(input: SfxGenInput): Promise<AudioOutput>;   // ElevenLabs
    generateVoice(input: VoiceGenInput): Promise<AudioOutput>;
}
export interface Model3DPort {
    generateModel(input: Model3DInput): Promise<Model3DOutput>;      // Meshy/TRELLIS.2
    generateAnimation(input: Anim3DInput): Promise<Model3DOutput>;
    generateTexture(input: TextureInput): Promise<TextureOutput>;
}
export interface ImageGenPort {
    generateSprite(input: SpriteGenInput): Promise<ImageOutput>;     // Replicate FLUX/SDXL
    generateTileset(input: TilesetGenInput): Promise<ImageOutput>;
}
export interface WorldGenPort {
    generateWorld(input: WorldGenInput): Promise<WorldGenOutput>;    // Marble → GLB + collider
}
```
Impatto: **W2** (audio/3d/image), **W3** (WorldGen/Marble), **W1** (le invoca via dag).

### G.4 — Mock per le porte nuove

File: `lib/_mocks/generative.mock.ts` + `lib/_mocks/worldgen.mock.ts`
**[PROPOSTA Fase 0]** — Zod-validati come gli esistenti. Impatto: **tutti** i
workstream sviluppano in isolamento prima del merge.

### G.5 — `.env.example` + `WORLDLABS_API_KEY`

Aggiunta cross-cutting (coordinare con i 4 workstream, Manifesto §02.5).

**Per il piano di esecuzione a valle**: ogni proposta G.1-G.5 → un prompt
"Fase 0.X: applica contract proposal N" con verifica (`tsc --noEmit` 0 errori +
smoke test del nuovo mock che Zod-valida).

---

## Riferimenti

- Contratti/porte: [`lib/contracts/`](../lib/contracts/) · mock: [`lib/_mocks/`](../lib/_mocks/)
- Tabelle/RPC: `supabase/migrations/00[1,3,5]_*.sql`
- KB client: [`lib/knowledge.ts`](../lib/knowledge.ts) · numeri: [KB_STATE.md](KB_STATE.md)
- Criteri wow: [WOW_CONTRACT.md](WOW_CONTRACT.md) · posizionamento: [COMPETITIVE_LANDSCAPE_2026.md](COMPETITIVE_LANDSCAPE_2026.md)
- W1-W4 + BaaS: [CONCURRENT_DEVELOPMENT_MANIFESTO.md](CONCURRENT_DEVELOPMENT_MANIFESTO.md) · forma esecutiva: [SUPREME_CONCURRENT_EXECUTION_PLAN.md](SUPREME_CONCURRENT_EXECUTION_PLAN.md)
- Credenziali: `.env.example`
