# Perplexity Deep Research — PCG, asset, controller, runtime (2026-06-07)

Risultato della Perplexity Deep Research per la svolta "struttura garantita-giocabile" (vedi piano
`~/.claude/plans/svolgi-sia-uno-che-sharded-allen.md`). Risorse con licenze permissive, pronte a
innestarsi nella pipeline GameSmith. Principio di fondo confermato: **l'LLM NON sceglie geometria,
fisica o distanze dei salti; sceglie pattern e contenuto; un algoritmo deterministico traduce in
geometria rispettando i vincoli fisici.**

## 1. Generazione mappe/livelli 2D

### 1.1 Platformer con salti garantiti
- **Toolbox jump-difficulty (Compton & Mateas / Smith et al.)** — formule per stimare difficoltà e
  probabilità di successo di un salto + completamento livello. Paper: "The evolution of fun: Automatic
  level design through challenge modeling", "Procedural Level Design for Platform Games".
  → Implementare in TS il modello di salto: dato jump_speed/gravity/max_air_time del controller →
  distanza max orizzontale/verticale. Ogni gap validato contro queste formule prima di accettarlo.
- **PCGRL — gym-pcgrl** (MIT): https://github.com/amidos2006/gym-pcgrl — ambiente Gym, l'agente modifica
  una griglia finché soddisfa metriche (path length, n. buchi...). Eseguibile come servizio Python; il
  Node orchestrator passa parametri alto-livello e riceve una griglia valida.
- **Mario AI Framework** (evaluator "completion %" via agente che gioca): 
  https://github.com/amidos2006/Mario-AI-Framework
- **pcg_benchmark** (MIT): https://github.com/amidos2006/pcg_benchmark — confronto generatori.

### 1.2 Top-down / overworld — WFC
- **kchapelier/wavefunctioncollapse** (MIT, npm JS): https://github.com/kchapelier/wavefunctioncollapse
- **mxgmn/WaveFunctionCollapse** (MIT, originale C#): https://github.com/mxgmn/WaveFunctionCollapse
  → L'LLM definisce vocabolario tile + macro-regole (acqua≠lava); WFC produce la mappa concreta.

### 1.3 Formati/import
- **Tiled** `.tmx`/`.tmj` = formato di scambio standard (non serve la GUI, generiamo il JSON noi).
- **vnen/godot-tiled-importer** (MIT): https://github.com/vnen/godot-tiled-importer
- **Phaser 3**: `this.load.tilemapTiledJSON(...)` → `this.make.tilemap(...)`.

## 2. Mappe/livelli pronti CC0
- **jamesbowman/tiled-maps** (CC0 desert level + tileset): https://github.com/jamesbowman/tiled-maps
- **Tiled CC0 example maps** (forum mapeditor).
- **OGA Top-Down Dungeon Pack** (CC0, 2256 tile + .tsx + mappa esempio):
  https://opengameart.org/content/top-down-dungeon-pack

## 3. Animazioni 2D / sprite animati
- **RGS_Dev — Animated Stick Figure 2D** (CC0): idle/walk/run/jump/slide/dash/climb/damage/death/...
  https://rgsdev.itch.io/animated-stick-figure-character-2d-free-cc0 — "default humanoid" per prototipi.
- **itch.io CC0 Sprites**: https://itch.io/game-assets/assets-cc0/tag-sprites
- **OGA animated** (es. "Ninja [Animated]") — verificare CC0/CC-BY per asset.
- Slicing: **Miisan-png/sprite-sheet-slicer** (MIT): https://github.com/Miisan-png/sprite-sheet-slicer
  / approccio canvas (come GDevelop import-spritesheet, MIT). Microservizio Node con `canvas`/`sharp`.

## 4. Musica CC0 (gap #1: audio_music = 0)
- **FreePD** (CC0, per mood: horror/tension/sci-fi/...): https://freepd.com
- **Duckhive — CC0 Game Music Vol.1** (chiptune loopabile WAV): https://duckhive.itch.io/game-music-1
- **Not Jam Music Pack** (CC0, loop).
- **itch.io CC0 music**: https://itch.io/game-assets/tag-cc0/tag-music
- **OGA Calm/Relaxing (CC0)**: https://opengameart.org/content/cc0-calm-relaxing-music

## 5. Controller giocatore + fisica (NON inventati dall'LLM)
### Godot 4
- **noasey — Ultimate 2D Platformer Controller** (MIT): movimento/salto/coyote/dash/wall/roll/run.
  https://noasey.itch.io/ultimate-2d-platformer-controller
- **Ev01/PlatformerController2D** (MIT): https://github.com/Ev01/PlatformerController2D (più leggero).
- Top-down template Godot 4 (verificare licenza repo).
### Phaser 3
- **jpdf00/phaser3-plataformer** (MIT): https://github.com/jpdf00/phaser3-plataformer (estrarre player:
  accel/gravity/double-jump). + aggiungere coyote-time/jump-buffer.
- Tutorial top-down Phaser 3 (micropi) per controller 4-direzioni.
> Idea chiave: GameSmith sceglie UNO tra pochi controller MIT; l'LLM agisce solo su PARAMETRI entro
> range safe (più floaty/pesante), MAI sulle distanze/physics base. Il profilo di salto delle formule
> (§1.1) deve riflettere ESATTAMENTE i parametri del controller scelto → geometria e fisica coerenti.

## 6. Tassonomie / classificazione stile (per popolare style_pack_compat, oggi VUOTO)
- Tassonomia tag **OpenGameArt** (pixelart/lowpoly/overhead/sidescroller/fantasy/scifi...) + tag itch.
- Enum suggeriti: `dimension: 2D|3D`, `style: pixel|lowpoly|handpainted|realistic|abstract|flat`,
  `tone: cute|horror|grimdark|bright`, `perspective: sidescroller|topdown|isometric`.
- **IsItPixelArt** (CV open, pixel-or-not, dataset CC0): https://devpost.com/software/isitpixelart
  → filtro automatico "è pixel art?" per annotare la asset DB. (Nyckel = alternativa cloud, ToS.)

## 7. Runtime "engine + data" JS (opzionali, valutare — NON adottare ora)
- **Kaboom.js** (MIT): https://github.com/replit/kaboom — mini-runtime JSON-driven, headless in Node →
  utile come quick-preview/QA interno (non sostituisce Godot/Phaser).
- **GDevelop** (engine MIT) + **gdexporter** (CLI headless): https://github.com/arthuro555/gdexporter —
  progetti = JSON (scene/eventi/oggetti). Layer "no-code-style" se un domani serve.

## 8. PCG parametrico (genre/difficulty/theme → struttura)
- **PCGRL metrics** (difficulty, lenience, path length, reward density) — l'LLM setta i parametri.
- **VGDL / GVGAI** (Apache-2.0): https://github.com/rubenrtorrado/GVGAI_GYM — VGDL = linguaggio testuale
  per descrivere sprite/regole/vittoria/layout → layer intermedio LLM-friendly traducibile in JSON nostro.
- **Difficulty-curve frameworks** (endless runner): curva 1D (distanza → densità ostacoli); l'LLM sceglie
  solo la forma (lineare/sinusoidale/picchi), il generatore piazza chunk rispettando i vincoli di salto.

## Come si innesta in GameSmith (mappa fasi del piano)
1. Preset utente → 2. Game Designer → parametri strutturali (jumpProfile entro range controller,
difficultyMetrics) + meccaniche → 3. Generatore deterministico (platformer: jump-toolbox/PCGRL;
top-down: WFC; dungeon: rot-js) → AbstractLayout validato (reachability + jump-reachability) →
4. Asset coerenti (style+genre+engine) + controller MIT fisso → 5. code_gen costruisce SUL livello,
estende il controller, aggiunge SOLO meccaniche → 6. build → Playtester → rigenera col reason.
