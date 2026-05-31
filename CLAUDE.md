CLAUDE.md — Game Studio AI Workspace
═══ SYSTEM INSTRUCTIONS ═══
Identity
This workspace is Game Studio AI — an AI-powered platform that democratizes
game development. You are working inside this project as a senior engineer.
Code Quality Rules

Language: TypeScript (strict mode) for the product, Python 3.11+ for data scripts
No dead code: never leave commented-out blocks, unused imports, or placeholder functions
No any type: every variable, parameter, and return value must be typed
Error handling: every async call wrapped in try/catch with meaningful error messages
Logging: use structured logging (console.error with context object) for all failures
Environment variables: always read from process.env, never hardcode secrets
File length: no single file exceeds 400 lines. Split into modules if approaching limit
Naming: camelCase for TS variables/functions, snake_case for Python, SCREAMING_SNAKE for constants
Comments: explain WHY, not WHAT. No obvious comments like "// increment counter"
Testing: every script must have a dry-run mode (--dry-run flag) that logs what would happen without executing

Git Discipline

Commit after every completed subtask with descriptive message
Format: feat(phase-N): description or fix(phase-N): description
Never commit .env files, API keys, or data/ directory contents

Anti-Hallucination Protocol
When writing classification or labeling code that uses LLMs:

ALWAYS use structured output (JSON Schema with enum constraints)
ALWAYS include a confidence_score field (0-100)
ALWAYS include a rejection/uncertain escape hatch category
NEVER trust free-form string output from LLMs for categorical data
NEVER parse LLM output with regex — use JSON.parse or json.loads only

Dependencies
Before installing any package, check if the functionality already exists in:

Node.js / Python standard library
Already-installed packages
The project's existing utility functions
Only then consider adding a new dependency. Prefer zero-dependency solutions.

Database / Migration Sync Protocol
The local migration files in supabase/migrations/ MUST stay perfectly in sync
with the remote Supabase database. The local files are the source of truth.

Rules:
- NEVER modify the remote schema (tables, columns, indexes, RPCs, RLS policies)
  through the Supabase Dashboard UI directly. Schema changes happen ONLY by
  creating a new sequentially-numbered migration file (e.g. 002_*.sql, 003_*.sql)
  and applying it via the SQL Editor.
- NEVER edit an already-applied migration file in place. If migration 001 has
  already been run on remote, treat it as immutable. Schema fixes are additive:
  write a new migration that ALTERs, DROPs, or replaces what was wrong.
- ALWAYS commit a migration file BEFORE telling the user to apply it on the
  Dashboard. The git commit is the authorization record.
- ALWAYS update PROJECT_STATUS.md with the migration's applied state and let the
  user confirm "applied on Supabase" before treating it as live.
- If you ever suspect the local files and remote schema have drifted, STOP and
  reconcile first: ask the user to run a verification query (e.g.
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public'`)
  and compare against the union of migrations under supabase/migrations/. Do not
  write new code that touches the DB until the drift is resolved.
- Migration filename convention: NNN_short_snake_case.sql, NNN zero-padded to 3
  digits, monotonically increasing. The number is permanent once committed.

The same protocol applies to RLS policies and RPC functions: they live in
migrations, never authored ad-hoc in the Dashboard.

═══ CURRENT MISSION: PHASE 2 — 4-WAY PARALLEL PRODUCT DEV ═══

Phase 1 is DONE. The RAG knowledge base lives on Supabase: 7300+
code_knowledge chunks (100% allowlist licenses after the RAG-1 audit),
~5000 asset_library_index rows (CC0/CC-BY-4.0/OFL-1.1 only), 30 style
packs, 14 genre templates, 12 audio moods, 80 reference games with
visual analysis, 40 verified LoRAs — all seeded by migrations 001-004.

Phase 2 builds the actual product on top, split across FOUR parallel
workstreams that develop in isolated branches and converge through a
strict merge order. The full playbook lives in:

  docs/CONCURRENT_DEVELOPMENT_MANIFESTO.md       (architectural strategy)
  docs/SUPREME_CONCURRENT_EXECUTION_PLAN.md      (per-sub-phase prompts + checklists)

The 4 Workstreams

  W1 — Reasoning + Orchestrator   ws/w1-reasoning-orchestrator
       lib/reasoning/             D.1 Intent .. D.6 Evaluation
       lib/orchestrator/          Hermes 3-level-memory loop
       lib/episodic-memory/       Voyager EMA per (user, skill)
       lib/game-plan-versioning/  RFC 6902 diff backend

  W2 — Tools + LLM router         ws/w2-tools-llm
       lib/tools/                 48 specialised tools by category
       lib/llm/                   OpenRouter + Helicone wrapper
       lib/asset-resolver/        D.5 match_assets + generative fallback
       lib/style-inference/       Vision + librosa → style_pack pick

  W3 — Runtime + Sandbox          ws/w3-runtime-engines
       lib/runtime/engines/       8 EngineAdapter implementations
       lib/runtime/sandbox/       E2B wrapper
       lib/runtime/assembler/     Build + R2 zip pipeline
       lib/runtime/publishers/    itch.io packager
       lib/runtime/smoke-test/    Headless per-engine smoke tests
       lib/runtime/playtest-runner/  Executes W1 Playtester script in sandbox

  W4 — Frontend + Auth + Billing  ws/w4-frontend-billing
       app/                       Next.js 14 App Router
       components/                shadcn + feature components
       lib/billing/               Stripe wrapper + tier sync
       lib/analytics/             PostHog client + server
       lib/auth/                  Clerk helpers
       lib/notifications/         Resend + Knock + Loops + Crisp + Dub.co
       lib/multitenancy/          Clerk org + RLS (Phase 2 of Phase 2)
       lib/versioning-ui/         Game Plan diff timeline (Phase 2 of Phase 2)
       lib/hitl/                  Pause/review modals
       lib/byoa/                  Asset upload + Vision analyze
       lib/onboarding/            First-time tutorial flow

Foundation (READ-ONLY for all 4 workstreams during parallelism)

  lib/contracts/                  Canonical Zod schemas (the boundary)
  lib/_mocks/                     Shape-correct mocks used until merge
  lib/knowledge.ts, lib/types.ts  KB client (Phase 1)
  scripts/shared/**               Phase 1 shared utilities
  scripts/ingestion/**            Phase 1 ingestion pipeline (frozen)
  scripts/ingestion_assets/**     Phase 1 asset ingestion (frozen)
  supabase/migrations/00[1-5]_*.sql  Applied schema (immutable)
  CLAUDE.md, package.json, tsconfig.json, requirements.txt, .env.example

Cross-Workstream BaaS Perimeter (consume the SDK, never duplicate)

  Clerk          W4 auth (NEVER write JWT signing or session stores)
  Supabase       Everyone (DB + pgvector + RPC + RLS)
  Trigger.dev    W1 + W3 long jobs (NEVER write worker / queue)
  Cloudflare R2  W3 .zip storage (NEVER write upload server)
  E2B            W3 sandbox (NEVER write container runtime)
  OpenRouter     W2 LLM gateway (NEVER write provider failover)
  Helicone       W2 LLM observability proxy
  Replicate      W2 sprite + 3D generation
  Suno API       W2 BGM generation
  ElevenLabs     W2 SFX + voice
  Meshy.ai       W2 3D character / prop generation
  Upstash Redis  W2 rate limiting
  PostHog        W4 analytics + feature flags
  Resend         W4 transactional email
  Loops          W4 marketing email
  Knock          W4 in-app notifications
  Crisp          W4 live chat
  Dub.co         W4 link analytics
  Stripe         W4 billing
  Sentry         W4 error tracking (Phase 2 of Phase 2)
  Vercel         W4 deployment

If a task asks you to "write a JWT validator" → STOP, that's Clerk.
If a task asks you to "write a worker for a queue" → STOP, that's Trigger.dev.
Implementing a BaaS in custom code is immediate tech debt — every
duplication ships incorrect.

Rules That Apply To EVERY Workstream

1. Never modify lib/contracts/** during parallelism. Open a
   "contract proposal" GitHub issue, wait for the other 3 to agree,
   land the change on main as a dedicated commit, then everyone
   rebases.

2. Never edit cross-cutting files (CLAUDE.md, package.json,
   tsconfig.json, requirements.txt, .env.example, .gitignore,
   scripts/shared/**, supabase/migrations/00[1-5]_*.sql,
   lib/knowledge.ts, lib/types.ts) without coordinating with the
   other 3 workstreams.

3. New migrations: claim a number with a GitHub issue
   "Wn claims migration 0XX" before writing the SQL file. Commit
   the file BEFORE applying. Update PROJECT_STATUS.md with the
   applied state after the user confirms apply.

4. Each workstream commits ONLY on its own branch and pulls
   `git pull origin main --rebase` every morning to stay synced.

5. Mocks consumed: when a workstream needs a feature another is
   still building, import from `@/lib/_mocks/<dominio>.mock`. All
   mocks Zod-validate against the contract, so a divergent mock
   surfaces at test time, not at merge.

6. Merge order is immutable: W2 → W3 → W1 → W4. Each merge replaces
   the matching mock imports with the real implementation in a
   dedicated commit before the workstream's PR.

7. Structured logging is mandatory: every workstream writes
   `data/standup/W<N>-YYYY-MM-DD.jsonl` for every meaningful action
   (start / done / error / cost / latency). The daily 5-line
   markdown summary goes to `docs/standup/YYYY-MM-DD_w<N>.md`.

8. The Code Quality Rules and Anti-Hallucination Protocol at the
   top of this file apply unchanged in Phase 2.

LLM APIs Used in Phase 2

Same key set as Phase 1 plus the W2-specific generative providers.
Every API call goes through `lib/llm/router.ts` (W2-owned) which
applies cost cap, retry, and structured-output Zod validation. Direct
SDK calls outside the router are an anti-pattern — they bypass the
budget tracker and the Helicone trace.

NEVER WORK ON PHASE 1 ARTIFACTS

Phase 1 is frozen. The scripts under scripts/ingestion/ and
scripts/ingestion_assets/ shipped, the chunks are in Supabase. Any
"let me re-classify" or "let me add another scraper" instinct should
be killed — Phase 1 expansion is documented in
docs/RAG_GAP_DECISIONS.md and was intentionally closed. New product
work goes on a Workstream branch and consumes the existing RAG.