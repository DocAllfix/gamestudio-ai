# CLAUDE.md — Workstream W3: Runtime + Engine Adapters + Sandbox

<!-- Le 4 regole base + Code Quality + Anti-Hallucination + Migration Sync arrivano
     dal CLAUDE.md root, caricato sempre. Questo file AGGIUNGE solo il contesto W3. -->
<!-- Fonti complete: @/EXECUTION_PLAN_PROMPTS_v2.md (fasi), @/docs/EXECUTION_ARCHITECTURE.md
     (porte + Parte F credenziali), @/docs/WOW_CONTRACT.md (soglie/prerogative). -->

## 1. Identità sessione
- **Branch**: `ws/w3-runtime-engines` (da `v0.1.0-contracts`).
- **Possiedi (write)**: `lib/runtime/engines/`, `lib/runtime/sandbox/`, `lib/runtime/assembler/`, `lib/runtime/publishers/`, `lib/runtime/smoke-test/`, `lib/runtime/playtest-runner/`.
- **READ-ONLY**: `lib/contracts/`, ogni altra dir workstream, `scripts/`, migrations applicate, file cross-cutting.

## 2. Cosa devi consegnare (fasi — `EXECUTION_PLAN_PROMPTS_v2.md`)
- `[1-W3]` E2B sandbox wrapper + R2 storage + Trigger.dev job base
- `[2-W3]` Engine adapter Phaser + Three.js (browser-native)
- `[3-W3]` Engine adapter Godot (WASM headless) + Defold (.apk native + smoke headless)
- `[4-W3]` Engine adapter Babylon (`NullEngine` headless)
- `[5-W3]` `webExport()` su tutti e 5 + Assembler + smoke end-to-end
> Prompt + DONE completi nel piano v2.

## 3. Contratti che usi (READ-ONLY)
- `lib/contracts/assembly-pipeline.contract.ts`: `EngineAdapter` (con `webExport()` **da FASE 0.1, G.2**), `SandboxHandle`, `CommandResult`, `SmokeTestResult`, `BuildArtifact`, `AssemblerInputSchema`/`AssemblerOutputSchema`, `WebBuildArtifact` **[G.2]**, `ItchPackagerInputSchema`/`OutputSchema`.
- `lib/contracts/game-plan.contract.ts`: `EngineEnum` (include `babylon` **da G.1**).

## 4. Mock — cosa consumi, cosa esponi
- **Esponi** (tieni in sync): `@/lib/_mocks/runtime.mock` (`runtimeBuild`, `pushToItch`), `@/lib/_mocks/worldgen.mock` (creato in FASE 0.2, se W3 owna l'adattatore Marble).
- **Consumi in test**: `@/lib/_mocks/baas.mock` (`e2bMock`, `r2Mock`, `triggerMock`) per girare senza rete.

## 5. Credenziali / API che TI servono (vedi `docs/EXECUTION_ARCHITECTURE.md` Parte F §W3)
- `E2B_API_KEY` (sandbox build/smoke), `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET`/`R2_ENDPOINT` (storage .zip/bundle), `TRIGGER_API_KEY`/`TRIGGER_PROJECT_REF` (job lunghi), butler/itch.io (OAuth).
- `WORLDLABS_API_KEY` (Marble, account API paid — solo test interno; feature-utente = F2 con Order Form).
- **Toolchain nel template E2B** (binari, non credenziali): Godot headless + export templates + coi-serviceworker, Defold (bob), .NET. W3 possiede il template E2B.

## 6. Vincoli specifici W3
- **5 motori day-1**: godot, phaser, threejs, babylon, defold. `smokeTest()` deve girare **headless**: NullEngine (Babylon), export headless (Godot/Defold), JS runner (Phaser/Three.js).
- **3 prerogative** (WOW §3): `webExport()` → `iframe_url` (browser); PWA (W4 monta l'iframe); **.apk native via Defold** (build + smoke headless "senza grafica/suono"). `.apk Godot` = FF (template pre-baked + emulatore, fuori scope day-1).
- Soglia `SMOKE_TEST_PASS_RATE_MIN = 0.95` (CITALA, non ridefinirla).
- Marble: solo smoke test di integrazione interno, marcato "not user-facing".

## 7. Merge order
- **W2 → W3 → W1 → W4**. W3 è il **secondo** a mergiare (dopo W2): al merge, W2 è già reale → sostituisci eventuali mock di W2 col reale. Consegni `runtime.mock` reale a W1 (che mergia dopo). Commit solo su questo branch; pull `main --rebase`. `lib/contracts/` read-only.
