# Gemini Deep Research — RAG dataset expansion brief

## 1. Cosa stiamo costruendo (in 60 secondi)

Game Studio AI è una piattaforma SaaS commerciale che genera giochi
completi a partire da prompt utente, per 8 motori distinti. Sotto il
cofano ha un **RAG knowledge base** (Supabase pgvector, embedding
OpenAI 1536-dim) di **7 503 chunk di codice** classificati in una
tassonomia 21 categorie × 8 engine × 20 generi videoludici × 43
key-features × 12 design pattern. Prima di generare codice, ogni tool
chiama `getReferences()` e inietta chunk reali da progetti open-source
come grounding per il modello LLM.

**Test empirico appena concluso (8 engine, gpt-4o + sonnet-4-6
evaluator, task baseline per engine)**: la KB porta +2 punti totali su
80, gate di blueprint (≥3 vincite su 5 criteri) passato 0/8 perché
gpt-4o satura il 10/10 su task mainstream. Ma su un test mirato di
nicchia (Ren'Py inventory) la KB ha vinto 4/5. Conclusione: **la KB
serve dove il modello base sbaglia**, cioè (a) feature di nicchia,
(b) generi poco rappresentati nel training del modello, (c) modelli più
deboli. Vogliamo ampliare la KB esattamente lì.

## 2. Quello che ci serve da te

Cerca **ovunque**, su qualsiasi piattaforma raggiungibile (GitHub,
GitLab, Codeberg, SourceHut, Bitbucket, Itch.io devlogs+linked repos,
itch.io bundles open-source, Gitee, jam.host indie pages, awesome-list
README di terze parti, university course repos, conference talk
companions, Twitch dev streams con repo nel pannello, archived
SourceForge/Google-Code, defold.com community libraries, godot asset
library mirror su GitHub, MonoGame samples ecosystem, Three.js
showcases collegati a sorgenti aperti, Stride community toolkit
contributors, LÖVE forum threads con link a repo, Ren'Py mod
collections, Phaser official tutorials, anche progetti universitari
serbi/cinesi/giapponesi pubblicati su GitLab/Gitee), **progetti
open-source con licenza PERMISSIVA che riempiano i gap qui sotto**.

Per ogni candidato che proponi mi serve obbligatoriamente:
- URL completo (clonabile)
- Licenza esatta (SPDX se possibile, MIT/Apache-2.0/BSD-x/CC0-1.0/
  Unlicense/ISC/Zlib/CC-BY-4.0/MPL-2.0/EPL-2.0 sono OK; **GPL/AGPL/
  LGPL/CC-BY-NC/CC-BY-SA/proprietary sono ESCLUSI**, niente "TODO check
  license" — se non è verificabile non lo includere)
- Engine target (uno degli 8: godot, phaser, renpy, defold, monogame,
  love2d, threejs, stride)
- Categoria della tassonomia che riempie (lista al §3)
- Stelle/star count se disponibile (proxy di qualità)
- Dimensione approssimativa (KB o file count — vincolo: niente repo
  >100MB se non subdir-scopabili)
- Una riga sul perché è rilevante e una citazione/link a un file
  concreto (no: "questo repo ha cose buone")

## 3. Tassonomia esatta — usala letteralmente

### 3.1 21 categorie primarie (engine × categoria è la cella che vogliamo riempire)

```
A01_player_controller    A02_state_machine        A03_combat
A04_enemy_ai             A05_camera
B01_level_structure      B02_procedural_gen       B03_physics_collision
B04_navigation
C01_progression          C02_inventory            C03_dialogue_narrative
C04_save_load
D01_ui                   D02_audio                D03_vfx
E01_project_structure    E02_signals_events       E03_game_flow
E04_genre_specific
X01_utility
```

### 3.2 20 generi (un chunk può avere più generi nell'array genre_tags)

```
platformer  metroidvania  roguelike  rpg  jrpg  visual_novel
puzzle  card_game  horror  arcade  sim  tower_defense  racing
rhythm  stealth  bullet_hell  fighting  survival  sandbox  generic
```

### 3.3 43 key features (granulari, "feature in code")

```
coyote_time  wall_jump  dash  i_frames  screen_shake  hit_stop
input_buffer  combo  patrol  chase  boss_phase  typewriter_text
branching_dialogue  wave_spawner  parallax  day_night_cycle
save_checkpoint  inventory_grid  crafting  skill_tree  procedural_gen
pathfinding  steering  loot_drop  xp_leveling  camera_follow
camera_shake  dead_zone  one_way_platform  moving_platform
destructible  projectile  knockback  damage_number  health_bar
minimap  audio_spatial  bgm_crossfade  footstep_system  particle_effect
shader_custom  post_processing  squash_stretch
```

### 3.4 12 design pattern

```
state_machine  observer  singleton  component  strategy  command
factory  object_pool  behavior_tree  pub_sub  mediator  decorator
```

## 4. Dove stiamo bene — NON serve cercare qui

Per non sprecare le tue query, ecco le combinazioni dove abbiamo già
copertura buona o eccellente:

- **godot**: 3 357 chunk, copre tutte le 21 categorie. Specialmente
  forte su player_controller (224), combat (139), state_machine (41),
  inventory (109), save_load (157), dialogue (103). Coverage genere
  rpg=301, platformer=73, metroidvania=45, roguelike=46, card_game=65.
- **threejs**: 981 chunk, fortissimo su scene/E01 (250), vfx (116),
  camera (24). Genere sandbox=18, survival=8, rhythm=10.
- **monogame**: 846 chunk, copre player/physics/E01 (250). Genere
  arcade=18, platformer=29.
- **phaser**: 971 chunk, top platformer (205 player_controller),
  physics (84), vfx (175), camera (72). Genere platformer=24,
  puzzle=16, arcade=70, bullet_hell=9.
- **defold**: 796 chunk, top E01/E02/X01. Genere platformer=22,
  arcade=22.
- **love2d**: 718 chunk, E03 forte (82). Genere arcade=16.
- **renpy**: 591 chunk, **dominante per visual_novel** (327). C03
  dialogue=122, C04 save=26, C02 inventory=12.
- **stride**: 215 chunk, solo physics-driven 3D (B03=56).

**Non proporci altri "godot RPG generici" o "phaser platformer
generici". Sono saturi.** Stessa cosa per qualsiasi cella che già
abbiamo a ≥100 chunk.

## 5. I VERI GAP — qui vogliamo bombardamento

### 5.1 Celle engine × categoria a ZERO o quasi (priorità massima)

Le seguenti coppie sono a 0 o ≤4 chunk e NON sono semi-attese (cioè
escludiamo i gap strutturali di Ren'Py su player_controller/physics
che sono normali per un'engine di Visual Novel):

**P0 — completamente vuote, blocchere casi d'uso reali**:
- `phaser × B04_navigation` (0): A* / pathfinding su Phaser
- `phaser × C03_dialogue_narrative` (0): dialogue tree per HTML5/RPG Phaser
- `phaser × C04_save_load` (0): localStorage save system Phaser
- `phaser × E04_genre_specific` (0): visual novel / RPG core systems Phaser
- `phaser × X01_utility` (0): helper utilities Phaser
- `monogame × C01_progression` (0): XP/leveling/skill_tree MonoGame
- `monogame × C03_dialogue_narrative` (0): dialogue system MonoGame
- `stride × C01_progression` (0): progression Stride
- `stride × C02_inventory` (0): inventory Stride
- `stride × C03_dialogue_narrative` (0): dialogue Stride
- `stride × C04_save_load` (0): save Stride
- `stride × E04_genre_specific` (0): genere-specific Stride

**P1 — quasi vuote, ≤4 chunk**:
- `phaser.A04_enemy_ai` (4): AI nemico Phaser (chase/patrol)
- `phaser.B02_procedural_gen` (4): procedural Phaser
- `phaser.C01_progression` (2): progression Phaser
- `phaser.C02_inventory` (4): inventory Phaser
- `defold.A03_combat` (3): combat Defold
- `monogame.B02_procedural_gen` (3): procgen MonoGame
- `monogame.C02_inventory` (1): inventory MonoGame
- `monogame.C04_save_load` (1): save MonoGame
- `love2d.B04_navigation` (3), `love2d.C01_progression` (3),
  `love2d.C03_dialogue_narrative` (1), `love2d.C04_save_load` (4)
- `threejs.C01_progression` (4), `threejs.C02_inventory` (4),
  `threejs.C03_dialogue_narrative` (3)
- `stride.A02_state_machine` (4), `.A03_combat` (2), `.A04_enemy_ai` (1),
  `.B01_level_structure` (3), `.B02_procedural_gen` (1),
  `.B04_navigation` (4), `.D02_audio` (3), `.E02_signals_events` (4)

### 5.2 Generi videoludici sotto-rappresentati

Conteggi totali chunk per genere (su 7 503):

- `stealth` = **0** chunk totali → cerca tutto, qualunque engine
- `jrpg` = **1** chunk → praticamente vuoto
- `horror` = 8 → solo Ren'Py
- `fighting` = 12 → solo godot
- `tower_defense` = 12 → solo godot
- `survival` = 14 → quasi vuoto
- `rhythm` = 23 → solo threejs
- `bullet_hell` = 26 → phaser
- `racing` = 34 → godot
- `roguelike` = 52 → solo godot
- `metroidvania` = 54 → quasi solo godot
- `sandbox` = 58 → distribuito ma sottile
- `puzzle` = 59 → distribuito ma sottile

**Per ogni genere sopra**, cerca progetti open-source con licenza
verificata su ognuno degli 8 engine — soprattutto stealth, jrpg,
horror, fighting, tower_defense dove abbiamo zero o quasi.

### 5.3 Key-features thin / mancanti

Feature granulari sotto i 10 chunk (su 43 totali):

- `hit_stop` (7), `boss_phase` (6), `footstep_system` (9)

Quelle a 10-25 (utili da rinforzare):

- `combo` (14), `dash` (15), `wall_jump` (13), `i_frames` (13),
  `crafting` (13), `tower_defense_*` ecc., `skill_tree` (18),
  `xp_leveling` (23), `rhythm`, `survival`, `card_game` patterns.

Esempi concreti che cerchi:
- "hit_stop pattern in monogame fighting"
- "boss_phase state machine in any engine"
- "footstep_system spatial audio in three.js"
- "combo system + cancel windows in godot fighting"
- "skill_tree implementation in defold RPG"

### 5.4 Categorie "fat" da NON cercare più

Già al cap o oltre — non proporre repo che generano altro material qui:

- `*.E01_project_structure` (boilerplate, già cappato a 250)
- `*.D01_ui` generico (già cappato per godot e renpy)
- `godot.E02_signals_events` (cappato)
- `*.X01_utility` generico

## 6. Vincoli durissimi

1. **Licenza permissiva o niente.** MIT, Apache-2.0, BSD-2/3-Clause,
   CC0-1.0, Unlicense, ISC, Zlib, CC-BY-4.0, MPL-2.0, EPL-2.0.
   Qualsiasi GPL/AGPL/LGPL/CC-BY-NC/CC-BY-SA/proprietary/unknown è
   ESCLUSO. Se devi indovinare la licenza, non includerlo.

2. **Niente repo già nel manifest.** Ecco i 940 URL già harvested:
   esclusi automaticamente per dedup. Se ne hai dubbi, indicalo, lo
   verifichiamo noi.

3. **Spazio disco limite**: per ogni repo proposto, indica la size.
   Sopra 100MB serve giustificare con subdir specifica (es. solo
   `engine/dlib/src` di un mega-repo).

4. **Niente "awesome-list" generiche.** Vogliamo i progetti
   sottostanti, non i META-elenchi. Se la fonte è una awesome-list,
   estrai i 3-5 progetti più rilevanti per ogni gap e proponi quelli.

5. **Niente progetti "tutorial-only" da 50 LOC.** Soglia minima ~300
   LOC di codice engine-specifico (escluso README, asset, build
   config). Vogliamo materiale ricco da chunkare.

6. **Niente codice generato da LLM.** Salta repo che dichiarano
   esplicitamente "generated by GPT" o simili.

## 7. Output che mi serve

Per ogni gap (categoria × engine, o genere × engine, o feature) elenca
**5-15 candidati ordinati per qualità**. Formato per ciascuno:

```
- Gap: phaser × C03_dialogue_narrative
  URL: https://github.com/owner/repo
  Licenza: MIT  | Stars: 240  | Size: 18 MB
  Engine: phaser
  Relevance: implementazione completa di branching dialogue con
    typewriter, choice menu, character emotion swaps. File chiave:
    src/dialogue/DialogueManager.js (link al file).
  Note: il README dichiara Phaser 3.60+, compatibile con il nostro
    parser.
```

Priorità di ricerca, dall'alto al basso:

1. P0 celle a ZERO (§5.1, parte alta)
2. Generi a zero o ≤15 chunk totali (stealth, jrpg, horror, fighting,
   tower_defense)
3. P1 celle quasi vuote
4. Key-features thin (§5.3)
5. Generi sotto-rappresentati (§5.2 parte bassa)

## 8. Fonti suggerite, ma vai oltre

Conosciamo già: GitHub search API, GitLab REST API, Itch.io HTML
scraping (validato in Fase 1bis). Esplora anche:

- **Codeberg** (codeberg.org) — molti progetti europei FOSS
- **Gitee** (gitee.com) — ecosystem cinese, ricco di JRPG/visual novel
  asiatici su Ren'Py, Phaser, MonoGame
- **SourceHut** (sr.ht) — comunità Lua/Defold/love2d
- **Defold community library** (defold.com/community/libraries/)
- **Godot Asset Library** (godotengine.org/asset-library/)
- **MonoGame Community Hub** (monogame.net/about/#community)
- **LÖVE forums** thread con link a repo (love2d.org/forums/)
- **Phaser Examples ecosystem** (phaser.io/examples)
- **Stride community-toolkit contributors** (stride3d.net/community/)
- **itch.io filtrato "open-source"** + link nel devlog
- **University coursework repos**: cerca "CS3450 game development",
  "DH2323 game programming", "INFR11150" ecc.
- **Game jam archive** (ldjam.com, itch.io/jams) — molti finalisti
  pubblicano sorgenti permissivi
- **Twitch dev streamers** che pubblicano i game-jam con repo MIT
- **Archived projects** su archive.softwareheritage.org

## 9. Esempi concreti del tipo di output utile

**Esempio BUONO**:
```
- Gap: stride × C02_inventory
  URL: https://github.com/Kryptos-FR/Stride.Editor.RPG
  Licenza: MIT  | Stars: 87  | Size: 12 MB
  Engine: stride
  Relevance: editor estensibile per RPG con sistema inventory drag-drop,
    serializzato come asset Stride. File chiave: Source/Items/
    InventoryComponent.cs (220 LOC, 11 metodi pubblici).
```

**Esempio INUTILE (non proporci)**:
```
- "Forse XYZ ha qualcosa di simile, da verificare"
- "Su GitHub ci sono tanti progetti Stride"  (troppo vago)
- "Repo X ma licenza incerta"  (no, licenza deve essere certa)
```

## 10. Bonus, se ne trovi

- Materiale per **engine non ancora supportati** ma simili ai nostri:
  Bevy (Rust), MacroQuad (Rust), Pixi.js (JS), Solar2D (Lua),
  Stride3d-extensions, Ebitengine (Go), Heaps.io (Haxe) — ci interessa
  per planning futuro, non come target Fase 2.
- Game design documents permissivi (CC-BY-4.0) che potrebbero
  arricchire i prompt di alto livello.
- Linee guida ufficiali engine (es. "Godot best practices" doc) — non
  per RAG ma per il system prompt dei tool.

## TL;DR per te

Trovami, per ognuno degli 8 motori, **progetti OSS verificati a licenza
permissiva** che riempiano gap precisi nella nostra tassonomia di 21
categorie × 20 generi × 43 features. Priorità assoluta: celle a ZERO
nelle combinazioni (§5.1), generi a zero come stealth e jrpg (§5.2),
feature thin come hit_stop / boss_phase / combo / skill_tree.
Esplora **ovunque**, anche piattaforme non occidentali (Gitee), anche
archivi e devlog di game jam. Niente vaghezze: URL + licenza + size +
file concreto + riga di motivazione. Vogliamo armi vere per la Fase
1quater dell'harvest.
