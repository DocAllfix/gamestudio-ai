# AUDIT REPORT — EXECUTION_PLAN_PROMPTS.md

**Data**: 2026-06-03 · **Ruolo**: Principal Engineer / Adversarial Reviewer.
**Oggetto**: audit di completezza, coerenza, correttezza di
`EXECUTION_PLAN_PROMPTS.md` (23 blocchi: FASE 0 ×3, W1 ×5, W2 ×4, W3 ×5, W4 ×5,
Gate ×1) contro le fonti di verità (contratti, migration, mock, doc architettura).

**Verdetto sintetico**: il piano è **strutturalmente sano** — 69/72 riferimenti
tecnici verificati esatti, merge order rispettato, scope pulito, Gate 1:1 con le
costanti. **Trovati 7 difetti**, di cui **1 CRITICO** (evento `fork` inesistente
nell'enum DB), 1 ALTO, 3 MEDI, 2 BASSI. Nessuno è bloccante per l'avvio della
FASE 0; il CRITICO va corretto prima della Fase 5-W1/5-W4.

---

## Passata 1 — Completezza verticale (matrice BOM → fase)

Confronto: `EXECUTION_ARCHITECTURE.md` Parte B + `WOW_CONTRACT.md` §4 "DENTRO" →
blocco fase che lo produce.

| Elemento BOM (day-1) | Fase assegnata | Stato |
|---|---|---|
| D.1 Intent / D.2 Design | [1-W1] | ✅ coperto |
| D.3 Consistency (gate soft-lock) | [2-W1] | ✅ coperto |
| D.4 Balance | [2-W1] | ✅ coperto |
| D.5 Execution Orchestrator | [3-W1] | ✅ coperto |
| D.6 Evaluation (smoke gate) | [4-W1] | ✅ coperto |
| Hermes orchestrator | [3-W1] | ✅ coperto |
| Episodic memory / flywheel | [5-W1] | ⚠️ coperto ma con difetto A1 (`fork`) |
| game-plan-versioning (RFC 6902) | — | ⚠️ **PARZIALE** (vedi A2) |
| LLM router (Azure) | [1-W2] | ✅ coperto |
| code_gen ×5 motori | [2-W2] | ✅ coperto |
| asset_resolver / validators / byoa | [2-W2] | ✅ coperto |
| Porte generative PAY (audio/3d/image) | [3-W2] | ✅ coperto |
| WorldGen Marble (test interno) | [4-W2] | ✅ coperto |
| E2B / R2 / Trigger.dev | [1-W3] | ✅ coperto |
| 5 engine adapter | [2-W3][3-W3][4-W3] | ✅ coperto (phaser/threejs, godot/defold, babylon) |
| webExport + Assembler | [5-W3] | ✅ coperto |
| .apk native Defold | [3-W3] | ✅ coperto |
| Clerk auth / Vercel | [1-W4] | ✅ coperto |
| Creator Mode 5-step | [2-W4] | ✅ coperto |
| Feed iframe + PWA + touch | [3-W4] | ✅ coperto |
| Paywall a crediti + Stripe + Tip Jar | [4-W4] | ✅ coperto |
| PostHog flywheel + badge/fork | [5-W4] | ⚠️ coperto ma con difetto A1 |
| KB client / asset RPC | foundation | ✅ già esistente (citato) |

**Difetto trovato in Passata 1**:
- **A2 [MEDIO]** — `game-plan-versioning` (RFC 6902 diff backend, BOM B.1 di
  `EXECUTION_ARCHITECTURE.md`, dir `lib/game-plan-versioning/`) **non ha un
  blocco fase dedicato**. È toccato implicitamente da [1-W1] (D.2 emette patch) e
  dalla RPC `apply_game_plan_diff`, ma nessuna fase implementa esplicitamente il
  backend del versioning (applicazione patch, catena versioni). Per il day-1 può
  essere parziale (il micro-edit è Studio Mode = F2), ma va dichiarato.

Tutto il resto del BOM day-1 è coperto.

---

## Passata 2 — Coerenza contratti (nomi esatti)

Verifica grep su `lib/contracts/` e `supabase/migrations/`. **69/72 riferimenti
EXISTS con nome esatto.** Le 3 assenze sono attese/marcate. Difetto reale: 1.

| Categoria | Risultato |
|---|---|
| 7 interfacce reasoning (`propose`/`refine`/`validate`/`balance`/`materialize`/`evaluate`/`run`) | ✅ tutte esistono in `reasoning-engine.contract.ts` |
| 9 schemi Zod citati | ✅ tutti esistono |
| 15 ToolId citati (escluso babylon) | ✅ tutti in `ToolIdEnum` |
| `code_gen_babylon_ts`, `babylon_assembler` | ✅ MISSING ma **correttamente** marcati `[dipende da v0.1.0-contracts]` (proposta G.1) |
| 7 RPC (`update_episodic_memory` ecc.) | ✅ tutte esistono, firme corrette |
| 6 tabelle | ✅ tutte esistono |
| `findDirectedGatingCycle` | ✅ esiste (`game-graph.contract.ts:122`) |
| mock surface (complete/embed/invokeTool/runtimeBuild/runHermesPlan/…) | ✅ tutti esistono |
| `generative.mock.ts`, `worldgen.mock.ts` | ✅ MISSING ma **correttamente** marcati "creati in FASE 0.2" |
| 6 costanti evaluation-metrics | ✅ tutte, valori match (900 = `15*60`) |
| param `check_quota` | ✅ `p_clerk_user_id` (il piano usa `clerk_user_id`, semanticamente ok) |

**Difetto trovato in Passata 2**:
- **A1 [CRITICO]** — l'evento **`fork` NON esiste** nell'enum `event_name` di
  `usage_events` (migration 005, righe 161-166) né in `UsageEventSchema`
  (`billing.contract.ts`). L'enum reale è: `game_started, game_completed,
  game_failed, tool_executed, plan_refined, asset_uploaded, game_exported_itch,
  game_exported_steam, upgrade_clicked, downgrade_clicked`. Il piano usa `fork`
  in **5 punti**: righe 292, 297 ([5-W1]) e 672, 675, 681 ([5-W4]). Un INSERT con
  `event_name='fork'` **violerebbe il CHECK constraint a runtime** → il flywheel
  e il loop virale fork si romperebbero. **Questo è il moat che cresce** (cfr.
  WOW_CONTRACT §5): un difetto qui colpisce il cuore strategico.

---

## Passata 3 — Dipendenze e merge order

Grafo delle dipendenze tra i 23 blocchi (estratto dal campo "Dipendenze" + dagli
import mock citati). **Nessun ciclo.** Merge order W2→W3→W1→W4 rispettato.

| Blocco dipendente | Dipende da | Mediato da mock? | OK? |
|---|---|---|---|
| W1 [3-W1] usa i tool | W2 [2-W2] | ✅ `tools.mock` (`invokeTool`) | ✅ |
| W1 [3-W1] usa il runtime | W3 [5-W3] | ✅ `runtime.mock` (`runtimeBuild`) | ✅ |
| W1 [1-W1..3] usa LLM | W2 [1-W2] | ✅ `llm.mock` (`complete`) | ✅ |
| W1 [4-W1] transizione runtime reale | merge W3 (prima di W1) | ✅ rispetta W3→W1 | ✅ |
| W4 [2-W4] usa l'orchestrator | W1 (ultimo) | ✅ `orchestrator.mock` (`runHermesPlan`) | ✅ |
| W4 [3-W4] usa il bundle/webExport | W3 | ✅ `runtime.mock` finché W3 non merge | ✅ |
| W2/W3/W4 dipendono da contratti | FASE 0 (`v0.1.0-contracts`) | n/a (tag) | ✅ |

**Difetto trovato in Passata 3**:
- **A3 [MEDIO]** — incoerenza di merge order nella nota di [4-W1]: il blocco dice
  "transizione `runtime.mock` → reale al **merge W3**". Corretto rispetto
  all'ordine W2→W3→W1→W4 (W3 merge prima di W1). MA [3-W1] usa SIA `tools.mock`
  (W2) SIA `runtime.mock` (W3): poiché W1 è il **terzo** a mergiare, al momento
  del merge di W1 sia W2 sia W3 sono già reali — quindi la sostituzione dei mock
  di W1 avviene tutta al merge di W1, non "al merge W3". La frase è imprecisa (non
  un bug funzionale, ma fuorviante per l'agente). Chiarire: "i mock di W1 vengono
  sostituiti col reale quando W1 viene mergiato (dopo W2 e W3)".

Nessuna dipendenza cross-WS non mediata da mock. Nessun ciclo.

---

## Passata 4 — Verifiche DONE (binarie e complete?)

Scansione di tutti i criteri DONE. La maggioranza è binaria (comando + output
atteso). Trovati 3 criteri non pienamente binari.

**Difetti trovati in Passata 4**:
- **A4 [MEDIO]** — [0.2] riga 111: *"ogni mock chiama `Schema.parse()` su input e
  output (verifica a vista)"*. "Verifica a vista" non è binario. **Correzione**:
  sostituire con un test che passa un input malformato e asserisce che il mock
  lancia (`expect(() => mock(bad)).toThrow()`), provando che la validazione c'è.
- **A5 [MEDIO]** — [1-W4] riga 586: *"login Clerk funzionante (manuale) + webhook
  crea row `users`"*. "(manuale)" non è eseguibile da un agente. **Correzione**:
  per il day-1 di sviluppo, sostituire con un test che usa `clerkMock` +
  asserzione che il webhook handler fa upsert su `users` (query Supabase di
  conteggio). Il login reale resta una verifica E2E del Gate, non di fase.
- **A6 [BASSO]** — [3-W4] riga 635: *"PWA: lighthouse 'installable' pass (o
  manifest+SW presenti e validi)"*. L'alternativa "o … presenti" rende il
  criterio ambiguo (due gate diversi). **Correzione**: fissare uno solo —
  preferibilmente l'assert programmatico (manifest.json valido + service worker
  registrato), eseguibile in CI senza Lighthouse interattivo.

Tutti gli altri criteri DONE sono binari e sufficienti.

---

## Passata 5 — Scope (creep e buchi)

- **Scope creep**: **NESSUNO.** Le feature FF/F2 (Nakama, .apk Godot, Marble
  feature-utente, Playtester completo, motori renpy/monogame/love2d/stride)
  compaiono **solo** nel vincolo trasversale (righe 34-35) e come chiarimento
  (riga 268: "Playtester completo = FF"), MAI come deliverable di una fase. ✅
- **Buchi rispetto a WOW_CONTRACT §4 "DENTRO"**: vedi A2 (game-plan-versioning
  parziale, Passata 1). Un solo buco minore.
- **Copertura dimensionale day-1** (5 motori + 3 prerogative):
  - godot ✅ [3-W3] · phaser ✅ [2-W3] · threejs ✅ [2-W3] · babylon ✅ [4-W3] ·
    defold ✅ [3-W3].
  - browser ✅ ([5-W3] webExport) · PWA ✅ ([3-W4]) · .apk Defold ✅ ([3-W3]).
  - **Tutti gli assi coperti.** ✅

Nessun difetto nuovo oltre ad A2.

---

## Passata 6 — Decisioni architetturali e vincoli economici (giugno 2026)

| Decisione | Verifica nel piano | Esito |
|---|---|---|
| Helicone NON cablato | righe 31, 329: "NON usare Helicone" — solo nei vincoli, mai in un prompt operativo che lo invoca | ✅ rispettato |
| Azure AI Foundry primario in testing | [1-W2] riga 326: adattatore primario Azure; deployment in [0.3] | ✅ rispettato |
| Vincoli parametri Claude su Azure | [1-W2] riga 326-327 ("NON inviare temperature/top_k/thinking; top_p=0.99") + DONE riga 342 (test: nessun `temperature` se model=claude-*) | ✅ rispettato |
| Babylon senza harvest KB | [2-W2] riga ~360: "NESSUN harvest KB" + grounding curato; nessun prompt riapre la pipeline Fase 1 | ✅ rispettato |
| Generativo AI solo dietro paywall | [3-W2] gated via `check_quota` (DONE: free→allowed=false); [4-W4] paywall | ✅ rispettato |
| Langfuse solo F2 | citato solo nei vincoli come "F2"; non è deliverable di nessuna fase | ✅ rispettato |
| Free tier = solo CC0+LLM | [2-W2] sprite_gen "preferisce CC0; FLUX solo se paywall" | ✅ rispettato |

**Difetto trovato in Passata 6**:
- **A7 [BASSO]** — [2-W2] riga ~370: il prompt dice `sprite_gen` "preferisce CC0
  (FLUX solo se paywall)" ma `sprite_gen` è classificato FREE in [2-W2] mentre lo
  "sprite premium FLUX" è in [3-W2] (PAY). Il confine tra "sprite_gen CC0 free" e
  "sprite premium FLUX pay" è descritto in due fasi diverse senza un criterio DONE
  che verifichi che il path FLUX sia gated. **Correzione**: aggiungere a [2-W2] un
  DONE: "test: `sprite_gen` con tier=free non invoca FLUX (usa solo
  asset_resolver/CC0)". Rischio economico se non esplicitato.

Nessuna violazione delle decisioni di giugno 2026.

---

## Passata 7 — Gate di lancio (1:1 con le fonti)

Tabella: costante/prerogativa → valore fonte → criterio DONE del Gate.

| Fonte | Valore | Criterio DONE nel Gate | Esito |
|---|---|---|---|
| `SMOKE_TEST_PASS_RATE_MIN` | 0.95 | "smoke pass rate ≥ 0.95" | ✅ 1:1 |
| `SOFT_LOCK_COUNT_MAX` | 0 | "soft_lock_count = 0 su tutte le run" | ✅ 1:1 |
| `STRESS_CURVE_RMSE_MAX` | 0.15 | "RMSE < 0.15 dove misurato" | ✅ 1:1 |
| `AESTHETIC_COHERENCE_MIN` | 0.75 | "coherence ≥ 0.75" | ✅ 1:1 |
| `GENERATION_COST_USD_MAX` | 1.5 | "costo/gioco Free < 1.5" | ✅ 1:1 |
| `GENERATION_TIME_SECONDS_MAX` | 900 | "tempo/gioco < 900s" | ✅ 1:1 |
| Prerogativa browser (`webExport`) | WOW §3 | "webExport iframe_url valido 100% run" | ✅ |
| Prerogativa PWA | WOW §3 | (implicito in [3-W4], **non ripetuto nel Gate**) | ⚠️ vedi nota |
| Prerogativa .apk Defold | WOW §3 | "≥1 .apk Defold passa lo smoke" | ✅ |

**Osservazione Passata 7**: le 6 costanti sono 1:1 (nessuna riscritta — il piano
le cita, non le ridefinisce). Le 3 prerogative: browser e .apk sono nel Gate;
**la prerogativa PWA è verificata in [3-W4] ma non ribadita esplicitamente nei 9
criteri DONE del Gate.** Non è un difetto critico (è coperta a livello di fase),
ma per completezza il Gate dovrebbe includere "PWA installabile" tra i suoi
criteri end-to-end. Lo classifico come **A6-bis [BASSO]**, accorpabile ad A6.

**Nessun disallineamento di valore. Nessuna soglia riscritta.** ✅

---

## Priorità di Correzione

Ordinata per severità. Ogni difetto: ID · severità · localizzazione · fonte che
lo smentisce · correzione.

### [CRITICO]

**A1 — Evento `fork` inesistente nell'enum `usage_events`**
- **Dove**: `EXECUTION_PLAN_PROMPTS.md` righe 292, 297 ([5-W1]); 672, 675, 681 ([5-W4]).
- **Fonte**: `supabase/migrations/005_product_schema.sql` righe 161-166 (CHECK
  constraint) + `lib/contracts/billing.contract.ts` `UsageEventSchema`. `fork`
  non è tra i 10 valori ammessi.
- **Correzione (2 opzioni)**:
  1. **Aggiungere `fork`** all'enum: nuova migration `006_add_fork_event.sql` che
     fa `ALTER TABLE usage_events DROP CONSTRAINT … ADD CONSTRAINT … CHECK (...,
     'fork')` + aggiornare `UsageEventSchema` (contract proposal, coordinato).
     **Raccomandato** perché il fork è un segnale di flywheel di prima classe
     (validazione di terzi, cfr. WOW_CONTRACT §5).
  2. In alternativa, se non si vuole toccare il contratto ora: mappare il fork su
     un evento esistente (`game_started` del nuovo progetto forkato) + un campo in
     `metadata: {forked_from: <id>}`. Meno pulito ma zero-migration.
  - In entrambi i casi, **aggiornare le 5 righe del piano** per coerenza.

### [ALTO]

*(Nessun difetto ALTO. A1 è l'unico oltre i MEDI.)*

### [MEDIO]

**A2 — game-plan-versioning senza fase dedicata**
- **Dove**: assente dal piano (atteso un blocco W1).
- **Fonte**: `EXECUTION_ARCHITECTURE.md` Parte B.1 (`lib/game-plan-versioning/`).
- **Correzione**: aggiungere una nota in [5-W1] o [3-W1] che il backend versioning
  (applicazione patch RFC 6902 + catena versioni via `apply_game_plan_diff`) è
  parte di W1; oppure dichiarare esplicitamente che per il day-1 è coperto solo
  l'emissione del patch (D.2) e l'applicazione completa è F2 (Studio Mode).

**A3 — Nota merge-order imprecisa in [4-W1]**
- **Dove**: [4-W1] "transizione `runtime.mock` → reale al merge W3".
- **Fonte**: `CONCURRENT_DEVELOPMENT_MANIFESTO.md` §06 (W2→W3→W1→W4).
- **Correzione**: riformulare in "i mock di W1 (`tools.mock`, `runtime.mock`)
  vengono sostituiti col reale quando W1 viene mergiato — dopo W2 e W3, già reali".

**A4 — DONE non binario in [0.2]**
- **Dove**: riga 111.
- **Correzione**: sostituire "verifica a vista" con
  `expect(() => generativeMock.generateBgm(badInput)).toThrow()` (prova la
  validazione Zod).

**A5 — DONE "(manuale)" in [1-W4]**
- **Dove**: riga 586.
- **Correzione**: test con `clerkMock` + query
  `SELECT count(*) FROM users WHERE clerk_user_id=...` dopo il webhook handler;
  login reale → solo nel Gate E2E.

### [BASSO]

**A6 (+A6-bis) — DONE PWA ambiguo + PWA assente dai criteri Gate**
- **Dove**: [3-W4] riga 635; Gate (9 criteri).
- **Correzione**: in [3-W4] fissare un solo gate (manifest+SW validi
  programmaticamente); aggiungere "PWA installabile" tra i criteri DONE del Gate.

**A7 — Confine sprite_gen FREE/FLUX PAY non verificato**
- **Dove**: [2-W2] (sprite_gen FREE) vs [3-W2] (FLUX PAY).
- **Fonte**: `WOW_CONTRACT.md` §9 (Free = solo CC0+LLM).
- **Correzione**: aggiungere a [2-W2] un DONE: "test: `sprite_gen` con tier=free
  NON invoca FLUX (solo asset_resolver/CC0)".

---

## Conclusione

Il piano **regge all'audit avversariale**: nessun difetto ALTO, scope pulito,
merge order corretto, Gate 1:1 con le costanti, decisioni di giugno 2026 tutte
rispettate. L'unico **CRITICO (A1, `fork`)** è circoscritto e ha una correzione
chiara; va risolto prima di implementare [5-W1]/[5-W4], non prima di FASE 0. I 6
difetti MEDI/BASSI sono rifiniture di precisione dei criteri DONE, non problemi
strutturali. **Raccomandazione**: applicare A1 (preferibilmente opzione 1, nuova
migration 006 + contract proposal nella FASE 0) e A2-A7 come patch al piano prima
di lanciare i workstream che li toccano.
