# lib/reasoning/ — Workstream 1

The 6 Reasoning Engine modules D.1-D.6.

Owner: **W1** (`ws/w1-reasoning-orchestrator`).
Branch policy: write only on W1's branch. Read-only on every other branch.

Files to create (Supreme Plan §03):

- `intent-interpreter.ts`  — D.1 phase 1.1
- `design-planner.ts`      — D.2 phase 1.2
- `consistency-manager.ts` — D.3 phase 1.3
- `balance-controller.ts`  — D.4 phase 1.4
- `evaluation-agent.ts`    — D.6 phase 1.6
- `__tests__/*.test.ts`    — 5+ tests per module

Each module implements the matching interface in
`lib/contracts/reasoning-engine.contract.ts`.

Contracts source of truth: do not modify the Zod schemas in
`lib/contracts/` without raising a "contract proposal" issue on
GitHub (Supreme Plan §01 Rule 1 + Manifesto §02.3).

Mocks consumed during parallelism:
- `@/lib/_mocks/tools.mock` (W2)
- `@/lib/_mocks/runtime.mock` (W3)
- `@/lib/_mocks/llm.mock` (W2)

BaaS integrated:
- Supabase RPC (search_code_knowledge, match_assets, match_loras,
  get_reference_parameters, record_tool_execution, update_episodic_memory,
  apply_game_plan_diff)
- OpenRouter via `lib/llm/router` (real or mock)
- Helicone proxy header
- Trigger.dev (run the Hermes loop as a long-running task)

Logging: every module writes to `data/standup/W1-YYYY-MM-DD.jsonl`.
