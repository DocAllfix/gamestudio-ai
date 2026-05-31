# lib/orchestrator/ — Workstream 1

The Hermes 3-level-memory orchestrator (D.5 outer loop).

Owner: **W1** (`ws/w1-reasoning-orchestrator`).
Branch policy: write only on W1's branch. Read-only elsewhere.

Files to create (Supreme Plan §03 phase 1.5):

- `hermes.ts`         — entrypoint implementing HermesOrchestrator
- `dag-scheduler.ts`  — topological scheduler with retry + cost cap
- `memory.ts`         — short/long/episodic memory persistence
- `__tests__/*.test.ts`

Contracts: implements `HermesOrchestrator` in
`lib/contracts/reasoning-engine.contract.ts`.

Cross-workstream consumers:
- `lib/orchestrator/hermes.ts` replaces `@/lib/_mocks/orchestrator.mock`
  imports in W4 at merge time.

Logging: append `data/standup/W1-YYYY-MM-DD.jsonl` per iteration
(phase + cost + latency + memory delta).
