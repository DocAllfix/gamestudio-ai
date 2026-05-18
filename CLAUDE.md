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

═══ CURRENT MISSION: PHASE 1 — RAG KNOWLEDGE BASE ═══
What We're Building Right Now
A vector database (Supabase pgvector) containing dissected, classified, and
embedded code from the best open-source game projects across 8 engines.
This is the "Dataset Boost" — the foundation that makes every AI-generated
game dramatically better.
The Pipeline
GitHub Scrape → Quality Filter → Engine-Specific Parse → LLM Classify → Embed → Store
Reference Documents

docs/SUPREME_RAG_BLUEPRINT.md — Full technical blueprint (taxonomy, schema, pipeline)
docs/MASTER_EXECUTION_PLAN.md — Operational plan (anti-hallucination, prompts, phases)
docs/pietra_v4.md — The foundational vision document for the entire product

Directory Structure (Current Phase)
game-studio-ai/
├── CLAUDE.md                          ← you are here
├── .env                               ← API keys (never commit)
├── .gitignore
├── package.json                       ← minimal, for TS scripts
├── tsconfig.json
├── requirements.txt                   ← Python deps for ingestion scripts
│
├── docs/
│   ├── pietra_v4.md
│   ├── SUPREME_RAG_BLUEPRINT.md
│   └── MASTER_EXECUTION_PLAN.md
│
├── supabase/
│   └── migrations/
│       └── 001_knowledge_base.sql     ← pgvector schema
│
├── scripts/
│   └── ingestion/
│       ├── 01_scrape.py               ← GitHub + awesome lists scraper
│       ├── 02_filter.py               ← Quality gate (structural checks)
│       ├── 03_parse_godot.py          ← Godot .tscn/.gd parser
│       ├── 03_parse_phaser.py         ← Phaser scene parser
│       ├── 03_parse_renpy.py          ← Ren'Py .rpy parser
│       ├── 03_parse_generic.py        ← Defold/MonoGame/LÖVE/Three.js/Stride
│       ├── 04_classify.py             ← LLM classification (2-step + confidence gate)
│       ├── 05_embed_store.py          ← Embedding generation + Supabase insert
│       ├── 06_validate.py             ← Post-ingestion sanity checks
│       └── 07_test_queries.py         ← Query test suite
│
├── lib/
│   ├── knowledge.ts                   ← getReferences() + getReferenceParameters()
│   └── types.ts                       ← Shared TypeScript types
│
├── data/                              ← LOCAL ONLY, gitignored
│   ├── repos_raw/                     ← Cloned repos (Phase 1)
│   ├── repos_clean/                   ← Filtered repos (Phase 2)
│   ├── chunks_raw/                    ← Parsed chunks (Phase 3)
│   ├── chunks_classified/             ← LLM-classified chunks (Phase 4)
│   └── manifest.json                  ← Master repo manifest
│
└── test_output/                       ← Comparison test results
    ├── without_kb.gd
    └── with_kb.gd
Key Constraints

Godot 4 ONLY: filter pushed:>=2025-01-01 on GitHub to exclude Godot 3 syntax. Additionally verify config_version=5 in project.godot.
MIT/CC0/Apache/BSD/Zlib licenses ONLY: no GPL, no proprietary, no unknown
Max 100MB per repo: skip large repos with binary assets
Confidence gate: chunks with LLM confidence < 85 go to quarantine, not main table
Structured Output only: all LLM classification must use JSON Schema with enum constraints

Supabase Project

URL: read from NEXT_PUBLIC_SUPABASE_URL env var
Service key: read from SUPABASE_SERVICE_ROLE_KEY env var
pgvector extension must be enabled before running migrations

LLM APIs Used in This Phase

DeepSeek V4 Flash (via OpenRouter or direct): classification of chunks
OpenAI text-embedding-3-small: embedding generation (1536 dimensions)
Both accessed through env vars: OPENROUTER_API_KEY, OPENAI_API_KEY

═══ FUTURE STATE: PHASE 2 — GAME STUDIO AI PRODUCT ═══
What Comes After the Knowledge Base
Once the RAG is populated and tested, this same repository will grow into:

Hermes Agent Orchestrator (lib/orchestrator.ts) — pattern from Nous Research
48 AI Tools (lib/tools/) — code gen, sprite gen, audio gen, assemblers, QA
Game Reasoning Engine — Game Plan + Game Graph before any generation
Next.js Frontend — Creator Mode → Studio Mode → Code Mode
Multi-engine support — Godot, Phaser, Ren'Py, Defold, MonoGame, LÖVE, Three.js, Stride
Full BaaS stack — Clerk, Supabase, Trigger.dev, R2, E2B, OpenRouter, Helicone, PostHog, Vercel

How the KB Connects to the Product
Every tool in lib/tools/ will call getReferences() from lib/knowledge.ts
BEFORE generating any code. The KB is the invisible foundation that makes
the AI output professional-grade instead of amateur.
DO NOT build any product features during Phase 1.
Focus exclusively on the Knowledge Base pipeline. The product code comes in Phase 2.