# CLAUDE.md — Workstream W4: Frontend + Auth + Billing + Feed

<!-- Le 4 regole base + Code Quality + Anti-Hallucination + Migration Sync arrivano
     dal CLAUDE.md root, caricato sempre. Questo file AGGIUNGE solo il contesto W4. -->
<!-- Fonti complete: @/EXECUTION_PLAN_PROMPTS_v2.md (fasi), @/docs/EXECUTION_ARCHITECTURE.md
     (Parte C backend→frontend, Parte D strategia UI, Parte F credenziali),
     @/docs/WOW_CONTRACT.md (§9 pricing, §10 onboarding/GTM). -->

## 1. Identità sessione
- **Branch**: `ws/w4-frontend-billing` (da `v0.1.0-contracts`).
- **Possiedi (write)**: `app/`, `components/`, `lib/billing/`, `lib/analytics/`, `lib/auth/`, `lib/notifications/`, `lib/multitenancy/`, `lib/hitl/`, `lib/versioning-ui/`, `lib/onboarding/`, `lib/byoa/`.
- **READ-ONLY**: `lib/contracts/`, ogni altra dir workstream, `scripts/`, migrations applicate, file cross-cutting.

## 2. Cosa devi consegnare (fasi — `EXECUTION_PLAN_PROMPTS_v2.md`)
- `[1-W4]` Clerk auth + Vercel deploy + layout shell (Next.js 14 + Tailwind + shadcn)
- `[2-W4]` Creator Mode 5-step (con mock W1/W2/W3)
- `[3-W4]` Feed iframe player sandboxed + PWA manifest + input touch
- `[4-W4]` Paywall a crediti + Stripe + Tip Jar (0% fee)
- `[5-W4]` PostHog flywheel eventi + badge/fork + analytics
> Prompt + DONE completi nel piano v2. La mappa "ogni funzionalità backend → posto UI" è in `docs/EXECUTION_ARCHITECTURE.md` Parte C.

## 3. Contratti che usi (READ-ONLY — bind la UI ai CAMPI, non ai valori)
- `lib/contracts/reasoning-engine.contract.ts`: `HermesPlanRequestSchema`, `HermesPlanResponseSchema` (output che la UI renderizza).
- `lib/contracts/billing.contract.ts`: `TIER_DEFINITIONS`, `QuotaCheckRequest/Response`, `UsageEventSchema` (con `fork` da FASE 0.1, G.0).
- `lib/contracts/evaluation-metrics.contract.ts`: `EvaluationReport` (per il badge "verificato").

## 4. Mock — cosa consumi
- **Consumi** (finché W1/W3 non mergiano): `@/lib/_mocks/orchestrator.mock` (`runHermesPlan`), `@/lib/_mocks/runtime.mock` (`runtimeBuild` per il bundle del feed).
- **Esponi**: nessuno (sei l'ultimo nel merge order).

## 5. Credenziali / API che TI servono (vedi `docs/EXECUTION_ARCHITECTURE.md` Parte F §W4)
- **Day-1**: `CLERK_SECRET_KEY`/`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (auth), `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` (paywall/Tip Jar), `POSTHOG_KEY`/`NEXT_PUBLIC_POSTHOG_KEY`/`POSTHOG_HOST` (analytics/flywheel), Vercel (deploy).
- **Fast-follow**: `RESEND_API_KEY`, `LOOPS_API_KEY`, `KNOCK_API_KEY`, `CRISP_WEBSITE_ID`, `DUB_API_KEY`, `SENTRY_DSN`.

## 6. Vincoli specifici W4
- **SDK diretti, NO porte esagonali** per Clerk/Stripe/Resend/Knock/Loops/Crisp/Dub/Sentry (il dominio non li tocca — `EXECUTION_ARCHITECTURE.md` Parte A "dove NON mettere porte"). Solo PostHog passa per la porta `Telemetry`.
- **Pricing bootstrap** (WOW §9): Free = solo CC0+LLM; generativo dietro paywall via `check_quota`; budget-a-crediti, MAI "illimitato" sul generativo. Tip Jar = Stripe diretto 0% fee.
- **Feed**: `<iframe sandbox>` su dominio separato; `postMessage` del gioco → `usage_events`. PWA: manifest W3C valido + service worker attivo (criterio programmatico, no Lighthouse interattivo).
- **Strategia UI** (Parte D): clone-and-merge (AI Website Cloner + Frontend Design plugin); Cinema Studio (Higgsfield) = **pattern** mappato sul nostro backend (genere/style/world_graph), NON controlli video. Studio Mode (canvas React Flow) + Code Mode = F2.

## 7. Merge order
- **W2 → W3 → W1 → W4**. W4 è l'**ultimo** a mergiare: al merge, W1/W2/W3 sono già reali → sostituisci `orchestrator.mock`/`runtime.mock` col reale. Commit solo su questo branch; pull `main --rebase`. `lib/contracts/` read-only.
