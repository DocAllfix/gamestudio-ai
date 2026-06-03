# REGISTRO CORREZIONI — EXECUTION_PLAN_PROMPTS → v2

**Data/ora**: 2026-06-03 · **Processo**: Fixer (Atto 1) + Post-Fix Auditor (Atto 2).
**Input**: `EXECUTION_PLAN_PROMPTS.md` + `AUDIT_REPORT_EXECUTION_PLAN.md` (7 difetti).
**Output**: `EXECUTION_PLAN_PROMPTS_v2.md` (definitivo, 22 blocchi + Gate, invariato).
Questo registro è la catena di custodia: leggibile indipendentemente dal piano.

---

## 1. Scelta per A1 (CRITICO) — con razionale

**Opzione adottata: OPZIONE 1** — aggiungere `fork` come nuovo `event_name`
all'enum di `usage_events` via **migration 006** + aggiornare `UsageEventSchema`
in `billing.contract.ts`, registrato come contract proposal **G.0 dentro [0.1]**.

**Razionale**: il `fork` è un segnale di flywheel di **prima classe** — la
validazione di terzi è il moat che cresce (`WOW_CONTRACT.md` §5). L'opzione 2
(mappare `fork` su `game_started` + `metadata.forked_from`) renderebbe il segnale
fork indistinguibile da un game_started normale nelle query analitiche e nel
calcolo `success_score`, costringendo a filtri fragili sul metadata. Per un evento
centrale al moat, un valore enum dedicato è più pulito e più robusto. Coerente con
la raccomandazione dell'audit. Costo: una migration additiva idempotente + 1 riga
nel contratto, coordinata in FASE 0 (prima dei branch) — zero rischio per i
workstream a valle.

---

## 2. Tabella dei fix applicati (Atto 1)

| ID | Severità | Sezione originale | Correzione applicata in v2 | Commento inline | V1 | V2 |
|---|---|---|---|---|---|---|
| A1 | CRITICO | Vincoli trasversali; [0.1]; [5-W1]; [5-W4]; [0.3] | Nuovo vincolo "evento fork"; G.0 (migration 006) in [0.1] + 2 DONE; migration 006 nelle Dipendenze di [5-W1] e [5-W4]; DONE tag-include-006 in [0.3] | `FIX A1` ×5 | ✅ | ✅ |
| A2 | MEDIO | [3-W1] | Paragrafo "Game-plan versioning" (scope day-1 = persist patch via `apply_game_plan_diff`; replay/UI = F2) + 1 DONE + output di fase | `FIX A2` ×2 | ✅ | ✅ |
| A3 | MEDIO | [4-W1] Dipendenze | Riformulata: "i mock di W1 sostituiti col reale al merge di W1 (dopo W2 e W3)"; rimosso il residuo "al merge W3" | `FIX A3` ×1 | ✅ | ✅ |
| A4 | MEDIO | [0.2] DONE | "verifica a vista" → `expect(() => generativeMock.generateBgm(invalidInput)).toThrow()` | `FIX A4` ×1 | ✅ | ✅ |
| A5 | MEDIO | [1-W4] DONE | "(manuale)" → test con `clerkMock` + query `SELECT count(*) FROM users WHERE clerk_user_id='<test_id>'` → 1 | `FIX A5` ×1 | ✅ | ✅ |
| A6 | BASSO | [3-W4] DONE | DONE PWA ambiguo → unico criterio programmatico (manifest W3C valido + service worker attivo) | `FIX A6` ×1 | ✅ | ✅ |
| A6-bis | BASSO | Gate | Aggiunto 10° criterio DONE: "PWA installabile verificata (manifest + SW): ✅ su tutte le build" | `FIX A6-bis` ×1 | ✅ | ✅ |
| A7 | BASSO | [2-W2] DONE | Aggiunto DONE: "`sprite_gen` con tier=free NON istanzia/chiama `ImageGenPort` (FLUX); solo CC0" | `FIX A7` ×1 | ✅ | ✅ |

Tutti gli 8 interventi applicati con chirurgia minima (frase/criterio, non
riscrittura di paragrafi sani). Ogni modifica ha un commento inline tracciabile.

---

## 3. Controverifica avversariale (Atto 2) — V1–V6

### V1 — I fix sono stati applicati tutti?
**PASS.** Conteggio commenti inline: A1 ×5, A2 ×2, A3 ×1, A4 ×1, A5 ×1, A6 ×1,
A6-bis ×1, A7 ×1. Tutti gli 8 interventi presenti.

### V2 — I fix risolvono il difetto originale?
**PASS.**
- A1: `fork` ora è aggiunto all'enum DB (migration 006, G.0) + `UsageEventSchema`;
  tutte le occorrenze nel piano ([5-W1], [5-W4]) hanno la dipendenza 006 dichiarata;
  nessun uso di `fork` resta non riconducibile a 006. ✅
- A4/A5: i criteri sono ora eseguibili senza intervento umano (assert `.toThrow()`,
  query `SELECT count`). ✅
- A6-bis: il Gate ha **esattamente 10 criteri DONE** (verificato:
  `awk '/^## GATE/,0' | grep -c '^- \[ \]'` → 10). ✅

### V3 — I fix non introducono nuovi difetti?
**PASS** (dopo 1 correzione, vedi §4).
- Nessuna dipendenza cross-WS non mediata da mock introdotta (006 è FASE 0, su main).
- Nessun deliverable spostato fuori scope (A2 chiarisce esplicitamente day-1 vs F2).
- Nessuna costante ridefinita (le soglie restano citate).
- `code_gen_babylon_ts`/`babylon_assembler`/`fork`: tutti marcati `[dipende da
  v0.1.0-contracts]` o introdotti da G.0/G.1.
- Decisioni giugno 2026 intatte: Jest assente (solo nel divieto), Helicone solo
  nelle note negative, Azure primario, Babylon senza harvest, Langfuse F2.

### V4 — Coerenza interna?
**PASS.**
- Dipendenze aggiornate: [5-W1] e [5-W4] elencano migration 006; [0.3] verifica
  che il tag includa 006.
- Vincolo trasversale aggiornato (nuovo punto "evento fork" + `[dipende da
  v0.1.0-contracts]` esteso a fork).
- Conteggio blocchi invariato: **22 blocchi `###` + 1 Gate** (i fix non aggiungono
  fasi; G.0 è un sotto-punto di [0.1], non una fase).
- I commenti inline non contraddicono il testo che modificano.

### V5 — Il Gate è ancora 1:1 con le fonti?
**PASS.** Tabella:

| Fonte | Valore | Criterio Gate | Esito |
|---|---|---|---|
| `SMOKE_TEST_PASS_RATE_MIN` | 0.95 | "smoke pass rate ≥ 0.95" | ✅ |
| `SOFT_LOCK_COUNT_MAX` | 0 | "soft_lock_count = 0" | ✅ |
| `STRESS_CURVE_RMSE_MAX` | 0.15 | "RMSE < 0.15" | ✅ |
| `AESTHETIC_COHERENCE_MIN` | 0.75 | "coherence ≥ 0.75" | ✅ |
| `GENERATION_COST_USD_MAX` | 1.5 | "costo Free < 1.5" | ✅ |
| `GENERATION_TIME_SECONDS_MAX` | 900 | "tempo < 900s" | ✅ |
| Prerogativa browser | WOW §3 | "webExport iframe_url 100%" | ✅ |
| Prerogativa PWA (A6-bis) | WOW §3 | "PWA installabile" | ✅ |
| Prerogativa .apk Defold | WOW §3 | "≥1 .apk Defold smoke pass" | ✅ |
| (evaluation gate aggregato) | — | "≥80% run passano i verdetti" | ✅ |

6 costanti + 3 prerogative + 1 aggregato = **10 criteri**. Nessun valore riscritto.

### V6 — Smoke logico end-to-end?
**PASS** (dopo 1 correzione, vedi §4). Run mentale: FASE 0 (006 committata+applicata,
tag v0.1.0-contracts include 006) → W1..W4 in parallelo contro i mock →
merge W2→W3→W1→W4 → Gate. La catena `fork`: 006 nel tag → [5-W1]/[5-W4] la
dichiarano in Dipendenze → il Gate misura il flywheel. Nessun blocco presuppone
un artefatto non ancora prodotto.

---

## 4. Problemi emersi durante l'Atto 2 e loro risoluzione

| # | Problema (controverifica) | Verifica | Risoluzione | Re-verifica |
|---|---|---|---|---|
| P1 | A3: edit della riga "Dipendenze" di [4-W1] aveva lasciato un **residuo** della vecchia frase ("(prima di W1 nel merge order…)") su una riga orfana | V4 | Rimossa la riga residua | V4 ✅ |
| P2 | A1: il DONE di [0.3] verificava il merge dei contratti ma **non** che il tag `v0.1.0-contracts` includesse la migration 006 committata+applicata → la catena fork sarebbe stata incompleta (006 fuori dal tag) | V6 | Aggiunto DONE in [0.3]: "006 esiste nel commit taggato + applicata su Supabase + registrata in schema_migrations" (`FIX A1` 5ª occorrenza) | V6 ✅ |
| P3 | A2: commento inline `FIX A2` presente solo sul DONE, non sul paragrafo del prompt → tracciabilità incompleta | V1 | Aggiunto `FIX A2` anche sopra il paragrafo "Game-plan versioning" | V1 ✅ |

Tutte le correzioni post-audit sono chirurgiche e re-verificate sulla singola
verifica impattata.

---

## 5. Non-regressione

- `npx tsc --noEmit` → **exit 0** (nessun codice/contratto toccato dal piano;
  le modifiche contrattuali reali — babylon, webExport, porte, fork — sono
  *descritte* come contract proposal di FASE 0, non applicate in questo documento).
- `npx vitest run` → **45/45 PASS**.
- Conteggio blocchi: **22 + Gate**, invariato rispetto all'originale.

---

## 6. Verdetto finale

**Il piano `EXECUTION_PLAN_PROMPTS_v2.md` è pronto per l'approvazione del team.**

Tutti i 7 difetti dell'audit (8 interventi con A6-bis) sono corretti; 3 problemi
nuovi emersi durante la controverifica (P1-P3) sono stati risolti e ri-verificati;
nessun difetto noto residuo.

Controverifica avversariale: **V1 ✅ · V2 ✅ · V3 ✅ · V4 ✅ · V5 ✅ · V6 ✅**

Firmato: Staff Engineer (Fixer + Post-Fix Auditor) — 2026-06-03.
