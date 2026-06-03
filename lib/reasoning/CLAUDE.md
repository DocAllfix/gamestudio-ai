# CLAUDE.md — Workstream W1: Reasoning Engine + Hermes + Flywheel

<!-- Le 4 regole base (Think Before Coding · Simplicity First · Surgical Changes ·
     Goal-Driven) + Code Quality + Anti-Hallucination + Migration Sync arrivano dal
     CLAUDE.md root, caricato sempre. Questo file AGGIUNGE solo il contesto W1. -->
<!-- Fonti complete (non duplicate qui): @/EXECUTION_PLAN_PROMPTS_v2.md (le fasi),
     @/docs/EXECUTION_ARCHITECTURE.md (porte + Parte F credenziali),
     @/docs/WOW_CONTRACT.md (soglie/scope), @/docs/CONCURRENT_DEVELOPMENT_MANIFESTO.md (merge order). -->

## 1. Identità sessione
- **Branch**: `ws/w1-reasoning-orchestrator` (nascerà da `v0.1.0-contracts` in FASE 0.3).
- **Possiedi (write)**: `lib/reasoning/`, `lib/orchestrator/`, `lib/episodic-memory/`, `lib/game-plan-versioning/`.
- **READ-ONLY**: `lib/contracts/`, `lib/_mocks/`, ogni altra dir workstream (`lib/tools/`, `lib/runtime/`, `app/`), `scripts/`, `supabase/migrations/00[1-6]_*.sql`, file cross-cutting (package.json, tsconfig, ecc.).

## 2. Cosa devi consegnare (fasi — riferimenti a `EXECUTION_PLAN_PROMPTS_v2.md`)
- `[1-W1]` D.1 Intent Interpreter + D.2 Design Planner
- `[2-W1]` Gate D.3 Consistency (soft-lock, ASP) + D.4 Balance
- `[3-W1]` D.5 Execution Orchestrator + Hermes loop + game-plan-versioning (persist patch)
- `[4-W1]` D.6 Evaluation Agent (smoke gate)
- `[5-W1]` Flywheel EMA: usage_events → success_score
> I prompt operativi completi + i criteri DONE binari sono nel piano v2. Non duplicarli.

## 3. Contratti che usi (READ-ONLY)
- `lib/contracts/reasoning-engine.contract.ts`: interfacce `IntentInterpreter.propose`, `DesignPlanner.refine`, `ConsistencyManager.validate`, `BalanceController.balance`, `ExecutionOrchestrator.materialize`, `EvaluationAgent.evaluate`, `HermesOrchestrator.run` + `HermesMemorySchema`.
- `lib/contracts/game-plan.contract.ts`: `GamePlanSchema`, `GamePlanPatchSchema`; `lib/contracts/game-graph.contract.ts`: `GameGraphSchema` + `findDirectedGatingCycle()`.
- `lib/contracts/evaluation-metrics.contract.ts`: le 6 soglie (CITALE, non ridefinirle).

## 4. Mock — cosa consumi, cosa esponi
- **Consumi** (offline, finché W2/W3 non mergiano): `@/lib/_mocks/llm.mock` (`complete`, `embed`), `@/lib/_mocks/tools.mock` (`invokeTool`, `invokeToolBatch`), `@/lib/_mocks/runtime.mock` (`runtimeBuild`).
- **Esponi**: `lib/orchestrator/hermes.ts` sostituirà `@/lib/_mocks/orchestrator.mock` (`runHermesPlan`) al merge di W1.

## 5. Credenziali / API che TI servono
- Solo le **Fondamenta** (Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_*`; `OPENAI_API_KEY` per embeddings). W1 usa le porte LLM/tool/runtime **via mock** → nessuna API key generativa propria.
- RPC Supabase (write): `update_episodic_memory`, `apply_game_plan_diff`, `record_tool_execution`. Dettaglio: `docs/EXECUTION_ARCHITECTURE.md` Parte F.

## 6. Vincoli specifici W1
- D.3 è un **GATE**: `SOFT_LOCK_COUNT_MAX = 0` (enforce; usa `findDirectedGatingCycle`).
- D.6 è un **GATE**: smoke pass (`SmokeTestReportSchema`).
- Flywheel `[5-W1]`: l'evento `fork` richiede **migration 006** (creata in FASE 0.1). `success` = evento utente reale (game_completed/exported/fork), non auto-validazione.
- game-plan-versioning: day-1 = persist patch via `apply_game_plan_diff`; replay/UI = F2 (Studio Mode, fuori scope).

## 7. Merge order
- **W2 → W3 → W1 → W4**. W1 è il **terzo** a mergiare: al merge di W1, W2 e W3 sono già reali su `main` → i mock di W1 (`llm`/`tools`/`runtime`) si sostituiscono col reale in quel commit. Commit solo su questo branch; `git pull origin main --rebase` ogni mattina.
- Mai modificare `lib/contracts/` durante il parallelismo → serve "contract proposal" concordato.
