# E2B sandbox template — required binaries (W3-owned)

W3 owns the E2B template image that `bootSandbox()` boots. Engine adapters
assume these binaries/files are present on `PATH` or at the documented paths.
This file is the source of truth for what the template must contain; the
template image itself is built/published out of band (E2B template build),
not from this repo.

The adapters never install toolchains at runtime — they only invoke them.
Paths below are referenced as constants in the engine adapters.

## Browser engines (Phaser, Three.js) — [2-W3]
- `node` (≥ 20) + `esbuild` on PATH — `build()` bundles `src/main.js`.
- Headless Chromium + Playwright (the smoke runner `smoke-runner.mjs` loads
  the bundle and reports `{passed, crash_reason}`). The runner script is
  written into the sandbox by the assembler, not baked into the template.
- `zip` — `package()`.

## Godot (WASM headless) — [3-W3]
- `godot` headless binary (Godot 4.x) on PATH.
- **Godot export templates** for the Web preset installed at the engine's
  expected templates dir — without them `--export-release` exits 0 but emits
  nothing, which is why `build()` verifies the expected files exist
  (`index.{html,js,wasm,pck}`).
- `/opt/coi-serviceworker.js` — copied into the export so the static host
  (R2/itch) gets cross-origin isolation (COOP/COEP) client-side, required for
  SharedArrayBuffer / threaded WASM.
- `node` for the headless WASM smoke runner (`godot-smoke-runner.mjs`).

## Defold (.apk native + headless smoke) — [3-W3]
- A JDK (`java`) — bob is a JAR.
- `/opt/bob.jar` — Defold's headless build tool. `build()` runs
  `--platform armv7-android ... bundle` to produce `build/android/game.apk`.
- Android bundle prerequisites bob needs for an `.apk` (Android SDK bits bob
  bundles/fetches). The day-1 `.apk` prerogative depends on this.
- `node` for the "no graphics/sound" headless smoke runner
  (`defold-smoke-runner.mjs`).

## Babylon (NullEngine headless) — [4-W3]
- `node` (≥ 20) + `esbuild` — `build()` bundles `src/main.ts`.
- `@babylonjs/core` resolvable in the sandbox so the smoke runner can import
  `NullEngine`. NullEngine has no canvas/GPU, so the scene runs in plain Node
  with no headless browser — this is Babylon's server-side verification edge.
- The smoke runner (`babylon-smoke-runner.mjs`) boots NullEngine, builds the
  bundled scene, advances `BABYLON_SMOKE_FRAMES` (60) render ticks, and prints
  `{passed, crash_reason}`. Written into the sandbox per-build (not baked in).

## Shared
- `zip` for every `package()`.
- The smoke runners are JS/MJS files the assembler writes into the sandbox
  FS per build; they are not part of the template image.
