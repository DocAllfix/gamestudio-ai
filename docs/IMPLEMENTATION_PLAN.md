# Piano — GameSmith: GameSpec + Scene Composer + Studio (architettura cross-engine)

## Context — perché questo piano (sostituisce la direzione precedente)

GameSmith genera giochi end-to-end ma il risultato **non sembra un gioco**: asset
montati a caso, tileset stirato, scene vuote/grigie, affidabilità ~1 run su 5
(verificato: 27 run il 2026-06-07, 5 `passed=true`). 

**Causa-radice (verificata nel codice + confermata da un analista esterno che ha
letto la repo):** chiediamo all'LLM TRE lavori nello stesso GDScript — logica
(la fa bene), **composizione della scena** (disastro), **wiring asset→nodi** (non
dovrebbe farlo). Il `code_gen` ri-stringifica il livello in rettangoli pixel
(`_codegen.ts` describeLevel) e l'LLM indovina coordinate/scale + stira le texture
(`scale = size/tex_size`). La scena Godot (`scaffold.ts` `GODOT_MAIN_TSCN`) è un
Node2D nudo: Camera/Parallax/TileMap vanno creati a runtime dall'LLM ogni volta.

**Sorpresa importante:** il compositore deterministico **esiste già a metà** —
`tilemap_populate` produce un `.tmj` Tiled engine-agnostic con autotile — ma è
**scollegato**: `execution.ts/wireInputs` NON passa il `tilemap` al `code_gen`
(solo `level_layout`+`entities`+`assets`), perché il suo reachability check (BFS
walkable) rigetta i platformer → workaround in `dag-builder.ts` che ha cementato
il bypass.

**La svolta (decisa con l'utente, dopo aver corretto la prima proposta
dell'analista):** l'LLM produce **DATI** (un GameSpec), non codice di rendering.
Un **compositore deterministico** + **runtime parametrici per archetipo** rendono
la scena. Lo **Studio** (asset library + tool) è lo strato che PRODUCE gli asset
arricchiti che il compositore consuma. Si costruisce **orizzontalmente** (tracer
bullets su tutta la matrice motore×archetipo), NON in verticale su una cella —
perché il prodotto si vende sulla **coerenza cross-engine**, e le astrazioni
leakano solo al secondo motore.

Esito atteso: da "1 su 5 buono" a "sempre un gioco che sembra un gioco", su tutti
i motori e generi, con la varianza LLM confinata dove è VOLUTA (meccaniche/tema).

## Stato verificato (non si riparte da zero)
- **Studio già a metà:** `lib/studio/{slicer,pixel-snap,material-maps}.ts` reali;
  `app/(dashboard)/studio/` pagina reale; bridge `asset_resolver.findUserAsset`
  (library prima del CC0); audio port `lib/tools/audio/` scritto (non nel registry).
- **Asset:** ~8.267 in `asset_library_index`, 6.861 con style_pack; +754 OGA 2D,
  +1.406 musica CC0 ingeriti il 2026-06-07.
- **Composer-metà:** `tilemap_populate` (.tmj + autotile 47-blob), `_platformer-physics.ts`
  (`jumpReachCells`), `_reachability.ts`.
- **Recupero Sorceress/Studio:** tool + UI + fattibilità in `docs/STUDIO_LIBRARY_PLAN.md`.
- **Pipeline LLM attuale:** gira in produzione → resta invariata mentre si costruisce
  il nuovo a fianco (zero regressioni per l'utente).

---

## L'architettura (la spina dorsale)

**Due strati (per non esplodere in N×M):**
- **Strato A — Archetipi di scena** (engine-agnostic, finiti): una "ricetta" su
  primitive. Ogni archetipo ha uno **schema GameSpec** tipizzato.
- **Strato B — EngineComposer (porta)**: ~10 primitive (`createTileMap`,
  `createParallax`, `createCamera`, `createPlayer`, `createEntity`, `createHud`…)
  che ogni motore implementa una volta. Costo: N×P + K, non N×M.

**GameSpec** = discriminated union su `archetype`, **avvolge** il `.tmj` (trasporto
dati-livello 2D) e aggiunge ciò che il .tmj non copre: camera, parallax, fisica,
mechanics flags, asset-slot binding.

**6 archetipi → 14 generi:**
- `side_scroller_platform` ← hardcore_platformer, metroidvania
- `top_down_grid` ← jrpg, roguelike, retro_8bit, social_sim (+dialog)
- `arena_2d` ← bullet_hell, browser_arcade, multiplayer_arena
- `puzzle_grid` ← mobile_puzzle
- `scene_3d` ← threejs_showcase, stride_action
- `non_spatial_ui` ← visual_novel, card_game

I primi 4 condividono primitive 2D. `scene_3d` e `non_spatial_ui` sono tronchi
separati (dopo). Confine esplicito: motori 3D (Three/Babylon) → solo `scene_3d`;
`design.ts` vieta combo assurde (es. platformer+threejs).

**L'LLM cambia ruolo:** D.1/D.2 (intent+design) invariati; i nodi `code_gen_*`
spaziali → `compose_gamespec` (deterministico) + opzionale `mechanics_delta_gen`
(LLM, solo se il design chiede meccaniche non-standard). Per visual_novel/card_game
l'LLM resta protagonista (la generazione È la scrittura).

**Studio = strato di trasformazione asset condiviso:** gli stessi tool girano a
ingestione (catalogo CC0) e on-demand (upload/generati) e scrivono lo schema
arricchito (`tile_size`, palette, `tile_role`, `frame_size`) che il composer
consuma. Senza, il composer non ha da dove prendere asset coerenti.

---

## Approccio: tracer bullets orizzontali + Studio-first

- **NO vertical slice** (un motore+genere bello): valida "so fare un platformer in
  Godot", non "le astrazioni generalizzano" — il leak si vede solo al motore #2.
- **SÌ tracer bullets**: implementazione end-to-end sottilissima su TUTTA la matrice
  attuabile, prima di approfondire qualunque cella.
- **Studio-first in CODICE + composer su CARTA in parallelo** (vera parallelizzazione
  per un dev solo: una è costruzione visibile, l'altra è design).
- **Matrice iniziale: Godot + Phaser** (massima leva, `.tmj` risolto: vnen MIT per
  Godot, nativo per Phaser). **Defold e 3D dopo** (Defold ha modello diverso/rischio
  leak; il 3D è tronco separato).
- **Filtro anti-leak (carta, gratis):** per OGNI primitiva, scrivi lo pseudo-codice
  Godot E Phaser PRIMA di scrivere rendering. Se una non si scrive in entrambi senza
  torcere il GameSpec → lo schema è sbagliato, si aggiusta sul foglio.
- **Disciplina critica (psicologica):** dopo il primo tracer bullet Godot, NON
  approfondire prima di aver coperto orizzontale. Tieni la matrice davanti.

---

## Fasi

### FASE 0 — Contratti su carta (giorni, zero rendering)
- `GameSpec` Zod per `side_scroller_platform` (+ schema scheletro degli altri 5).
- Porta `EngineComposer` (~10 primitive) come interfaccia TS astratta.
- **Schema asset ⟷ GameSpec co-disegnato**: quali campi enriched servono al composer
  (`tile_size`, palette, `tile_role`, `frame_size`, anchor) → estende `MatchedAsset`.
- Filtro pseudo-codice Godot+Phaser per ogni primitiva.
- *Verifica:* ogni campo GameSpec ha una traduzione concreta nei 2 motori.

### FASE 1 — Studio COMPLETO (codice, valore visibile) — vedi `docs/STUDIO_LIBRARY_PLAN.md`
Non "3 tool": lo Studio è un prodotto a sé (library⇄gioco, moat). Si costruisce
**intero**, in ordine di priorità. I 3 detection-tool sono solo i PRIMI perché il
composer ci blocca; il resto segue. CC0-first gratis + generativo a paywall.

**Priorità 1 — sblocca il composer (🟢 deterministico):**
- Detection/enrichment: `tile_size` detector (divisori + autocorrelazione), palette
  extractor (k-means/median-cut), frame analyzer (connected-components). Girano a
  **ingestione** sul catalogo + on-demand. Scrivono i campi enriched della FASE 0.

**Priorità 2 — la capability che ci manca davvero (animazione):**
- **Pipeline sprite ANIMATO** (gap verificato vs autosprite.io): char (testo/img) →
  frames coerenti → chroma → **sprite sheet + atlas per-motore** (Godot SpriteFrames/
  HFrames-VFrames, Phaser JSON atlas) + FPS per-mossa + loop point + preview in-browser.
  - parte deterministica 🟢 (estrazione frame, chroma, slice, **atlas-metadata
    per-motore**, frame analyzer, loop/fps) = in casa.
  - generazione frame-coerenti 🟡 = porta `ImageGenPort` (FLUX/video img2img) — la
    **coerenza personaggio è la parte dura** (è il forte di AutoSprite). DECISIONE
    aperta: costruirla noi (FLUX + pipeline) vs integrare l'**API/MCP di AutoSprite**
    come provider dietro la porta (paywall) — valutare costo/dipendenza-da-competitor.
  - **Perché qui e non dopo:** il composer mette in scena PERSONAGGI ANIMATI con
    metadati frame; uno sprite statico = gioco statico. Capability core, non rifinitura.
  - **collision-box-from-sheet** (JSON hitbox per frame): bounding-box su alpha → il
    composer la consuma per le collisioni (Sorceress non ce l'ha; AutoSprite nemmeno).

**Priorità 3 — audio + library (valore visibile, free):**
- **Audio**: collega `SunoElevenAudioPort` al registry + binario CC0 dal catalogo
  (2.488 SFX + 1.406 musica) → giochi non muti, free.
- **Library sfogliabile**: griglia + filtri (tipo/stile/genere/2D-3D) + ricerca
  semantica (pgvector) sul catalogo; `save→project_assets` (la pagina già lo legge).

**Priorità 4 — il resto dei tool 🟢/🟡** (`docs/STUDIO_LIBRARY_PLAN.md` §2): Background
Remover, Corridor Chroma, True Pixel/Pixel-Snap (c'è), Material Forge completo (metà
c'è), 3D-to-2D (billboard dei 554 model CC0), SFX Editor/Sound Studio, Bitrate; poi i
🟡 a paywall: 3D Studio (Meshy/TRELLIS) + rig + text-to-anim, Seamless Tile, Image
Expander. Skip: Voxel, Canvas, Marketplace, WizardGenie.

*Verifica:* catalogo arricchito (tile_size/palette/frame popolati); Library naviga e
filtra; un gioco carica musica CC0; un personaggio esce **animato** (idle/walk/jump)
con atlas Godot+Phaser; collision-box JSON generato.

> **Nota competitiva (autosprite.io):** è un tool stretto ma curato che batte tutti
> sulla singola capability "personaggio animato coerente + atlas pronto-motore"
> (+ MCP + API + free tier). Sorceress e noi siamo larghi (tileset/3D/audio/bg + il
> FARE-il-gioco verificato, che loro non hanno). Da AutoSprite impariamo: la coerenza
> personaggio e l'**output atlas per-motore** sono ciò che rende gli sprite animati
> davvero usabili — ed è esattamente ciò che il composer richiede.

### FASE 2 — Tracer bullets composer (Godot + Phaser × archetipi 2D)
- `compose_gamespec` (deterministico) + `EngineComposer` Godot (via vnen) e Phaser
  (nativo): da un GameSpec **hardcoded minimale** → scena reale (TileMap +
  ParallaxBackground + Camera2D + Player + HUD), buildata + smoke.
- Reachability per `side_scroller_platform` usa `jumpReachCells` (non BFS) → fix per
  costruzione del bypass attuale.
- `main.tscn`/scaffold Godot diventa una **scena vera** (Camera2D zoom/deadzone +
  ParallaxBackground + TileMap vuoto + HUD), non un Node2D nudo.
- Espandi orizzontale: `top_down_grid`, `arena_2d` (poi `puzzle_grid` separato).
- *Verifica:* lo stesso GameSpec rende una scena coerente in Godot E Phaser; brutta
  ma composta (niente stretch, niente vuoto, camera/parallax sensati).

### FASE 3 — Cattura valore: fallback → composer, poi LLM produce GameSpec
- Sostituisci `_godot-fallback.ts` (e gli equivalenti) con un'invocazione del composer
  su GameSpec deterministico → ogni run che oggi cade in fallback (402/errore) esce
  **composta**, su qualunque motore/archetipo. Il fallback = "runtime nuovo meno
  l'enrichment LLM".
- Aggiungi il nodo `compose_gamespec` al DAG; il `code_gen` spaziale si spegne quasi
  del tutto (resta `mechanics_delta_gen` opzionale). L'LLM produce il GameSpec.
- *Verifica:* run end-to-end con 20-30 prompt reali → `passed` rate da ~19% a ≥70%
  (sparisce il fallimento da scena vuota). Screenshot: gioco composto, non "foto a caso".

### FASE 4+ — Espansione orizzontale + profondità Studio
- Capacità una alla volta SU TUTTA la matrice: `tile_role` veri, parallax multi-layer,
  camera deadzone per archetipo, kit curati (CLIP + palette).
- Poi: Defold adapter, `scene_3d` (3D gen Meshy/TRELLIS), `non_spatial_ui`.
- Studio: i tool restanti (Auto-Sprite video→frame→chroma, 3D Studio, Material Forge
  completo, collision-box-from-sheet) — `docs/STUDIO_LIBRARY_PLAN.md` §2.
- Modifica granulare ("play+edit") via RFC6902 esistente; Smithy mascotte.

---

### FASE 5+ — Conservate dal piano precedente (backlog, NON perdere)
Pezzi del piano originale ancora validi, da fare DOPO il core (composer + Studio).
Restano coerenti con la nuova architettura (girano sopra GameSpec/composer).

- **Preset opzionali (user_overrides)** — "stile Higgsfield, NON wizard". L'utente può
  scegliere genere/motore/tipo-mappa/difficoltà/stile **graphic_style**; solo-prompt
  resta valido coi default. Contract `user_overrides?` (commit dedicato), precedenza in
  `intent.ts` (override > inferenza > default), threading nel `dag-builder`/GameSpec.
  Frontend: pannello "Personalizza" con card-preset + anteprima, opzionale.
- **Modifica granulare ("play+edit")** — il differenziante "Higgsfield dei videogiochi":
  mentre giochi → prompt per aggiustare cose specifiche, per area/livello, doppio canale
  (utente diretto + agente), fino all'edit del codice. Backend: RFC6902 esistente
  (`diff-backend.ts` + `apply_game_plan_diff`) → richiesta → `GamePlanPatch` → nuova
  versione → rebuild dei soli nodi toccati. Frontend: iframe + pannello prompt→patch +
  timeline versioni.
- **Smithy (mascotte/brand)** — `[[project_smithy_concept]]`: mascotte pixel-art che
  martella l'incudine sulla schermata di forgia/loading, con messaggi a tema in vignetta;
  "Smithy forgia i tuoi giochi" (faccia pubblica del prodotto; Hermes resta il nome
  tecnico interno dell'orchestratore). Animazione di forgia durante la generazione.
- **RAG code-chunk misurato** — telemetria hit/miss dei ~7.336 chunk + A/B (KB on/off su
  compile-rate); rinforzare solo dove i dati mostrano valore. (Meno centrale ora che
  l'LLM scrive meno codice — ma utile per il `mechanics_delta_gen`.)
- **LoRA selector** — i ~40 LoRA HF sono dormienti; gate sui dati: misurare quanto spesso
  un run paid arriva a FLUX (CC0 insufficiente). Se frequente → `match_loras`
  (style_pack+brief → `lora_hf_repo`) iniettato nel nodo sprite/animazione. CHECK: molti
  LoRA catalogati sono SDXL, noi FLUX → verificare compatibilità. Solo paid, `ensureAllowed`.
- **Export/ownership + feed/flywheel (moat)** — già parzialmente presenti; mantenerli
  attraverso tutto il nuovo sistema (ogni asset e gioco posseduto ed esportabile).
- **Playtester LLM** — oggi smoke+D.3+D.6+playtest-via-stato; evolvere verso un giudice
  LLM che gioca via stato strutturato (non pixel). Con GameSpec/composer lo stato di test
  è ancora più pulito da esporre.

## File chiave (da creare/toccare)
- **Nuovi:** `lib/contracts/game-spec.contract.ts` (GameSpec union), `lib/contracts/engine-composer.contract.ts` (porta), `lib/runtime/composer/<engine>/` (adattatori), `lib/studio/{tile-size,palette,frame-analyzer}.ts` (detection).
- **Esistenti da riusare:** `lib/tools/level/tilemap_populate/` (.tmj), `_platformer-physics.ts` (`jumpReachCells`), `lib/studio/{slicer,pixel-snap,material-maps}.ts`, `lib/tools/audio/` (wire), `asset-resolver` (bridge), `app/(dashboard)/studio/`.
- **Da modificare:** `lib/reasoning/dag-builder.ts` (nodo compose_gamespec), `lib/reasoning/execution.ts` (wireInputs → composer), `lib/runtime/assembler/scaffold.ts` (scena vera + fallback→composer), `lib/tools/code/_codegen.ts` (ridotto a mechanics_delta).

## Principi trasversali (invariati)
- CC0-first gratis, generativo a paywall (`ensureAllowed`). Esagonale: riempi porte.
- Export/ownership non negoziabile. Contratti read-only → contract proposal.
- Verifica sempre col DATO: run reale → run_traces → SCREENSHOT → giocabile.
- La pipeline LLM attuale resta in produzione finché il nuovo sistema non la supera.

## Costi/rischi onesti
- **~8-10 settimane** al primo risultato visibilmente buono e cross-engine (build
  Godot WASM 60-180s + loop sandbox/deploy lento → stima realistica, non 6).
- Rischio #1 = **disciplina orizzontale** (non scivolare in vertical slice mascherato).
- Rischio #2 = **over-engineering del GameSpec** (il filtro pseudo-codice lo contiene).
- Lo Studio NON deve diventare la scusa per non affrontare il composer → paletti FASE 0
  (schema co-disegnato) e parallelo carta obbligatori.

## Verifica end-to-end (per fase)
- FASE 0: review schema (ogni campo traducibile in Godot+Phaser).
- FASE 1: query DB (campi enriched popolati) + Library UI naviga + gioco con musica CC0.
- FASE 2: stesso GameSpec → screenshot scena coerente in Godot E Phaser; `tsc`+`vitest`.
- FASE 3: 20-30 run reali, `passed` rate ≥70%, screenshot non-grigio/non-stirato.
