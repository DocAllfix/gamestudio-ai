# RAG Gap Decisions — cosa fare per ogni zero-cell critica

**Data**: 2026-05-24
**Scope**: per ognuna delle celle problematiche del dataset
`code_knowledge` (vedi `FINDING_phase1ter_residual_gaps.md`), decidere:
COMPENSIAMO (template hardcoded) / ESCLUDIAMO (rinviamo a Fase 2 di
prodotto) / HARVEST (nuovo round mirato).

Output: tabella di decisioni + plan di compensazione.

---

## 1. Recap stato dataset

| Engine | Chunk | Gap critici per Genre Template day-1 |
|---|---:|---|
| godot | 3 357 | Nessuno — copertura completa |
| threejs | 1 270 | Postprocessing pipeline (EffectComposer) sottile |
| monogame | 1 090 | **C01_progression (0)**, **C03_dialogue (0)** |
| phaser | 968 | **C03_dialogue (0)**, **C04_save_load (0)** |
| defold | 796 | Nessuno critico — copertura ampia |
| love2d | 718 | C03 sottile (~5) |
| renpy | 591 | A/B vuoti (atteso per VN — non gap) |
| stride | 215 | **C01/C02/C03/C04/E04 quasi tutti vuoti** |

Tot: 7 503 chunk verificati, 0 GPL, 0 fat cells.

---

## 2. Mapping gap → Genre Template impattato

| Template | Engine | Categorie critiche | Gap riscontrato |
|---|---|---|---|
| T01 Metroidvania | Godot | A01/A02/A03/B03 | OK |
| T02 Visual Novel | Ren'Py | C03/C04/D01/D02 | OK (post Fase 1ter) |
| T03 Mobile Puzzle | Defold | A02/B01/D01 | OK |
| T04 Browser Arcade | Phaser | A01/A05/B03 | OK |
| T05 JRPG Top-down (Godot) | Godot | C01/C03/C04 | OK |
| T05-alt JRPG (MonoGame) | MonoGame | C01/C03/C04 | **GAP** |
| T06 Card Game | LÖVE | A01/B02/C02 | OK |
| T07 Platformer Hardcore | MonoGame | A01/A02/A03/B03 | OK |
| T08 Roguelike | Godot | A01-A05/B02 | OK |
| T09 3D Browser | Three.js | A01/A05/B01 | OK (ma manca shader pipeline) |
| T10 Stride 3D | Stride | A01-A05/B/C | **GAP STRUTTURALE** |
| T11 Multiplayer | Godot + Nakama | C01/A01 | OK |
| T12 Social Sim | Godot + Ollama | C01/C03 | OK |
| T13 Bullet Hell | LÖVE | A01/A03/A05 | OK |
| T14 Retro 8-bit | Godot/LÖVE | A01/A02/A05 | OK |

**4 template a rischio**: T05-alt MonoGame JRPG, T10 Stride 3D, T02 e
T04 hanno gap secondari su dialogue/save Phaser ma sono compensati
dall'engine alternativo.

---

## 3. Decisione per ogni gap

### G.1 — monogame × C01_progression / C03_dialogue (0 chunk)

**Decisione**: **COMPENSIAMO via Genre Template hardcoded** + **non
promettere T05-alt MonoGame JRPG come tier "wow day-1"**.

**Rationale**: già confermato strutturale da Fase 1quater (harvest
luminus-rpg + Monofoxe → 1.5% accept rate). MonoGame ha ottimi
giochi RPG shipped (Stardew, Streets of Rage 4) ma il codice OSS RPG
permissivo non esiste.

**Compensazione concreta**:
1. T05 JRPG day-1 = **Godot only**, con MonoGame come "beta" via
   Aesthetic Coherence con C# code template.
2. Hardcode in `genre_templates` table: per T05-alt MonoGame,
   `code_template_repos` punta a 2-3 snippet curati manualmente
   (Stardew DEW Tools, Nez framework snippet) come baseline.
3. Etichetta UI: "MonoGame JRPG (Beta)" nel template picker.

### G.2 — phaser × C03_dialogue / C04_save_load (0 chunk)

**Decisione**: **COMPENSIAMO via template ibrido**.

**Rationale**: Phaser ha plugin commerciali (rexrainbow/phaser3-rex-
plugins, 902MB, non includibile) per dialogue. Per save_load è
tipicamente LocalStorage o IndexedDB — pattern semplici che l'LLM
genera correttamente da prompt, NON serve RAG.

**Compensazione concreta**:
1. **Dialogue Phaser**: T04 Browser Arcade non richiede dialogue
   complesso. Per il sottoinsieme T04+VN (visual novel su Phaser),
   il D.5 hardcoda un mini-template ink → Phaser parser (~50 righe
   TypeScript) come scaffolding.
2. **Save Phaser**: hardcode 1 helper `phaser_save_helper.ts` (~30
   righe LocalStorage wrapper con versioning) come default per ogni
   T04.
3. Nessun harvest dedicato — pattern conosciuti, costo opportunità
   alto vs benefit basso.

### G.3 — stride × quasi tutto (215 totali, sotto la soglia 350)

**Decisione**: **ESCLUDIAMO Stride dai 8 engine "wow day-1"** + **lo
manteniamo come "Beta Engine"**.

**Rationale**: ecosistema OSS Stride è ~6 repo (già tutti processati).
215 chunk è il tetto pratico. Non c'è modo onesto di renderlo "wow"
al primo prompt senza inquinare il dataset.

**Compensazione concreta**:
1. **Stride al lancio = "Beta"**: visibile nel picker engine ma con
   warning "Best for advanced users — requires manual refinement
   post-generation".
2. **Reasoning Engine** per Stride salta il Playtester Agent
   (M.2 PARTE BLUEPRINT) — troppi falsi negativi dovuti a stato
   immature degli asset/codice generato.
3. **Hardcoded scaffold**: per T10 Stride 3D, `code_template_repos`
   include 3 path specifici nel `stride3d/stride/samples/` (già nel
   KB ma indicizzati come "starter rigidi", non come pattern di
   riuso).
4. **Pietra v5 aggiorna**: lista degli 8 engine ma differenzia "7
   shipped + 1 beta (Stride)".

**Trade-off accettato**: T10 non è una promessa wow al day-1. È un
"easter egg" per i power user.

### G.4 — threejs postprocessing/EffectComposer pipeline (sottile)

**Decisione**: **HARVEST mirato leggero (1 sessione, ~$0.20)**.

**Rationale**: il dataset Three.js ha 1270 chunk ma è light su
shader / postprocessing avanzato. Per il template T09 (3D Browser
Showcase) il D.5 deve poter generare effetti che fanno "wow"
(bloom, FXAA, depth of field, chromatic aberration). Senza pattern
nel RAG, l'LLM scrive shader generici.

**Compensazione concreta**:
1. Harvest mirato: cercare ~10-15 repo OSS che usano
   `three/examples/jsm/postprocessing/EffectComposer` + LUT shader.
   Topic GitHub: `topic:threejs-shaders`, `topic:postprocessing`,
   `topic:webgl-vfx`.
2. Aggiungere a `_sources.py` come `CURATED` con bypass.
3. Eseguire 01_scrape → 05_embed_store solo per engine='threejs'.
4. Atteso: +50-100 chunk su shader/postprocessing.
5. Costo classify: ~$0.05.

**Repo candidati noti** (da verificare in Fase Deep Research):
- `pmndrs/postprocessing` (MIT, mega-popular) — già nel KB?
- `mrdoob/three.js/examples/jsm/postprocessing/*` (probabilmente già
  estratti dal nostro scrape mrdoob/three.js — verificare)
- `gkjohnson/three-gpu-pathtracer` (MIT)
- `donmccurdy/glTF-Transform` (MIT, già nel KB?)
- `vanruesc/postprocessing` (MIT, fork moderno con TAA, bloom, dof)

### G.5 — love2d × C03_dialogue (sottile, ~5 chunk)

**Decisione**: **COMPENSIAMO con template ibrido (ink integration)**.

**Rationale**: LÖVE ha pochi shipped RPG narrativi OSS, ma `ink`
(inkle) ha un parser Lua mantenuto. Bastano 30-50 righe di
integration.

**Compensazione concreta**:
1. Hardcode `love_ink_dialogue_helper.lua` (~50 righe) nel template
   T06 Card Game e T13 Bullet Hell come optional addon.
2. Nessun harvest dedicato.

### G.6 — defold × Lua patterns moderni (potenzialmente sottile)

**Decisione**: **NESSUNA AZIONE** — 796 chunk sono sufficienti.

**Rationale**: già coperto in larghezza. Defold ha asset library
ufficiale + britzl plugin ricchi. T03 Mobile Puzzle è solido.

### G.7 — renpy × audio/animation patterns (D02 = 7 chunk)

**Decisione**: **NESSUNA AZIONE** — sufficiente per T02 baseline.

**Rationale**: Ren'Py gestisce audio via API standard semplici. 7
chunk + Ren'Py Cookbook (in commenti dei chunk già indicizzati)
bastano.

---

## 4. Riepilogo decisioni

| Gap | Decisione | Effort | Costo $ | Effect su template day-1 |
|---|---|---:|---:|---|
| G.1 monogame RPG | COMPENSA + beta label | 2h dev | 0 | T05 = Godot only "wow", MonoGame "beta" |
| G.2 phaser dialog/save | COMPENSA hardcode | 3h dev | 0 | T04 wow OK, VN Phaser scaffold-only |
| G.3 stride tutto | ESCLUDI dai wow | 1h dev | 0 | T10 = "beta" engine |
| G.4 threejs shader | HARVEST mirato | 4h | $0.20 | T09 wow PIENO |
| G.5 love2d dialog | COMPENSA ink helper | 1h dev | 0 | T06/T13 OK |
| G.6 defold | nessuna | 0 | 0 | T03 wow OK |
| G.7 renpy audio | nessuna | 0 | 0 | T02 wow OK |

**Totale effort di compensazione: ~11h dev + $0.20 API.**

**Effect netto sul "wow day-1"**:
- **8 template wow (out of 14)**: T01, T02, T03, T04, T05 (Godot),
  T06, T07, T08, T09, T11, T12, T13, T14 = **13 wow** + 1 beta (T10
  Stride).
- T05-alt MonoGame JRPG **resta wow** ma con scaffolding hardcoded
  (non RAG retrieval).

**Pietra v5 dichiarerà**: "14 generi giocabili al day-1, 13 in tier
wow effect, 1 in beta engine (Stride 3D)."

---

## 5. Implementazione dei compensation hardcode

I template scaffold da scrivere (in Sett 2 dello sviluppo):

```
templates/
├── monogame/
│   ├── jrpg_progression.cs       # XP/level/stat baseline (~80 righe)
│   ├── jrpg_dialogue.cs          # ink + MonoGame integration
│   └── README_BETA.md
├── phaser/
│   ├── phaser_save_helper.ts     # LocalStorage versioning
│   ├── ink_phaser_runtime.ts     # ink JSON consumer
│   └── README_BETA.md
├── love2d/
│   └── love_ink_dialogue.lua     # ink Lua integration
└── stride/
    ├── starter_scaffold/         # progetto Stride boot-ready
    └── README_BETA.md
```

Questi scaffold vivono nel repo (versionati), il D.5 li copia nel
progetto generato quando rileva il template + engine matching.

---

## 6. Cosa va monitorato post-launch

Anche con queste compensazioni, il post-launch deve misurare:

1. **Coherence score per template**: se T05-alt MonoGame produce
   coerenza < 0.6 in media, escluderlo del tutto.
2. **Playtester pass rate per Stride**: se < 50%, marcare T10 come
   "alpha" e nascondere dal picker per Free tier.
3. **Phaser dialogue requests**: se >10% degli utenti richiede VN su
   Phaser, riconsiderare harvest dedicato.
4. **Episodic memory boost** sul code_knowledge esistente: man mano
   che si accumula success_score, i chunk MonoGame esistenti che
   funzionano per RPG vengono priorizzati anche se sono in altre
   categorie. Self-healing parziale.

---

## 7. Decisioni non prese qui (da delegare)

- **Aggiungere Stride per davvero**: richiederebbe accordi con team
  stride3d per accedere a samples non pubblici (proprietary di
  ex-Xenko). Out of scope Fase 1.
- **Convertire commercial Phaser plugins**: rexrainbow ha plugin
  splendidi ma 902MB → richiede negoziato license. Out of scope.
- **Self-host del classifier**: per ridurre costi di harvest futuri.
  Considerare in Fase 2.

---

## 8. Tileset 2D — espansione futura [aggiunto 2026-06-04]

Il DB ha solo **35 tileset** (vs 1238 sprite, 554 model_3d, 19 animation_3d —
fonte: KB_STATE.md). Pochi per coprire tutti i generi 2D nel **Free tier**, dove
il generativo è gated (l'utente Free usa solo CC0). Per i tier PAY non è un
problema: `tilemap_populate` + FLUX (Replicate, già configurato) genera tile
on-demand nello stile richiesto coi nostri LoRA.

**Decisione: NON harvestare ora.** Riaprirebbe Fase 1 (frozen) ed è fuori dal
percorso critico (merge/swap/primo-test). Da affrontare come mini-"Fase 1ter"
mirato DOPO che `level_layout_2d`/`tilemap_populate` sono implementati e sappiamo
quali generi/stili gli utenti usano davvero (evita di harvestare tileset
sbagliati).

**Fonti CC0 candidate** (allowlist: CC0/CC-BY-4.0/OFL-1.1):
- **Kenney.nl** — il riferimento per tileset CC0 di qualità, già usato per asset
- **OpenGameArt** — CC0/CC-BY/OFL, ampio ma da filtrare licenze
- **Itch.io** (asset pack CC0)

**Effort stimato:** scraper mirato + classificazione + 1 migration additiva (NNN)
per inserire i nuovi tileset in `asset_library_index`. Non urgente.
