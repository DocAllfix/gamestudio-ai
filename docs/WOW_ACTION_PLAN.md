# WOW Action Plan — Sonnet + i nostri tool per un gioco vero, bello, fedele al prompt

**Data:** 2026-06-06. **Principio:** Sonnet è il *cervello/regista* (capisce, progetta, scrive,
gioca, giudica); i tool/risorse sono le *mani affidabili* (asset, livelli garantiti, validazione).
Il WOW nasce dalla **combinazione**, non da un pezzo. Tutto guidato dai dati (run_traces).

## I 3 livelli del WOW (obiettivo)
1. **"Funziona"** — premi e esce un gioco GIOCABILE (non grigio/rotto). *Quasi fatto.*
2. **"È MIO"** — il gioco riflette il prompt specifico ("monete che drenano HP" si vede) + asset coerenti.
3. **"Lo modifico mentre gioco"** — Fetta 4 play+edit (il differenziante "Higgsfield dei giochi").

## Stato accertato oggi (col dato)
- ✅ Game Designer → design ricco (mechanics/loop/win/lose). Modello: gpt-4.1-mini (Azure).
- ✅ Design ricco ARRIVA al code_gen (`codeContext` nel DAG).
- ✅ code_gen Godot = Claude Sonnet (via OpenRouter) → platformer vero, valido al 1° colpo (screenshot).
- ✅ Playtester universale (getState + guard + LLM judge) cablato nel gate.
- ✅ Osservabilità totale (run_traces + codice + log).
- ⚠️ Asset (sprite/audio): canale verso code_gen pronto (describeLevel) ma i PROVIDER generativi
  non sono cablati → oggi degradano a placeholder.
- ⚠️ Reference games (80, visual_analysis) NON usati dal Game Designer al primo passo.
- ⚠️ Anello di RIGENERAZIONE: il Playtester dice "non giocabile" ma il reason non torna ancora a
  rigenerare.
- ❌ Fetta 4 (play+edit) non iniziata.

---

## PIANO D'AZIONE (ordine = valore/rischio)

### FASE A — "Funziona sempre" (chiudere il loop di garanzia)
Obiettivo: ogni generazione produce un gioco giocabile, o si rigenera finché lo è.
- **A1. Anello di rigenerazione.** Playtester `playable=false` → D.6 emette `refinement_request` col
  `reason` → Hermes lo rimanda a code_gen che RIGENERA col feedback (max N). Stesso pattern del
  self-heal, ma sulla giocabilità. *(Il reason è già nel gate; manca il giro a D.2/code_gen.)*
- **A2. Consolidare Claude su tutti i code_gen 2D** (phaser/threejs come Godot) + verificare il
  giro completo E2E (Hermes full) con screenshot+playtest verde.
- **A3. Deploy:** OPENROUTER_API_KEY sul worker (per Claude) + redeploy → primo gioco vero dalla webapp.

### FASE B — "È MIO" (il prompt reso incredibile)
Obiettivo: il gioco riflette visibilmente il prompt specifico + asset coerenti.
- **B1. Reference games nel Game Designer.** Al primo passo, recuperare reference_games per genere
  e ancorare il design alla loro visual_analysis (mood/palette/feel) → design fondato, non generico.
  *(Modulo reference-games.ts già scritto; agganciarlo in intent.ts.)*
- **B2. Asset provider reali** (Replicate FLUX sprite, Suno/ElevenLabs audio) cablati ai tool, così
  il gioco ha sprite/musica VERI (non quadrati). Gli URL già fluiscono a code_gen via describeLevel.
  *(FLUX sprite cablato 2026-06-07: provider + gate fix; aspetta credito Replicate.)*
- **B3. Le meccaniche specifiche del prompt nel code_gen.** Il design (`mechanics`) arriva già; far sì
  che il code_gen le IMPLEMENTI verificabilmente (la Playtester controlla che la meccanica esista
  nello stato — es. "hp cala raccogliendo monete" → state.player_hp scende).

#### B4. Preset visivi (Higgsfield Cinema Studio style) + algoritmi-mappa per genere — IL "È MIO" completo
Proposta utente (2026-06-07), analizzata e accolta. Due assi che l'utente può scegliere PRIMA di
forgiare, che il Game Designer traduce in PARAMETRI/VINCOLI deterministici → meno allucinazioni, più
fedeltà, meno retry. **Specifica vincolante:** NON un wizard. Il prompt-solo resta SEMPRE valido
(come oggi); i preset sono un INVITO opzionale a ottenere di più. UX = stile **Higgsfield Cinema
Studio / SOUL**: card-preset con ANTEPRIMA visiva (thumbnail dello stile), esplorabili, "scegli o
lascia decidere all'AI". Default intelligenti ovunque (es. motore consigliato per genere).

- **Gli assi-preset** (tutti opzionali, ognuno con anteprima):
  - *Genere* videoludico → vincola il Designer (no inferenza sbagliata).
  - *Motore* (con CONSIGLIO per genere: es. platformer→Godot/Phaser, visual-novel→Ren'Py).
  - *Stile mappa* = scelta dell'ALGORITMO + parametri (vedi sotto), con anteprima del tipo di layout.
  - *Difficoltà* → density/pacing dei tool.
  - *Stile grafico* → `style_pack_id` + (quando accesi) `lora_hf_repo` deterministici + palette,
    con anteprima dell'estetica. Qui vanno i LoRA ([[project_lora_status]]).
  - + le altre personalizzazioni dei tool (audio mood, ecc.).
- **Algoritmi-mappa per famiglia di genere (il fix dell'allucinazione-livello, liberie permissive).**
  Principio (confermato da ricerca): l'LLM NON disegna la mappa (fa livelli ingiocabili); l'LLM/preset
  pone i VINCOLI, un algoritmo costruisce la mappa valida+attraversabile, poi l'LLM ci mette il
  CONTENUTO (nemici/pickup/tema). Adapter dietro la porta level (esagonale, già nostra):
  - roguelike/dungeon/cave → **rot-js (BSP/cellular)** — GIÀ NOSTRO (porting di libtcod, Zlib/BSD).
  - overworld/top-down/tile-coerenti → **WFC (Wave Function Collapse, MIT)** — DA AGGIUNGERE (gap reale:
    regole tipo "acqua non tocca lava", strade connesse).
  - platformer → **Perlin/noise 1D → height-array** `[2,2,3,4,3]` — DA AGGIUNGERE; è il "livello come
    dati" robusto che evita il code_gen-inventa-il-livello (causa dei retry visti il 2026-06-07).
  - reachability resta il giudice (mai un livello impossibile).
- **Modello dati CONDIVISO (l'interconnessione):** preset+asset tipizzati per slot (sprite/tile/
  personaggio/mappa/audio) sono lo STESSO modello usato da: (a) Generazione (preset→parametri),
  (b) **BYOA** (l'utente porta l'asset nello slot invece di generarlo), (c) **Studio Sorceress**
  (crea/modifica mappe/tile/animazioni/personaggi → diventano preset/asset riutilizzabili portati in
  generazione). Un modello, tre funzionalità. Riusa `project_assets` (Fetta 3).
- **Cosa ci dà (onesto):** meno allucinazioni (struttura algoritmica garantita), meno retry (il
  livello non lo inventa l'LLM), più controllo/profondità, asset/preset riutilizzabili, LoRA/FLUX
  precisi (lo stile è una chiave deterministica). NON più veloce sulla singola chiamata — più veloce
  per CONVERGENZA (meno rigenerazioni).
- **Sforzo (onesto):** sostanzioso — 2 nuovi adapter mappa (WFC, Perlin) + frontend preset-con-anteprima
  (skill impeccable, stile Higgsfield, anteprime: generate noi o reference) + estensione contract
  (`user_overrides` rispettati dal Designer) + style→pack/LoRA. Da fare DOPO che il loop base è stabile.
- **UX refs (verificati):** Higgsfield Cinema Studio (pannelli genere/stile/camera, AI Director come
  default, "scegli o lascia all'AI"), SOUL moodboards (card-preset con anteprima, +moodboard custom da
  reference). https://higgsfield.ai/cinema-studio · https://higgsfield.ai/blog/create-custom-ai-moodboard-soul-2
- **Librerie (licenze verificate):** rot-js (già nostro) · python-tcod BSD-2 (rif) · WFC MIT · Perlin (algoritmo).

### FASE C — Sonnet come ORCHESTRATORE più forte (la potenza piena)
Obiettivo: Sonnet non solo scrive, ma dirige la pipeline e cura la qualità.
- **C1. Design → parametri tool.** Il design ricco guida ANCHE i tool spaziali (theme/density/size dal
  Game Designer, non solo genere+difficoltà) → livelli/asset coerenti col prompt.
- **C2. Self-improvement loop.** I run_traces (prompt → codice validato che gira) alimentano il
  fine-tuning (Azure) → modello GameSmith-Godot che migliora col volume = moat-dati.
- **C3. Valutazione qualità (oltre "gira").** Il Playtester LLM giudica anche "è DIVERTENTE/fedele al
  prompt?" (completabilità, ritmo) → rigenera per qualità, non solo per non-crash.

### FASE D — Il WOW differenziante
- **D1. Fetta 4: play+edit.** Modifica granulare a voce mentre giochi (RFC6902 patch → rebuild del
  nodo) + Smithy + animazione forgia. È "l'Higgsfield dei giochi".

---

## FASE E — Asset Library + Studio componibile (la visione "game lab", proposta utente 2026-06-07)
**Principio cardine (utente):** tre capability — (1) **Libreria** asset CC0 sfogliabile, (2) **Studio**
(tool Sorceress per creare/modificare asset), (3) **Generazione** — funzionano OGNUNA da sola, ma
UNITE permettono di costruire "il tuo gruppo di asset" → poi generare il gioco esattamente come lo
vuoi. Componibilità: prendi una sprite dalla libreria → la modifichi coi tool Sorceress → la usi nella
generazione. Più asset curati hai pronti, più la generazione è facile/fedele/veloce (l'AI ASSEMBLA,
non inventa). Tutto su UN modello dati condiviso (`project_assets`) — vedi B4.

### E1. Libreria asset CC0 sfogliabile
- **Cosa c'è già (verificato DB):** `asset_library_index` = 2.488 audio_sfx + 1.238 sprite + 554
  model_3d + 35 tileset + 16 icon (CC0, allowlist licenze hard-enforced) + RPC `match_assets` +
  embedding (pgvector). Buchi: **audio_music=0, animation=0**, tileset/UI pochi.
- **Cosa manca:** la UI di browsing + più contenuti + metadata di categorizzazione.

### E2. Fonti CC0 da ingerire (verificate online, riempiono i buchi) — stesso pattern Fase 1
| Fonte | Copre | Riempie |
|---|---|---|
| **Kenney.nl** (40k+ CC0) | sprite, tileset, 3D, UI, audio, font | tileset, UI, musica |
| **OpenGameArt** (CC0/CC-BY) | 2D, **musica**, sfx | audio_music (0) |
| **Quaternius** (CC0) | 3D low-poly **riggati+animati** | model_3d + animation |
| **Quaternius Universal Animation Library** (CC0, compat Mixamo) | animazioni 3D | **animation (0)** |
| **Mixamo** (gratis Adobe, riggato) | animazioni humanoid 3D | animation |
| **RancidMilk** (CC0 su rig Quaternius) | anim 3D | animation |
| **ambientCG / Poly Haven** (CC0) | materiali PBR, HDRI, texture | texture/PBR (per 3D) |
| **itch.io tag CC0** | sprite animati, tile, pack | sprite/tile/anim |
> Licenze: mantenere l'allowlist hard-enforced (`asset_library_index` la già impone). CC0 prima;
> CC-BY/OFL solo con attribuzione tracciata; mai GPL/sconosciute ([[feedback_dataset_no_pollution]]).

### E3. Categorizzazione + ricerca (migration additiva)
- Aggiungere a `asset_library_index`: `style` (pixel/low-poly/realistic/hand-drawn/voxel…),
  `dimension` (2d/3d), `genre_affinity` (text[]), `tags` (text[]). L'`embedding` c'è già.
- **Ricerca SEMANTICA (per significato, non keyword)** — già la nostra tecnologia (pgvector +
  embedding, come code_knowledge/LoRA/reference-games). L'utente scrive "robot spaventoso da dungeon"
  e trova mech/teschi/mostri anche senza quelle parole esatte. **DOPPIO USO:** (a) barra di ricerca
  manuale nello Studio; (b) **match automatico in generazione** — l'asset_resolver cerca
  semanticamente gli asset coerenti col design ("platformer cyberpunk") e li usa/propone da solo.
  Costo embedding all'ingestione: ~$0.00002/asset (trascurabile).

### E4. Mappe/livelli pronti — cosa esiste DAVVERO (onesto, verificato)
- **2D:** formato standard **Tiled (.tmx/.tmj)** + importer **YATI** (Godot 4) + editor **Sprite
  Fusion** (export Godot/JSON/TMX). Esistono pack di livelli-tile CC0 (itch.io). → I livelli 2D
  pronti SONO un input valido: importati come tilemap, il code_gen ci costruisce la logica sopra. NON
  sono "giochi pronti".
- **3D:** NON esistono livelli 3D plug-and-play. Esistono **kit modulari** (KayKit dungeon, Kenney) =
  pezzi da assemblare → li compone il nostro `level_layout_3d`. Gestire l'aspettativa: kit, non livelli.
- **Incastro:** mappe/kit pronti sono INPUT agli algoritmi-mappa del piano B4 (rot-js/WFC/Perlin), non
  sostituti. Un livello-tile CC0 può essere lo "skeleton" che l'LLM rifinisce.

### E5. Animazioni — esistono (verificato)
- 2D: sprite-sheet animati (Kenney, Ninja Adventure, RGS modular). 3D: Quaternius Universal Animation
  Library (CC0) + Mixamo (gratis) + RancidMilk (CC0). → Riempie `animation=0`. Si infilano come asset
  tipizzati (slot "animation") nello stesso modello.

### E6. Composizione (il ponte, già metà fatto)
- `asset_resolver` legge `project_assets` come PRIMA fonte (asset curati dall'utente: presi dalla
  libreria, modificati in Studio, o BYOA), poi catalogo CC0, poi generativo paywall. Un asset preso
  dalla libreria → ritoccato coi tool Sorceress → salvato in `project_assets` → usato in generazione.
  Libreria + Studio + Generazione = stesso `project_assets`, tre porte.

### Effetto utente (per livello)
- Casual: prompt → gioco con asset CC0 coerenti di default (più bello senza sforzo).
- Intermedio: sfoglia libreria, sceglie stile, genera → "è mio".
- Esperto: cura un set (libreria + ritocco Sorceress + BYOA) → genera esattamente ciò che vuole = il moat "game lab".

### Vantaggi (onesti)
Meno allucinazioni (assembla asset reali) · più fedeltà ("è mio") · più veloce per convergenza (meno
FLUX/retry) · costo più basso (CC0 gratis) · anti-slop (pain #1 r/aigamedev) · componibilità =
facilità per il casual + profondità per l'esperto.

### Onestà / vincoli
Lavoro grosso (ingestione + UI + metadata = settimane). "Livelli 3D pronti" non esistono (solo kit).
Licenze per-asset da verificare (allowlist esiste). Da fare DOPO che il loop base (generazione→gioco
giocabile) è solido. Si appoggia a: piano Sorceress (`docs/research/SORCERESS_*.md`), B4 (modello
asset condiviso + preset), Fetta 3 (Studio shell + `project_assets`).

### Fonti verificate
[awesome-cc0](https://github.com/madjin/awesome-cc0) · [Kenney](https://kenney.nl) ·
[Quaternius Universal Animation Library CC0](https://quaternius.itch.io/universal-animation-library) ·
[YATI Tiled→Godot](https://github.com/Kiamo2/YATI) · [Sprite Fusion](https://www.spritefusion.com/) ·
[OpenGameArt CC0](https://opengameart.org/content/cc0-resources) · [ambientCG] · [Mixamo].

---

## I 30 tool Sorceress — inventario esplicito (per FASE B/C/E, non dimenticare)
Fonte: `docs/research/SORCERESS_30_TOOLS.md` (inventario+mapping completo). Sorceress = pura
orchestrazione (no modelli propri). Vantaggio nostro: le porte esagonali esistono già
(ImageGenPort/Model3DPort/AudioGenPort) → integrarli = riempire porte, non riscrivere.

**🟢 Ricreabili 1:1 in casa (algoritmo deterministico, costo ZERO, free tier) — 12:**
True Pixel, Pixel Snap, Sprite Analyzer, Slicer, 3D-to-2D (render headless dei 554 model CC0),
Material Forge (5/6 PBR map = derivati deterministici), Background Remover (rembg), Corridor Chroma
(chroma key), SFX Editor, Sound Studio (slice), Procedural Walk (IK), Bitrate converter.

**🟡 Riempire una porta esistente con un provider (paywall) — 9:**
Auto-Sprite (video→frame→chroma→sheet, la capability più forte), 3D Studio + Auto-Rigging +
Text-to-Animation (Meshy/TRELLIS/Rodin/Tripo), Material base-color, Seamless Tile, Image Expander
(outpaint), Music Gen (Suno), SFX Gen (ElevenLabs + 2.488 SFX CC0 nel DB), Speech Gen (ElevenLabs).

**🔵 Già nostro (a volte meglio) — 5+:** Tileset Forge (il nostro autotile 47-blob da 1 tile è
superiore), Quick Sprites, Publishing (webExport+zip+itch), Play Arcade (feed iframe), WizardGenie
(il loro game-engine SENZA verifica — il nostro verificato vince; mai assorbire).

**⚪ Skip day-1:** Voxel Studio/anim/walk (×3), Canvas, Layout Preview, Marketplace.

→ Sequenza: i 12 deterministici sono lavoro nostro gratis (free tier); i 9 provider vanno dietro
`ensureAllowed` (paywall). Tutti come pannelli dello Studio (Fetta 3, shell fatta) + come fonti per
l'`asset_resolver` nella generazione-gioco. Audio è il più pronto (codice già scritto).

## Rapporto con gli altri piani (niente è perso/in conflitto)
- **Piano fette** (`~/.claude/plans/svolgi-sia-uno-che-sharded-allen.md`): Fette 0-3 fatte
  (ingresso Higgsfield, primo gioco, audio, **Studio shell**); restano Fetta 4 (play+edit = WOW D1),
  Fetta 5 (Playtester = **fatto oggi**), Fetta 6 (code-RAG misurato), Fetta 7 (LoRA, dietro gate).
- **Piano Sorceress** (`docs/research/SORCERESS_*.md`): assorbire i 30 tool come "Asset Studio".
  La SHELL Studio esiste (Fetta 3); le CAPABILITY dietro le porte (sprite FLUX, audio, 3D/Meshy,
  Material Forge) = **WOW FASE B2/C**. Lo stesso lavoro (cablare i provider dietro
  ImageGenPort/AudioGenPort/Model3DPort) serve sia la generazione-gioco sia lo Studio → un lavoro,
  due feature. Per decisione del piano Sorceress: si fa DOPO aver validato il primo gioco reale
  (= FASE A qui), per non costruire uno studio asset su un motore non provato end-to-end.

## Cosa NON facciamo (deciso col dato)
- Template fissi per gioco (ucciderebbero "qualsiasi gioco da un prompt").
- Assembler per-motore (il nostro scaffold li ha superati).
- Costruire i 32 tool mancanti ora (asset extra/community = dopo).
- Adottare GDevelop ora (opzione strategica forte ma da validare headless — vedi memoria).

## Verifica trasversale (ogni fase)
Run reale tracciato → leggere run_traces (tool usati, codice, playtest) + SCREENSHOT (vedere, non
dedurre) + il gioco gira/è giocabile. Mai dichiarare "fatto" senza la prova visiva.
