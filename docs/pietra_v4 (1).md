# PIETRA FONDATIVA DEFINITIVA v4.0
## Game Studio AI — La piattaforma che democratizza lo sviluppo di videogiochi

**Versione**: 4.0 FINALE  
**Data**: 18 maggio 2026  
**Input**: 8 documenti fondativi + Serverless Blueprint + Coverage Analysis + Gap Resolution + Ricerca Empirica + Roblox Legal Analysis  
**Stack**: Next.js + 18 servizi BaaS + Hermes pattern + 48 tool AI  
**Vincolo**: 1 sviluppatore, Claude Code, $0-30/mese → lancio → unicorno

---

# ═══════════════════════════════════════════
# PARTE I — IL CERVELLO ORCHESTRATORE
# ═══════════════════════════════════════════

## 1. HERMES AGENT — Il nostro motore

### 1.1 Decisione e motivazione

**Hermes Agent** (Nous Research, MIT, 57K+ stelle GitHub, febbraio 2026) è il nostro orchestratore. Non LangGraph, non CrewAI, non AutoGen, non codice custom da zero.

Motivazione spietata:

- **È validato in produzione a scala miliardaria.** Piattaforme da miliardi di dollari di valutazione usano Hermes Agent come orchestratore. Non è un progetto accademico — è infrastruttura di produzione.
- **Ha già tutto ciò che ci serve built-in.** Memoria a 3 livelli, registry tool con function calling, retry ricorsivo, esecuzione parallela (sub-agent), supporto 200+ modelli LLM, scheduled automations. Noi ne adottiamo il **pattern architetturale** e lo reimplementiamo in TypeScript dentro Trigger.dev — niente daemon da installare, niente VPS da gestire.
- **MIT license.** Uso commerciale libero, nessun vendor lock-in, audit completo del codice.
- **Si auto-migliora.** Il pattern di Episodic Memory fa sì che dopo 3 mesi di uso, le performance siano drasticamente superiori al giorno 1.

**NOTA ARCHITETTURALE**: Non installiamo Hermes Agent come daemon su un server. Adottiamo il suo **pattern** (memoria 3 livelli, tool registry, retry ricorsivo) e lo implementiamo come classe TypeScript (`GameOrchestrator`) eseguita dentro task Trigger.dev. Zero infra da gestire.

### 1.2 Cosa SCARTIAMO definitivamente

| Framework | Perché lo scartiamo |
|---|---|
| **LangGraph** | Hermes Agent fa tutto quello che LangGraph fa (grafi, stato, retry, HITL) + memoria persistente + skill auto-generanti + 200+ modelli. LangGraph è un sottoinsieme di Hermes. |
| **CrewAI** | Pattern "agenti che parlano tra loro" = costi token imprevedibili, debugging impossibile. Hermes usa function calling deterministico. |
| **AutoGen** | API instabile, riscritto 2 volte da Microsoft. Non affidabile come fondazione. |
| **LlamaIndex** | Hermes ha già il suo sistema di memoria e retrieval. Ridondante. |
| **Haystack** | Stessa logica di LlamaIndex. |
| **LangChain** | Teniamo solo i document loaders come utility per ingestion PDF/DOCX. Il resto non serve. |

### 1.3 I tre livelli di memoria (architettura production-grade)

**Short-Term Context** — scratchpad del job corrente. Brief, GDD in costruzione, task in esecuzione, output parziali. Vive in RAM. Si cancella a fine job.

**Long-Term Knowledge** — profilo utente/progetto persistente. "Questo utente preferisce pixel art dark, palette fredda, meccaniche soulslike." Salvato in **Supabase** (tabella `user_preferences`). Ogni generazione futura rispetta queste regole senza doverle ripetere.

**Episodic Memory** — log di esperienze con parametri di successo. Se il sistema ha trovato il prompt giusto per generare un boss fight dopo 3 tentativi, salva quei parametri esatti. La prossima volta parte dal successo, non da zero. Il sistema **migliora da solo** — è il moat competitivo più forte e non richiede training di modelli.

### 1.4 I 40 tool del Game Studio

Il nostro orchestratore espone 40 tool specializzati per il game development. Ogni tool è una funzione Python async con input/output tipizzati.

**Dipartimento CODE (8 tool)**

| # | Tool | Cosa fa | Modello backend |
|---|---|---|---|
| 1 | `gdd_generator` | Genera Game Design Document completo da brief | DeepSeek V4 Flash |
| 2 | `code_gen_gdscript` | Genera script GDScript per Godot 4 | DeepSeek V4 Pro |
| 3 | `code_gen_javascript` | Genera script JS/TS per Phaser 3 | DeepSeek V4 Pro |
| 4 | `code_gen_csharp` | Genera script C# per MonoGame/Stride | Kimi K2.6 |
| 5 | `code_gen_python` | Genera script Python per Ren'Py | DeepSeek V4 Flash |
| 6 | `code_gen_lua` | Genera script Lua per Defold/LÖVE | DeepSeek V4 Pro |
| 7 | `dialogue_gen` | Genera albero dialoghi in formato ink (.ink) | DeepSeek V4 Flash |
| 8 | `behaviour_tree_gen` | Genera BT per NPC (Beehave/custom) da descrizione | Claude Sonnet |

**Dipartimento ART 2D (6 tool)**

| # | Tool | Cosa fa | Modello backend |
|---|---|---|---|
| 9 | `sprite_gen` | Genera sprite sheet (idle, walk, run, jump, attack, die) | SDXL/FLUX via Replicate |
| 10 | `tileset_gen` | Genera tileset coerente per bioma/zona | SDXL + ControlNet |
| 11 | `ui_gen` | Genera mockup UI: HUD, menu, inventario, mappa | FLUX Pro |
| 12 | `background_gen` | Genera background/parallax layers per livelli | SDXL/FLUX |
| 13 | `anim_sprite_gen` | Genera sprite sheet frame-by-frame per animazioni | SDXL + ControlNet |
| 14 | `style_analyzer` | Analizza concept art dell'utente → estrae palette, stile, proporzioni | Claude Vision |

**Dipartimento ART 3D (4 tool)**

| # | Tool | Cosa fa | Modello backend |
|---|---|---|---|
| 15 | `model_3d_gen` | Genera modello 3D da testo o immagine | Meshy / Tripo / TripoSR |
| 16 | `model_3d_texture` | Applica texture PBR a mesh esistente | Meshy API |
| 17 | `model_3d_rig` | Auto-rigging di mesh 3D con skeleton | Meshy API / Blender headless |
| 18 | `model_3d_animate` | Genera animazione su modello riggato (500+ preset Meshy) | Meshy API |

**Dipartimento AUDIO (3 tool)**

| # | Tool | Cosa fa | Modello backend |
|---|---|---|---|
| 19 | `bgm_gen` | Genera colonna sonora (genere, BPM, mood, durata, loop) | Suno API |
| 20 | `sfx_gen` | Genera effetti sonori (impatto, passo, UI click, ambiente) | ElevenLabs SFX |
| 21 | `voice_gen` | Genera voci NPC con TTS (multilingua, emozioni) | ElevenLabs TTS |

**Dipartimento LEVEL DESIGN (4 tool)**

| # | Tool | Cosa fa | Modello backend |
|---|---|---|---|
| 22 | `level_layout_2d` | Genera layout livello 2D (griglia con annotazioni semantiche) | Claude Sonnet |
| 23 | `tilemap_populate` | Traduce layout astratto in tilemap concreta con WFC/walker | Python (DeBroglie/custom) |
| 24 | `entity_placement` | Posiziona nemici, oggetti, NPC, trigger su mappa generata | DeepSeek V4 Pro |
| 25 | `heightmap_gen` | Genera heightmap 3D con noise + parametri LLM per terreni | Python (Perlin/Simplex) |

**Dipartimento VFX (3 tool)**

| # | Tool | Cosa fa | Modello backend |
|---|---|---|---|
| 26 | `shader_gen` | Genera shader custom (acqua, fuoco, dissolve, outline, glow) | Claude Sonnet (shader math) |
| 27 | `particle_gen` | Genera configurazione particellare (esplosioni, magia, pioggia) | DeepSeek V4 Pro |
| 28 | `postfx_gen` | Genera profilo post-processing (glow, tonemap, fog, color grade) | DeepSeek V4 Flash |

**Dipartimento GAME DESIGN (3 tool)**

| # | Tool | Cosa fa | Modello backend |
|---|---|---|---|
| 29 | `boss_design` | Genera boss fight multi-fase (pattern, telegraph, HP, fasi) | Claude Sonnet |
| 30 | `difficulty_balancer` | Analizza parametri (HP, DMG, loot) e suggerisce bilanciamento | DeepSeek V4 Flash |
| 31 | `progression_design` | Genera curva di progressione (XP, unlock, pacing) | Claude Sonnet |

**Dipartimento ASSEMBLY (5 tool — uno per engine)**

| # | Tool | Cosa fa |
|---|---|---|
| 32 | `godot_assembler` | Compone progetto Godot 4 completo (project.godot, .tscn, .gd, assets/) |
| 33 | `phaser_assembler` | Compone progetto Phaser 3 (index.html, game.js, assets/) |
| 34 | `renpy_assembler` | Compone progetto Ren'Py (script.rpy, images/, audio/) |
| 35 | `defold_assembler` | Compone progetto Defold (game.project, .collection, .script) |
| 36 | `monogame_assembler` | Compone progetto MonoGame (.csproj, Content/, .cs) — Fase 2 |

**Dipartimento QA (3 tool)**

| # | Tool | Cosa fa |
|---|---|---|
| 37 | `code_validator` | Verifica: il codice compila? Linter engine-specifico. |
| 38 | `project_validator` | Verifica: tutte le risorse referenziate esistono? Percorso completabile? |
| 39 | `smoke_test` | Esecuzione headless del gioco per 10s — crasha? |

**Dipartimento PUBLISHING (1 tool)**

| # | Tool | Cosa fa |
|---|---|---|
| 40 | `store_page_gen` | Genera descrizione Steam/itch.io, tag, feature bullets, testi marketing |

**6 killer feature aggiuntive (dal Growth Report)**

| # | Tool | Cosa fa | Impatto |
|---|---|---|---|
| 41 | `itch_packager` | Zip compilato + store page + screenshot auto + OAuth 1-click publish su itch.io | Abbatte barriera pubblicazione |
| 42 | `stream_mode` | Overlay per Twitch/YouTube: mostra prompt live, spettatori votano modifiche real-time | Viralità esplosiva |
| 43 | `portfolio_gen` | Pagina pubblica username.brand.tld con tutti i giochi dell'utente, clonabili | Social proof per creator |
| 44 | `jam_mode` | Pre-configura interfaccia per game jam: timer, milestone, QA auto, export formato jam | Partnership con jam itch.io |
| 45 | `ai_coach` | Analizza il gioco generato e propone migliorie di bilanciamento, pacing, marketing store page | Differenziatore unico |
| 46 | `npc_plugin` | Pacchetti NPC generativi (Hermes 3 8B via Ollama) aggiungibili a un gioco con 1-click | Feature unica, nessun competitor |
| 47 | `code_gen_luau` | Genera script Luau per Roblox (variante di code_gen_lua) | Accesso a 300M utenti Roblox |
| 48 | `roblox_assembler` | Genera Place structure + upload via Open Cloud API | Export verso piattaforma Roblox |

**Totale: 48 tool — il catalogo più completo nel mercato.**

---

# ═══════════════════════════════════════════
# PARTE I-BIS — IL GAME REASONING ENGINE
# ═══════════════════════════════════════════

## 1-BIS. IL CERVELLO CHE CAPISCE I VIDEOGIOCHI

### Cos'è il Game Reasoning Engine

Non basta orchestrare 46 tool — serve un layer che **capisca il linguaggio dei videogiochi** (generi, loop, pacing, difficoltà, estetica) e usi i tool come specialisti per implementare un piano coerente.

Il Game Reasoning Engine è il layer sopra Hermes che:
- Costruisce e mantiene una **rappresentazione strutturata del gioco** (Game Plan + Game Graph) prima che venga generato un singolo file
- Opera su **metriche di game design** (pacing, difficulty curve, readability, risk/reward) non solo su prompt testuali
- Coordina i 46 tool come un direttore d'orchestra che segue una partitura, non come un dispatcher che smista ticket

Ispirazione diretta: l'AI Director di Left 4 Dead, che non spawna zombie a caso ma calcola lo "stress" del giocatore e modula nemici, risorse, musica e ritmo per creare tensione drammatica. Il nostro Reasoning Engine fa la stessa cosa ma in fase di **creazione**.

### Il flusso prima e dopo

**PRIMA (senza Reasoning Engine)**:
```
Brief → Hermes chiama tool in sequenza → output (potenzialmente incoerente)
```

**DOPO (con Reasoning Engine)**:
```
Brief → Game Plan (modello strutturato del gioco) → tool calls guidate dal piano → output coerente
```

### 1-BIS.1 Game Plan — La partitura del gioco

Il Game Plan è un documento JSON/SQL strutturato che modella l'intero gioco prima che venga generata una singola riga di codice:

```json
{
  "meta": {
    "genre": "metroidvania",
    "sub_genre": "souls-lite",
    "target_platform": ["steam", "web"],
    "target_duration": "4-6 hours",
    "audience": "core_gamer",
    "difficulty": "medium-hard"
  },
  "core_loop": {
    "primary_actions": ["explore", "combat", "platforming"],
    "secondary_actions": ["talk_npc", "upgrade", "unlock_ability"],
    "reward_cycle": "ability_gating + lore_discovery",
    "risk_reward": "souls-lite (lose currency on death, recover at spot)"
  },
  "world_graph": {
    "zones": [
      {"id": "crystal_cave", "type": "intro", "difficulty": 1, "connections": ["dark_forest"]},
      {"id": "dark_forest", "type": "mid", "difficulty": 3, "connections": ["crystal_cave", "ruins", "abyss"]},
      {"id": "ruins", "type": "mid", "difficulty": 4, "connections": ["dark_forest", "throne_room"]},
      {"id": "abyss", "type": "late", "difficulty": 5, "connections": ["dark_forest", "throne_room"]},
      {"id": "throne_room", "type": "climax", "difficulty": 6, "connections": ["ruins", "abyss"], "boss": true}
    ],
    "gating": {"dark_forest→ruins": "requires_dash", "dark_forest→abyss": "requires_wall_climb"}
  },
  "pacing": {
    "intro_zone": {"stress": "low", "enemies": "few_weak", "resources": "generous", "music": "ambient_calm"},
    "mid_zones": {"stress": "building", "enemies": "varied", "resources": "balanced", "music": "tension_building"},
    "climax_zone": {"stress": "peak", "enemies": "elite+boss", "resources": "scarce", "music": "epic_orchestral"}
  },
  "aesthetics": {
    "art_style": "pixel_art_dark",
    "palette": ["#1a1a2e", "#16213e", "#0f3460", "#e94560"],
    "resolution": "320x180",
    "music_mood": "dark_ambient_orchestral",
    "sfx_style": "impactful_crunchy"
  },
  "rules": {
    "player_hp_range": [50, 200],
    "enemy_damage_range": [5, 40],
    "boss_phases_min": 2,
    "boss_phases_max": 4,
    "max_simultaneous_enemies_intro": 3,
    "checkpoint_frequency": "every_2_rooms"
  }
}
```

Ogni tool legge dal Game Plan e scrive nel Game Plan. La coerenza globale è garantita dal modello dati.

### 1-BIS.2 Game Graph — La struttura del mondo

Accanto al Game Plan, il Game Graph unifica:
- **World graph/lore**: luoghi, NPC, fazioni, oggetti, relazioni (JSONB in Supabase)
- **Grafo dei livelli**: nodi = stanze/zone, archi = connessioni/sblocchi
- **Dipendenze gameplay**: quali abilità gattano quali zone, quali item sbloccano quali aree

Questo grafo permette al Reasoning Engine di: evitare soft-lock (mai chiavi necessarie dopo la porta), mantenere coerenza narrativa (NPC non contraddicono eventi passati), ottimizzare backtracking e pacing.

### 1-BIS.3 I 6 moduli del Reasoning Engine

| Modulo | Input | Output | Tool che usa |
|---|---|---|---|
| **Intent Interpreter** | Brief + preferenze + reference art/musica | Game Plan v0 + routing engine | Claude Sonnet (reasoning) |
| **Design Planner** | Game Plan v0 | Game Plan raffinato (core loop, mappa, pacing, regole) | Claude Sonnet + difficulty_balancer |
| **Consistency Manager** | Game Graph + dialoghi/quest generati | Validazione coerenza + correzioni | DeepSeek V4 Pro + dialogue_gen |
| **Balance Controller** | Game Plan + parametri numerici | Parametri bilanciati + report | difficulty_balancer + property_test_gen |
| **Execution Orchestrator** | Game Plan finale | Chiamate ordinate a code_gen, art_gen, audio_gen, assembler | Hermes Agent (tutti i 46 tool) |
| **Evaluation Agent** | Playtest data + feedback utente | Proposte di modifica al Game Plan + rigenerazione parziale | ai_coach + smoke_test |

### 1-BIS.4 API interne del Reasoning Engine

Tre funzioni core che strutturano tutto il flusso:

```python
# 1. Da brief a Game Plan
async def propose_game_plan(brief: str, preferences: dict, references: list) -> GamePlan:
    """Intent Interpreter + Design Planner generano il piano completo"""

# 2. Da feedback a Game Plan aggiornato  
async def refine_game_plan(game_plan: GamePlan, feedback: str) -> GamePlan:
    """L'utente dice 'rendi il boss più facile' → il piano si aggiorna"""

# 3. Da Game Plan a progetto engine
async def materialize_game(game_plan: GamePlan, engine: str) -> ProjectZip:
    """Execution Orchestrator traduce il piano in chiamate tool → progetto completo"""
```

### 1-BIS.5 Impatto sul posizionamento

Il Game Reasoning Engine è il moat competitivo principale. La narrativa diventa:

> "Non generiamo solo codice e asset — abbiamo un Game Reasoning Engine che modella il gioco come un sistema coerente e usa 46 specialisti AI per implementarlo su 8+ engine reali."

Rosebud genera giochini web. SEELE genera demo 3D. Noi modelliamo il gioco come un **sistema** e poi lo costruiamo. È la differenza tra generare un video e dirigere un film.

---

# ═══════════════════════════════════════════
# PARTE I-TER — MARKET DATA E VALIDAZIONE
# ═══════════════════════════════════════════

## 1-TER. DATI DI MERCATO

### Dimensioni del mercato (fonti verificate)

- **AI Game Generator Market**: $1.64B (2024) → $21.26B (2034), CAGR 29.2%
- **AI in Games complessivo**: $4.8B (2025) → $22.6B (2034), CAGR 18.8%
- **Indie Game Market**: $9.9-11.1B (2024-2025) → $28.6B+ (2033), CAGR 12-14%
- **TAM combinato**: supera i $20B nel prossimo decennio

### Segmenti target

1. **Creator bloccati (non-coder)**: artisti, scrittori, musicisti, studenti — target primario
2. **Indie dev sovraccarichi**: 1-3 persone, sanno programmare ma schiacciate da asset/QA — target secondario
3. **Modder / community designer**: abituati a moddare Skyrim, Minecraft, RimWorld — convertibili con template "mod-like"
4. **Educazione & bootcamp**: scuole e corsi che vogliono introdurre game dev senza 3 mesi di setup engine

### Competitor dissezionati

| Competitor | Output | Engine | Limiti strutturali |
|---|---|---|---|
| **Rosebud AI** | Giochi web Three.js, vibe coding, fork/remix | Solo WebGL/Three.js | Nessun export serio, giochi percepiti come "giochini web", pipeline asset limitata |
| **SEELE AI** | Demo 3D, workflow iterativo tipo Claude Code | Three.js + Unity WebGL | Solo demo/esperimenti, no progetti completi multi-engine, no governance |
| **Aippy** | Mini-game e meme interattivi mobile | App mobile proprietaria | Target casual irrilevante per game dev serio |
| **Sider AI** | Browser games generici | Solo web | Scopo ludico/didattico, non produzione |

### 5 moat strutturali di Game Studio AI

1. **Multi-engine reale**: 8 engine al lancio, nessun competitor comparabile
2. **Orchestratore Hermes**: production-grade con memoria a 3 livelli e skill auto-generanti
3. **46 tool specializzati**: coprono intera catena del valore (code, art 2D/3D, audio, level design, VFX, QA, publishing)
4. **Output = progetto engine completo**: cartella apribile in editor, versionabile su Git, pubblicabile su Steam/itch.io
5. **Game Reasoning Engine**: unico player con un cervello che modella il gioco come sistema coerente prima di generarlo

Gap confermato: nessun competitor fa multi-engine, project-owned, orchestrato a livello studio con reasoning engine.

---

# ═══════════════════════════════════════════
# PARTE II — MATRICE ENGINE + MODELLI LLM
# ═══════════════════════════════════════════

## 2. MOTORI DI GIOCO — Catalogo completo con verdetto

Analisi incrociata del Routing Matrix + OSINT Reports + ricerca maggio 2026.

### 2.1 Engine al lancio (Fase 1)

**GODOT 4** — Il generalista
- Licenza: MIT. Linguaggio: GDScript (+ C#). MCP: 3 server maturi (godot-ai, godot-mcp-server, Godot-MCP).
- Genera: Metroidvania, Platformer, RPG top-down, Action 2D, Roguelike, 3D leggero, Social sim.
- Perché al lancio: headless CLI, file di testo generabili senza installare Godot, export Steam/Web/Desktop/Mobile, i LLM generano GDScript eccellentemente.
- Giochi di riferimento: Cassette Beasts, Dome Keeper, Brotato, Halls of Torment.
- Limiti: 3D competitivo ma non al livello Unity/Unreal. Community più piccola.

**PHASER 3** — Il web-instant
- Licenza: MIT. Linguaggio: JavaScript/TypeScript. MCP: nessuno necessario (sono file web).
- Genera: Browser arcade, Puzzle, Casual, Marketing game, Demo giocabili, Prototipi rapidi.
- Perché al lancio: zero installazione per l'utente finale (gioco nel browser), i LLM generano JS perfettamente, "wow factor" istantaneo.
- Limiti: solo web/browser, nessun export nativo desktop/mobile.

**REN'PY** — Lo specialista narrativo
- Licenza: MIT. Linguaggio: Python. MCP: non necessario (script .rpy sono testo).
- Genera: Visual novel, Dating sim, Narrativa interattiva, Interactive fiction.
- Perché al lancio: standard mondiale del genere, Doki Doki Literature Club è fatto con Ren'Py, la generazione è quasi triviale (testo + immagini + scelte), mercato enorme.
- Limiti: solo visual novel / narrativa.

**DEFOLD** — Il mobile-first
- Licenza: Custom (100% gratuita, zero royalty). Linguaggio: Lua. MCP: plugin Player2 AI NPC.
- Genera: Mobile casual, Hyper-casual, Puzzle mobile, 2D ottimizzato touch.
- Perché al lancio: creato da King (Candy Crush), build ultra-leggere, performance eccellenti su telefoni economici, export iOS/Android/Web nativo.
- Limiti: community più piccola, meno tutorial, Lua meno generato dai LLM rispetto a JS/Python/GDScript.

### 2.2 Engine al lancio — Tier 2 (specialistici, con MCP server disponibile)

Questi engine erano inizialmente previsti per la Fase 2, ma la scoperta di MCP server dedicati li rende integrabili al lancio.

**MONOGAME** — Il pixel-perfect
- Licenza: MIT/Ms-PL. Linguaggio: C#. Genera: Platformer hardcore, Pixel art preciso, JRPG, Retro.
- Giochi: Celeste, Stardew Valley, Streets of Rage 4. DeepSeek/Kimi generano C# bene.
- **MCP server: `monogame-mcp`** (GitHub: jchambless/monogame-mcp) — documentazione AI-powered, gestione progetto, scaffolding codice, diagnostic tool per MonoGame. Si installa con `npx monogame-mcp` o Docker. Supporta creazione progetti, content pipeline, build/run da CLI.

**LÖVE** — Il minimalista
- Licenza: zlib (libera). Linguaggio: Lua. Genera: Card game, Bullet hell, Roguelike puro, Prototipi.
- Giochi: Balatro (versione iniziale), Move or Die. Leggero, zero overhead.
- **MCP server: `love2d-mcp`** (GitHub: shayarnett/love2d-mcp) — bridge bidirezionale tra LÖVE e AI assistant via TCP. Permette introspezione real-time (query game objects, posizioni, proprietà), esecuzione dinamica di codice Lua nel contesto del gioco, debugging AI-assisted, modifica del comportamento senza restart.

**THREE.JS** — Il 3D browser
- Licenza: MIT. Linguaggio: JavaScript. Genera: 3D browser, Esperienze web immersive, Showcase.
- I LLM generano Three.js eccellentemente. Perfetto per demo 3D instant.
- **MCP server: 3 opzioni disponibili.**
  - `threejs-devtools-mcp` (GitHub: DmitriyGolub) — **59 tool** per oggetti, materiali, shader, texture, animazioni, performance monitoring, memory diagnostics, code generation. Zero modifiche al progetto. Funziona con vanilla Three.js e React Three Fiber.
  - `three-js-mcp` (locchung) — controllo real-time scene 3D via WebSocket: creazione oggetti, movimento, rotazione, scene state retrieval.
  - `mcp-game-asset-gen` (GitHub: Flux159) — generazione asset per Three.js (immagini, audio, modelli 3D) via MCP con provider multipli (OpenAI, Gemini, Fal.ai).

**STRIDE** — Il 3D professionale open
- Licenza: MIT. Linguaggio: C#. Genera: 3D professionale, Action-adventure.
- Editor Unity-like ma FOSS. Community piccola ma crescente.
- MCP: nessun server dedicato trovato, ma essendo C# usa lo stesso tooling .NET di MonoGame. Integrabile via CLI custom.

### 2.3 Engine Fase 3 (mese 10+ con partnership)

**UNITY** — Via partnership ISV → il nostro sistema genera file .cs, .unity, .prefab.
**UNREAL ENGINE 5** — Via MCP server esistente (22 tool) → il più ambizioso.

### 2.4 Piattaforme esterne (export target, non engine core)

**ROBLOX** — Export target con 300M+ utenti
- Linguaggio: Luau (derivato Lua 5.1, open-source MIT). Il nostro `code_gen_lua` genera anche Luau con differenze minime.
- Integrazione: via Open Cloud API ufficiale (beta). L'utente collega il SUO account Roblox via OAuth → il sistema carica codice e asset sul Place dell'utente.
- I giochi Roblox vivono SOLO sulla piattaforma Roblox. Non sono esportabili su Steam/itch.io.
- Roblox può revocare l'accesso API in qualsiasi momento. Per questo è un export target, non un engine core.
- Precauzioni legali: non usiamo "Roblox" nel nostro branding, non raccogliamo dati utenti Roblox, non usiamo gli AI tool di Roblox per il nostro prodotto. Il codice lo generiamo con i nostri LLM.
- Disclaimer nell'UI: "I giochi esportati su Roblox vivono sulla piattaforma Roblox e sono soggetti ai loro Termini di Servizio. Per giochi che possiedi al 100%, scegli un engine open-source."
- Generi ideali su Roblox: Obby, Tycoon, Simulator, Social hangout, Tower defense.
- Fase 2 — costo implementazione ~430 righe (code_gen_luau + roblox_assembler + OAuth + upload + disclaimer UI).

### 2.4 Engine SCARTATI con motivazione

| Engine | Perché scartato |
|---|---|
| **Bevy (Rust)** | I LLM generano Rust che non compila nell'80% dei casi. Bevy < v1.0, API instabile. |
| **Cocos2d-x** | Ecosistema in declino, community ridotta, superato da Defold e Phaser. |
| **LibGDX (Java)** | Java nel 2026 per game dev indie è anacronistico. |
| **OGRE / Urho3D** | Engine low-level per sviluppatori C++ esperti. Antitetici alla democratizzazione. |
| **Pyxel** | Troppo di nicchia. Le restrizioni retro 8-bit si simulano meglio come "profilo" in Godot. |

### 2.5 Routing automatico: genere → engine consigliato

| L'utente vuole... | Engine consigliato | Perché | Alternativa |
|---|---|---|---|
| Metroidvania / Platformer action | **Godot 4** | Miglior 2D con physics + MCP maturo | MonoGame (C# pixel-perfect) |
| Visual novel / Dating sim | **Ren'Py** | Standard del genere, codice semplicissimo | Godot + Dialogic |
| Mobile casual / Puzzle | **Defold** | Ottimizzato mobile, build leggere | Phaser (web) |
| Browser game / Demo istantanea | **Phaser 3** | Zero installazione, giocabile subito | Godot web export |
| RPG top-down / JRPG | **Godot 4** | Sistema scene flessibile, dialoghi con ink | MonoGame (C#) |
| Card game / Autobattler | **LÖVE** | Leggero, Lua perfetto per logica card game | Phaser 3 |
| Platformer hardcore pixel-perfect | **MonoGame** | Celeste-level di precisione, MCP completo | Godot 4 |
| Roguelike / Roguelite | **Godot 4** | PCG template + Gaea + WFC | LÖVE (Lua) |
| 3D nel browser | **Three.js** | 3 MCP server, 59+ tool, zero installazione | Godot web 3D |
| 3D professionale desktop | **Stride** | Editor Unity-like ma MIT | Godot 4 3D |
| Multiplayer arena | **Godot 4** + Nakama | ENet integrato + Nakama backend | Stride + LiteNetLib |
| Social sim / Generative agents | **Godot 4** | Top-down + LLM NPC via Ollama | — |
| Bullet hell / Arcade puro | **LÖVE** | Minimalista, performance massima, MCP bridge | Phaser 3 |
| Retro 8-bit puro | **Godot 4** (restrizioni retro) | Vincoli creativi simulati | LÖVE |

**8 engine al lancio. 14 generi coperti. Nessun utente senza opzione.**

---

## 3. MODELLI LLM — Categorizzazione con routing per costo/task

### 3.1 I modelli e i loro costi reali (maggio 2026)

| Tier | Modello | Provider | Input/MTok | Output/MTok | Cache hit | Forza principale |
|---|---|---|---|---|---|---|
| **Bulk** | DeepSeek V4 Flash | DeepSeek API | $0.14 | $0.28 | $0.003 (98% off) | Veloce, economico, buono per testo/template |
| **Code** | DeepSeek V4 Pro | DeepSeek API | $0.44 | $0.87 | — | 93.5 LiveCodeBench, eccellente per codice |
| **Code alt** | Kimi K2.6 | Moonshot API | $0.60 | $2.50 | — | 1T params, 80-90% qualità Claude al 12% del costo |
| **Reasoning** | Claude Sonnet 4.6 | Anthropic API | $3.00 | $15.00 | $0.30 (90% off) | Architettura, design, analisi, debug |
| **Vision** | Claude Sonnet 4.6 | Anthropic API | $3.00 | $15.00 | — | Analisi concept art, storyboard, reference |
| **Premium** | Claude Opus 4.7 | Anthropic API | $5.00 | $25.00 | — | Solo edge case critici |
| **NPC runtime** | Hermes 3 8B | Ollama locale | Gratis | Gratis | — | NPC AI nel gioco finale, non nel backend |

### 3.2 Routing: tipo task → modello → costo

| Task | Modello | Costo stimato per task | Motivazione |
|---|---|---|---|
| GDD da brief | DeepSeek V4 Flash | ~$0.05 | Testo strutturato, non serve reasoning profondo |
| Dialoghi NPC (50 linee) | DeepSeek V4 Flash | ~$0.03 | Testo creativo semplice |
| Player controller GDScript | DeepSeek V4 Pro | ~$0.08 | Codice gameplay con logica |
| Enemy AI con pattern | DeepSeek V4 Pro | ~$0.10 | Codice con state machine |
| Boss fight multi-fase | Claude Sonnet | ~$0.35 | Richiede reasoning su game design |
| Level layout interconnesso | Claude Sonnet | ~$0.25 | Reasoning spaziale complesso |
| Shader custom (acqua/fuoco) | Claude Sonnet | ~$0.15 | Math e GLSL |
| Analisi concept art utente | Claude Sonnet (Vision) | ~$0.10 | Multimodale |
| Sprite 2D (1 immagine) | SDXL via Replicate | ~$0.003 | — |
| Sprite alta qualità | FLUX Pro via Replicate | ~$0.005 | — |
| Modello 3D | Meshy/Tripo API | ~$0.10-0.20 | — |
| BGM (1 traccia 60s) | Suno API | ~$0.05-0.10 | — |
| SFX (1 effetto) | ElevenLabs | ~$0.01-0.05 | — |
| Voce NPC (1 linea) | ElevenLabs TTS | ~$0.02-0.10 | — |
| Traduzione (100 stringhe) | DeepSeek V4 Flash | ~$0.02 | — |

**Costo totale per generare 1 gioco 2D completo (5 livelli)**: ~$1.50-5.00 con routing ottimizzato.

### 3.3 Modelli dai documenti — verdetto aggiornato

I 6 documenti propongono self-hosting di Llama 3, Mistral 7B, Phi-3, StarCoder2, Code Llama. **Tutti scartati per la Fase 1** perché le API DeepSeek/Kimi sono più economiche E più potenti di qualsiasi modello self-hosted, senza il costo GPU ($1-2/ora per una A100).

| Modello (dai documenti) | Verdetto | Sostituto |
|---|---|---|
| Llama 3 (self-hosted) | ❌ | DeepSeek V4 Flash via API ($0.14/MTok vs $1-2/ora GPU) |
| Mistral 7B | ❌ | DeepSeek V4 Flash (più economico e più capace) |
| Phi-3 | ❌ Fase 1 | Rientra solo se fai client locale |
| StarCoder2 | ❌ | DeepSeek V4 Pro (superiore su tutti i benchmark) |
| Code Llama | ❌ | DeepSeek V4 Pro |
| DeepSeek-Coder-V2 (dai documenti) | ✅ Aggiornato | Ora è DeepSeek V4 Flash/Pro (successore) |

---

# ═══════════════════════════════════════════
# PARTE III — ART, AUDIO, 3D, VFX
# ═══════════════════════════════════════════

## 4. PIPELINE ASSET COMPLETA

### 4.1 Arte 2D — Sprite, tileset, UI, background

| Servizio | Ruolo | Costo | Licenza output |
|---|---|---|---|
| **SDXL via Replicate** | Sprite, tileset, UI — con LoRA pixel-art/stylized | $0.002-0.008/img | Commerciale |
| **FLUX Pro via Replicate** | Concept art, sprite alta qualità, character design | $0.003-0.005/img | Commerciale |
| **ControlNet** | Coerenza visiva: sketch utente → asset che mantiene composizione | Incluso in SDXL | — |

Pipeline: brief → SDXL/FLUX genera asset → ControlNet mantiene coerenza con reference dell'utente → output nominato (player_idle_01.png, tile_forest_ground.png) → inserito nel progetto engine.

### 4.2 Arte 3D — Modelli, texture, rigging, animazione

| Servizio | Ruolo | Costo | Ideale per |
|---|---|---|---|
| **Meshy.ai API** | Pipeline completa: text/image → 3D → texture PBR → auto-rig → animazione (500+ preset) | Da $20/mese | Personaggi, props, game-ready |
| **Tripo AI v3.0 API** | Stili creativi (voxel, LEGO, cartoon), auto-rigging | Da $12/mese | Asset stilizzati, game dev budget |
| **TripoSR via Replicate** | Velocissimo, image-to-3D low-poly | $0.07/modello | Prototipi rapidi, props semplici |
| **Blender headless** | Retopology, UV unwrap, auto-rigging via Rigify (script LLM) | Gratis (GPL, output liberi) | Post-processing mesh AI |

Il router 3D sceglie: props semplici → TripoSR ($0.07) / personaggi con rig → Meshy ($0.10-0.20) / stile voxel-cartoon → Tripo / hero assets → Rodin (Fase 2, premium).

### 4.3 Audio — Musica, SFX, Voci

| Servizio | Ruolo | Costo |
|---|---|---|
| **Suno API** | BGM: colonna sonora per genere, BPM, mood, durata, loop | ~$0.05-0.10/traccia |
| **ElevenLabs SFX** | Effetti sonori: impatto, passo, UI, ambiente | ~$0.01-0.05/SFX |
| **ElevenLabs TTS** | Voci NPC multilingua con emozioni | ~$0.02-0.10/linea |
| **Kokoro TTS** (Fase 2) | Voci self-hosted Apache 2.0, 82M params, leggero | Gratis (self-host) |
| **Piper TTS** (Fase 2) | Fallback ultra-leggero MIT | Gratis |

### 4.4 VFX e Shader

Il LLM genera direttamente: shader Godot Shader Language/GLSL, configurazioni GPUParticles2D/3D, profili Environment per post-processing. Nessun servizio esterno necessario — il codice shader è testo che l'LLM produce e il MCP Godot applica.

### 4.5 Animazione 2D

Tre approcci combinati: frame-by-frame (SDXL genera ogni frame della sprite sheet), Skeletal 2D (LLM genera Skeleton2D + bone + AnimationPlayer per Godot), Tween procedurale (LLM genera script Tween per juice: squash&stretch, flash, screen shake).

---

# ═══════════════════════════════════════════
# PARTE IV — LEVEL DESIGN, NARRATIVA, QA
# ═══════════════════════════════════════════

## 5. CREAZIONE MONDI E LIVELLI

### 5.1 Pipeline livelli 2D

```
Brief ("dungeon cristallino con 3 stanze, boss alla fine")
  → LLM genera layout astratto (griglia JSON con annotazioni semantiche)
  → WFC (DeBroglie MIT) o Random Walker traduce in tilemap concreta
  → LLM posiziona entità (nemici, chest, NPC, trigger, checkpoint)
  → Validator verifica percorribilità (A* pathfinding sulla griglia)
  → Assembler traduce in .tscn (Godot) / JS (Phaser) / .collection (Defold)
```

Tool PCG dal Unified Report: GDQuest PCG Demos (MIT, template walker/BSP/cellular automata), Gaea (MIT, framework procedurale a nodi per Godot), DeBroglie (MIT, WFC in C# per dungeon/città). Tiled (BSD, editor tilemap standard — mancava nei documenti originali).

### 5.2 Pipeline livelli 3D (Fase 2)

Heightmap via noise → Meshy/Tripo genera props 3D → LLM posiziona entità → scena Godot 3D con MeshInstance, CollisionShape, NavigationRegion.

### 5.3 World graph / Lore

JSON nested in Supabase (JSONB nel campo `game_graph` della tabella `projects`): entità (luoghi, NPC, fazioni, oggetti) con relazioni esplicite. L'LLM consulta questo grafo prima di generare dialoghi, quest o descrizioni → coerenza narrativa garantita.

## 6. NARRATIVA E DIALOGHI

**ink (inkle, MIT)** è il nostro linguaggio narrativo unico. L'LLM genera script .ink con variabili, condizioni, branching, stati. La compilazione produce JSON importabile in tutti gli engine (Godot, Unity, Phaser, Defold via plugin). Yarn Spinner (MIT, dai documenti) scartato per non avere due sistemi paralleli.

**Generative Agents** (pattern Smallville): per giochi con NPC complessi, ogni NPC ha memoria episodica + sociale + di ruolo in Supabase. L'LLM aggiorna obiettivi periodicamente. Runtime: Hermes 3 8B locale via Ollama (gratuito) per dialoghi NPC generativi nel gioco stesso.

## 7. QA E BUG FIXING

### 7.1 Pipeline QA a 6 livelli

| Livello | Verifica | Come | Quando |
|---|---|---|---|
| 1. Compilazione | Codice parsa senza errori | GDScript parser / ESLint / Python AST | Dopo ogni code_gen |
| 2. Riferimenti | Ogni risorsa citata esiste nel progetto | Script scansiona load()/preload() | Dopo assembly |
| 3. Collisioni | Entità ha CollisionShape coerente | Analisi .tscn | Dopo assembly |
| 4. Percorribilità | Livello completabile, no soft-lock | A* pathfinding sulla tilemap | Dopo level design |
| 5. Bilanciamento | HP/DMG/tempi ragionevoli | LLM analizza con rubriche dal Governance Blueprint | Dopo tutti i task |
| 6. Smoke test | Gioco si avvia senza crash per 10s | Godot headless con autoplay | Dopo export |

### 7.2 Debug loop ricorsivo (Recursive Tool Use)

Smoke test fallisce → log catturato → LLM riceve log + codice → produce patch (diff) → patch applicata → retry. Max 3 tentativi. Se fallisce, segnala all'utente con spiegazione chiara.

### 7.3 Property-based testing (Hypothesis, MIT)

L'LLM genera proprietà di gioco ("il danno non è mai negativo", "gli XP non decrescono", "l'inventario non supera il limite"). Hypothesis genera input randomizzati e cerca violazioni. Leggero, zero infra, e cattura bug logici impossibili da trovare con test manuali.

---

# ═══════════════════════════════════════════
# PARTE V — IL GAME STUDIO
# ═══════════════════════════════════════════

## 8. GAME STUDIO — Il workspace unificato per la creazione di videogiochi

Il Game Studio è il cuore della piattaforma: un workspace unico dove l'utente crea, itera, testa e pubblica il suo gioco senza mai uscire dall'applicazione. Combina generazione codice, generazione asset, level design interattivo, narrativa, audio, e un AI Game Director — tutto in un'unica interfaccia.

### 8.1 Game Elements Library

L'utente crea **elementi riutilizzabili** tra livelli e progetti:
- Personaggi con sprite sheet complete (tutte le animazioni)
- Tileset per biomi/zone
- Oggetti (armi, pozioni, chiavi)
- NPC con personalità e dialoghi base
- Pattern nemici (patrol, chase, boss pattern)

Ogni elemento ha un @tag. L'utente scrive "inserisci @warrior nel livello 3" e il sistema sa esattamente quale sprite, quali animazioni, quali parametri usare.

### 8.2 AI Game Director

L'utente descrive un livello/situazione in linguaggio naturale → il Game Director lo scompone automaticamente in: layout, nemici, oggetti, trigger, musica, illuminazione. L'utente non deve sapere cos'è un TileMap o un CollisionShape — descrive e il sistema costruisce.

### 8.3 Genre System

Il genere scelto influenza automaticamente: meccaniche di movimento, sistema di combattimento, curva di difficoltà, stile UI, tipo di camera, pacing della progressione. Un "Horror" ha movimento lento, risorse scarse, audio teso. Un "Arcade" ha movement veloce, scoring, musica energetica.

### 8.4 Engine Presets

La piattaforma offre centinaia di combinazioni preset per ogni genere × engine: top-down Godot, side-scroller Phaser, isometric MonoGame, first-person Stride, VN layout Ren'Py, card game LÖVE, 3D browser Three.js. Ogni preset include: camera setup, input mapping, physics config, rendering profile.

### 8.5 Multi-modal Input Hub

L'utente carica qualsiasi materiale:
- **Storyboard/concept art** → Claude Vision analizza stile, palette, personaggi → parametri per tutti i tool
- **Musica propria** → analisi BPM/key/mood → integrata nel punto giusto
- **Sceneggiatura** → parsing entità, scene, dialoghi → GDD automatico
- **Reference da altri giochi** → "combattimento Hollow Knight + estetica Hyper Light Drifter" → traduzione in meccaniche e stile

### 8.6 Playtest integrato (dal Continuous Iteration Blueprint)

Per Phaser: iframe nella webapp → giocabile istantaneamente. Per Godot: web export servito staticamente. L'utente testa nel browser senza installare nulla. Telemetria in-game: death, clear time, percorso, click confusi.

### 8.7 Micro-edit nel browser (dal Continuous Iteration Blueprint)

Dopo la generazione, l'utente non deve rigenerare tutto:
- Click su un NPC → "rendilo più aggressivo" → LLM modifica solo quel behaviour tree
- Click su uno sprite → "palette più fredda" → rigenera solo quello sprite
- "Abbassa la difficoltà del boss del livello 3" → LLM aggiusta solo HP/DMG/pattern

### 8.8 Varianti creative (dal Governance Blueprint)

Per ogni asset critico, il sistema genera 3-4 varianti. L'utente sceglie la migliore. La scelta alimenta l'Episodic Memory → il sistema impara le preferenze estetiche dell'utente.

### 8.9 Game Plan View (dal Game Reasoning Engine Blueprint)

Una sezione dell'interfaccia dove l'utente vede il Game Plan come visualizzazione interattiva: grafico dei livelli (nodi e connessioni), curva di difficoltà (grafico con slider), mood per zona (palette + icone), regole di bilanciamento (slider min/max). L'utente può modificare il piano a livello concettuale prima che venga materializzato in codice. Comandi di alto livello: "rendi l'area 2 più tesa ma non punitiva", "sposta il climax in zona 3", "rendi il loop economico più generoso" — il Reasoning Engine traduce in modifiche concrete.

### 8.10 Explainability (dal Game Reasoning Engine Blueprint)

Il sistema spiega le sue scelte: "Ho ridotto gli HP del boss 2 del 20% perché il tasso di abbandono era alto dopo 3 tentativi", "Ho scelto Godot perché il tuo genere (metroidvania) ha il supporto migliore su questo engine". Trasparenza totale = fiducia dell'utente.

---

# ═══════════════════════════════════════════
# PARTE VI — GOVERNANCE, COLLABORATION, INFRA
# ═══════════════════════════════════════════

## 9. GOVERNANCE (dal Governance Blueprint)

### 9.1 Fase 1 (essenziale)

| Principio | Implementazione |
|---|---|
| Asset metadata | Campo JSON per ogni asset: owner, origine, licenza, can_train |
| Model catalog | File `models.yaml`: ID, versione, endpoint, costo, stato (active/canary/deprecated) |
| Content moderation | Guardrail nel system prompt LLM + filtro regex su prompt utente |
| HITL | Hermes Agent supporta nativamente pause per review umano |
| Audit log | Ogni tool call logga: timestamp, modello, prompt hash, output hash, costo |
| IP protection | Vietato upload asset che violano IP terzi, flag DMCA-style |

### 9.2 Fase 2+ (scaling)

Ruoli e permessi (Studio Owner, Game Director, Artist, QA Lead), commenti inline su asset, merge creativo di varianti, timeline progetto con changelog AI, moderazione configurabile per workspace (all ages vs 18+).

## 10. PUBLISHING E DISTRIBUZIONE

| Canale | Come | Fase |
|---|---|---|
| **Web (browser)** | Phaser/Godot web export, URL condivisibile | ✅ Fase 1 |
| **itch.io** | Upload automatizzato via butler CLI | ✅ Fase 1 |
| **Steam** | SteamCMD + VDF scripted (utente paga $100 Steam Direct) | ✅ Fase 2 |
| **Mobile (iOS/Android)** | Defold/Godot export + store submission guidata | ⚠️ Fase 2 |
| **Desktop standalone** | Godot/MonoGame export .exe/.app/.AppImage | ✅ Fase 1 |

Plus: store page generata dall'AI (descrizione, tag, screenshot), devlog/patch notes automatici, social media content.

## 11. INFRASTRUTTURA E COSTI

### 11.1 Stack serverless (zero VPS, zero Docker, zero Redis)

| Servizio | Ruolo | Costo Day-1 |
|---|---|---|
| **Clerk** | Auth (login, OAuth, JWT, session, MFA, componenti React) | $0 (10K MAU free) |
| **Supabase** | Database Postgres + Realtime WebSocket + pgvector + RLS | $0 (500MB DB, 1GB storage free) |
| **Trigger.dev** | Job queue asincroni per generazione AI (no timeout, retry, dashboard) | $0 ($5 credito free) |
| **Cloudflare R2** | File storage per progetti .zip e asset (zero costi di egress/download) | $0 (10GB + 10M req free) |
| **E2B** | Code sandbox sicuro (Firecracker microVM) per compilare/testare giochi | $0 ($100 credito free) |
| **OpenRouter** | LLM routing unificato: 1 API key per 300+ modelli (Claude, DeepSeek, Kimi, ecc.) | ~$10-30 (pay-per-token) |
| **Helicone** | LLM observability: costi per utente/progetto/tool, latenza, cache | $0 (100K req/mese free) |
| **PostHog** | Analytics + feature flags + error tracking + session replay + A/B testing + survey | $0 (1M eventi/mese free) |
| **Vercel** | Frontend hosting Next.js, CDN globale, deploy automatico da GitHub | $0 (100GB bandwidth free) |
| **Upstash Redis** | Rate limiting per utente, caching risposte LLM | $0 (10K cmd/giorno free) |
| **Resend** | Email transazionali (benvenuto, "gioco pronto", receipt) | $0 (100/giorno free) |
| **Loops** | Email marketing (drip campaign onboarding: giorno 1, 3, 7) | $0 (1K contatti free) |
| **Knock** | Notifiche in-app + email + push | $0 (10K messaggi/mese free) |
| **Crisp** | Live chat e supporto con chatbot AI | $0 (2 seat free) |
| **Dub.co** | Link analytics per giochi condivisi | $0 (1K link/mese free) |
| **Stripe** (v2) | Pagamenti subscription | $0 (pay-per-transaction) |
| **Meilisearch Cloud** (v2) | Ricerca typo-tolerant per marketplace asset/template | $0 (100K documenti free) |
| **Polar.sh** (v2) | Monetizzazione creator nel marketplace | $0 (commissione sulle vendite) |
| **TOTALE** | **18 servizi** | **~$10-30/mese** (solo API token LLM) |

Nessun VPS. Nessun Docker. Nessun Redis da gestire. Nessun worker da monitorare. Tutto serverless, pay-as-you-go, con free tier che copre l'intero MVP.

### 11.2 Costi API generazione (modelli AI)

| API | Budget stimato/mese | Note |
|---|---|---|
| OpenRouter (DeepSeek + Claude + Kimi) | $10-30 | Routing automatico al modello più economico per task |
| Replicate (SDXL/FLUX/TripoSR) | $10-30 | Migliaia di immagini + modelli 3D |
| Suno | $10 | Piano base |
| ElevenLabs | $0-5 | Free tier + startup program |
| Meshy/Tripo | $12-20 | Piano base per 3D |
| **TOTALE API AI** | **~$42-95/mese** | |

### 11.3 Crediti gratuiti per startup

| Programma | Crediti | Come ottenerli |
|---|---|---|
| Anthropic Anthology Fund | $25,000 | Applicazione diretta, no VC referral |
| AWS Activate | fino a $300,000 | Applicazione per startup AI |
| Google Cloud Startup | fino a $350,000 | Applicazione per startup AI |
| ElevenLabs Startup | 12 mesi gratis piano Scale | Applicazione startup |
| DeepSeek | 5M token gratis | Ogni nuovo account |
| **Totale potenziale** | **$475,000+** | 2+ anni di runway a costo zero |

---

# ═══════════════════════════════════════════
# PARTE VI-BIS — STRATEGIA UI/UX: INTERFACCIA A STRATI PROGRESSIVI
# ═══════════════════════════════════════════

## 11-BIS. TRE MODALITÀ, UN SOLO BACKEND

La piattaforma offre tre strati di interfaccia che l'utente può alternare liberamente. Dietro le quinte, il backend è identico (Hermes Agent esegue tool calls). La differenza è solo come il frontend li presenta.

### Strato 1 — Creator Mode (per tutti, al lancio)

L'utente vede: campo di testo per descrivere il gioco, preset rapidi per genere, engine picker con raccomandazione AI, bottone "Genera", progress bar con task in esecuzione, output giocabile + download. Nessun nodo, nessun grafo, nessuna complessità. È il modo in cui il 90% degli utenti entra nella piattaforma.

### Strato 2 — Studio Mode (canvas a nodi, Fase 2)

Dopo la prima generazione, l'utente clicca "Apri in Studio" e vede il grafo dei nodi che il sistema ha costruito automaticamente. Ogni task diventa un nodo visibile e modificabile: può cambiare un singolo sprite senza rigenerare tutto, aggiungere nodi (shader, particelle), creare branch paralleli per confrontare varianti, riordinare il flusso, salvare il pipeline come template riutilizzabile.

Implementazione: React Flow (MIT), la stessa libreria usata da n8n, Langflow, e decine di workflow builder. Il JSON di tool calls di Hermes Agent viene visualizzato come grafo interattivo.

### Strato 3 — Code Mode (per sviluppatori, Fase 2)

Click su qualsiasi nodo → vede il codice generato (GDScript, JS, Python, C#, Lua). Editor integrato con diff viewer e AI-assist per modifiche mirate. Export del progetto raw per lavorarci nel proprio IDE/engine.

### Perché tre strati

Il Creator Mode cattura il pubblico più ampio (democratizzazione). Lo Studio Mode trattiene i power user (retention). Il Code Mode serve i dev professionisti (monetizzazione premium). I competitor prompt-only perdono i power user. I competitor canvas-only perdono i principianti. Noi prendiamo tutti.

### Dettaglio Creator Mode — UX al lancio

L'interfaccia di lancio è lineare, conversazionale, senza attriti. Il flusso esatto:

1. **Welcome screen** — campo di testo ampio con placeholder "Descrivi il gioco che vuoi creare..." + chip preset per genere (Metroidvania, Visual Novel, Mobile Casual, ecc.)
2. **Engine picker** — dopo l'analisi del brief, il sistema mostra le card degli engine con badge "Consigliato" su quello ideale. L'utente sceglie o accetta la raccomandazione.
3. **Piano di generazione** — lista dei task con icone per dipartimento (codice, arte, audio), modello AI assegnato, costo stimato, tempo stimato. Trasparenza totale.
4. **Generazione live** — progress bar globale + stato di ogni task (in coda → in corso → completato). L'utente vede il suo gioco prendere forma in tempo reale.
5. **Output** — gioco giocabile nel browser (per Phaser/Godot web) + bottone download .zip + bottone "Apri in Studio" per passare al canvas.

### Dettaglio Studio Mode — Canvas a nodi

Implementato con **React Flow** (MIT). Ogni nodo del canvas corrisponde a un tool call di Hermes Agent. L'utente può:

- **Riaprire qualsiasi nodo** → vedere l'input/output, modificare il prompt, rigenerare solo quel pezzo
- **Aggiungere nodi** dal catalogo dei 40 tool → trascinare "shader_gen" o "voice_gen" nel grafo
- **Creare branch** → duplicare un nodo per testare due varianti in parallelo (es. due stili di sprite)
- **Collegare nodi** → l'output di un nodo diventa input di un altro (es. style_analyzer → sprite_gen per coerenza)
- **Salvare pipeline come template** → riutilizzabile per progetti futuri o condivisibile nel marketplace
- **Esportare il pipeline** come JSON → riproducibile via API o CLI

Il canvas non è un'aggiunta cosmetica: è il modo in cui i power user controllano il processo creativo senza scrivere codice, e il modo in cui i template diventano prodotti vendibili nel marketplace.

---

# ═══════════════════════════════════════════
# PARTE VI-TER — FRONTEND, BRAND IDENTITY, TOOLING
# ═══════════════════════════════════════════

## 11-TER. COSTRUZIONE DEL FRONTEND — Workflow di cloning e fusione

### Il principio

Non si parte da zero. Si parte dai migliori siti esistenti, si estraggono i pezzi che funzionano, si fondono in qualcosa di unico. È lo stesso principio che applichiamo ai videogiochi: orchestrare il meglio che esiste.

### La skill Claude Code per clonare siti

**AI Website Cloner** (GitHub: JCodesMore/ai-website-cloner-template, MIT, 13.000+ stelle in 6 settimane) è una skill per Claude Code che clona qualsiasi sito con un singolo comando.

Installazione:

```bash
git clone https://github.com/JCodesMore/ai-website-cloner-template.git my-clone
cd my-clone && npm install
claude --chrome
# nel terminale Claude Code:
/clone-website https://sito-che-ti-piace.com
```

Il pipeline interno della skill:

1. **Reconnaissance** — Claude apre il sito in Chrome via MCP, cattura screenshot a 3 risoluzioni (mobile 375px, tablet 768px, desktop 1440px), estrae design token (palette in oklch, scala tipografica, sistema di spacing, border radii), simula interazioni reali (scroll, hover, click, menu mobile).
2. **Foundation** — scarica font, immagini, video. Configura Tailwind con i token estratti.
3. **Component Specs** — scrive specifiche dettagliate per ogni sezione con valori CSS esatti da `getComputedStyle()`, non da screenshot.
4. **Parallel Build** — lancia builder agent in git worktree isolati, uno per sezione/componente.
5. **Assembly & QA** — merge dei worktree, visual diff automatico contro l'originale, correzione discrepanze.

Output: progetto **Next.js 16 + Tailwind CSS v4 + shadcn/ui** completo e funzionante.

### Alternative e complementi

| Skill/Tool | Approccio | Quando usarlo |
|---|---|---|
| **ai-website-cloner-template** (JCodesMore) | Chrome MCP + CSS extraction + parallel build | Siti standard, landing page, dashboard |
| **Perfect-Web-Clone** (ericshang98) | DOM diretto + CSS strutturato, 40+ tool specializzati | Pagine molto pesanti (50K+ linee DOM) dove il cloner base va in overflow |
| **clone-website skill** (mcpmarket) | Firecrawl MCP, clonazione parziale | Quando vuoi solo una sezione specifica (hero, pricing, footer) |
| **claude-zyte-screenshots** | Screenshot con anti-bot protection | Siti protetti da Cloudflare o captcha |

### Il workflow concreto per il nostro frontend

**Step 1 — Selezione siti di ispirazione** (5 siti, 1 aspetto da ciascuno)

| Sito | Cosa prendiamo | Perché |
|---|---|---|
| **linear.app** | Layout generale, dark mode, tipografia | Pulizia estrema, sensazione premium |
| **vercel.com/v0** | Il model picker / component selector | UX di selezione tra opzioni AI |
| **runway.ml** | Dashboard di generazione con progress | Feedback visivo durante la generazione |
| **comfyui.org** o **n8n.io** | Il canvas a nodi | Riferimento per lo Studio Mode |
| **itch.io** | Il layout dei giochi / marketplace | Riferimento per la community e le card dei giochi |

**Step 2 — Clonazione**

```bash
# Clona ciascun sito in cartelle separate
/clone-website https://linear.app        # → ./linear-clone
/clone-website https://v0.dev            # → ./v0-clone
/clone-website https://runwayml.com      # → ./runway-clone
```

**Step 3 — Fusione con Claude Code**

Prompt a Claude Code:
```
Ho 5 siti clonati nelle cartelle linear-clone, v0-clone, runway-clone, 
comfyui-clone, itch-clone. Crea il frontend di "Game Studio AI":
- Layout generale e dark mode da linear-clone
- Il component picker (engine selector) da v0-clone  
- La dashboard di generazione con progress da runway-clone
- La struttura del canvas a nodi da comfyui-clone (per Studio Mode)
- Il layout marketplace/card giochi da itch-clone
Fusiona tutto in un unico progetto Next.js con la nostra palette e 
il nostro branding. Il risultato deve essere coerente, non un 
Frankenstein.
```

**Step 4 — Personalizzazione**

Cambia palette colori, tipografia, logo, copy, micro-animazioni, icone fino a che il frontend è 100% originale. Il cloning è il punto di partenza, non il punto di arrivo.

---

## 11-QUATER. BRAND IDENTITY — Nome, logo, posizionamento

### Il processo di naming

**Tool consigliati:**

| Tool | Cosa fa | Costo |
|---|---|---|
| **Namelix** (namelix.com) | Genera nomi brevi e brandabili con AI, cerca domini disponibili, genera logo di base | Gratuito |
| **Jenova Name Generator** | Naming consultant AI con memoria persistente: ricorda le tue preferenze tra sessioni, screening trademark, integrato con Logo Generator e IP Researcher | Free tier |
| **Namify** | Nome + dominio su estensioni nuove + logo + check trademark | Gratuito |
| **Claude stesso** | Brainstorming strategico: gli dai brief, mercato, competitor, tono → genera 50+ nomi con razionale | Già lo usi |

**Criteri per il nome:**

1. Pronunciabile in almeno 3 lingue (EN, IT, ES/FR)
2. Dominio .ai o .dev disponibile (o .gg per gaming)
3. Nessun conflitto trademark nel settore software/gaming
4. Evocativo di: creazione, gioco, semplicità, potere creativo
5. Massimo 3 sillabe — più corto = più memorabile
6. Handle social disponibile (Twitter/X, Discord, GitHub)

### Logo e identità visiva

| Fase | Tool | Cosa fare |
|---|---|---|
| MVP/lancio | **Looka** ($20 una tantum) | Logo + brand kit completo: colori, font, varianti, business card, social templates. Sufficiente per lanciare. |
| Post-traction | Designer umano | Il logo è l'asset visivo più importante. Dopo il seed/primi ricavi, investi $500-2000 in un logo professionale unico. |
| Ongoing | **Canva AI** o **uBrand** | Materiale marketing, social media, pitch deck, tutti coerenti con il brand kit |

### Posizionamento — da definire PRIMA di tutto il resto

Prima del nome, prima del logo, prima del codice: rispondere a queste 5 domande.

1. **Per chi è?** → Creator senza esperienza tecnica che vogliono creare il loro primo gioco + dev indie che vogliono accelerare 10x il loro workflow
2. **Cosa fa?** → Trasforma un'idea in un videogioco completo e pubblicabile, usando AI per ogni fase dello sviluppo
3. **Cosa lo differenzia?** → Multi-engine (8+ engine), multi-modello (routing intelligente tra LLM), input multimodale (testo + immagini + musica + storyboard), iterazione continua nella webapp
4. **Quale emozione evoca?** → "Io posso farlo" — empowerment creativo, abbattimento delle barriere
5. **Come si posiziona nel mercato?** → Non è un "genera giochini web" (Rosebud). Non è un IDE (Unity/Godot). È lo studio di produzione AI dove chiunque è il direttore creativo.

---

## 11-QUINQUIES. CLAUDE CODE SKILLS DA INSTALLARE — Setup completo

### Skills essenziali per lo sviluppo del progetto

| Skill | Repository | Cosa fa | Quando |
|---|---|---|---|
| **AI Website Cloner** | github.com/JCodesMore/ai-website-cloner-template | Clona frontend da URL con Chrome MCP | Fase frontend |
| **Perfect Web Clone** | github.com/ericshang98/Perfect-Web-Clone | Clone DOM-based per pagine pesanti | Backup per siti complessi |
| **clone-website (Firecrawl)** | mcpmarket.com/tools/skills/website-clone-replicate | Clonazione parziale (sezioni specifiche) | Fase frontend |
| **claude-zyte-screenshots** | github.com/apscrapes/claude-zyte-screenshots | Screenshot su siti con anti-bot | Quando i siti bloccano |

### MCP Server essenziali

| MCP Server | Cosa fa | Quando |
|---|---|---|
| **Chrome MCP** | Controlla browser da Claude Code (DOM, screenshot, CSS, interazioni) | Sempre (cloning + testing) |
| **godot-ai (hi-godot)** | 100+ tool per controllare Godot da Claude Code | Fase engine Godot |
| **godot-mcp-server (matula)** | Bridge CLI Godot headless | Fase build/export |
| **monogame-mcp** | Scaffolding, docs, diagnostics per MonoGame | Fase engine MonoGame |
| **love2d-mcp** | Bridge bidirezionale LÖVE ↔ AI via TCP | Fase engine LÖVE |
| **threejs-devtools-mcp** | 59 tool per Three.js (oggetti, materiali, shader, animazioni) | Fase engine Three.js |
| **Firecrawl MCP** | Web scraping strutturato | Frontend + ingestion |
| **GitHub MCP** | Gestione repo, PR, issues da Claude Code | Sempre |

### Installazione completa — il setup day-one

```bash
# 1. Installa Claude Code (se non già fatto)
npm install -g @anthropic-ai/claude-code

# 2. Clona la skill website cloner
git clone https://github.com/JCodesMore/ai-website-cloner-template.git ~/skills/website-cloner

# 3. Configura .env.local
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
TRIGGER_SECRET_KEY=tr_...
OPENROUTER_API_KEY=sk-or-...
HELICONE_API_KEY=sk-hel-...
E2B_API_KEY=e2b_...
CLOUDFLARE_R2_ACCESS_KEY=...
REPLICATE_API_TOKEN=...
SUNO_API_KEY=...
ELEVENLABS_API_KEY=...

# 4. Build custom E2B template con Godot
e2b template build --name godot4-sandbox

# 5. Deploy
npx vercel

# Fatto. Nessun VPS. Nessun Docker. Nessun Redis.
# 18 servizi BaaS. Tu scrivi solo la logica AI.
```

---

# ═══════════════════════════════════════════
# PARTE VI-QUATER — GTM, VIRALITÀ, ASSET LIBRARY, PRICING
# ═══════════════════════════════════════════

## 11-SEXIES. GO-TO-MARKET: DA TOOL A MOVIMENTO CREATOR

### Tesi di GTM

Non lanciamo un "AI tool" — instauriamo un **movimento di creator** che rivendica il diritto di possedere i propri giochi, con output su engine seri. I competitor comunicano feature; noi comunichiamo risarcimento strutturale: "basta giochini usa-e-getta nel browser, i tuoi mondi meritano engine veri."

### Pre-lancio (T-3 mesi → T0)

**1. Manifesto pubblico** — Pubblica un manifesto "Game Dev non è ancora stato democratizzato" spiegando perché i tool attuali sono insufficienti (giochini web, modelli chiusi, mancanza di proprietà). Call to action: join the waitlist.

**2. Founding Worlds Program** — Seleziona 20-30 creator (pixel artist, scrittori, musicisti, modder) con accesso early. Obiettivo: lanciare 10-15 "Founding Games" visivamente forti come casi studio al day-1. Incentivo: lifetime plan scontato + badge "Founding World".

**3. Engine-specific challenges** — Mini-challenge: "Godot Metroidvania in 72h", "Ren'Py VN Jam", "Defold Mobile Puzzle Sprint". Ogni challenge produce template raffinati per la library di lancio.

**4. Contenuti OSINT/Research** — Spezza parti della Pietra Fondativa in micro-thread Twitter/LinkedIn/Reddit: "Perché 8 engine battono 1", "La memoria episodica che rende il tuo studio AI più intelligente ogni giorno". Mostra tesi di mercato chiara.

**5. Waitlist segmentata** — Form che chiede: ruolo (writer/artist/dev/musician), engine preferito, genere desiderato, frustrazione principale. Personalizza il primo touch al lancio.

### Lancio (T0 → T+30 giorni)

**1. Launch Event live** — Live stream Twitch/YouTube: genera 3 giochi completi da zero (Metroidvania Godot, Visual Novel Ren'Py, Mobile puzzle Defold) in meno di 60 minuti. CTA: "Provate a forkarli adesso".

**2. Template library al day-1** — Non un campo vuoto. Una griglia: "Horror VN Starter", "Roguelite Dungeon", "Cozy Farming", "Bullet Hell", "Card Battler". Ogni template collegato a engine + parametri pre-ottimizzati.

**3. Instant gratification** — Nessun account per il primo gioco. Scegli genere → scrivi 1 riga → premi Generate. Massima riduzione attrito.

**4. Export automatico itch.io** — Tool `itch_packager`: zip + store page + screenshot + OAuth 1-click publish.

### Crescita virale (T+30 giorni → T+24 mesi)

Motore: **ogni gioco generato porta nuovi utenti**.

**1. In-game badge**: splash screen "Made with [Brand]" (skippabile 2s) + link "Create your own game" nel menu.

**2. Public Gallery & Fork**: giochi pubblici in gallery con tag genere/engine/mood + "Play" (embed browser) + "Fork" (apre interfaccia con stesso brief/template).

**3. Affiliate & creator economy**: referral per YouTuber/Twitch streamer con revenue share su piani Pro.

**4. Content flywheel mensile**: spotlight 3-5 giochi, dev stories, comparazioni "From notebook to Steam page: 7 days".

**5. Product-Led Growth**: upsell contestuali in-app: "Hai generato 2 livelli, vuoi che l'AI bilanci difficoltà? Try Studio Mode".

## 11-SEPTIES. VIRAL LOOPS

### Loop primario: Playable → Share → Fork

1. Utente genera un gioco
2. Gioca nel browser o scarica
3. Condivide link itch.io / pagina interna
4. Amici vedono badge "Made with [Brand]" + bottone "Fork this game"
5. Nuovi utenti entrano con template già settato

### Loop secondario: Template Jam & Remix Battle

**Template Jam**: mensile, un tema (es. "Horror School", "Solar Roguelite"). La community costruisce giochi dallo stesso template. Produce: nuovi template, contenuti social, storie di creator.

**Remix Battle**: prendi un gioco pubblico di successo, lancia challenge "Migliora in 48h". Vincitore in home, altri in highlight.

### Community hub

Discord/Forum con canali per engine, ruoli (writer, artist, composer), livelli esperienza. Channel "Template Requests" dove votare prossimi template/feature → alimenta roadmap. Programma "World Architects": power user che curano template e best practice per generi specifici.

### Education & partnership

Mini-course con creator YouTube ("From story to VN in a weekend"). Partnership con scuole di game design per prototipazione rapida. Micro-grant ($500-2000) per progetti che raggiungono milestone (Steam release, 100K download).

## 11-OCTIES. ASSET LIBRARY — Milioni di asset pronti all'uso

### Strategia: AI generation + librerie CC0 come default

Non solo generazione AI — integriamo librerie massive di asset CC0 come **base, non opzionale**. Messaggio marketing: "Millions of ready-to-use assets + AI generation. No more blank canvas."

### Librerie integrate

**Arte 2D / Sprite / Tile / UI**

| Risorsa | Quantità | Licenza |
|---|---|---|
| **Kenney.nl** | 40.000+ asset 2D/3D/UI/audio | CC0, nessuna attribuzione |
| **OpenGameArt.org** | Migliaia di sprite, tileset, UI, kit | CC0/CC-BY (filtro per licenza) |
| **itch.io free assets** | Migliaia di pack pixel art, UI, tiles | Miste, molti CC0 |
| **CraftPix Freebies** | Pack professionali per genere | Free con uso commerciale |
| **GameAssets.com** | 60.000+ asset CC0 | CC0 dichiarata |

**3D models / textures**

| Risorsa | Tipo | Licenza |
|---|---|---|
| **Quaternius** | Modelli low-poly (character, environment, weapons), spesso riggati | CC0 |
| **KayKit** (Kay Lousberg) | 1.500+ modelli low-poly stilizzati: Adventurers, Dungeon, Forest, Platformer, Space. FBX/GLTF/OBJ, compatibili con Godot/Unity/UE/Three.js/Roblox. | CC0 |
| **Poly Haven** | Modelli 3D, HDRI, texture PBR | CC0 |
| **Cinevva Asset Search** | Meta-motore che indicizza più librerie CC0 | Strumento ricerca |

**Audio (BGM, SFX)**

| Risorsa | Tipo | Licenza |
|---|---|---|
| **Freesound.org** | SFX, ambienti, foley | CC0/CC-BY |
| **OpenGameArt Audio** | BGM per generi, SFX | CC0/CC-BY |
| **Kenney Audio** | SFX coerenti con asset Kenney | CC0 |

### Implementazione: Asset Library Layer

1. **Pre-download e indicizzazione**: scaricare pack CC0, normalizzare metadati (tipo, stile, colore, categoria, engine compatibility)
2. **Tool `asset_library_search`**: input descrizione semantica → output lista asset matching con thumbnail e drag-and-drop
3. **Fallback automatico**: se la generazione AI produce qualità bassa, il sistema propone asset dalla libreria
4. **Template ibridi**: template che partono con asset umani (Kenney) + AI per completare il resto

### Asset Selector (pre e post generazione)

**Pre-generazione**: dopo che il Game Plan è generato, il sistema cerca nella library asset CC0 compatibili (per stile, risoluzione, genere) e li propone: "Vuoi usare questi come base? L'AI completerà il resto." L'utente sceglie: CC0 base (veloce, coerente), AI genera tutto (più unico), o mix.

**Post-generazione**: nello Studio Mode, l'Asset Browser con ricerca Meilisearch (typo-tolerant), filtri per stile/risoluzione/colore/licenza, preview thumbnail, e "Add to project". Drag-and-drop nell'editor di livelli.

### Gap tecnici risolti (dai documenti supplementari)

| Gap | Soluzione | Fase |
|---|---|---|
| CORS per Godot web in iframe | Inject `coi-serviceworker.min.js` (MIT, 6KB) nell'HTML esportato | Day-1 |
| Sistema @tag Elements | Tabella `elements` in Supabase + pre-processore che inietta dati nel prompt LLM + UI autocompletamento | Day-1 |
| WFC tilemap in TypeScript (DeBroglie è C#) | Day-1: LLM genera tilemap direttamente. v2: `wfc-ts` npm package | Day-1/v2 |
| Custom E2B template con Godot | Dockerfile con Godot headless + export templates + coi-serviceworker. `e2b template build` | Day-1 |
| Micro-edit click-on-element (iframe ↔ parent) | `window.parent.postMessage()` da snippet iniettato nel gioco + listener nella webapp | v2 |
| Parsing sceneggiatura utente | `pdf-parse` / `mammoth` (npm) per estrazione testo + Claude per analisi strutturale | Day-1 |
| inkjs compiler | `inkjs` npm, gira direttamente in TypeScript, nessuna sandbox | Day-1 |
| Blender headless per 3D rig | Day-1: solo Meshy API. v3: custom E2B template con Blender | Day-1/v3 |
| Desktop export (.exe/.app) | Export templates inclusi nel custom E2B template Godot | Day-1 |
| Steam deploy | v2: genera file VDF + utente carica manualmente. v3: SteamCMD in E2B | v2/v3 |

## 11-NONIES. PRICING STRUCTURE

| Piano | Prezzo | Cosa include | Badge in-game |
|---|---|---|---|
| **Free** | $0 | N giochi/mese, engine Phaser/Ren'Py/LÖVE, asset library CC0, badge obbligatorio | "Made with [Brand]" |
| **Creator** | $19/mese | Tutti gli engine (Godot, Defold, MonoGame, Three.js, Stride), progetti illimitati, rimozione badge | Opzionale |
| **Pro** | $49/mese | Tutto Creator + asset AI premium, priority queue, export itch.io 1-click, Game Jam Mode, AI Coach | Nessuno |
| **Studio** | $99/mese | Tutto Pro + multi-utente/seat, integrazione Git, pipeline CI, Steam deploy, NPC generativi | Nessuno |

Leve di profitto: crediti inutilizzati = margine puro, prompt caching 90% sconto su input ripetuto, routing intelligente (60% task a DeepSeek $0.14/MTok), batch API 50% sconto per generazioni non urgenti.

## 11-DECIES. NAMING — 10 proposte con framework

### Framework semantico

Categorie concettuali: campo/field (orchestrazione), studio/factory (produzione), loop/orbit (iterazione), world/verse (creazione mondi), forge/weaver (costruzione).

### Le 10 proposte

| # | Nome | Significato | Brand angle | Mood |
|---|---|---|---|---|
| 1 | **GameField** | Il campo dove le idee acquistano massa | "The field where your ideas become games" | Particelle, nodi, onda |
| 2 | **OrbitPlay** | Asset ed engine orbitano intorno al tuo gioco | "Everything in orbit around your game" | Cerchi concentrici, orbite |
| 3 | **LoopForge** | Forgia gameplay loop + loop di iterazione | "Forge game loops and iterate endlessly" | Forgia neon, scintille |
| 4 | **Worldweaver** | Tessitore di mondi, perfetto per narratori | "Weave worlds from imagination" | Fili che collegano luoghi |
| 5 | **StudioLoop** | Studio virtuale basato su loop gen-test-ship | "Your AI studio, on loop" | DAW audio applicata a livelli |
| 6 | **PlayLattice** | Reticolo su cui si agganciano asset e sistemi | "The lattice that holds your game together" | Griglie, grafi, nodi |
| 7 | **GameOrbit** | Tutti i sistemi ruotano attorno al gioco | "Everything in orbit around your game" | Cerchio centrale, orbite |
| 8 | **ForgeQuest** | Forgiare quest e il tuo viaggio come dev | "Forge your quest" | Fantasy-tech, caldo + neon |
| 9 | **MassGame** | L'AI dà massa/sostanza alle idee | "Give your game ideas mass" | Design industriale, contrasti forti |
| 10 | **PlayFoundry** | Fonderia dove le idee diventano giochi | "Where ideas are forged into games" | Metallo fuso, calore creativo |

### UX Moodboard

**Palette**: dark mode base (slate/graphite) con accenti per dipartimento: code = teal, art = magenta, audio = violet, world = emerald, QA = amber.

**Tipografia**: sans geometrico (Inter, Space Grotesk, Satoshi) + monospace per codice (JetBrains Mono, Fira Code).

**Metafora visiva**: "Studio" — sidebar con dipartimenti (Code, Art, Audio, Levels, QA). Elementi come nodi orbitanti intorno al progetto centrale.

**Microcopy**: CTA = "Describe your game", "Generate first level", "Make it harder", "Ship to itch.io". Sostituire "project" con "game" ovunque.

---

# ═══════════════════════════════════════════
# PARTE VII — ROADMAP E MODULO ZERO
# ═══════════════════════════════════════════

## 12. ROADMAP

### Mese 1-2: "Il primo gioco generato"
- Setup: `npx create-next-app`, `npm install @clerk/nextjs @supabase/supabase-js @trigger.dev/sdk openai @e2b/code-interpreter`
- Configura .env con API key: Clerk, Supabase, Trigger.dev, OpenRouter, Helicone, E2B, R2
- Crea custom E2B template con Godot 4 headless + export templates + coi-serviceworker
- Registra i primi 15 tool (code_gen per Godot + Phaser, sprite_gen, bgm_gen, assembler)
- Implementa GameOrchestrator (pattern Hermes in TypeScript) dentro Trigger.dev
- Endpoint: POST brief → Trigger.dev job → Game Plan → tool calls → progetto .zip su R2
- Deploy su Vercel
- Demo pubblica su Twitter/X e Reddit

### Mese 3-4: "Il Game Studio"
- Frontend React con brief input → engine picker → progress → download
- Integra tutti i 40 tool
- Multi-engine (Godot + Phaser + Ren'Py + Defold)
- Upload materiale utente (concept art, musica, storyboard)
- Playtest nel browser

### Mese 5-6: "La piattaforma"
- Accounts, progetti salvati, template per genere
- Micro-edit nel browser
- 3D pipeline (Meshy/Tripo)
- Applicazione ai programmi startup per crediti

### Mese 7-9: "Il marketplace"
- Community: template, asset pack, meccaniche condivise
- Iterazione continua: branch, patch notes AI, content drops
- Steam/itch.io publishing integrato

### Mese 10-12: "L'esplosione"
- MonoGame + LÖVE + Three.js + Stride
- Unity partnership ISV
- UE5 sperimentale
- Serie A se la traction c'è

## 13. MODULO ZERO — Il primo prompt a Claude Code

```
Crea un progetto Next.js 16 con TypeScript e Tailwind.

Installa: @clerk/nextjs, @supabase/supabase-js, @trigger.dev/sdk,
@trigger.dev/nextjs, openai, @e2b/code-interpreter, @aws-sdk/client-s3,
@upstash/redis, @upstash/ratelimit, posthog-js, resend.

Crea questa struttura:

app/
├── layout.tsx              (ClerkProvider + PostHogProvider)
├── page.tsx                (Landing page)
├── (auth)/
│   ├── sign-in/page.tsx    (Clerk <SignIn/>)
│   └── sign-up/page.tsx    (Clerk <SignUp/>)
├── dashboard/
│   ├── page.tsx            (Lista progetti utente)
│   └── [projectId]/
│       ├── page.tsx        (Dettaglio progetto + playtest iframe)
│       └── generate/page.tsx (Brief → Engine picker → Piano → Genera)
├── api/
│   ├── generate/route.ts   (POST: crea progetto in Supabase, triggera job Trigger.dev)
│   ├── status/[jobId]/route.ts (GET: stato job da Supabase)
│   └── webhook/clerk/route.ts  (POST: Clerk webhook → crea user in Supabase)

lib/
├── supabase.ts             (Client Supabase con types)
├── openrouter.ts           (Client OpenAI puntato a OpenRouter via Helicone proxy)
├── r2.ts                   (Client S3 per Cloudflare R2)
├── orchestrator.ts         (GameOrchestrator: pattern Hermes in TypeScript)
│                            - shortTermMemory: Map<string, any>
│                            - loadLongTermMemory(userId) → Supabase
│                            - loadEpisodicMemory(taskType) → Supabase
│                            - proposeGamePlan(brief) → OpenRouter (Claude Sonnet)
│                            - executeWithRetry(toolCall, maxRetries=3)
│                            - saveEpisodicMemory(taskType, params, quality)
├── types.ts                (GamePlan, GameGraph, ToolCall, ProjectState — Zod schemas)
└── tools/
    ├── registry.ts         (Map<string, ToolFunction> di tutti i tool)
    ├── gdd-generator.ts    (Tool 1: brief → GDD JSON via DeepSeek Flash)
    ├── code-gen-gdscript.ts(Tool 2: task → GDScript via DeepSeek Pro)
    ├── code-gen-js.ts      (Tool 3: task → JS via DeepSeek Pro)
    ├── sprite-gen.ts       (Tool 9: prompt → PNG via Replicate SDXL)
    ├── bgm-gen.ts          (Tool 19: mood → audio via Suno)
    ├── godot-assembler.ts  (Tool 32: tutti output → progetto Godot in E2B sandbox)
    ├── phaser-assembler.ts (Tool 33: tutti output → progetto Phaser)
    └── code-validator.ts   (Tool 37: linting in E2B sandbox)

trigger/
├── generate-game.ts        (Task Trigger.dev che esegue GameOrchestrator)
└── export-web.ts           (Task che esporta via Godot headless in E2B)

NON implementare le chiamate API reali. Usa mock che restituiscono
dati finti ma con la struttura corretta. La struttura e il flusso
sono la priorità. Ogni file deve avere tipi TypeScript completi.

Testa con: POST /api/generate {brief: "platformer 2D con cavaliere"}
e verifica che il job Trigger.dev parta e aggiorni lo stato in Supabase.
```

---

# ═══════════════════════════════════════════
# PARTE VIII — LA VISIONE
# ═══════════════════════════════════════════

## 14. DEMOCRATIZZARE LO SVILUPPO DI VIDEOGIOCHI

Come DALL-E e Midjourney hanno democratizzato la creazione di immagini, come le piattaforme di video AI hanno democratizzato la produzione video — noi democratizziamo la creazione di videogiochi.

**Chi può usare la piattaforma:**
- Un bambino di 12 anni che vuole creare il suo primo gioco
- Un musicista che ha una colonna sonora e vuole un gioco attorno
- Uno scrittore che ha una storia e vuole trasformarla in una visual novel
- Un game designer con un GDD che non sa programmare
- Un artista con concept art che vuole vederli prendere vita
- Un dev indie solo che vuole fare in 1 settimana quello che un team fa in 1 anno
- Uno studio che vuole prototipare 10 idee in un giorno

**Due porte per lo stesso edificio:**
- **Modalità Creator**: descrivi, carica, scegli, gioca. Zero codice.
- **Modalità Developer**: accedi al codice generato, modifica, estendi, esporta, pubblica.

**Il moat competitivo:**
1. Hermes Agent che migliora con l'uso (Episodic Memory)
2. 40 tool specializzati per game dev (nessun competitor li ha)
3. Multi-engine (nessuno offre 10+ engine in un'unica piattaforma)
4. Input multimodale (storyboard + musica + concept art + testo)
5. Network effect del marketplace (template, asset, meccaniche condivise)

Il pattern Multi-Model Orchestration è provato: piattaforme che lo applicano nel video hanno raggiunto valutazioni miliardarie in meno di 2 anni. Il mercato gaming ($275B nel 2026) è ordini di grandezza più grande del mercato video AI.

---

*Questo documento è la Pietra Fondativa definitiva. Il prossimo passo è aprire VS Code, lanciare Claude Code, e incollare il Modulo Zero. Da lì, il codice si scrive.*

*Non c'è più nulla da analizzare. C'è solo da costruire.*
