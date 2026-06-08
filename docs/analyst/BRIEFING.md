# GameSmith — Briefing tecnico per analista esterno

> Scopo di questo documento: dare a un consulente esterno il contesto preciso su
> COSA stiamo costruendo, COME è fatta l'architettura, A CHE PUNTO siamo, e
> QUAL È il problema che non riusciamo a risolvere. Allegato: `_check.png`
> (screenshot di un gioco generato — vedi §6).
>
> La domanda centrale per l'analista è in fondo (§8): **perché non riusciamo a
> generare un gioco che SEMBRI un gioco, con gli asset assemblati in modo
> coerente, invece di "foto messe a caso"?**

---

## 1. Cosa stiamo costruendo

**GameSmith** (workspace "Game Studio AI") è una piattaforma che genera videogiochi
giocabili a partire da un prompt testuale dell'utente (es. *"a platformer, fantasy
forest, jump platforms collect coins reach the exit"*). L'output deve essere un
gioco **vero, giocabile nel browser**, con grafica e audio coerenti — non un
prototipo, non una serie di rettangoli colorati.

Obiettivo di qualità dichiarato: il gioco deve **sembrare e giocarsi come un gioco
vero dal primo prompt**, con asset contestuali (scelti per genere/stile/motore),
non placeholder.

Concorrenti diretti: generatori di giochi AI tipo Rosebud / Sorceress.

---

## 2. Stack tecnico

| Livello | Tecnologia |
|---|---|
| Prodotto | TypeScript (strict, ESM), Next.js 14 App Router |
| LLM gateway | **OpenRouter** (modello principale: Claude Sonnet); fallback Azure previsto ma non attivo |
| Generazione immagini | Replicate (FLUX) per sprite, con rembg per il ritaglio |
| DB + ricerca | Supabase Postgres + **pgvector** (embedding `text-embedding-3-small`, 1536 dim) |
| Job lunghi / worker | **Trigger.dev** (la generazione gira in un task worker, non in-request) |
| Sandbox build | **E2B** (container effimero dove si builda/esporta il gioco) |
| Storage build | **Cloudflare R2** (il bundle web del gioco + lo .zip esportabile) |
| Motore di gioco (day-1) | **Godot 4.3** esportato in WASM/HTML5 (più Phaser/Three/Babylon/Defold previsti, ma solo Godot è curato) |

---

## 3. Architettura (la pipeline prompt → gioco)

Architettura **esagonale** (porte/adattatori). Il cuore è un orchestratore ("Hermes")
che esegue una pipeline a fasi e materializza un **DAG di esecuzione** (grafo di tool).

### Flusso end-to-end

```
PROMPT utente
   │
   ▼
[D.1/D.2] GAME DESIGNER (LLM)  → lib/reasoning/intent.ts, design.ts, baseline.ts
   • inferisce genere (enum: hardcore_platformer, metroidvania, jrpg, ...),
     motore, stile (style_pack_id: A01..D08), un "design doc" (mood, meccaniche)
   │
   ▼
[D.5] DAG BUILDER per-genere   → lib/reasoning/dag-builder.ts
   • crea i nodi del grafo. Per un platformer 2D:
        sprite_gen(player)  sprite_gen(tileset)  sprite_gen(enemy)  sprite_gen(background)
        bgm_gen   sfx_gen
        level_layout_2d → tilemap_populate → entity_placement
        code_gen_godot_gdscript
   │
   ▼
ESECUZIONE NODI                → lib/reasoning/execution.ts
   • ASSET (CC0-first):  asset_resolver → RPC pgvector match_assets
        - lib/tools/asset-resolver/index.ts
        - se nessun CC0 e tier pagante → genera con FLUX; se free → placeholder
   • LIVELLO (deterministico): generatore di layout per famiglia di genere
        - lib/tools/level/_strategies.ts (strategia "platform": piattaforme
          spaziate entro la distanza di salto, entry/exit raggiungibili, BFS)
   • CODICE (LLM):  code_gen scrive il GDScript del gioco
        - lib/tools/code/_codegen.ts (prompt + self-heal loop)
        - lib/tools/code/godot/index.ts (gold example + sanitizer Godot3→4)
   │
   ▼
ASSEMBLER                       → lib/runtime/assembler/assemble.ts, scaffold.ts
   • scrive nel progetto Godot:  main.gd (il codice), main.tscn, project.godot,
     export_presets.cfg, e SCARICA gli asset (URL → file res://)
   • builda headless in E2B:  godot --headless --export-release "Web"
   • SMOKE TEST headless (Chromium) + PLAYTEST headless (gioca + legge lo stato)
   • esporta il bundle su R2 → iframe_url
   │
   ▼
[D.6] GATE + LOOP              → lib/orchestrator/hermes.ts
   • se non "giocabile" → rigenera (max 3 iterazioni) col feedback
   • ship della MIGLIORE iterazione
```

### Come il gioco "comunica" di funzionare
Ogni gioco generato stampa ogni frame una riga `__GS__ alive=.. on=.. y=.. t=..`
(stato del giocatore) e pubblica `window.__GAME_STATE__` via `JavaScriptBridge`.
Il **playtest** headless legge questo stato per decidere se il gioco è giocabile
(il player si muove, non cade subito, raggiunge il goal). È il nostro segnale di
verità "ha renderizzato + è giocabile".

### Contratti (confine tra i moduli)
Tutto ciò che attraversa un confine passa per schemi **Zod** in `lib/contracts/`
(game-plan, tool-registry, assembly-pipeline, ecc.). Gli enum (genere, motore)
sono ancorati a righe di catalogo seedate da migration, non stringhe libere.

---

## 4. Come vengono gestiti gli ASSET (il pezzo che riguarda la domanda)

### Magazzino: `asset_library_index` (Supabase, ~6.861 righe)
Ogni asset (sprite/tileset/background/model_3d/texture/audio) è una riga con:
- `download_url` (il file alla fonte — non scarichiamo i binari, indice-only)
- `license` (solo allowlist: CC0-1.0, CC-BY-4.0, ...)
- `asset_type`, `use_case_tags[]` (character/enemy/tile_ground/background/...)
- `style_pack_compat[]` (A01..D08 — pixel/stylized/3d/special, classificato per tema)
- `genre_affinity[]` (gli enum di genere)
- `embedding` (per ricerca semantica pgvector)

Conteggi attuali (dopo l'ingestione di oggi): sprite ~1.731, tileset 188,
background 52, audio_sfx 2.488, **audio_bgm 1.406** (musica, prima era 0),
model_3d 554, texture 759.

### Selezione asset: RPC `match_assets` (pgvector)
`asset_resolver` chiama `match_assets(embedding, asset_type, style_pack, genre,
engine, threshold)`. Filtri AND su tipo/stile/genere + similarità coseno.
- CC0-first: se c'è un match, lo usa; se non c'è e l'utente è pagante → FLUX;
  se free → placeholder (texture a tinta unita, mai un rettangolo "nudo").
- Abbiamo aggiunto un "graceful widening" (se lo strict non trova, allenta
  genere poi stile) e una preferenza per URL **caricabili** (alcuni asset CC0
  vecchi hanno `download_url` = .zip → scartati → preferiamo PNG diretti).

### Come gli asset finiscono NEL gioco (qui sta il nodo del problema)
**È il code_gen (LLM) che assembla la scena imperativamente.** Nel `_ready()` del
GDScript l'LLM:
- crea i nodi (`Sprite2D`, `StaticBody2D`, `CharacterBody2D`...),
- carica le texture dai path `res://assets/sprites/{sprite_gen,tileset,enemy,background}.png`,
- **decide a mano le coordinate e le scale** di ogni elemento,
- per le piattaforme: prende l'immagine del tileset e la **stira** sul rettangolo
  della piattaforma (`scale = platform_size / texture_size`).

Helper che imponiamo nel prompt: `_tex(path,size,color)` (carica o placeholder),
`_fit(sprite, target_h)` (scala lo sprite a un'altezza target).

---

## 5. Stato attuale — cosa funziona e cosa no (coi numeri)

**Run reali di oggi: 27.** Esito: **5 con `passed=true`** (gioco che builda +
renderizza + playtest ok), le altre `passed=false` per cause diverse.

### Funziona
- La pipeline end-to-end gira: prompt → gioco buildato → iframe su R2, in ~2-4 min.
- Il magazzino asset è popolato e categorizzato su 3 assi (stile/genere/use_case).
- Il match CC0 contestuale funziona (verificato: per "fantasy forest" trova
  tileset foresta, background, nemici coerenti).
- La musica CC0 ora si carica nel gioco (era 0, ora 1.406 tracce).
- Quando l'LLM genera codice "semplice e corretto", **esce un gioco vero**
  (player su piattaforma, sfondo, HUD, musica) — l'abbiamo visto 5 volte oggi.

### Non funziona / fragile
1. **Affidabilità ~1 su 5.** La stessa pipeline a volte produce un gioco bello,
   a volte uno rotto/vuoto. La differenza è la qualità del codice che l'LLM
   genera quel giro (vedi §6).
2. **Schermo grigio (risolto in più strati oggi):** causa-radice = scena Godot
   vuota (colore clear di default) perché `_ready()` dell'LLM andava in errore
   runtime su codice troppo complesso (sistemi inventati: stamina, piattaforme
   mobili, timer...) → il player non veniva creato → niente render.
3. **Rete di sicurezza:** abbiamo aggiunto un **template di fallback
   garantito-giocabile**: se il code_gen non produce codice valido (per
   qualunque motivo), lo scaffold inserisce un platformer minimo noto-funzionante
   invece di uno schermo grigio. `_check.png` è proprio questo fallback (§6).
4. **Crediti LLM:** dopo 27 generazioni in un giorno abbiamo esaurito il credito
   OpenRouter → l'ultima run ha ricevuto HTTP 402 → niente codice → è scattato
   il fallback. (Il fallback NON dipende dall'LLM, per questo è uscito comunque.)

---

## 6. Il problema preciso — guarda `_check.png`

`_check.png` è uno screenshot del **template di fallback** (l'LLM non aveva
crediti, quindi è uscita la rete di sicurezza). Mostra il problema visivo nella
sua forma più nuda, ma **la stessa debolezza compositiva affligge anche i giochi
generati dall'LLM**:

Cosa si vede e cosa c'è di sbagliato:
- **piattaforme minuscole sparse in un vuoto blu** — niente terreno continuo,
  niente composizione; sembrano "oggetti buttati a caso";
- **il tileset è stirato** in barrette deformi (lo allunghiamo a forza sul
  rettangolo della piattaforma invece di affiancarlo/tilarlo correttamente);
- **lo sfondo manca** (slot non risolto) → fondo piatto, "vuoto";
- gli sprite sono piccoli, le proporzioni e lo zoom-camera non sono pensati.

In sintesi: **anche quando gli asset giusti ci sono, non vengono ASSEMBLATI in una
scena coerente.** Non c'è un vero "compositore di scena". L'assemblaggio è
delegato all'LLM che indovina coordinate e scale, oppure (nel fallback) a coordinate
hardcoded approssimative. Il risultato non legge come un livello disegnato.

> NB: in alcune run "buone" (1 su 5) il risultato è molto migliore (player su una
> piattaforma con sfondo vero e HUD). Ma non è affidabile né, mai, di qualità
> "prodotto".

### File precisi da guardare per l'analista
- Pipeline/orchestrazione: `lib/orchestrator/hermes.ts`, `lib/reasoning/execution.ts`,
  `lib/reasoning/dag-builder.ts`
- Generazione livello (deterministica): `lib/tools/level/_strategies.ts`,
  `lib/tools/level/level_layout_2d/`, `tilemap_populate/`, `entity_placement/`
- Generazione codice (LLM): `lib/tools/code/_codegen.ts`, `lib/tools/code/godot/index.ts`
- Assemblaggio/build: `lib/runtime/assembler/assemble.ts`,
  `lib/runtime/assembler/scaffold.ts`, `lib/runtime/assembler/_godot-fallback.ts`
- Asset: `lib/tools/asset-resolver/index.ts`, RPC `match_assets`
  (in `supabase/migrations/003_asset_library_index.sql`)

---

## 7. Cosa abbiamo provato (per non far ripetere all'analista le stesse cose)

- Imposto regole rigide nel prompt del code_gen (mai ColorRect, usa `_tex()`/
  `_fit()`, costruisci prima il core, niente sottosistemi inventati).
- `match_assets` con widening + soglia di similarità realistica (0.45) + preferenza
  per URL immagine-diretta.
- Background in `CanvasLayer` (per coprire il viewport mentre la camera scorre).
- Resize sprite per dimensione-target (FLUX 1024px vs CC0 16px → uniformati).
- Loop: "no game state" = fallimento → rigenera; spedisci la MIGLIORE iterazione.
- Export Godot single-thread (per togliere flakiness SharedArrayBuffer/coi-sw).
- Template di fallback garantito (per non spedire MAI grigio).

Tutto questo migliora l'affidabilità ma **non risolve la qualità compositiva**: il
gioco "gira" ma non "sembra disegnato".

---

## 8. Le domande per l'analista

1. **Architettura dell'assemblaggio asset → scena.** Oggi è l'LLM che costruisce
   la scena imperativamente in `_ready()` (coordinate/scale indovinate) e stira le
   texture. **È questo l'errore di fondo?** Dovremmo invece avere un **compositore
   di scena deterministico** (es. costruire una vera `TileMap` Godot dal layout +
   un sistema di parallax per lo sfondo + regole di camera/inquadratura), e
   lasciare all'LLM solo le MECCANICHE, non il rendering/posizionamento? Qual è
   l'architettura corretta per "assemblare asset in una scena che sembri un gioco"?

2. **Tileset e tiling.** Come gestire correttamente i tileset CC0 (sheet di tile di
   dimensione ignota) per costruire terreno/piattaforme coerenti, invece di stirare
   un'immagine? Serve riconoscere/normalizzare il tile size? Usare `TileMap`/
   `TileSet` di Godot a partire dai tile? Serve un passo di "slicing" degli asset?

3. **Coerenza visiva.** Come garantiamo che background + tileset + sprite scelti
   appartengano allo stesso stile e si compongano bene (palette, scala, prospettiva)?
   La categorizzazione per `style_pack` basta o serve altro (es. classificazione
   visiva/CLIP, normalizzazione palette, set curati per stile)?

4. **Affidabilità della generazione di codice.** Far scrivere a un LLM l'intero
   GDScript è la causa della varianza 1-su-5? Conviene spostarsi su un **runtime
   "engine + data"** (l'LLM produce DATI strutturati — layout, entità, parametri —
   e un runtime fisso e testato li rende), tenendo l'LLM lontano dal codice che
   renderizza? (es. un game template parametrico per genere)

5. **Cosa ci manca, concretamente,** per passare da "a volte esce un gioco" a
   "esce sempre un gioco che sembra un gioco"? Qual è il pezzo architetturale
   mancante più importante?

---

### Una frase di sintesi per l'analista
> *"Abbiamo la pipeline (prompt → design → asset CC0 + generativi → build Godot →
> playtest → publish) e il magazzino asset categorizzato. Ma l'assemblaggio
> finale degli asset in una SCENA coerente è delegato all'LLM che improvvisa
> coordinate/scale, e questo dà risultati instabili e visivamente poveri (vedi
> _check.png). Vogliamo capire se la strada giusta è un compositore di scena
> deterministico (TileMap/parallax/camera + runtime parametrico) con l'LLM
> ristretto alle meccaniche, e cosa ci manca per arrivarci."*
