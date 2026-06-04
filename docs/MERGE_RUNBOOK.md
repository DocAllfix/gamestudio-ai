# MERGE_RUNBOOK.md — Convergenza Phase 2 (W2→W3→W1→W4)

> **Stato (2026-06-04)**: tutti e 4 i workstream COMPLETI e committati sui loro
> branch. Questo runbook è la procedura meccanica per integrarli su `main` in
> ordine immutabile, sostituendo i mock con le implementazioni reali, con gate
> `tsc`+`vitest` verde ad ogni step.
>
> **Regole standing**: tutto LOCALE, **NON pushare** senza ok esplicito.
> `lib/contracts/**` resta read-only. Si committa su `main` ad ogni step.

---

## 0. Pre-merge — check di sanità (prima di toccare main)

Per ogni branch, nel suo worktree, verificare verde:
```
git -C <worktree> status --short        # tree pulito (a parte package.json di W4)
cd <worktree> && npx tsc --noEmit        # 0 errori
cd <worktree> && npx vitest run          # tutti pass
```
Stato atteso (autodichiarato, da confermare): W2=104, W3=123, W1=111, W4=122.

Worktree: `gamestudio-w2/w3/w1/w4`. Branch: `ws/w{N}-*`. Main: `gamestudio.ai`.

**Contracts non divergenti**: `lib/contracts/` deve essere identico su tutti
(read-only durante il parallelismo). Verificare con un diff prima di iniziare.

---

## 1. Il problema del package.json (cross-cutting) — risolverlo PRIMA

Durante il parallelismo nessuno ha toccato `package.json` (regola cross-cutting).
Ma i workstream hanno installato dep reali localmente (`--no-save` / non committate):

| WS | Dep reali da consolidare |
|----|--------------------------|
| W2 | provider SDK (openai/azure, replicate, ecc.) — verificare cosa serve davvero |
| W3 | `e2b`, `@aws-sdk/client-s3` (R2), `@trigger.dev/sdk` |
| W1 | (nessuna nuova — usa solo Supabase/OpenAI già presenti) |
| W4 | `stripe`, `posthog-js`, `posthog-node`, `@clerk/nextjs`, `next@16`, tailwind, `@playwright/test` (dev) |

→ **UN commit unico di consolidamento `package.json` su main**, fatto durante il
merge (non prima). Strategia: aggiungere le dep mano a mano che il workstream che
le richiede viene integrato (W3 aggiunge le sue allo step 3, W4 alle sue allo
step 5), oppure tutte insieme alla fine. `npm install` dopo per rigenerare il lock.

---

## 2. STEP 1 — W2 → main (primo, nessun mock da sostituire)

W2 è il primo: NON consuma mock di altri → merge "pulito".

```
# su main
git -C <main> checkout main
git -C <main> merge ws/w2-tools-llm --no-ff -m "merge: W2 tools + LLM router into main"
# consolida le dep W2 in package.json se servono per i test reali
npx tsc --noEmit && npx vitest run    # GATE: deve restare verde
```
Dopo questo, su `main` esistono i REALI: `lib/llm/router.ts`, `lib/tools/*`,
`lib/asset-resolver/*`, `lib/style-inference/*`. I mock `llm.mock`/`tools.mock`/
`generative.mock` restano in `lib/_mocks/` (li useranno W1/W4 finché non si
sostituiscono — vedi step successivi).

---

## 3. STEP 2 — W3 → main (secondo)

W3 NON consuma mock di W2 nel codice (verificato: `assemble.ts` ha solo un
commento di riferimento). Merge pulito.

```
git -C <main> merge ws/w3-runtime-engines --no-ff -m "merge: W3 runtime + engines into main"
# aggiungi a package.json: e2b, @aws-sdk/client-s3, @trigger.dev/sdk
npx tsc --noEmit && npx vitest run    # GATE verde
```
Dopo: su `main` ci sono i REALI `lib/runtime/*` — `assemble()` (sostituto di
`runtimeBuild`), i 5 EngineAdapter, sandbox/R2/trigger wrapper. Conferma:
`lib/runtime/assembler/assemble.ts` è "the real replacement for runtimeBuild".

---

## 4. STEP 3 — W1 → main (terzo) — PRIMO merge con swap mock→reale

W1 consuma 3 mock in 4 punti ESATTI (verificato 2026-06-04). Al merge, in un
**commit dedicato** dopo il merge, sostituire:

| File:riga | Import attuale (mock) | → Reale (già su main) |
|-----------|----------------------|----------------------|
| `lib/reasoning/intent.ts:32` | `complete` da `../_mocks/llm.mock.js` | `lib/llm/router.ts` (W2) |
| `lib/reasoning/execution.ts:34` | `invokeToolBatch` da `../_mocks/tools.mock.js` | `lib/tools/*` (W2) |
| `lib/reasoning/execution.ts:35` | `runtimeBuild` da `../_mocks/runtime.mock.js` | `lib/runtime/assembler/assemble.ts` (W3) |
| `lib/reasoning/evaluation.ts:42` | `runtimeBuild` da `../_mocks/runtime.mock.js` | `lib/runtime/assembler/assemble.ts` (W3) |

```
git -C <main> merge ws/w1-reasoning-orchestrator --no-ff -m "merge: W1 reasoning + orchestrator into main"
# commit dedicato: sostituisci i 4 import sopra (mock → reale W2/W3)
#   verifica firme: la firma reale deve combaciare con quella del mock (il mock
#   era Zod-validato sullo stesso contratto → divergenze emergono nei test)
git -C <main> commit -am "refactor(merge): W1 swap llm/tools/runtime mocks → real W2/W3 impls"
npx tsc --noEmit && npx vitest run    # GATE verde
```
Dopo: `lib/orchestrator/hermes.ts` (reale) è pronto a sostituire
`orchestrator.mock` per W4. Riferimento: `lib/reasoning/README.md`,
`lib/orchestrator/README.md`.

---

## 5. STEP 4 — W4 → main (ultimo) + consolidamento finale

W4 isola il consumo mock in **wrapper dedicati** (merge pulito):
- `app/(creator)/create/actions.ts:39` → `runHermesPlan` (da `orchestrator.mock`)
- `lib/orchestrator/hermes-client.ts` → wrapper attorno a `runHermesPlan`
- `lib/runtime/runtime-client.ts` → `getMockFeedBuilds()` (lista mock per il feed)

| Punto | Swap mock → reale |
|-------|-------------------|
| `hermes-client.ts` / `actions.ts` | `orchestrator.mock` (`runHermesPlan`) → `lib/orchestrator/hermes.ts` (W1) |
| `runtime-client.ts` (`getMockFeedBuilds`) | lista mock → query Supabase reale su build_artifacts / game_plan_versions (W3) |

```
git -C <main> merge ws/w4-frontend-billing --no-ff -m "merge: W4 frontend + billing into main"
# commit dedicato: swap orchestrator.mock → hermes W1, runtime feed mock → query W3
# + COMMIT FINALE package.json: aggiungi stripe, posthog-js/node, @clerk/nextjs,
#   next@16, tailwind, @playwright/test (dev). Poi: npm install (rigenera lock).
git -C <main> commit -am "refactor(merge): W4 swap orchestrator/runtime mocks → real W1/W3"
git -C <main> commit -am "chore(merge): consolidate package.json with all 4 workstream deps"
npx tsc --noEmit && npx vitest run && npx next build   # GATE finale verde
```

---

## 6. Post-merge — verifica integrale + GATE di lancio

Dopo i 4 merge, su `main`:
1. `npx tsc --noEmit` + `npx vitest run` + `npx next build` → tutti verdi.
2. I mock in `lib/_mocks/` non più importati dal codice di prodotto (solo dai test,
   se ancora servono). Verificare con grep `^import .*_mocks/` su `lib/`+`app/`.
3. **GATE DI LANCIO** (EXECUTION_PLAN_PROMPTS_v2.md): run reali in E2B (no mock),
   5 motori × 3-5 generi, misura le 6 soglie di `evaluation-metrics.contract.ts`.
   → Richiede le CREDENZIALI (Ondata 1: Clerk, OpenRouter/Azure, E2B; Supabase+R2
   già disponibili). Vedi nota credenziali sotto.

## 7. Credenziali — servono SOLO dal GATE in poi (non per il merge)

Il merge gira a **zero credenziali** (tutto su mock/test offline). Le chiavi
servono per i run reali del GATE:
- **Ondata 1** (primo gioco reale end-to-end): Clerk, OpenRouter o Azure, E2B
  (+ Supabase e R2 già disponibili).
- **Ondata 2** (feature PAY/lancio): Stripe, Suno/ElevenLabs/Meshy/Replicate,
  Trigger.dev, Upstash, PostHog, itch.io, ecc. — gated dietro check_quota, non
  bloccano il funzionamento base.
