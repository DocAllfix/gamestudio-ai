# Messaggio di avvio — nuova sessione GameSmith

> Copia-incolla questo come primo messaggio della nuova sessione (o di' a Claude
> "leggi docs/NEXT_SESSION_START.md"). Serve a dare contesto pulito senza il rumore
> del debugging della sessione precedente.

---

Ciao. Riprendiamo lo sviluppo di **GameSmith** (workspace "Game Studio AI"):
piattaforma che genera videogiochi giocabili nel browser da un prompt, con asset
contestuali, su più motori (Godot/Phaser/… + 3D). Sono un dev solo. Comunico in
italiano. Lavoro con verifica **sul dato** (run reale → trace → screenshot), niente
supposizioni, niente pezze ai sintomi.

**Prima di tutto, leggi (sono nel repo, committati):**
1. `docs/IMPLEMENTATION_PLAN.md` — il piano approvato (architettura + fasi).
2. `docs/STUDIO_LIBRARY_PLAN.md` — lo Studio completo (tool, UI, fattibilità).
3. La memoria `project_architecture_pivot` ti riassume la svolta.

**Contesto in breve (la svolta architetturale):**
- Problema: i giochi "non sembrano giochi" (asset montati a caso, tileset stirato,
  scene grigie), affidabilità ~1 run su 5. Causa-radice (verificata + confermata da
  un analista esterno): l'LLM fa 3 lavori in un solo GDScript — logica (OK),
  **composizione scena** (male), **wiring asset→nodi** (non dovrebbe).
- Svolta: **l'LLM produce DATI (un `GameSpec`), non codice di rendering.** Un
  **compositore deterministico** + **adapter per-motore** (porta `EngineComposer`,
  ~10 primitive) rendono la scena. 6 archetipi coprono i 14 generi. Lo **Studio**
  produce gli asset arricchiti (tile_size/palette/frame) che il composer consuma.
- Scoperta: il composer **esiste già a metà** (`lib/tools/level/tilemap_populate/`
  produce un `.tmj` con autotile) ma è **scollegato** — va riconnesso, non ricostruito.
- Approccio: **tracer bullets ORIZZONTALI** su Godot+Phaser (no vertical slice;
  Defold/3D dopo). **Studio in codice + composer su carta in parallelo.** Filtro
  anti-leak: pseudo-codice Godot+Phaser per ogni primitiva prima di scrivere rendering.

**Da dove partire: FASE 0 del piano** — contratti su carta:
`GameSpec` (Zod) per `side_scroller_platform` + porta `EngineComposer` + schema asset
enriched, col filtro pseudo-codice Godot+Phaser. Zero rendering finché lo schema non regge.

**Stato del codice (già committato/pushato su `main`):**
- Studio già a metà: `lib/studio/{slicer,pixel-snap,material-maps}.ts`, pagina
  `app/(dashboard)/studio/`, bridge `asset_resolver.findUserAsset`, audio port
  `lib/tools/audio/` (scritto, non nel registry).
- Asset: ~8.267 in `asset_library_index` (6.861 con style_pack); +754 OGA 2D +1.406
  musica CC0 ingeriti.
- Composer-metà: `tilemap_populate` (.tmj+autotile), `_platformer-physics.ts`
  (`jumpReachCells`).
- La **pipeline LLM attuale gira in produzione** e resta invariata: costruiamo il
  nuovo sistema a fianco, zero regressioni per gli utenti.

**Caveat onesti:**
- **OpenRouter è a credito zero** (esaurito da ~27 run di test). Per generare giochi
  veri (path LLM) serve ricaricarlo. Il **fallback garantito** fa uscire comunque un
  gioco giocabile senza LLM (ma è una rete di sicurezza, da rifare meglio col composer).
- C'è una modifica NON committata a `lib/runtime/assembler/_godot-fallback.ts` (un
  abbozzo di "abbellimento" del fallback): è una pezza superata dal nuovo piano —
  ignorala o scartala (`git checkout lib/runtime/assembler/_godot-fallback.ts`).
- Token Trigger.dev per il deploy worker: `TRIGGER_ACCESS_TOKEN` è in `.env`
  (deploy: `npx trigger.dev@4.4.6 deploy --skip-update-check`, con `unset CI`).

**Verifica sempre col dato.** Ricordati: prima la roccia (gira), poi la bellezza.
Partiamo dalla FASE 0.
