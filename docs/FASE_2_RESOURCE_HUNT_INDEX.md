# Fase 2 — Resource Hunt: indice e stato

**Data**: 2026-05-24
**Obiettivo**: trovare TUTTO il materiale esterno che renda il primo
gioco generato wow, non AI-slop. Si esegue tra blueprint v2 (fatto) e
sviluppo settimana 1.

---

## 1. Cosa abbiamo già — inventario certo

Prima di cercare cose nuove: questo è cosa è GIÀ nel repo. NON
ri-cercarlo a Gemini.

### 1.1 Dataset RAG `code_knowledge` (Supabase pgvector)

- **7 548 chunk** classificati, 0 fat cells, 0 GPL/copyleft.
- Per engine:
  - godot: 3 357 chunk (copertura completa)
  - threejs: 1 270 (forte 3D/vfx)
  - monogame: 1 090 (gap C01/C03 strutturale)
  - phaser: 968 (gap C03/C04 strutturale)
  - defold: 796 (ampia)
  - love2d: 718 (C03 sottile)
  - renpy: 591 (VN completo)
  - stride: 215 (esaurito, gap strutturale confermato)
- Generi coperti 8/8. Vedi `FINDING_phase1ter_residual_gaps.md`.

### 1.2 Manifest repo (968 entries totali)

- File: `data/manifest.json` (968) + `data/manifest.curated.json` (732
  curated/notable).
- Tutti i repo passati al filter, parse, classify. **Non ricercare
  questi su GitHub a Gemini** — sono già processati.
- Mix di tier "curated" (engine ufficiali + repo top), "notable" (alto
  segnale), "regular" (passati i filtri qualità).
- Esempi già nel KB (NON cercare):
  - Godot: `uheartbeast/metroidvania-godot-4`,
    `noidexe/top-down-action-rpg-template`,
    `expressobits/character-controller`, `foxssake/netfox`,
    `heroiclabs/nakama-godot`, `MenacingMecha/godot-psx-style-demo`,
    `Whimfoome/godot-FirstPersonStarter`,
    `nathanhoad/godot_puzzle_dependencies`, ecc.
  - threejs: `mrdoob/three.js`, `Alchemist0823/three.quarks`,
    `donmccurdy/*`, ecc.
  - phaser: `phaserjs/examples`, `phaserjs/phaser-by-example`,
    `ffx0s/mario-html5`, `proyecto26/ion-phaser`, ecc.
  - monogame: `MonoGame/MonoGame`, `MonoGame-Extended/*`, FNA-XNA/FNA,
    `friflo/Friflo.Engine.ECS`, `craftworkgames/MonoGame.Extended`,
    `Martenfur/Monofoxe` (in quarantine), `SkyAlpha/luminus-rpg`.
  - love2d: `love2d/love`, `Stabyourself/mari0`,
    `hawkthorne/hawkthorne-journey`, ecc.
  - defold: `defold/defold`, `defold/defold-examples`, britzl pacchetti.
  - renpy: 16 progetti GitLab + Itch incluso BobcStats, Encyclopaedia.
  - stride: `stride3d/stride`, BepuPhysics, Stride Community Toolkit
    (TUTTO l'ecosistema OSS Stride permissivo è già esaurito).

### 1.3 Risorse menzionate nella Pietra v4 (non da ri-cercare)

Le ha già citate il documento `pietra_v4 (1).md` come scelte di
prodotto. Conferma e dettaglio in Fase 2:

- Asset library 2D: Kenney.nl (40k+), OpenGameArt, itch free,
  CraftPix Freebies, GameAssets.com (60k+).
- Asset library 3D: Quaternius, KayKit, Poly Haven, Cinevva (meta-
  search).
- Audio: Freesound, OpenGameArt Audio, Kenney Audio.
- AI gen: SDXL/FLUX via Replicate, Meshy.ai, Tripo AI v3, TripoSR.
- Audio gen: Suno, ElevenLabs SFX/TTS, Kokoro/Piper TTS (Fase 2).
- Narrative DSL: ink (inkle) + inkjs npm.
- PCG: GDQuest PCG Demos, Gaea, DeBroglie (C# WFC).
- Tilemap: Tiled editor.
- MCP server engine-specific: godot-ai, godot-mcp-server,
  monogame-mcp, love2d-mcp, threejs-devtools-mcp, three-js-mcp,
  mcp-game-asset-gen, Chrome MCP, Firecrawl MCP, GitHub MCP.
- Frontend tooling: AI Website Cloner (JCodesMore), Perfect Web Clone
  (ericshang98), Clone-website Firecrawl skill, claude-zyte-screenshots.
- BaaS: i 18 servizi (Clerk, Supabase, Trigger.dev, R2, E2B,
  OpenRouter, Helicone, PostHog, Vercel, Upstash, Resend, Loops,
  Knock, Crisp, Dub.co, Stripe, Meilisearch, Polar.sh).
- Modelli LLM con routing già definito (DeepSeek V4 Flash/Pro, Kimi
  K2.6, Sonnet 4.6, Opus 4.7, Hermes 3 8B locale).

### 1.4 Riferimenti accademici verificati nei round Gemini

Già consolidati in `GEMINI_REASONING_REPORT_REVIEW_v2.md` parte 1
(20+ paper verificati). Vedi blueprint v2 parte B.

---

## 2. Cosa cerchiamo in Fase 2 — i 6 documenti

Ogni documento copre un dominio. Per ognuno:

| # | Documento | Cosa contiene | Metodo |
|---|---|---|---|
| 1 | ASSET_LIBRARY_MANIFEST.md | URL canonici, numero asset, schema metadata, licenza per pack | ricerca interna (WebFetch) |
| 2 | STYLE_PACK_REFERENCES.md | Per ognuno dei 30 pack: 5 ref games + palette oklch + LoRA Civitai/HF + font + asset library affini | ricerca interna |
| 3 | AUDIO_MOOD_LIBRARY.md | 10 mood × (3-5 reference + SFX bank + BPM range) | ricerca interna |
| 4 | REFERENCE_GAMES_VISUAL.md | Per ogni style_pack × genre: 5-10 screenshot Steam/itch | ricerca interna |
| 5 | RAG_GAP_DECISIONS.md | Per ogni zero-cell critica: compensiamo / escludiamo / harvest? | analisi interna + SQL |
| 6 | ENGINE_MECHANICS_KIT.md | Per ognuno degli 8 engine: griglia movement/AI/camera/save/audio/UI | ricerca interna su KB + Deep Research per Stride |

## 3. Cosa cerchiamo via Deep Research — i 5 prompt

Per cose specifiche dove la mia ricerca interna sarebbe lenta o
incompleta:

| # | Prompt | Target | Tool consigliato |
|---|---|---|---|
| 1 | Genre Templates batch 1 (T01-T04) | Metroidvania, VN, Mobile Puzzle, Browser Arcade | Gemini Deep Research |
| 2 | Genre Templates batch 2 (T05-T07) | JRPG, Card game, Platformer hardcore | Gemini Deep Research |
| 3 | Genre Templates batch 3 (T08-T11) | Roguelike, 3D showcase, Stride 3D, Multiplayer | Gemini Deep Research |
| 4 | Genre Templates batch 4 (T12-T14) | Social sim, Bullet hell, Retro 8-bit | Gemini Deep Research |
| 5 | Stride 3D + nicchie gap | Stride combat/save/UI + phaser dialogue plugin alternativi | Gemini Deep Research |

In aggiunta, **Claude.ai chat normale** può fare ricerche con
"Projects" + "Web Search" (più affidabile di Deep Research per
fonti limitate ma pulite). Usalo per:
- Verifica licenze pacchetti specifici (vai a CivitAI/HuggingFace,
  guardi la licenza dichiarata).
- Lettura post tecnici GDC/blog (Gemini è più rumoroso su questo).

Altre opzioni di ricerca esterna disponibili:

| Strumento | Quando usarlo |
|---|---|
| **ChatGPT Deep Research** (Pro) | Alternativa parallela a Gemini, spesso meno verbose. Confronto cross-source. |
| **Perplexity Pro Deep Research** | Migliore per fonti accademiche con bibliografia formale. |
| **Claude.ai con Search** (Pro) | Migliore per code/docs technical reading. |
| **Grok (xAI) Deep Search** | Buono per social / Reddit / community signal. |
| **Genspark Autopilot** | Multi-LLM compare; usalo per cross-validation veloce. |

---

## 4. Sequenza esecutiva proposta

Ordine ottimale, con dipendenze:

### Settimana 1 — Documenti interni (faccio io)

Giorno 1 (oggi): scrivo i 6 documenti di Resource Hunt sotto. Tempo
stimato: 4-6h di lavoro interno mio. Output: 6 file `.md` in `docs/`.

### Settimana 1 — Deep Research esterni (li lanci tu)

Giorno 2-3: tu lanci i 5 prompt Gemini Deep Research (li trovi in
`docs/DEEP_RESEARCH_PROMPTS_FASE2.md`). Tempo: ~2h tuoi.

Giorno 4: io rivedo gli output (WebFetch verification come per round
1/2 del Reasoning Engine). Tempo: ~2h interne mie. Output: review
files in `docs/`.

### Settimana 2 — Consolidamento

Giorno 1-2: aggiorno blueprint v2 con i materiali raccolti. Pietra
v5 addendum. Where-to-look-next.

Giorno 3+: solo ora si parte con lo sviluppo (Settimana 1 della
roadmap blueprint).

---

## 5. Anti-duplicazione: cosa NON cercare

Lista esplicita di cose già coperte che NON vanno nei prompt Deep
Research:

- ❌ Repo OSS già nel manifest (968 entries) — vedi sez. 1.2
- ❌ Asset library già menzionate nella Pietra (Kenney, OpenGameArt,
  Quaternius, KayKit, Poly Haven, Freesound, CraftPix, GameAssets,
  Cinevva)
- ❌ Modelli LLM già scelti (DeepSeek, Kimi, Sonnet, Opus)
- ❌ AI gen già scelti (SDXL, FLUX, Meshy, Tripo, Suno, ElevenLabs)
- ❌ Stack BaaS (18 servizi)
- ❌ Paper PCG/LLM-agent del blueprint v2 parte B
- ❌ Competitor già analizzati (17 nei round 1/2)
- ❌ Engine SCARTATI (Bevy, Cocos2d-x, LibGDX, OGRE, Pyxel)

Lista esplicita di cose da CERCARE:

- ✅ Palette concrete oklch per 30 style pack
- ✅ LoRA SDXL/FLUX pubbliche su Civitai/HuggingFace verificate
- ✅ Font CC0 per genere/style
- ✅ ControlNet reference images sources
- ✅ Suno prompt patterns per mood × genere
- ✅ SFX bank specifici per genere (oltre a quanto Kenney/Freesound
  hanno già)
- ✅ Screenshot reference giochi shipped per moodboard
- ✅ Genre template scheletri (3-5 zone, gating tipo, pacing curve,
  rules range, per ognuno dei 14 generi)
- ✅ Code mechanics pattern per engine (movement/AI/camera/save/UI)
  via SQL query interna sul KB esistente
- ✅ Gap residui dataset (decisione compensa/escludi/harvest)

---

## 6. Mappa file Fase 2

```
docs/
├── FASE_2_RESOURCE_HUNT_INDEX.md            ← QUESTO (indice)
├── ASSET_LIBRARY_MANIFEST.md                ← doc 1
├── STYLE_PACK_REFERENCES.md                 ← doc 2
├── AUDIO_MOOD_LIBRARY.md                    ← doc 3
├── REFERENCE_GAMES_VISUAL.md                ← doc 4
├── RAG_GAP_DECISIONS.md                     ← doc 5
├── ENGINE_MECHANICS_KIT.md                  ← doc 6
└── DEEP_RESEARCH_PROMPTS_FASE2.md           ← 5 prompt + istruzioni
```

Procedo nell'ordine. I 6 documenti interni sono indipendenti — li
scrivo in sequenza ma se vuoi posso parallelizzare alcuni.
