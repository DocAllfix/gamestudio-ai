# Engine Mechanics Kit — pattern essenziali per 8 engine

**Data**: 2026-05-24
**Scope**: per ognuno degli 8 engine al day-1, mappare i pattern
canonici per Movement / Enemy AI / Camera / Save / Audio / UI /
Physics. Per ognuno: chunk già nel KB (riferimento ID-style) o
gap da chiudere.

L'obiettivo è che il D.5 Execution Orchestrator, quando deve
generare codice, abbia un mapping diretto a "chunk già verificati"
dal dataset.

---

## Categorie funzionali (cross-engine)

Da generare per ogni gioco wow day-1:

| Categoria | Sub-pattern | Rilevanza |
|---|---|---|
| Movement | Platformer 2D, Top-down, FPS 3D, Third-person 3D, Side-scroller | core |
| Enemy AI | Patrol, Chase, Ranged, Boss multi-fase, State machine | core |
| Camera | Follow 2D, Cinematic, Screen-shake, Parallax, OrbitControls 3D | core |
| Save | LocalStorage simple, JSON file, encrypted, slot-based | core |
| Audio | BGM manager, SFX pool, dynamic music, footstep system | core |
| UI | HUD, Pause menu, Settings, Dialog box, Inventory | core |
| Physics | Jump feel (coyote+jump-buffer), Dashing, Wall-jump, Grapple | per genere |

---

## 1. Godot 4 — 3 357 chunk

**Stato**: copertura completa. Solo mapping.

| Pattern | Chunk attesi nel KB (categoria A0x/B0x/C0x) | Repo notabili |
|---|---|---|
| Player 2D platformer | A01 movement (large) | `Heart-Platformer-Godot-4`, `2D-Platformer-Starter-Kit`, `nezvers/Godot_2D_action_platformer` |
| Top-down | A01 movement + A02 jumping | `noidexe/top-down-action-rpg-template`, `TetraForce` |
| FPS controller | A01 + B01 navigation | `Whimfoome/godot-FirstPersonStarter`, `expressobits/character-controller`, `chafmere/Godot4-FPS-Template`, `GarbajYT/godot_updated_fps_controller` |
| Multiplayer FPS | A01 + B01 + multiplayer | `devloglogan/MultiplayerFPSTutorial`, `foxssake/netfox`, `nakama-godot` |
| Enemy patrol/AI | A04 | molti chunks |
| Boss multi-fase | A04 + A05 | `Dark-Peace/BulletUpHell` |
| Camera follow | B05 | molti |
| Save | C04 | `nathanhoad/godot_puzzle_dependencies` (parziale) |
| Inventory | C02 | molti |
| Audio manager | D02 | molti |
| HUD/Menu | D01 | molti (E01 boilerplate)) |
| Tower defense | A04 + A03 | `ape1121/Godot-4-Tower-Defense-Template` |
| Card game | C02 + B03 | `guladam/deck_builder_tutorial`, `chun92/card-framework` |
| Roguelike | A02 + B02 | `SelinaDev/Godot-Roguelike-Tutorial`, `Bozar/godot-4-roguelike-tutorial` |
| Fighting | A03 | `blast-harbour/Godot-Rollback-Fighter-Demo` |
| Bullet hell | A03 + A04 | `Dark-Peace/BulletUpHell` |
| Metroidvania | A02 + A03 + B02 | `uheartbeast/metroidvania-godot-4`, `EeroLai/abyssal-walker` |
| Shader PSX/N64 | D03 | `MenacingMecha/godot-psx-style-demo`, `MenacingMecha/godot-n64-shader-demo` |

**Gap**: minimi. Forse generative agent NPC pattern leggero (per T12).
Compensato via `Hermes 3 8B` Ollama call dal codice generato.

---

## 2. Phaser 3 — 968 chunk

| Pattern | Chunk KB | Repo notabili |
|---|---|---|
| Platformer 2D | A01/A02 | `phaserjs/examples`, `ffx0s/mario-html5`, `phaser-by-example` |
| Top-down | A01 | molti |
| Arcade physics | A05 + B01 | `phaserjs/examples` (intero subset) |
| Camera follow + parallax | B05 | `phaserjs/examples` |
| HUD/Menu | D01 | molti |
| Save | C04 | **GAP** (0 chunk) — vedi RAG_GAP_DECISIONS G.2 |
| Dialog/Narrative | C03 | **GAP** (1 chunk) — compensa con ink_phaser_runtime.ts |
| Tower defense | A04 | `phaser3-tower-defense` (manifest? — verificare) |
| Match-3 | C02 | `remarkablegames/phaser-rpg` parziale |
| Endless runner | A01 + A02 | molti |

**Gap chiuso da**:
- `phaser_save_helper.ts` hardcoded (Sett 2)
- `ink_phaser_runtime.ts` hardcoded (Sett 2)

---

## 3. Ren'Py — 591 chunk

**Stato**: VN-completo dopo Fase 1ter.

| Pattern | Chunk KB | Repo notabili |
|---|---|---|
| Narrative branching | C03 (122) | Encyclopaedia framework, BobcStats |
| Save/Load | C04 (26) | Ren'Py default + custom |
| Inventory VN | C02 (12) | BobcStats |
| Audio mgr | D02 (7) | Ren'Py default |
| Progression (XP/stat) | C01 (5) | BobcStats |
| Choice UI | D01 | molti |

**Gap**: nessuno operativo. T02 wow OK.

---

## 4. Defold — 796 chunk

| Pattern | Chunk KB | Repo notabili |
|---|---|---|
| Casual movement | A01 | britzl pacchetti (defold-orthographic, etc.) |
| Tile-based puzzle | C02 + B01 | britzl |
| Match-3 | C02 | molti |
| Endless runner | A01 + A02 | molti |
| HUD/Menu | D01 | gooey, mahoma |
| Save | C04 | defsave |
| Audio | D02 | sound-pack |
| Particle | D03 | defold-particlefx |

**Gap**: minimi. T03 Mobile Puzzle wow OK.

---

## 5. MonoGame — 1 090 chunk

| Pattern | Chunk KB | Repo notabili |
|---|---|---|
| Platformer hardcore | A01/A02 | `MonoGame.Samples Platformer2D`, `MGPlatformerStarterKit` |
| Pixel-perfect physics | B01 | MonoGame.Extended |
| Camera | B05 | MonoGame.Extended Camera2D |
| Audio | D02 | MonoGame native + Extended |
| Tile/tilemap | C01/C02 | Tiled + MonoGame.Extended |
| HUD | D01 | Gum UI framework |
| Save | C04 | DataContractSerializer + JSON |
| Scene mgmt | E01 | MonoGame.Extended SceneManagement |
| Combat hardcore | A03 | `friflo/Friflo.Engine.ECS-Demos` (ECS approach) |
| Progression RPG | C01 | **GAP** (0 chunk) — vedi G.1 |
| Dialogue RPG | C03 | **GAP** (0 chunk) — vedi G.1 |

**Gap chiuso da**:
- `templates/monogame/jrpg_progression.cs` (~80 righe XP/level/stat)
- `templates/monogame/jrpg_dialogue.cs` (~120 righe ink integration)
- T05-alt = "beta" tier nel picker

**T07 Platformer Hardcore wow OK.**

---

## 6. LÖVE — 718 chunk

| Pattern | Chunk KB | Repo notabili |
|---|---|---|
| Card game | C02 + B03 | `love2d-cardgame` template |
| Bullet hell | A03 + A04 | `love2d-bullethell` |
| Roguelike puro | A02 + B02 | `hawkthorne` parziale |
| Mini platformer | A01 | molti |
| Camera | B05 | hump (popular lib) |
| Tween/Animation | D03 | flux, tween.lua |
| State machine | A04 | gamestate.lua |
| ASCII rendering | D01 | bitmap font + draw text |
| Audio | D02 | love.audio + cargo lib |
| Physics | B01 | love.physics |
| Save | C04 | bitser (lua serialize) |
| Dialogue | C03 | **GAP sottile** — compensa con `love_ink_dialogue.lua` |

**T06 Card / T13 Bullet Hell wow OK.**

---

## 7. Three.js — 1 270 chunk

| Pattern | Chunk KB | Repo notabili |
|---|---|---|
| Scene setup | E01 (high) | mrdoob/three.js examples |
| Camera (Orbit/First/Third) | B05 | pmndrs/drei `<OrbitControls>` etc. |
| Lighting | D03 | mrdoob/three.js examples |
| Materials/Shader | D03 | mrdoob/three.js + `Alchemist0823/three.quarks` |
| Animation (skeletal) | D03 | mrdoob/three.js loaders |
| GLTF loader | E01 | molti |
| Particle | D03 | three.quarks, gpu-particle |
| Audio 3D | D02 | three.js AudioListener |
| HTML UI overlay | D01 | drei `<Html />` |
| Physics (Cannon/Rapier) | B01 | molti via R3F |
| Character controller | A01 | `pmndrs/ecctrl` (verificare se nel KB) |
| Postprocessing | D03 | **GAP MINORE** — vedi G.4 |

**Gap chiuso da**:
- Harvest mirato ~10-15 repo postprocessing (Sett 1 Deep Research?
  Sì, prompt #5 — vedi DEEP_RESEARCH_PROMPTS_FASE2.md)

**T09 3D Browser wow OK dopo harvest postprocessing.**

---

## 8. Stride — 215 chunk (GAP STRUTTURALE)

| Pattern | Chunk KB | Repo notabili |
|---|---|---|
| Scene setup | E01 | stride3d/stride samples |
| Camera | B05 | sparso |
| Lighting | D03 | sparso |
| Physics (Bepu) | B01 | BepuPhysics demos |
| Asset loading | E01 | sparso |
| Movement | A01 | **THIN** |
| Combat | A03 | **GAP** (0) |
| Enemy AI | A04 | **GAP** (0) |
| Save | C04 | **GAP** (0) |
| Dialogue | C03 | **GAP** (0) |
| HUD | D01 | **GAP** (sottile) |
| Inventory | C02 | **GAP** (0) |
| Progression | C01 | **GAP** (0) |

**Decisione**: Stride = "Beta engine" al day-1 (vedi G.3).
T10 viene presentato come "starter scaffold per power user", non come
generazione completa wow.

**Compensazione hardcoded**: `templates/stride/starter_scaffold/` con
progetto Stride boot-ready + componenti basic camera+player.

---

## Tabella riepilogativa: status pattern per engine

| Engine | Movement | EnemyAI | Camera | Save | Audio | UI | Physics | Status |
|---|---|---|---|---|---|---|---|---|
| Godot | ✅ ricco | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **wow** |
| Phaser | ✅ | ✅ | ✅ | ⚠️ helper | ✅ | ✅ | ✅ | **wow** |
| Ren'Py | n/a (VN) | n/a | n/a | ✅ | ✅ | ✅ | n/a | **wow** |
| Defold | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **wow** |
| MonoGame | ✅ ricco | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **wow** (platformer); JRPG beta |
| LÖVE | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **wow** |
| Three.js | ✅ | ✅ | ✅ | ⚠️ Localstorage | ✅ | ✅ drei | ✅ Rapier | **wow** dopo G.4 |
| Stride | ⚠️ thin | ❌ | ⚠️ | ❌ | ⚠️ | ⚠️ | ✅ (Bepu) | **beta** |

Legenda: ✅ ricco / ⚠️ sottile o compensato / ❌ gap

**Risultato netto**: **7/8 engine in tier wow al day-1**, **Stride
beta**.

---

## Pipeline al primo prompt utente

Il D.5 Execution Orchestrator, ricevuto il Game Plan:

```python
def generate_code_for_engine(plan: GamePlan, engine: EngineEnum):
    # 1. Per ogni "core pattern" del template (movement, AI, etc.)
    patterns_needed = plan.template_origin.required_patterns
    # = [movement_topdown, enemy_patrol, camera_follow, save_simple,
    #    audio_bgm, hud_hp, dialogue_simple]

    for pattern in patterns_needed:
        # 2. Decompose-then-Retrieve sul KB
        rag_context = rag_retrieve(
            engine=engine,
            primary_category=pattern.category,
            sub_pattern=pattern.name,
            genre=plan.meta.genre,
            style_pack=plan.aesthetics.style_pack_ref,
            top_k=5,
        )

        # 3. Se KB ha chunk validi → injection nel code_gen prompt
        if rag_context.score > 0.75:
            generated = llm_codegen(
                pattern=pattern,
                examples=rag_context.chunks,
                style_pack_hints=plan.aesthetics,
            )

        # 4. Altrimenti fallback su hardcoded scaffold
        else:
            generated = load_hardcoded_scaffold(engine, pattern)
            log.warning(f"Used hardcoded scaffold for {engine}/{pattern}")

        # 5. Salva nel project_files
        save_artifact(plan, generated)
```

Questo garantisce: **0 prompt LLM "vuoti"**. Ogni file generato è
guidato da esempi reali o scaffold testato.

---

## Cose ancora da fare in Sett 2 sviluppo

- [ ] Implementare `rag_retrieve` con facet matching
- [ ] Scrivere i 6 file di scaffold hardcoded:
  - `templates/phaser/phaser_save_helper.ts`
  - `templates/phaser/ink_phaser_runtime.ts`
  - `templates/love2d/love_ink_dialogue.lua`
  - `templates/monogame/jrpg_progression.cs`
  - `templates/monogame/jrpg_dialogue.cs`
  - `templates/stride/starter_scaffold/` (progetto intero)
- [ ] Eseguire harvest threejs postprocessing (1h, $0.20)
- [ ] Verificare manualmente con SQL count quali pattern hanno < 5
  chunk per engine (sanity check)
