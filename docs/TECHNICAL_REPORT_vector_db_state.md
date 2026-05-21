# Report Tecnico — Stato del Database Vettoriale Game Studio AI

**Data**: 2026-05-21
**Destinatario**: tecnico valutatore (decisioni di harvest/espansione)
**Scopo**: fotografia precisa di cosa contiene il vettoriale, cosa abbiamo
imparato dai test su come i modelli recuperano semanticamente, dove
scarseggiamo rispetto a quello che il prodotto deve coprire, e cosa serve
prendere/dove/come per renderlo il miglior vettoriale possibile per lo scopo.

Tutti i numeri sono estratti live da Supabase il 2026-05-21, non stime.

---

## PARTE 1 — COSA ABBIAMO (lo stato fisico del vettoriale)

### 1.1 Infrastruttura

- **Storage**: Supabase PostgreSQL + estensione `pgvector` (server-side,
  attiva e verificata).
- **Embedding**: OpenAI `text-embedding-3-small`, 1536 dimensioni. 100%
  delle righe hanno un embedding non-null (verificato: 0 NULL).
- **Indice di ricerca**: HNSW `vector_cosine_ops` (m=16, ef_construction=64)
  su `code_knowledge.embedding`. Più indici B-tree (engine, category,
  chunk_type, complexity, quality, confidence) e GIN (genre_tags,
  key_features, subcategories, design_patterns) per il filtraggio ibrido.
- **Accesso**: 2 RPC PostgreSQL — `search_code_knowledge` (filtro + vector
  search ibrido) e `get_reference_parameters` (lookup parametri numerici).
  Entrambe testate (Fase 6: 20/20 query funzionali PASS).

### 1.2 Volumi

| Tabella | Righe | Cosa contiene |
|---|---:|---|
| `code_knowledge` | **8 517** | chunk accettati (confidence ≥85), vector-indexed, queryabili |
| `code_knowledge_quarantine` | **1 997** | chunk confidence 60-84, NON vector-searched di default |
| `game_parameters` | **1 862** | valori numerici estratti (il "DNA del game feel") |
| `ingestion_log` | **308** | 1 riga per repo sorgente, status='embedded' |

Origine: 308 repository open-source (licenze MIT/Apache/BSD/Zlib/CC0)
attraverso 8 engine, classificati da DeepSeek V4 Flash sotto JSON Schema
vincolato (zero categorie/generi fuori enum — garantito da validazione).

### 1.3 Cosa rende ogni chunk recuperabile

Ogni chunk in `code_knowledge` porta: codice sorgente reale, `summary`
(1 riga), `primary_category` (1 su 22), `subcategories` (pattern `A01.01`),
`genre_tags`, `key_features`, `design_patterns`, `complexity`,
`chunk_type` (full_recipe / single_mechanic / structural_pattern),
`quality_score` 1-5, `reusability_score` 1-5, `confidence_score`,
`source_repo`, `source_license`, e il vettore 1536-dim.

**Importante**: NON si fa embedding del codice grezzo, ma di una
`searchable_text` (summary + metadati tassonomici). Questo è il motivo per
cui le query in linguaggio naturale matchano bene — vedi Parte 2.

---

## PARTE 2 — COSA ABBIAMO CAPITO SU COME I MODELLI RECUPERANO

Questa è la parte che conta di più per chi deve decidere come espandere.
Tre lezioni empiriche dai test (Fase 6 query suite + Fase 7 A/B comparison,
documentato in [FINDING_dataset_boost_coverage.md](FINDING_dataset_boost_coverage.md)).

### 2.1 Il retrieval semantico funziona — e bene

Test su query in linguaggio naturale (Fase 6, dati reali):

| Query utente | Top-5 risultati | Pertinenza |
|---|---|---|
| "player controller with wall jump" | 5/5 hanno `wall_jump` (sim 0.61-0.70) | ottima |
| "camera follow with screen shake" | 5/5 hanno `screen_shake` (sim 0.62-0.64) | ottima |
| "dialogue branching visual novel renpy" | 3/3 renpy C03 (sim 0.75-0.78) | ottima |
| "enemy AI patrol chase" | 3/3 A04_enemy_ai (sim 0.66-0.68) | ottima |

Variance check: chunk A01 vs D02 hanno cosine sim 0.30-0.45 (ben sotto 0.8)
→ le categorie si separano nello spazio vettoriale, gli embedding non sono
degeneri. **Il meccanismo di recupero è sano.**

### 2.2 Lezione critica: il modello recupera per *similarità semantica*, non
per *correttezza di dominio*

L'embedding cattura il **significato** del `summary`+metadati. Quando un
utente chiede "metroidvania player controller", il top match può essere un
controller di un **twin-stick shooter** (BananaHolograma/alys) se quel chunk
ha summary semanticamente vicino — anche se i suoi parametri numerici
(max_speed 300) sono sbagliati per un metroidvania (atteso ~150).

**Conseguenza operativa**: la qualità del recupero dipende da quanto è
*denso e ben targettizzato* il dataset per quella nicchia. Con pochi chunk,
il "vicino più prossimo" può essere semanticamente simile ma
contestualmente sbagliato. Più chunk densi per nicchia = recupero più
preciso.

### 2.3 Lezione strategica: il boost della KB è CONDIZIONALE

Dal test A/B (Fase 7), due task realistici da utente finale:

- **Godot player controller** (224 chunk A01 disponibili): boost ~zero. I
  pattern canonici (coyote time, wall jump) sono già nel training di ogni
  LLM. La KB conferma ma non aggiunge.
- **Ren'Py inventory** (1 chunk C02, in quarantine): boost negativo. Il
  modello base È debole su Ren'Py, ma la KB non aveva chunk inventory veri
  da iniettare — solo screen UI generici.

**La KB porta valore solo dove (a) il modello base è debole E (b) abbiamo
copertura densa.** Oggi i due test mancano sempre una delle due condizioni.
Questo è il fatto che deve guidare l'espansione.

---

## PARTE 3 — DOVE SCARSEGGIAMO (analisi per asse)

### 3.1 Per ENGINE — squilibrio severo

| Engine | Chunk | % del totale | Categorie coperte /22 | Priorità prodotto |
|---|---:|---:|---:|---|
| godot | 3 357 | 39.4% | 21 | **PRIMARIO** |
| threejs | 1 270 | 14.9% | 21 | Tier 2 (3D browser) |
| monogame | 1 090 | 12.8% | 19 | Tier 2 (pixel-perfect) |
| phaser | 968 | 11.4% | 16 | **CORE LANCIO** (web) |
| defold | 796 | 9.3% | 21 | **CORE LANCIO** (mobile) |
| love2d | 718 | 8.4% | 21 | Tier 2 (card/bullet-hell) |
| stride | 215 | 2.5% | 16 | Tier 2 (3D pro) |
| **renpy** | **103** | **1.2%** | **4** | **CORE LANCIO** (narrativa) |

**Il problema più grave**: Ren'Py è un engine CORE al lancio (la visione lo
indica come standard mondiale per visual novel / dating sim) ma ha **103
chunk su sole 4 categorie su 22**. È il collo di bottiglia numero uno.

**Secondo problema**: Stride (215 chunk, 16 cat) e Phaser (16 cat su 22)
hanno copertura categoriale incompleta.

### 3.2 Per CATEGORIA TASSONOMICA — buchi mirati

Nessuna categoria reale (A-E) è a zero a livello globale. Ma il problema è
la distribuzione **per engine**. Categorie deboli in valore assoluto:

| Categoria | Chunk totali | Note |
|---|---:|---|
| B04_navigation | 49 | pathfinding/steering — sottile su tutti gli engine |
| C01_progression | 62 | XP/skill-tree/economy — critico per RPG, scarso |
| B02_procedural_gen | 102 | WFC/BSP/cellular — critico per roguelike |
| A02_state_machine | 109 | FSM — fondamentale, ma sottile |
| C03_dialogue_narrative | 129 | **103 su godot, solo 7 su renpy** (paradosso!) |
| C02_inventory | 137 | 109 su godot, quasi zero altrove |

**Paradosso da notare**: `C03_dialogue_narrative` ha 103 chunk su Godot ma
solo 7 su Ren'Py — l'engine che del dialogo narrativo è LO standard. Stesso
per inventory.

### 3.3 Per SOTTOCATEGORIA — copertura al 41%

Delle **140 sottocategorie** teoriche del blueprint, ne abbiamo coperte
**58** (41%). Distribuzione per dominio:

| Dominio | Sottocat. presenti | Sottocat. teoriche |
|---|---:|---:|
| A (core gameplay) | 20 | 43 |
| B (world/level) | 10 | 25 |
| C (meta-game) | 9 | 26 |
| D (presentation) | 9 | 24 |
| E (architecture) | 10 | 22 |

Le sottocategorie sono dominate da poche: E01.01 (2541), D01.01 (1525),
E02.01 (743). La **coda lunga** (boss_telegraph, group_behaviour,
version_migration, ecc.) è scoperta o quasi.

### 3.4 Per GENERE — i generi vetrina vs copertura sull'engine primario

Verifica: per ogni genere target, le sue categorie obbligatorie (blueprint
§1.3) hanno ≥3 chunk **sull'engine che il prodotto gli assegna**?

| Genere | Engine primario | Categorie coperte | Buchi |
|---|---|---|---|
| Platformer/Metroidvania | godot | **11/11** ✓ | — |
| RPG/JRPG | godot | **9/9** ✓ | — |
| Roguelike | godot | **8/8** ✓ | — |
| Card/Deckbuilder | love2d | **5/5** ✓ | — |
| Tower Defense | love2d | **5/5** ✓ | — |
| Mobile Casual/Puzzle | defold | **4/4** ✓ | — |
| **Visual Novel** | **renpy** | **3/5** ✗ | **D02_audio=0, C04_save_load=0** |

**I generi su Godot sono coperti perfettamente.** L'unico genere vetrina
con buchi è **Visual Novel su Ren'Py**: mancano audio (BGM/SFX management) e
save/load — due sistemi che ogni visual novel ha. È il gap più visibile per
l'utente finale che chiede "creo un dating sim".

### 3.5 Per DISTRIBUZIONE GENERI — coda lunga sottile

`genre_tags` su code_knowledge:
- Dominante: `generic` (7 539 — la maggior parte del codice non è
  genre-specific, è atteso).
- Ben rappresentati: rpg (398), visual_novel (236), platformer (225),
  arcade (177).
- **Sottili**: tower_defense (15), survival (14), fighting (13),
  **horror (8), jrpg (1)**.

Horror è citato nella visione come genere target ma ha 8 chunk. JRPG ne ha 1.

### 3.6 Qualità per engine — Phaser è l'anello debole

| Engine | avg quality | avg reusability |
|---|---:|---:|
| monogame | 3.75 | 3.74 |
| godot | 3.70 | 3.65 |
| stride | 3.63 | 3.49 |
| defold | 3.59 | 3.55 |
| threejs | 3.58 | 3.35 |
| renpy | 3.56 | 3.27 |
| love2d | 3.43 | 3.35 |
| **phaser** | **3.08** | **2.28** |

Phaser ha quasi 1000 chunk ma qualità/riusabilità più bassa: molti
provengono da `phaserjs/examples` (micro-demo da 1 funzione). Volume alto,
densità di valore bassa.

---

## PARTE 4 — COSA È CAMBIATO RISPETTO ALL'INIZIO (scoperte e aggiunte)

Punto di partenza (dry-run iniziale scraper): 265 repo candidati su 8
engine, contro un target blueprint di ~800 pre-filtro / ~6000 chunk.

Cosa è stato scoperto e aggiunto lungo la pipeline:

1. **Harvest espanso 265 → 916 candidati** via 3 fonti GitHub non sfruttate
   (topic harvesting, org harvesting, curated repos) + sub-directory
   expansion da mono-repo (three.js examples, godot-demo-projects).
2. **Curation adattiva 916 → 683 repo** con cutoff stelle per-engine e drop
   licenze incompatibili (GPL/LGPL/AGPL).
3. **Bug Godot 3 leak scoperto e corretto**: il filtro qualità leggeva solo
   il primo `project.godot`; ora verifica `config_version=5` su TUTTI.
4. **5 parser engine-specific** prodotti → 14 755 chunk grezzi.
5. **Heuristic expansion**: 5 categorie erano a zero (A02/B02/B03/C01/C02);
   aggiunte 14 regole + fix del falso positivo `xp` (matchava "expand").
6. **Grooming 14 755 → 11 113 chunk**: drop di 3 642 chunk rumore (tiny <20
   LOC, duplicati esatti, stub vuoti). Costo Fase 4 sceso da ~$4.43 a ~$3.33.
7. **chunk_type assegnato** deterministicamente (full_recipe /
   single_mechanic / structural_pattern).
8. **Fix bug extends inline** Godot: `class_name X extends Y` su una riga non
   veniva catturato → 241 chunk avevano extends_type errato → corretto.
9. **Classificazione LLM**: 10 769/11 113 classificati (96.9%), $12.21.
10. **Bug RPC scoperto in Fase 6**: `search_code_knowledge` ignorava
    `p_engine=NULL` → query cross-engine restituivano 0 → migration 002.
11. **Finding strategico Fase 7**: il boost è proporzionale alla copertura
    (la scoperta più importante per i prossimi passi).

In sintesi: siamo passati da un'idea (~265 repo) a una **knowledge base di
produzione interrogabile** (8 517 chunk, RAG funzionante, 20/20 test), e
soprattutto abbiamo capito **dove la KB serve davvero e dove no**.

---

## PARTE 5 — COSA SERVE PRENDERE, DOVE, IN CHE MODO (raccomandazioni)

In ordine di leva sul valore di prodotto. Tutte le fonti devono rispettare
il filtro licenze esistente (MIT/Apache/BSD/Zlib/CC0/ISC/Unlicense).

### Priorità 1 — RIEMPIRE REN'PY (collo di bottiglia)

**Perché**: engine core al lancio, oggi 103 chunk / 4 categorie / 1.2% del
DB. È l'engine dove il modello base è più debole → dove la KB darebbe il
boost maggiore (vedi Parte 2.3).

**Cosa prendere**: progetti Ren'Py con inventory, progression/route-flag,
save/load custom, audio management, gift/affinity systems (dating sim).
**Categorie target mancanti**: C02_inventory, C01_progression, C04_save_load,
D02_audio, E04_genre_specific (visual_novel_core E04.10).

**Dove**: GitHub `topic:renpy`, `topic:visual-novel` (probe iniziale:
~479+678 repo); org `renpy`, `DRincs-Productions` (toolkit maturi già nel
dataset); itch.io Ren'Py open-source con repo GitHub collegato.

**Come**: harvest mirato da 8 → 40-50 repo Ren'Py. Abbassare i cutoff stelle
(Ren'Py ha community piccola, pochi repo con molte stelle). Considerare di
**promuovere dalla quarantine** i chunk Ren'Py già presenti ma sotto soglia.

### Priorità 2 — RAFFORZARE GLI ENGINE DI NICCHIA DOVE L'LLM È CIECO

**Perché**: Defold (core lancio, mobile), Stride (3D pro). Su questi engine
il modello base ha pochissimo training → ogni chunk di qualità ha valore
marginale altissimo (al contrario di Godot dove l'LLM già sa tutto).

**Cosa prendere**: Defold game-state, collection/factory patterns, GUI;
Stride ECS, scene management, samples ufficiali.

**Dove**: org `defold` (488 repo su topic), `britzl` (autore prolifico
Defold, 45 repo license-OK già visti); org `stride3d` (samples ufficiali).

**Come**: portare Defold da 796 a ~1200 chunk densi; Stride da 215 a ~400.
Volume moderato, alto ROI sul boost reale.

### Priorità 3 — COLMARE LE CATEGORIE META-GIOCO DEBOLI

**Perché**: C01_progression (62), B02_procedural_gen (102), B04_navigation
(49) sono critiche per RPG e roguelike (generi vetrina) ma sottili.

**Cosa prendere**: skill-tree/economy systems, WFC/BSP/cellular dungeon
generators, A*/navmesh/steering implementations — su Godot e Love2d.

**Dove**: `topic:roguelike`, `topic:procedural-generation`,
`topic:pathfinding` filtrati per engine.

### Priorità 4 — ALZARE LA QUALITÀ PHASER

**Perché**: 968 chunk ma avg quality 3.08, reusability 2.28 — il più basso.
Molti micro-esempi da `phaserjs/examples`.

**Come**: NON aggiungere altri esempi. Piuttosto: (a) ri-classificare con
soglia qualità più alta per espellere i micro-demo a basso valore in
quarantine, oppure (b) harvest di veri giochi Phaser completi (non esempi)
per alzare la densità di full_recipe.

### Priorità 5 — RIEMPIRE LA CODA LUNGA DEI GENERI VETRINA SOTTILI

**Perché**: horror (8), jrpg (1), tower_defense (15), fighting (13) sono
generi citati nella visione ma quasi assenti.

**Cosa/dove**: harvest mirato `topic:horror-game`, `topic:jrpg`,
`topic:tower-defense` su Godot/Love2d. Volume piccolo ma chiude buchi
vetrina visibili all'utente.

### Trasversale — DUE FIX DI RETRIEVAL (non harvest, codice prodotto)

Indipendenti dall'espansione del dataset, da implementare in `lib/`:

1. **Gate di similarità**: i tool non devono iniettare grounding KB se i
   top-K recuperati hanno similarity sotto soglia (~0.55) — evita la
   regressione vista nel test Ren'Py (grounding debole peggiora l'output).
2. **Confidence floor adattivo per engine**: per engine sotto-coperti
   (renpy, stride) abbassare la soglia di retrieval da 85 a ~70 così i
   chunk-quarantine di nicchia diventano raggiungibili. Trade-off
   qualità/copertura, da tarare per-engine.

---

## PARTE 6 — SINTESI PER IL VALUTATORE

**Cosa abbiamo**: una RAG di produzione tecnicamente solida — 8 517 chunk
embedded, indice HNSW, 2 RPC testate, retrieval semantico verificato
funzionante. La pipeline end-to-end (scrape → filter → parse → classify →
embed → store → validate) è completa e committata.

**Cosa abbiamo capito**: il retrieval semantico è sano, ma il VALORE per
l'utente è condizionale — la KB aiuta solo dove il modello base è debole E
abbiamo densità. Il recupero è per similarità semantica, non per
correttezza di dominio, quindi la densità per-nicchia è ciò che determina
la precisione.

**Dove scarseggiamo (in ordine)**:
1. Ren'Py — 1.2% del DB, 4/22 categorie, ma engine core al lancio.
2. Engine ciechi-per-LLM (Defold, Stride) sotto-densi.
3. Categorie meta-gioco (C01, B02, B04) sottili.
4. Qualità Phaser bassa (micro-esempi).
5. Generi vetrina di coda (horror, jrpg, tower_defense).
6. Sottocategorie: 58/140 coperte (41%).

**Cosa serve di preciso**: harvest mirato — Ren'Py ×5, Defold +50%, Stride
×2, categorie meta-gioco su Godot/Love2d — tutto sotto filtro licenze
esistente, da GitHub topic/org. Più due fix di retrieval in codice (gate di
similarità + confidence floor adattivo) che valgono indipendentemente
dall'espansione.

Il vettoriale è una buona fondazione. Diventa il "miglior vettoriale
possibile per lo scopo" quando la densità di copertura segue la matrice
genere→engine della visione di prodotto, invece dell'attuale concentrazione
Godot-centrica ereditata da dove è stato più facile harvestare.
