# CERTIFICATO DI VALIDAZIONE — EXECUTION_PLAN_PROMPTS_v2.md

**Data/ora**: 2026-06-03
**Oggetti validati**: `EXECUTION_PLAN_PROMPTS_v2.md` (piano corretto) +
`REGISTRO_CORREZIONI.md` (catena di custodia del fixer).
**Validatore**: Validation Engineer indipendente.
**Dichiarazione di indipendenza**: non ho scritto il piano, né i fix, né il
registro. Ogni affermazione del registro è stata trattata come **non attendibile
fino a prova contraria** e verificata sulla fonte primaria (codebase, contratti,
migration, documenti di architettura). Il verdetto è binario e senza riserve.

---

## Tabella riepilogo — 18 verifiche

| ID | Descrizione | Esito | Nota (fonte) |
|---|---|---|---|
| **B1.1** | Conteggio blocchi = 23 (22 fase + Gate) | ✅ PASS | `grep -c "^### \["` → 22; `^## GATE` → 1. Coincide col registro. |
| **B1.2** | Gate ha 10 criteri DONE | ✅ PASS | `awk '/^## GATE/,0' \| grep -c "^- \[ \]"` → 10. |
| **B1.3** | Commenti inline `<!-- FIX` ≥ 13 | ✅ PASS | `grep -c "<!-- FIX"` → 13 (A1×5, A2×2, A3, A4, A5, A6, A6-bis, A7). |
| **B1.4** | Header dichiara 23 blocchi e corrisponde | ✅ PASS | Riga 4: "23 blocchi … = 22 fase + Gate (1)" coerente con B1.1. |
| **B2.1** | A1: fork — migration 006 + contratto + 5 occorrenze citano 006 | ✅ PASS | Vincolo trasversale marca fork `[dipende da v0.1.0-contracts]`; G.0 in [0.1] crea 006 + aggiorna `UsageEventSchema`; [5-W1]/[5-W4] Dipendenze elencano migration 006; [0.3] verifica 006 nel tag. Nessuna occorrenza di fork non riconducibile a 006. |
| **B2.2** | A2: game-plan-versioning con scope day-1/F2 + DONE; G.0 dentro [0.1] | ✅ PASS | Paragrafo in [3-W1] (day-1 = persist patch via `apply_game_plan_diff`; F2 = replay/Studio Mode) + DONE `parent_version_mismatch`. G.0 è sotto-punto di [0.1] (B4.2). |
| **B2.3** | A3: nota merge-order [4-W1] corretta, residuo assente | ✅ PASS | [4-W1] Dipendenze: "mock di W1 sostituiti al merge di W1 (dopo W2 e W3)". Nessun "merge W3" residuo vicino a [4-W1] (vedi B3.1). |
| **B2.4** | A4: [0.2] DONE binario (toThrow) esteso a ogni metodo | ✅ PASS | DONE: `expect(() => generativeMock.generateBgm(invalidInput)).toThrow()` "analogo per ogni metodo di generative.mock + worldgen.mock". "verifica a vista" assente. |
| **B2.5** | A5: [1-W4] DONE webhook programmatico | ✅ PASS | DONE: clerkMock + `SELECT count(*) FROM users WHERE clerk_user_id='<test_id>' → 1` + "login Clerk reale solo nel Gate E2E". "(manuale)" assente. |
| **B2.6** | A6: [3-W4] DONE PWA unico e programmatico | ✅ PASS | DONE unico: manifest W3C (name/short_name/start_url/display/icons) + service worker attivo. Nessun "o manifest+SW presenti"; "lighthouse" assente dai DONE. |
| **B2.7** | A6-bis: PWA come 10° criterio distinto nel Gate | ✅ PASS | Riga distinta: "PWA installabile verificata (manifest valido + SW attivo): ✅ su tutte le build", separata da webExport. |
| **B2.8** | A7: [2-W2] DONE confine sprite_gen FREE/FLUX | ✅ PASS | DONE: "`sprite_gen` con tier=free NON istanzia/chiama `ImageGenPort` (FLUX); solo CC0" — eseguibile (assert su non-invocazione). |
| **B3.1** | P1: residuo riga orfana in [4-W1] rimosso, campo integro | ✅ PASS | Nessun residuo "(prima di W1 nel merge order…)"; campo Dipendenze di [4-W1] grammaticalmente completo. L'unico "merge W3" (riga 261) è in [3-W1], non [4-W1] (vedi Osservazione O1). |
| **B3.2** | P2: [0.3] DONE copre 006 commit-taggato + applicata + schema_migrations | ✅ PASS | DONE [0.3]: "006 esiste ed è nel commit taggato; applicata su Supabase e registrata in `schema_migrations`" — copre tutti e tre. |
| **B3.3** | P3: `FIX A2` sia su paragrafo sia su DONE | ✅ PASS | `FIX A2` riga 270 (sopra paragrafo "Game-plan versioning") + riga 284 (sopra DONE). Entrambi presenti. |
| **B4.1** | Coerenza Dipendenze post-A1: ogni uso di fork dichiara 006 | ✅ PASS | fork compare in: testata, [0.1]/G.0, [0.3], [5-W1], [5-W4]. [5-W1] e [5-W4] elencano "migration 006" nelle Dipendenze. Nessun altro blocco usa fork. |
| **B4.2** | G.0 non è una fase autonoma | ✅ PASS | Nessun header `### [0.0/0.4]`, nessun `## G.0`, nessuna "Fase 0.0". G.0 è solo nel prompt operativo di [0.1]. |
| **B4.3** | Scope post-A2: nessun deliverable FF/F2 spacciato per day-1 | ✅ PASS | Il paragrafo A2 marca esplicitamente "F2 (NON in questo piano) = replay/UI Studio Mode". Day-1 limitato a persist patch. |
| **B4.4** | Nessun criterio DONE usa "manuale/a vista" | ✅ PASS | `grep -E "^- \[ \].*(manuale\|a vista\|manualmente\|verifica visiva)"` → 0 match. |
| **B4.5** | Decisioni giugno 2026 intatte (Helicone/Babylon/Langfuse) | ✅ PASS | Helicone solo "NON cablato (maintenance mode)" / "NON usare Helicone"; Langfuse solo "(F2)"; babylon "NESSUN harvest KB". Nessun match problematico. |
| **B5.1** | Registro V1-V6 ✅ supportati dal v2 (conteggi 1:1) | ✅ PASS | Registro dichiara 22+Gate, 10 criteri, 8 interventi, Gate 1:1 — tutti confermati indipendentemente (B1.1/B1.2/B1.3/B2.7). |
| **B5.2** | Registro NON dichiara falsamente file codebase esistenti | ✅ PASS | **Verifica critica**: 006 NON esiste e "fork" NON è in `billing.contract.ts` — MA il registro §5 dichiara esplicitamente che sono "contract proposal di FASE 0, **non applicate**". Il "45/45 PASS" si riferisce alla codebase attuale non toccata. Il registro è accurato. |
| **B5.3** | Conteggio blocchi nel registro = v2 | ✅ PASS | Registro: "22 + Gate, invariato" (righe 5, 78, 128) = B1.1. |

**Totale: 21 voci verificate** (le 18 richieste + B2/B3/B4 espansi nei sotto-punti).
**FAIL: 0.**

---

## Dettaglio FAIL

**Nessun FAIL.**

---

## Osservazioni non bloccanti (informative, NON FAIL)

> Queste non sono difetti rispetto al perimetro di validazione (i 7 difetti
> dell'audit + i difetti introdotti dai fix). Sono segnalate per completezza e
> per un eventuale allineamento futuro. NON bloccano l'approvazione.

**O1 — Formulazione merge-order ellittica in [3-W1] (riga 261)**
- **Dove**: prompt operativo di [3-W1], righe 259-261: "invoca il tool via
  `tools.mock` (sostituito al merge W2)" e "build via `runtime.mock` (sostituito
  al merge W3)".
- **Natura**: la decisione di A3 (formulare la sostituzione mock come "al merge
  di W1 stesso") è stata applicata a [4-W1] ma **non propagata** a [3-W1], dove
  resta la formulazione "al merge W2 / al merge W3".
- **Perché NON è un FAIL**: (a) non è uno dei 7 difetti dell'audit (A3 riguardava
  specificamente [4-W1] Dipendenze, ora corretto e con residuo P1 rimosso); (b)
  non è un difetto *introdotto* dai fix (è testo preesistente del piano originale,
  fuori dallo scope del mandato A1-A7); (c) la formulazione è *ellittica ma non
  falsa* — indica quando l'artefatto reale di W2/W3 diventa disponibile, non
  viola il merge order W2→W3→W1→W4; (d) non blocca né il lancio né una fase.
- **Raccomandazione (facoltativa, futura)**: per coerenza stilistica con A3,
  allineare anche [3-W1] a "i mock di W1 sostituiti al merge di W1". Intervento
  cosmetico, da fare in una revisione successiva — non prima della distribuzione.

---

## VERDETTO COMPLESSIVO

# ✅ APPROVATO

Tutte le 18 verifiche (espanse in 21 voci) sono **PASS**. Zero FAIL.

`EXECUTION_PLAN_PROMPTS_v2.md` è certificato come:
- **strutturalmente integro** (22 blocchi + Gate; Gate con 10 criteri DONE);
- **completo rispetto alle correzioni** (tutti i 7 difetti dell'audit + A6-bis
  corretti, verificati indipendentemente a tre livelli: esistenza, eliminazione
  del difetto, assenza di regressioni);
- **coerente con i problemi emergenti** P1-P3 (residuo rimosso, criterio 006 in
  [0.3] completo, tracciabilità FIX A2 doppia);
- **privo di difetti nuovi** (nessun criterio manuale, scope intatto, G.0 non è
  una fase);
- **conforme alle fonti di verità di giugno 2026** (Helicone deprecato, Azure
  primario, Babylon senza harvest, Langfuse F2, soglie citate non riscritte,
  Gate 1:1 con `evaluation-metrics.contract.ts` + 3 prerogative WOW §3);
- **accuratamente documentato** dal registro (B5.2: il registro non dichiara
  falsamente l'esistenza di file — distingue correttamente "contract proposal
  FASE 0" da "applicato").

Il piano **PUÒ essere distribuito ai 4 workstream**.

Non-regressione confermata: `npx tsc --noEmit` exit 0; `npx vitest run` 45/45 PASS.

**Firma**: Validation Engineer indipendente — 2026-06-03.
