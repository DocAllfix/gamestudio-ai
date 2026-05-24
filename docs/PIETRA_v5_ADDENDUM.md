# PIETRA FONDATIVA v5 — ADDENDUM TECNICO

**Versione**: 5.0 ADDENDUM (estende Pietra v4)
**Data**: 2026-05-24
**Status**: pre-sviluppo, post Fase 2 Resource Hunt
**Sostituisce**: nessuna parte di v4 — la integra con ancoraggi
tecnici concreti

---

## Scopo di questo addendum

La Pietra v4 era visione: 8 engine, 48 tool, 18 servizi BaaS, Game
Reasoning Engine, Asset Library, Genre System, Engine Presets,
Multi-modal Input Hub. Tutto definito a livello di promessa.

Il v5 traduce ogni promessa in **numeri verificati** e **risorse
verificate**. Dopo blueprint v2 + Fase 2 Resource Hunt, abbiamo:
- riferimenti accademici (15 paper canonici verificati)
- repo OSS (968 nel manifest + 27 nuovi verificati nel round Fase 2)
- librerie asset (13 CC0 verificate)
- style pack (30 con palette/LoRA/font)
- genre template (14 con world_graph/pacing/rules baseline)
- audio mood (12 con prompt Suno pre-curati)
- reference games (80 con URL Steam canonici)
- 7 503 chunk RAG `code_knowledge` verificati

L'addendum **non riscrive** la Pietra. **Aggiunge le 7 sezioni
mancanti** che fanno passare il prodotto da "ambizione" a "macchina
calibrata pre-build".

---

## §A — Wow Effect Promise (la promessa misurabile al primo prompt)

La differenza tra Game Studio AI e i competitor non è "abbiamo l'AI".
Tutti hanno l'AI. La differenza è **cosa promettiamo al primo prompt**
dell'utente, e come lo misuriamo.

### A.1 Promessa al day-1 (Free tier, primo prompt)

L'utente riceve un gioco con queste **garanzie verificabili**:

| Garanzia | Soglia | Come si misura |
|---|---|---|
| Aesthetic Coherence | ≥ 0.75 | Score CLIP-similarity + palette match (D.3 validator) |
| 0 soft-lock | 100% | ASP via clingo sul world_graph (D.3) |
| Stress curve RMSE | < 0.15 | Playtester Agent N=10 vs target (D.6) |
| Smoke test pass | ≥ 95% | Cradle screen-understanding (D.6) |
| Costo per generazione | < $1.50 | Sum tool_call.cost_usd nel DAG |
| Tempo di generazione | < 15 min | Trigger.dev job end-to-end |
| Lingua brief utente | EN/IT/ES/FR | DSPy signature multi-lingua |

Se uno qualunque di questi fallisce → il sistema rigetta l'output e
ri-itera, oppure consegna con disclaimer esplicito (Reflexion loop).

### A.2 13 generi in tier wow + 1 in beta

Day-1 promessi come "wow effect" garantito:

- **T01** Metroidvania Platformer (Godot 4)
- **T02** Visual Novel (Ren'Py)
- **T03** Mobile Casual Puzzle (Defold)
- **T04** Browser Arcade (Phaser 3)
- **T05** JRPG Top-down (Godot 4) — MonoGame in beta
- **T06** Card Game/Autobattler (LÖVE 11)
- **T07** Platformer Hardcore Pixel-Perfect (MonoGame)
- **T08** Roguelike/Roguelite (Godot 4)
- **T09** 3D Browser Showcase (Three.js)
- **T11** Multiplayer Arena (Godot 4 + Nakama)
- **T12** Social Sim/Generative Agents (Godot 4 + Ollama)
- **T13** Bullet Hell (LÖVE 11)
- **T14** Retro 8-bit Restricted (Godot 4)

Day-1 beta tier:
- **T10** Stride 3D Action Adventure — visibile nel picker engine
  con badge "Best for advanced users — requires manual refinement"

**13/14 = 93% di copertura wow day-1**. Nessun competitor offre nulla
di paragonabile (Rosebud 1-2 web genres, SEELE 1 3D, Inworld 0 generi,
Charisma 1 narrative).

---

## §B — Cost Revisited (con anti-slop pipeline)

La Pietra v4 stimava $1.50-5.00 per gioco 2D completo. Dopo
l'integrazione di Asset Library CC0 + Genre Template + RAG Decompose,
il costo si abbassa significativamente.

### B.1 Costo per gioco — Free tier (template + CC0 prevalente)

| Voce | Costo | Note |
|---|---|---|
| D.1 Intent Interpreter (template-based) | $0.02-0.05 | DSPy + Outlines, baseline-then-diff |
| D.2 Design Planner (delta only) | $0.10-0.25 | Dormans grammar + ToT branching |
| D.3 Consistency Manager | $0.00 | clingo + Reflexion (no LLM cost diretto) |
| D.4 Balance Controller (property-test) | $0.05-0.10 | Python hypothesis + small LLM judge |
| D.5 Execution Orchestrator | $0.30-0.80 | code_gen × N + asset_resolver (CC0 prevalente) |
| D.6 Evaluation Agent (Playtester + judge) | $0.10-0.30 | Cradle + MT-Bench rubric |
| Embedding RAG (cache miss minoritari) | $0.01-0.02 | text-embedding-3-small |
| **Totale gioco wow Free tier** | **$0.58-1.52** | mediana ~$1.00 |

### B.2 Costo per gioco — Pro tier ($49/mese, asset AI premium)

| Voce | Costo aggiuntivo | Note |
|---|---|---|
| Sprite AI custom (FLUX Pro × 20-40) | $0.10-0.20 | sprite_gen su entità centrali |
| Audio Suno custom × 3-5 tracce | $0.15-0.50 | bgm_gen layered |
| 3D modelli Meshy custom × 5-10 | $0.50-2.00 | model_3d_gen + rigging |
| **Totale gioco wow Pro tier** | **$1.40-4.20** | mediana ~$2.50 |

### B.3 Costo per Reasoning Engine (mensile, baseline operativo)

Per uno studio che usa la piattaforma:
- Free tier: $0/mese (badge in-game + LLM cost coperto da margin)
- Creator $19/mese: 10-15 giochi/mese (margine $14-15)
- Pro $49/mese: 15-25 giochi/mese (margine $25-35)
- Studio $99/mese: illimitato + seat multipli (margine variabile)

**Break-even point**: ~3-5 giochi generati/mese per coprire l'API
LLM budget. Free tier sostiene fino a ~10 giochi al mese a costo
zero per noi (DeepSeek cache, batch API 50% sconto, prompt cache 90%).

---

## §C — Risorse verificate (l'inventario completo)

### C.1 Knowledge Base RAG `code_knowledge`

**7 503 chunk verificati**. 0 GPL/copyleft. 0 fat cells (cap 250).
Copertura per 8 engine × 21 categorie × 20 generi × 43 key-features
× 12 design patterns.

Distribuzione:
- godot 3 357 / threejs 1 270 / monogame 1 090 / phaser 968 /
  defold 796 / love2d 718 / renpy 591 / stride 215

Gap strutturali confermati (vedi RAG_GAP_DECISIONS):
- phaser × dialogue/save (G.2) → scaffold hardcoded
- monogame × C01 progression/C03 dialogue (G.1) → T05-alt beta
- stride × quasi tutto (G.3) → T10 beta

### C.2 Asset Library — 13 librerie CC0/permissive

Vedi `ASSET_LIBRARY_MANIFEST.md`. ~600k asset grezzi, ~150-200k
utilizzabili post-filter.

Top 5:
- Kenney.nl (~60k+ asset, CC0)
- OpenGameArt (~50k asset, misti CC0/CC-BY)
- Freesound (500k+ audio, misti, API ufficiale)
- Poly Haven (~3k 3D/HDRI/textures, CC0, API ufficiale)
- Quaternius (~80 pack 3D low-poly, CC0)

Nuove rispetto a Pietra v4:
- **Sketchfab CC0 filter** (~70k modelli)
- **Pmndrs Drei** ecosystem (componenti R3F MIT, NPM)

### C.3 Style Pack — 30 pack con asset operativi

Vedi `STYLE_PACK_REFERENCES.md`. Per ognuno:
- Palette oklch + hex (5-9 colori)
- LoRA SDXL/FLUX (Civitai/HuggingFace, da verificare)
- Font Google Fonts (SIL OFL) + alternative CC0
- Asset library affini (Kenney/Quaternius/KayKit packs)
- 3-5 reference games con URL Steam

Distribuzione: 8 pixel art + 6 stilizzato 2D + 8 3D + 8 nicchia.

### C.4 Genre Template — 14 template wow

Vedi blueprint v2 parte N.3 (aggiornata 2026-05-24). Per ognuno:
- Engine consigliato + alternativi
- 3-5 zone baseline con gating tipato
- Pacing curve a 5 punti normalizzati
- Rules ranges numerici (HP/DMG/checkpoint/durata)
- Note implementative engine-specific
- 3-5 reference games shipped
- 2-7 repo OSS verificati Fase 2

### C.5 Audio Mood Library — 12 mood

Vedi `AUDIO_MOOD_LIBRARY.md`. Per ognuno:
- BPM range + key musicale
- Strumentazione consigliata
- Prompt Suno pre-curato
- Layering pattern (3 stems)
- SFX bank Freesound/Kenney query
- Reference games

12 mood mappati ai 14 template + cross-trasversali.

### C.6 Reference Games Visual — 80 giochi shipped

Vedi `REFERENCE_GAMES_VISUAL.md`. Per ognuno:
- URL canonico Steam/itch (per screenshot ufficiali)
- Style pack match
- Engine plausibile per replica

Sono input al D.1 Intent Interpreter via Claude Vision per moodboard
batch. Costo analysis ~$8 una tantum.

### C.7 Letteratura accademica — 15 paper canonici

Vedi blueprint v2 parte B. Tutti verificati via WebFetch:
- Voyager, Generative Agents, MetaGPT, ChatDev, AutoGen, ToT,
  Reflexion, Self-Refine, Cradle, CAMEL, AgentVerse, Self-Discover,
  MT-Bench, MarioGPT, LLM+Games Survey 2024
- + 11 PCG canonici (Smith ASP-PCG 2011, Karth WFC, Dormans
  mission/space, Yannakakis EDPCG, Booth L4D, Tanagra, Sentient
  Sketchbook, Sonancia, Mario PCG metrics, Caves of Qud, Dwarf
  Fortress)

### C.8 Tools operativi (oltre i 48 della Pietra v4)

Nuovi dal blueprint v2 + Fase 2:
- **DSPy** (stanfordnlp/dspy, MIT) per Game Plan compilation
- **clingo** (Potassco, MIT) per ASP validation
- **DeBroglie** (BorisTheBrave, MIT, 513★) per tilemap_populate WFC
- **Tracery** (galaxykate, Apache-2.0, 2.2k★) per lore pre-LLM
- **Outlines** (dottxt-ai, Apache-2.0, 13.9k★) per JSON enforce
- **PuzzleScript** (increpare, MIT, 1.1k★) per Game Plan 2D DSL ref
- **pmndrs/postprocessing** (Zlib, 2.8k★) per Three.js VFX
- **N8python/n8ao** (CC0, 466★) per SSAO Three.js
- **FarazzShaikh/THREE-CustomShaderMaterial** (MIT, 1.3k★) per toon
- **GodotRetro** (CC0/MIT, 745★) per shader retro T14

---

## §D — Differenziazione competitiva (post-blueprint v2)

La Pietra v4 §1-TER aveva i 5 moat. Con blueprint v2 + Fase 2
diventano **7 moat con asse di confronto chirurgico**.

| # | Moat | Game Studio AI | Best competitor | Gap |
|---|---|---|---|---|
| 1 | Multi-engine code export | 8 engine | Rosebud 2 | 4x |
| 2 | Game Reasoning sistemico | 6 moduli formalizzati | nessuno | ∞ |
| 3 | KB RAG verificata | 7 503 chunk, 0 GPL | nessuno | ∞ |
| 4 | Owned-by-developer code | .zip export | Inworld no, Roblox no | strutturale |
| 5 | Tier indie $0-30 | Free + Creator $19 | Promethean AAA-only, Layer enterprise | strutturale |
| 6 | **Style Pack pre-curati** ⭐ | 30 pack | nessuno | ∞ |
| 7 | **Asset Library CC0 indicizzata** ⭐ | 150-200k asset | Scenario LoRA proprie | scope |
| 8 | **Genre Templates day-1** ⭐ | 14 template | nessuno | ∞ |
| 9 | **Anti-slop pipeline garantita** ⭐ | wow promise misurabile | tutti hanno LLM puro | qualità |
| 10 | **Game Plan Diff** (git for design) ⭐ | RFC 6902 sul Game Plan | nessuno | ∞ |
| 11 | **Playtest Simulator pre-rilascio** ⭐ | Voyager + CAMEL + Cradle | nessuno | ∞ |
| 12 | **Tre Modalità Creator/Studio/Code** | React Flow sul Game Plan | Vercel v0 (1 modalità) | UX |

⭐ = nuovo rispetto Pietra v4, emerso dal blueprint v2 + Fase 2.

**Pitch difendibile davanti a investitori tecnici**:

> Gli altri generano prompt-output. Noi modelliamo il gioco come sistema
> formale (Game Plan tipato + ASP-verified), lo sviluppiamo con 6 moduli
> specialistici basati su 15 anni di ricerca PCG, e lo esportiamo come
> progetto compilabile su 8 engine reali, partendo da 14 genre template
> baseline + 30 style pack curati + 150k+ asset CC0 indicizzati. È la
> differenza fra un generatore di immagini e un IDE.

Ogni claim ha riferimento accademico o repo verificato.

---

## §E — Aggiornamenti alla Pietra v4 (deltas)

L'addendum modifica/precisa questi punti della v4:

### §2.5 Routing genere → engine: T05-alt e T10 marcati

| Pietra v4 dice | Addendum precisa |
|---|---|
| "RPG top-down → Godot 4 / MonoGame" | Day-1: Godot wow + MonoGame **beta** |
| "3D professionale desktop → Stride" | Day-1: **beta engine** con badge |

### §8.4 Engine Presets — count effettivo

Pietra v4 promette "centinaia di combinazioni preset". Addendum
precisa: **14 genre template × ~3 engine alternativi × 30 style pack
= 1260 combinazioni teoriche, ~100 wow al day-1**.

### §8.8 Varianti creative — meccanica del feedback

Aggiornato in blueprint v2: ogni asset critico genera 3-4 varianti.
La scelta dell'utente alimenta `code_knowledge.success_score` con
decadimento esponenziale 0.95 + 0.05 (vedi blueprint v2 parte O.4).

### §11-octies Asset Library — count effettivo

Pietra v4 promette "Millions of ready-to-use assets". Addendum
precisa: **~600k grezzi, ~150-200k utilizzabili post-filter licenza
e dedup cross-library**. Costo indicizzazione ~$3-5 + 8-12h scrape.

### §11-nonies Pricing — break-even rivisto

Costo per gioco aggiornato a $0.58-1.52 Free tier (mediana $1.00).
Free tier sostenibile fino a ~10 giochi/mese a costo zero per noi
con DeepSeek + cache + batch.

### §13 Modulo Zero — schema Game Plan aggiornato

Il prompt a Claude Code della Pietra v4 va modificato per usare il
Game Plan tipato v2 (con `style_pack`, `template_origin`,
`plan_version`, `execution_dag`, `asset_bindings`,
`aesthetic_coherence_metrics`).

---

## §F — Cosa NON cambia dalla Pietra v4

- Identità: democratizzare lo sviluppo di videogiochi.
- Stack: 18 servizi BaaS, zero VPS.
- Modelli LLM con routing intelligente.
- 48 tool del Game Studio.
- Hermes Agent pattern (memoria 3 livelli).
- Tre Modalità Creator/Studio/Code.
- Distribuzione: itch.io + Steam + mobile + web.
- 5 moat originali (multi-engine, Hermes, 48 tool, project-owned,
  Game Reasoning Engine).

Tutto questo resta. L'addendum aggiunge **misurabilità** e **risorse
verificate** alle promesse.

---

## §G — Roadmap effettiva (delta dalla Pietra v4)

La roadmap §12 della v4 (mesi 1-12) resta. Solo precisazione:

- **Sett 0-2 PRE-DEV** (oggi): blueprint v2 + 6 doc Resource Hunt +
  5 round Deep Research + review consolidata. **TUTTO COMPLETATO**.
- **Sett 1 dev**: schema Game Plan v2 tipato (TypeScript + JSON
  Schema)
- **Sett 2 dev**: migrazioni Supabase per style_packs +
  genre_templates + asset_library_index + seed dei 30+14 cataloghi
- **Sett 3+ dev**: come da blueprint v2 parte H (D.1 → D.6 → Diff
  → Frontend → End-to-end)

**Tempo totale stimato dal codice a wow effect day-1**: 14 settimane.

---

## §H — Riferimenti documentali

Tutti in `docs/`:

| File | Cosa | Status |
|---|---|---|
| pietra_v4 (1).md | Visione originale | ✓ |
| **PIETRA_v5_ADDENDUM.md** | **Questo file** | ✓ |
| GAME_REASONING_ENGINE_BLUEPRINT_v2.md | Blueprint operativo Reasoning Engine | ✓ (aggiornato 2026-05-24) |
| GAME_REASONING_ENGINE_BLUEPRINT_v1.md | Storico, sostituito | — |
| FASE_2_RESOURCE_HUNT_INDEX.md | Indice Fase 2 | ✓ |
| FASE_2_RESEARCH_RESULTS_REVIEW.md | Review 5 round Deep Research | ✓ |
| ASSET_LIBRARY_MANIFEST.md | 13 librerie CC0 | ✓ |
| STYLE_PACK_REFERENCES.md | 30 pack stilistici | ✓ |
| AUDIO_MOOD_LIBRARY.md | 12 mood audio | ✓ |
| REFERENCE_GAMES_VISUAL.md | 80 reference games | ✓ |
| RAG_GAP_DECISIONS.md | Decisioni per gap dataset | ✓ |
| ENGINE_MECHANICS_KIT.md | Pattern per 8 engine | ✓ |
| DEEP_RESEARCH_PROMPTS_FASE2.md | 5 prompt round Fase 2 | ✓ |
| GEMINI_REASONING_REPORT_REVIEW.md | Review round 1 Reasoning | — |
| GEMINI_REASONING_REPORT_REVIEW_v2.md | Review round 2 Reasoning | — |
| FINDING_phase1ter_residual_gaps.md | Gap dataset post Fase 1ter | — |

---

## §I — Numeri di sintesi finale

| Metrica | Valore | Fonte |
|---|---|---|
| Engine day-1 | 8 (7 wow + 1 beta) | blueprint v2 |
| Template day-1 | 14 (13 wow + 1 beta) | blueprint v2 N.3 |
| Generi totali coperti | 14 | Pietra §2.5 |
| Style pack | 30 | STYLE_PACK_REFERENCES |
| Mood audio | 12 | AUDIO_MOOD_LIBRARY |
| Reference games | 80 | REFERENCE_GAMES_VISUAL |
| Librerie asset CC0 | 13 | ASSET_LIBRARY_MANIFEST |
| Asset utilizzabili | 150-200k | ASSET_LIBRARY_MANIFEST |
| RAG chunk code | 7 503 | dataset Supabase |
| Repo manifest | 968 (732 curated) | data/manifest |
| Repo nuovi Fase 2 | ~27 permissivi verificati | FASE_2_RESEARCH_RESULTS_REVIEW |
| Paper canonici | 15 (LLM-agent) + 11 (PCG) | blueprint v2 B |
| Tool specialistici | 48 | Pietra §1.4 |
| Servizi BaaS | 18 | Pietra §11 |
| Modelli LLM con routing | 7 tier | Pietra §3 |
| Costo gioco Free tier | $0.58-1.52 (mediana $1.00) | §B.1 |
| Costo gioco Pro tier | $1.40-4.20 (mediana $2.50) | §B.2 |
| Tempo gen day-1 | < 15 min | §A.1 |
| Aesthetic Coherence soglia | ≥ 0.75 | §A.1 |
| Stress RMSE soglia | < 0.15 | §A.1 |
| Smoke test pass rate | ≥ 95% | §A.1 |

Questi sono i numeri che dichiariamo davanti a investitori, utenti,
press. Ognuno ha un file di riferimento dove è derivato. Niente
vibes, niente hype.

---

**Fine addendum v5.**
