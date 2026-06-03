# CLAUDE.md — Workstream W2: Tools + LLM Router + Porte generative

<!-- Le 4 regole base + Code Quality + Anti-Hallucination + Migration Sync arrivano
     dal CLAUDE.md root, caricato sempre. Questo file AGGIUNGE solo il contesto W2. -->
<!-- Fonti complete: @/EXECUTION_PLAN_PROMPTS_v2.md (fasi), @/docs/EXECUTION_ARCHITECTURE.md
     (porte + Parte F credenziali), @/docs/WOW_CONTRACT.md (scope/pricing). -->

## 1. Identità sessione
- **Branch**: `ws/w2-tools-llm` (da `v0.1.0-contracts`).
- **Possiedi (write)**: `lib/tools/`, `lib/llm/`, `lib/asset-resolver/`, `lib/style-inference/`.
- **READ-ONLY**: `lib/contracts/`, `lib/knowledge.ts`, ogni altra dir workstream, `scripts/`, migrations applicate, file cross-cutting.

## 2. Cosa devi consegnare (fasi — `EXECUTION_PLAN_PROMPTS_v2.md`)
- `[1-W2]` LLM Router (Azure primario + OpenRouter alt + cost cap) + `embed.ts` + `cost-tracker.ts`
- `[2-W2]` Tool verticale FREE: `code_gen_{godot,phaser,threejs,babylon,defold}` + `asset_resolver` + `code_validator` + `project_validator` + `byoa_analyzer`
- `[3-W2]` Porte generative PAY: `AudioGenPort` (Suno/ElevenLabs), `Model3DPort` (Meshy/TRELLIS.2), `ImageGenPort` (FLUX)
- `[4-W2]` `WorldGenPort` (Marble) — adattatore + smoke test integrazione interno
> Prompt + DONE completi nel piano v2.

## 3. Contratti che usi (READ-ONLY)
- `lib/contracts/tool-registry.contract.ts`: `ToolIdEnum`, `ToolDescriptor`, `ToolInvocationSchema`, `ToolExecutionResultSchema`.
- `lib/contracts/generative.contract.ts` **[da FASE 0.1, G.3]**: `AudioGenPort`/`Model3DPort`/`ImageGenPort`/`WorldGenPort`.
- `lib/knowledge.ts`: `getReferences()` per il RAG grounding dei code_gen.

## 4. Mock — cosa consumi, cosa esponi
- **Esponi** (tieni in sync con le firme reali): `@/lib/_mocks/tools.mock` (`invokeTool`, `invokeToolBatch`), `@/lib/_mocks/llm.mock` (`complete`, `embed`), `@/lib/_mocks/generative.mock` (creato in FASE 0.2).
- **Consumi**: nessuno (sei il primo nel merge order).

## 5. Credenziali / API che TI servono (vedi `docs/EXECUTION_ARCHITECTURE.md` Parte F §W2)
- **LLM**: Azure AI Foundry (`AZURE_OPENAI_*` + 1 deployment per gpt-4o-mini / deepseek / claude-sonnet-4-6 via Marketplace). OpenRouter (`OPENROUTER_API_KEY`) come alternativa.
- **Generativi (PAY)**: `REPLICATE_API_TOKEN` (FLUX/SDXL), `SUNO_API_KEY` (BGM), `ELEVENLABS_API_KEY` (SFX/voci), `MESHY_API_KEY` (3D).
- **Supporto**: `UPSTASH_REDIS_*` (cost cap), `HF_TOKEN` (LoRA), `FREESOUND_API_KEY` (FF).

## 6. Vincoli specifici W2
- **LLM routing**: Azure primario in testing. **NON usare Helicone** (maintenance mode). Gestisci NELL'adattatore i vincoli Claude-su-Azure: per claude-opus/sonnet NON inviare `temperature`/`top_k`/`thinking`; `top_p`=0.99. Routing ≥60% task → DeepSeek.
- **Babylon** (`code_gen_babylon_ts`): NESSUN harvest KB (pipeline Fase 1 frozen). Genera con competenza LLM + grounding curato nel prompt (snippet NullEngine/fisica/GLTF dalla doc ufficiale).
- **Pricing**: generativo AI (audio/3D/FLUX) SEMPRE dietro paywall (`check_quota`, tier≥creator). `sprite_gen` su tier=free usa SOLO CC0 (mai FLUX). MAI "illimitato" sul generativo.

## 7. Merge order
- **W2 → W3 → W1 → W4**. W2 è il **primo** a mergiare → consegna i mock reali (tools/llm/generative) su cui gli altri costruiscono. Commit solo su questo branch; pull `main --rebase` ogni mattina. `lib/contracts/` read-only (serve contract proposal per cambiarlo).
