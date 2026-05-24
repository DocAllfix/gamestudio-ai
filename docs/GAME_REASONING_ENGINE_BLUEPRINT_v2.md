# Game Reasoning Engine — Blueprint v2 (anti-slop edition)

**Data**: 2026-05-24
**Stato**: blueprint completo pre-implementazione
**Sostituisce**: `GAME_REASONING_ENGINE_BLUEPRINT_v1.md` (resta come
storico)
**Lunghezza**: ~2200 righe, autoportante.

Questo documento è la base operativa unica per costruire il Game
Reasoning Engine. Si presume letto: `pietra_v4 (1).md`,
`GEMINI_REASONING_REPORT_REVIEW_v2.md`, e (per riferimento storico)
il blueprint v1.

---

# PARTE 0 — Cosa cambia da v1 a v2

Il v1 aveva 6 moduli formalizzati e una mappatura PCG ai moduli, ma 7
gap importanti rispetto alla Pietra v4 lo separavano dalla "macchina
perfetta" descritta. Il v2 li copre tutti:

| Gap | Sezione v2 |
|---|---|
| 1. Aesthetic Engine (stili visivi pre-pronti) | Parte J |
| 2. Asset Library Integration (CC0 + AI ibrido) | Parte K |
| 3. Game Plan Diff (iterazione click-by-click) | Parte L |
| 4. Playtest Simulator (validazione pre-rilascio) | Parte M |
| 5. Genre Templates (cold start) | Parte N |
| 6. RAG Decompose-then-Retrieve | Parte O |
| 7. Tre Modalità — mapping al Game Plan | Parte P |

E aggiunge:
- Catalog completo di **30 Style Pack** (Parte J.3)
- Catalog completo di **14 Genre Template** (Parte N.3)
- Schema Game Plan **esteso** (Parte C aggiornata) con `style_pack`,
  `template_origin`, `aesthetic_coherence_metrics`
- Diagramma architetturale **aggiornato** (Parte E) con Asset
  Library, Style Pack Library, Genre Template Catalog, RAG visibili.
- Roadmap **aggiornata** (Parte H) con i passi anti-slop.

Le parti A-I restano sostanzialmente quelle del v1, lievemente
estese dove rilevante.

---

# PARTE A — Bilancio della Pietra v4

Nel mio audit della Pietra v4 (v1 sezione A) erano emersi 4 punti di
mediocrità sul Reasoning Engine:

1. **Game Plan JSON con campi a intuito**: `pacing.stress = "low"`,
   `risk_reward = "souls-lite"` sono stringhe descrittive, non
   variabili computabili.
2. **AI Director di Left 4 Dead come ispirazione narrativa** ma senza
   formalizzazione: non si dice quale metrica calcolare, quale soglia
   triggera l'azione, su quale finestra temporale.
3. **6 moduli con nomi vaghi** (Intent Interpreter, Design Planner,
   ecc.) e una colonna "tool che usa" che mescola modelli LLM e
   strumenti senza schema operativo.
4. **Nessuna citazione di letteratura** che validi quel modello come
   "stato dell'arte" — il rischio era reinventare PCG male.

Il v2, oltre a quei 4 punti chiusi nel v1, aggiunge 7 gap (parte 0)
con focus specifico sull'**anti-slop**: il primo gioco generato deve
dare effetto wow, non sembrare un prodotto AI-slop dei competitor.

---

# PARTE B — Riferimenti VERIFICATI

(Sezione invariata dal v1 — vedi `GAME_REASONING_ENGINE_BLUEPRINT_v1.md`
parte B per le tabelle complete dei 20+ paper, 8+ repos, 17
competitor. Riportato qui solo il sottoinsieme rilevante per il v2.)

## B.1 Top-15 paper canonici da incorporare

| Item | Autore | Anno | Link | Ruolo |
|---|---|---|---|---|
| Voyager | Wang G. | 2023 | arXiv:2305.16291 | Skill memory pattern |
| Generative Agents | Park J.S. | 2023 | arXiv:2304.03442 | Memory Stream / Reflection |
| MetaGPT | Hong S. | 2023 | arXiv:2308.00352 | SOPs handoff |
| ChatDev | Qian C. | 2023 | arXiv:2307.07924 | Chat Chain sequencing |
| Tree of Thoughts | Yao S. | 2023 | arXiv:2305.10601 | Reasoning Design Planner |
| Reflexion | Shinn N. | 2023 | arXiv:2303.11366 | Loop Evaluation Agent |
| Self-Refine | Madaan A. | 2023 | arXiv:2303.17651 | Dialog self-correct |
| Cradle | Tan W. | 2024 | arXiv:2403.03186 | Screen-based QA |
| CAMEL | Li G. | 2023 | arXiv:2303.17760 | Role-play multi-agent |
| AgentVerse | Chen W. | 2023 | arXiv:2308.10848 | Parallel exec |
| Self-Discover | Zhou P. | 2024 | arXiv:2402.03620 | Reasoning composition |
| MT-Bench LLM-judge | Zheng L. | 2023 | arXiv:2306.05685 | Eval pattern |
| MarioGPT | Sudhakaran S. | 2023 | arXiv:2302.05981 | Text→Level cold start |
| LLM+Games Survey | Gallotta R. + Liapis A. | 2024 | arXiv:2402.18659 | Survey area |
| EDPCG | Yannakakis G./Togelius J. | 2011 | yannakakis.net | Stress curve formalization |

## B.2 PCG canonici (mappati ai moduli)

- ASP-PCG (Smith G./Mateas M. 2011, IEEE TCIAIG) → Consistency Manager
- WFC discriminativo (Karth I. 2019) → Consistency Manager long-range
- Mission/Space generation (Dormans J. 2010-2011) → Design Planner
- Tanagra (Smith G./Whitehead J./Mateas M. 2010, FDG) → Consistency check
- Mixed-Initiative Co-Creativity (Yannakakis/Liapis 2014) → Intent Interpreter
- Sentient Sketchbook (Liapis 2013) → Evaluation Agent
- Sonancia (Lopes 2015) → Balance Controller audio pacing
- Booth GDC 2009 L4D AI Director → Balance Controller stress rules
- Mario PCG metrics (Horn 2014) → Evaluation Agent
- Caves of Qud history (Grinblat GDC 2018) → Design Planner generate-then-justify
- Dwarf Fortress (Adams) → Consistency Manager separazione macro/micro

### B.2.bis — DOI verificati (Fase 2 Categoria 1, 2026-05-24, via DBLP)

- **ASP-PCG**: Smith A.M. & Mateas M. 2011, "Answer Set Programming
  for Procedural Content Generation: A Design Space Approach", IEEE
  TCIAIG vol.3 n.3 pp.187-200, **DOI 10.1109/TCIAIG.2011.2158545** ✓
- **Sentient Sketchbook**: Liapis A., Yannakakis G.N., Togelius J.
  2013, "Sentient Sketchbook: Computer-aided game level authoring",
  **FDG 2013 pp.213-220** ✓ (NB: il DOI ACM 10.1145/2103833 dato dal
  report Gemini round 2 era ERRATO — confermato sospetto della
  review v2. Citare il venue FDG 2013, non quel DOI.)

## B.3 Repos / librerie operative

| Repo | Linguaggio | Stelle | Licenza | Uso |
|---|---|---|---|---|
| stanfordnlp/dspy | Python | molto attivo | MIT | Game Plan compilation |
| BorisTheBrave/DeBroglie | C# | 513 | MIT | `tilemap_populate` |
| galaxykate/tracery | JS | 2.2k | Apache-2.0 | Lore pre-LLM |
| increpare/PuzzleScript | JS | 1.1k | MIT | DSL ref. per 2D |
| ganelson/inform | C/CWeb | 1.6k | Artistic-2.0 | DSL ref. per IF/VN |
| dottxt-ai/outlines | Python | 13.9k | Apache-2.0 | JSON enforce |
| mxgmn/WaveFunctionCollapse | C# | 25k | MIT | WFC riferimento |
| Potassco/clingo | C++/Python | ~700 | MIT | ASP solver |

## B.4 Competitor (17 analizzati) — vedi v1 parte B.4 per tabella completa

Pattern competitivo: nessun competitor copre contemporaneamente
(a) multi-engine export, (b) game reasoning sistemico, (c) tier
indie/free, (d) asset library integrata, (e) playtest pre-rilascio.

---

# PARTE C — Schema dati Game Plan (esteso v2)

Estensione del v1: aggiunti `style_pack`, `template_origin`,
`aesthetic_coherence_metrics`, e tipi più granulari per supportare
l'iterazione via diff (parte L).

```ts
type GamePlan = {
  // === Metadata ===
  meta: {
    genre: GenreEnum,
    sub_genre: SubGenreEnum,
    target_engine: EngineEnum,        // 1 degli 8 day-1
    target_duration_minutes: number,
    audience: AudienceEnum,
    difficulty: DifficultyCurve,
    template_origin: TemplateId | null,   // NEW: quale genre template ha fatto da seed
    style_pack: StylePackId | null,       // NEW: quale style pack è attivo
    creator_id: UserId,
    plan_version: number,                 // NEW: monotonico, per diff/audit
    created_at: ISO8601,
    updated_at: ISO8601,
  },

  // === Core loop ===
  core_loop: {
    primary_actions: ActionEnum[],
    secondary_actions: ActionEnum[],
    reward_cycle: RewardPattern,
    risk_reward: {
      death_penalty: PenaltyEnum,
      recovery_mechanic: RecoveryEnum,
    },
  },

  // === World graph (zone + edges + gating) ===
  world_graph: {
    zones: Zone[],
    edges: Edge[],
    soft_lock_invariants: ASPClause[],    // verificabili via clingo
  },

  // === Pacing (curva di tensione + regole director) ===
  pacing: {
    target_curve: Float[],                // sample EDPCG sulla durata
    stress_metrics: StressDef,            // come misurare lo stress emergente
    director_rules: DirectorRule[],       // regole L4D-style formalizzate
  },

  // === Aesthetics (NEW: ora tipato e validabile) ===
  aesthetics: {
    style_pack_ref: StylePackId,           // pointer al catalog
    palette: HexColor[],                   // ereditato dal pack o overridden
    palette_overrides: HexColor[] | null,  // se utente personalizza
    resolution: Vec2,
    music_mood: MoodEnum,
    sfx_style: SfxStyleEnum,
    post_fx: PostFXProfile,                // CRT, scanlines, bloom, etc.
    lora_hints: string[],                  // per SDXL/FLUX
    controlnet_refs: AssetId[],            // immagini reference
    coherence_score: number | null,        // riempito da D.3 dopo validation
  },

  // === Rules numeriche (validabili via ASP/property-test) ===
  rules: {
    player_hp_range: [number, number],
    enemy_damage_range: [number, number],
    boss_phases: { min: number, max: number },
    max_simultaneous_enemies: Record<ZoneId, number>,
    checkpoint_frequency: number,
    economy: EconomyRules | null,
    progression: ProgressionRules | null,
  },

  // === Invariants globali (no soft-lock, coerenza narrativa) ===
  invariants: GlobalInvariant[],

  // === Asset bindings (NEW: link a CC0 risolti dall'Asset Resolver) ===
  asset_bindings: {
    sprites: Record<EntityId, AssetBinding>,
    tilesets: Record<ZoneId, AssetBinding>,
    audio_tracks: Record<MoodTrigger, AssetBinding>,
    sfx: Record<EventType, AssetBinding>,
    models_3d: Record<EntityId, AssetBinding> | null,
  },

  // === Tool DAG (NEW: l'ordine delle chiamate del D.5) ===
  execution_dag: ToolCallNode[],
}

type AssetBinding =
  | { source: 'cc0_library', asset_id: AssetId, license: LicenseEnum }
  | { source: 'generated', tool: ToolId, prompt: string, seed: number }
  | { source: 'user_upload', user_asset_id: UserAssetId }

type ToolCallNode = {
  id: NodeId,
  tool: ToolId,                            // tra i 48 della Pietra
  inputs: Record<string, NodeId | Value>,
  depends_on: NodeId[],
  output_artifact: ArtifactId | null,
  status: 'pending' | 'running' | 'done' | 'failed',
  cost_usd: number | null,
  retries: number,
}

type StylePackId = string                  // ref. al catalog J.3
type TemplateId = string                   // ref. al catalog N.3
type ASPClause = string                    // sintassi clingo
type DifficultyCurve = Float[]             // sample temporali normalizzati
```

**Differenze chiave vs v1**:
- `style_pack` + `template_origin` + `plan_version` come campi
  audit/explainability (Pietra §8.10).
- `aesthetics` ora ha `style_pack_ref`, `lora_hints`,
  `controlnet_refs`, `coherence_score`.
- `asset_bindings` esplicito → il D.5 sa quale asset CC0 usare vs
  quando generare AI.
- `execution_dag` esplicito → il D.5 produce un grafo
  visualizzabile (Studio Mode, parte P).

---

# PARTE D — I 6 moduli (estesi v2)

I 6 moduli del v1 restano. Ogni modulo è esteso con gli step
introdotti dai 7 gap. Le sezioni complete della logica sono in
J/K/L/M/N/O/P; qui solo l'integrazione.

## D.1 Intent Interpreter (esteso)

**Compito v1**: brief utente → Game Plan v0.
**Estensione v2**:
1. (NEW) **Template selection**: scelto il `target_engine` e la
   `genre`, propone il `template_origin` più affine dal catalog N.3.
2. (NEW) **Style Pack inference**: dal brief + ev. concept art
   uploadata, sceglie/propone uno `style_pack` dal catalog J.3.
3. Mixed-Initiative (Yannakakis 2014): se brief sotto soglia di
   chiarezza, propone varianti invece di chiedere chiarimenti
   seriali.
4. DSPy signature `BriefToGamePlanV0` con Outlines per JSON enforce.

**Output**: Game Plan v0 con tutti i campi `meta` riempiti +
`template_origin` non-null + `style_pack` non-null.

**Cost target**: ≤ $0.05 (cache del template + DeepSeek per il
delta).

## D.2 Design Planner (esteso)

**Compito v1**: Game Plan v0 → world_graph + pacing + rules.
**Estensione v2**:
1. (NEW) **Baseline-then-diff**: parte dal `world_graph` del
   `template_origin` (catalog N.3), non da zero. Genera solo il
   *delta* personalizzato.
2. **Dormans mission/space** (2011): scheletro confermato dal
   template, dettagli generati LLM.
3. **Tracery** per lore/nomi pre-LLM.
4. **Tree of Thoughts** per N varianti di world_graph, valutate da
   metriche, miglior tenuta.
5. **AgentVerse** parallel: combat designer + economy designer +
   narrative designer.
6. (NEW) **D.2-Refine variant**: accetta `(GamePlan,
   NaturalLanguageEdit) → GamePlanPatch` per micro-edit (parte L).

## D.3 Consistency Manager (esteso)

**Compito v1**: ASP validation + Reflexion loop.
**Estensione v2**:
1. (NEW) **Aesthetic Coherence Validator**: verifica che
   `asset_bindings` siano coerenti con `style_pack` (palette, art
   style, resolution). Sotto soglia → reject.
2. ASP via clingo sui `soft_lock_invariants` + `invariants` globali.
3. PuzzleScript headless per puzzle 2D inclusi.
4. Reflexion loop al D.2 se UNSAT.

## D.4 Balance Controller (invariato dal v1)

EDPCG + property-test su Hypothesis + AI Director rules formalizzate.

## D.5 Execution Orchestrator (esteso)

**Compito v1**: Game Plan finale → tool calls → progetto engine.
**Estensione v2**:
1. (NEW) **Asset Resolver step**: per ogni asset richiesto, interroga
   l'`asset_library_index` (parte K). Se match ≥ soglia → usa CC0.
   Altrimenti → tool generativo.
2. (NEW) **RAG Decompose-then-Retrieve** (parte O): prima di
   `code_gen_*`, decompone task + query `code_knowledge` per
   contesto.
3. MetaGPT SOPs + ChatDev Chain.
4. DeBroglie WFC per `tilemap_populate`.
5. CAMEL role-play per dialoghi NPC.
6. Voyager episodic memory in Supabase.
7. (NEW) **DAG persistito**: ogni tool call salvata come
   `ToolCallNode` per audit + ricostruzione Studio Mode (parte P).
8. (NEW) **Incremental materialization**: se è un
   `GamePlanPatch`, ri-esegue SOLO i nodi del DAG che dipendono dai
   campi modificati.

## D.6 Evaluation Agent (esteso)

**Compito v1**: smoke test + judge LLM.
**Estensione v2**:
1. Cradle screen understanding (Tan 2024) — invariato.
2. PCG metrics Horn 2014 — invariato.
3. MT-Bench judge — invariato.
4. (NEW) **Playtester Agent** (parte M): N=10 playthrough via
   agenti LLM (Voyager + CAMEL pattern), raccolta stress curve
   empirica, confronto con `pacing.target_curve`.
5. (NEW) **Auto-tuning**: se discrepanza > soglia, Reflexion loop
   mirato su D.4.
6. Reflexion verso D.2 se evaluation < soglia.

---

# PARTE E — Architettura tecnica (aggiornata v2)

```
┌──────────────────────────────────────────────────────────────────┐
│  Hermes Agent (TypeScript in Trigger.dev)                        │
│  - short-term context (RAM)                                      │
│  - long-term user prefs (Supabase user_preferences)              │
│  - episodic skill memory (Supabase episodic_skills)              │
└──────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│  Game Reasoning Engine                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐         │
│  │ D.1 Intent   │→ │ D.2 Design   │→ │ D.3 Consist.   │         │
│  │ Interpreter  │  │ Planner      │  │ Manager (ASP)  │         │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────┘         │
│         │ DSPy            │ Dormans            │ clingo          │
│         │ Tracery         │ ToT/AgentVerse     │ Reflexion       │
│         │                 │                    │ AesthCohere.    │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌────────▼───────┐         │
│  │ D.4 Balance  │→ │ D.5 Exec.    │→ │ D.6 Evaluation │         │
│  │ Controller   │  │ Orchestr.    │  │ Agent          │         │
│  └──────────────┘  └──┬───────────┘  └─────┬──────────┘         │
│        EDPCG          │ MetaGPT SOPs        │ Cradle              │
│        AI Director    │ DeBroglie           │ MT-Bench judge      │
│        Sonancia       │ Voyager mem         │ Playtester Agent    │
│        Property-test  │ Asset Resolver      │ Ropossum solver     │
│                       │ RAG Retrieve        │                     │
└────────────────────────┼─────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Style Pack   │ │ Genre Templ. │ │ KB RAG       │
│ Library (30) │ │ Catalog (14) │ │ code_knowl.  │
│ Parte J.3    │ │ Parte N.3    │ │ 7548 chunks  │
└──────────────┘ └──────────────┘ └──────────────┘
        │                                 │
        ▼                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  Asset Library Index (Parte K) — pgvector                        │
│  Kenney + OpenGameArt + Quaternius + KayKit + Poly Haven         │
│  + Freesound + CraftPix + Cinevva + GameAssets.com (~100K assets)│
└──────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│  48 specialist tools (code_gen, sprite_gen, audio_gen, ...)      │
│  → file di progetto per 1 degli 8 engine target                  │
│  → Asset Resolver decide se usare CC0 o generare AI              │
│  → KB RAG retrieval chiamato PRIMA di ogni code_gen              │
└──────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│  Frontend (Tre Modalità — Parte P)                               │
│  Creator Mode (chat) ↔ Studio Mode (canvas) ↔ Code Mode (IDE)    │
│  Tutti consumano lo stesso GamePlan + ToolCallNode[]             │
└──────────────────────────────────────────────────────────────────┘
```

---

# PARTE F — Vantaggio competitivo (esteso v2)

Confronto con i 17 competitor analizzati nel v1 + nuovi assi nati
dai 7 gap chiusi.

| Asse | Game Studio AI | Best competitor su quell'asse |
|---|---|---|
| Multi-engine code export | 8 engine | Rosebud (2-3) |
| Game Reasoning sistemico | Sì | Nessuno |
| KB RAG verificata per engine | 7548 chunk, 0 GPL | Nessuno |
| Owned-by-developer code | .zip export | Inworld no |
| Tier indie ($0-30/mese) | Sì | Promethean no |
| Asset gen multi-modale | 8 dipartimenti | Scenario solo art |
| **Style Pack pre-curati** (Gap 1) | **30 pack** | **Nessuno** |
| **Asset Library CC0 indicizzata** (Gap 2) | **100K+ asset** | Scenario LoRA proprie |
| **Game Plan Diff** (Gap 3) | **JSON-Patch RFC 6902** | **Nessuno** |
| **Playtest Simulator** (Gap 4) | **N=10 LLM playthrough** | **Nessuno** |
| **Genre Templates day-1** (Gap 5) | **14 generi pre-modellati** | **Nessuno** |
| **RAG decompose-then-retrieve** (Gap 6) | **Genre-aware ranking** | **Nessuno** |
| **Tre Modalità Creator/Studio/Code** (Gap 7) | **React Flow su Game Plan** | Vercel v0 (1 modalità) |

I 4 moat reali del v1 restano, più 3 nuovi del v2:

5. **Anti-slop pipeline**: ogni gioco al primo prompt parte da
   Genre Template + Style Pack + Asset Library CC0 + RAG. Non
   prompt-only.
6. **Iterazione incrementale via Diff**: nessun competitor offre
   git-for-game-design.
7. **Playtest pre-rilascio**: nessun competitor valida giocabilità
   prima della consegna.

---

# PARTE G — (v1 mantained — "Come aumentare il gap")

Lo spostiamo sotto sezione finale Q (rianalisi e gap residui), dopo
le 7 nuove sezioni gap-fixing.

---

# PARTE H — Roadmap di implementazione (aggiornata v2)

Settimanale, 14 settimane invece di 10 del v1.

| Sett. | Modulo | Cosa |
|---|---|---|
| 1 | Schema | Game Plan v2 tipato (TS + JSON Schema) con tutti i 7 gap. Test su 3 brief. |
| 2 | Catalog | Migrazione Supabase per `style_packs`, `genre_templates`, `asset_library_index`. Seed dei 30+14 dai cataloghi J.3/N.3 di questo doc. |
| 3 | D.1 | Intent Interpreter con DSPy + template/style selection. |
| 4 | D.2 | Design Planner con baseline-then-diff + Dormans grammar. |
| 5 | D.3 | Consistency Manager con clingo + Aesthetic Coherence Validator. |
| 6 | D.4 | Balance Controller con property-test. |
| 7-8 | D.5 | Execution Orchestrator + Asset Resolver + RAG retrieval + DeBroglie WFC. |
| 9 | D.6 | Evaluation Agent + Playtester Agent. |
| 10 | Diff | Game Plan Diff + Incremental Materialization. |
| 11 | Frontend | Creator Mode (chat) + integration backend. |
| 12 | Studio Mode | React Flow canvas su Game Plan. |
| 13 | Code Mode | Editor + diff viewer + AI-assist. |
| 14 | End-to-end | Test su 3 brief × 3 engine × 3 style pack. Check anti-slop. |

---

# PARTE I — Cosa serve confermare prima di iniziare

(Spostato sotto sezione finale Q.)

---
---

# PARTE J — AESTHETIC ENGINE (Gap 1)

## J.1 Il problema

La Pietra v4 §4.1 e §11-quater menzionano "palette dark mode +
accenti per dipartimento" e "style analyzer" come tool, ma nel
blueprint v1 il campo `aesthetics` del Game Plan era una scatola
vuota. Senza algoritmo concreto, l'LLM avrebbe inventato palette ad
hoc → output incoerente, AI-slop estetico.

## J.2 La soluzione — Style Pack

Uno **Style Pack** è un preset estetico tipato che vincola e guida
tutti i tool di generazione visiva, audio e UI.

```ts
type StylePack = {
  id: StylePackId,
  name: string,
  display_name: string,
  description: string,

  // === Visual ===
  palette: HexColor[],                    // 5-9 colori in oklch
  palette_role: Record<PaletteRoleEnum, HexColor>,  // primary, accent, danger, ...
  resolution_suggested: Vec2,             // es. 320x180 per pixel-art

  // === SDXL/FLUX hints ===
  lora_recommended: LoRARef[],            // riferimenti pubblici verificati
  prompt_modifiers: string,               // appended al prompt di sprite_gen
  negative_prompt: string,                // anti-slop guardrail
  controlnet_refs: AssetId[] | null,      // immagini reference

  // === Post FX (shader profile) ===
  post_fx: PostFXProfile,                 // CRT, scanlines, bloom, chromatic, ...

  // === Typography ===
  font_family_ui: FontRef,
  font_family_dialog: FontRef | null,

  // === Asset library affinity ===
  asset_library_filters: {
    kenney_packs: string[],               // es. ["1-Bit Pack", "Tiny Town"]
    quaternius: string[],
    opengameart_tags: string[],
    poly_haven_categories: string[],
  },

  // === Audio mood affinity ===
  music_mood: MoodEnum,
  sfx_style: SfxStyleEnum,

  // === Reference games (concept "vibe" target) ===
  reference_games: ShippedGameRef[],      // 3-5 giochi shipped
  reference_artists: ArtistRef[] | null,  // se rilevante

  // === Compatibility ===
  compatible_genres: GenreEnum[],
  compatible_engines: EngineEnum[],
  default_for: { genre: GenreEnum, sub_genre: SubGenreEnum }[] | null,
}
```

## J.3 Style Pack Library — i 30 pack day-1

Pack ordinati per gruppi tematici. Ogni pack ha:
- nome canonico, descrizione 1 frase
- 5-7 colori esempio (verranno raffinati in raccolta Fase 2)
- 3 giochi shipped reference
- LoRA candidati (da verificare in Fase 2 su Civitai/HuggingFace)
- generi compatibili

### Gruppo A — Pixel art 2D (8 pack)

**A01 — pixel-art-dark**
- Pixel art a basso bit con palette desaturata e contrasti forti.
- Reference: Hyper Light Drifter, Death's Door, Iconoclasts.
- LoRA candidati: `pixel-art-xl`, `dark-pixel-art-v2`.
- Generi: Metroidvania, Action 2D, RPG top-down, Roguelike.
- Engine: Godot, MonoGame, LÖVE, Phaser.

**A02 — pixel-art-vibrant**
- Pixel art saturata, colori vivaci, mood positivo/cozy.
- Reference: Stardew Valley, Eastward, Chicory.
- Generi: Farming, Adventure, Puzzle, JRPG.
- Engine: MonoGame, Godot, Defold.

**A03 — pixel-art-1bit**
- Solo 2 colori (B/N o B/N invertito), tributo Game Boy.
- Reference: Downwell, Minit, Return of the Obra Dinn.
- Generi: Arcade, Roguelite, Mystery.
- Engine: LÖVE, Godot, Defold.

**A04 — pixel-art-gbc**
- Tributo Game Boy Color, palette 4 toni × 4 paletes.
- Reference: Link's Awakening DX, Pokémon Crystal.
- Generi: JRPG, Adventure, Action 2D.
- Engine: Godot, MonoGame.

**A05 — pixel-art-snes-jrpg**
- Stile 16-bit fine anni '90, JRPG Square classico.
- Reference: Chrono Trigger, Secret of Mana, Final Fantasy VI.
- Generi: JRPG, Visual Novel ibrida.
- Engine: MonoGame, Godot.

**A06 — pixel-art-cyberpunk**
- Pixel art con neon, magenta/ciano, ambiente urbano notturno.
- Reference: Va-11 Hall-A, The Red Strings Club, Coffee Talk.
- Generi: Visual Novel, Narrative.
- Engine: Ren'Py, Godot.

**A07 — pixel-art-horror**
- Palette monocroma scura + accenti rosso/verde fosforescente.
- Reference: Lone Survivor, Faith, World of Horror.
- Generi: Horror, Mystery, Survival.
- Engine: Godot, MonoGame, Ren'Py.

**A08 — pixel-art-arcade-neon**
- Pixel art alto-contrasto stile arcade anni '80.
- Reference: Hotline Miami, Nuclear Throne, Furi.
- Generi: Twin-stick shooter, Bullet hell, Arcade.
- Engine: Godot, LÖVE, Phaser.

### Gruppo B — Stilizzato 2D non-pixel (6 pack)

**B01 — flat-cute-vector**
- Vector art piatto, forme arrotondate, palette pastello.
- Reference: Monument Valley, Alto's Adventure, Donut County.
- Generi: Puzzle, Casual, Endless runner.
- Engine: Defold, Phaser, Godot.

**B02 — hand-drawn-watercolor**
- Look acquerello/dipinto a mano, sfumature.
- Reference: GRIS, Hollow Knight, Ori and the Blind Forest.
- Generi: Metroidvania, Platformer narrativo, Adventure.
- Engine: Godot, MonoGame.

**B03 — comic-book-bold**
- Linee nere spesse, halftones, sfondi flat.
- Reference: Borderlands (2D port), Cuphead UI.
- Generi: Action 2D, Twin-stick, Beat'em up.
- Engine: Godot, MonoGame.

**B04 — anime-vn-soft**
- Sfondi morbidi, light bloom, character sprite anime-style.
- Reference: Doki Doki Literature Club, Va-11 Hall-A (lato VN).
- Generi: Visual Novel, Dating Sim, Narrative.
- Engine: Ren'Py.

**B05 — noir-monochrome**
- Bianco/nero con accento singolo, ombre dure, contrasto cinema noir.
- Reference: Genesis Noir, Mad Father, Sin City.
- Generi: Mystery, Detective, Horror leggero.
- Engine: Ren'Py, Godot.

**B06 — paper-craft-collage**
- Look ritagliato a mano, texture carta, ombre sotto i livelli.
- Reference: Tearaway, Paper Mario, Yoshi's Crafted World.
- Generi: Adventure, Platformer, Puzzle.
- Engine: Godot, Three.js.

### Gruppo C — 3D stilizzato (8 pack)

**C01 — low-poly-cute**
- Low-poly colorato, no texture, flat shading.
- Reference: A Short Hike, Untitled Goose Game, Lake.
- Generi: Adventure, Walking sim, Cozy.
- Engine: Godot, Three.js, Stride.
- Asset affinity: Quaternius Ultimate Pack, KayKit Adventurers.

**C02 — voxel-cute**
- Voxel art Minecraft-like ma palette curata e proporzioni cartoon.
- Reference: Hytale, Cube World, Nimble Quest.
- Generi: Sandbox, Adventure, Survival.
- Engine: Three.js, Godot.

**C03 — toon-shaded-anime**
- Cel-shading anime, contorno nero, ombre dure a due/tre toni.
- Reference: Genshin Impact, Ni no Kuni, Borderlands.
- Generi: Action RPG, JRPG 3D.
- Engine: Stride, Three.js (limit), Godot.

**C04 — psx-retro-3d**
- Stile PlayStation 1: texture sgranate, vertex jitter, fog.
- Reference: Crow Country, Signalis (lato 3D), Bloodborne PSX.
- Generi: Horror, Survival, Adventure.
- Engine: Godot, Three.js, Stride.

**C05 — n64-soft-3d**
- Stile Nintendo 64: poligoni morbidi, texture filtrate, palette calda.
- Reference: Super Mario 64, Banjo-Kazooie.
- Generi: Platformer 3D, Collectathon.
- Engine: Godot, Stride.

**C06 — sci-fi-clean**
- 3D pulito, materiali metallici/emissive, palette bianco/blu/arancio.
- Reference: Tron, Mirror's Edge, Lightmatter.
- Generi: First-person puzzle, Sci-fi narrative.
- Engine: Stride, Three.js, Godot.

**C07 — fantasy-stylized**
- 3D stilizzato fantasy, palette saturata, prop dettagliati.
- Reference: Genshin Impact, Tunic, World of Warcraft.
- Generi: Action RPG, Adventure.
- Engine: Stride, Godot.
- Asset affinity: KayKit Dungeon, KayKit Adventurers.

**C08 — abstract-geometric**
- Forme geometriche pure, gradient, ambient luminoso.
- Reference: Antichamber, Manifold Garden, Glitchspace.
- Generi: First-person puzzle, Abstract.
- Engine: Three.js, Stride, Godot.

### Gruppo D — Sperimentale/nicchia (8 pack)

**D01 — ascii-roguelike**
- Solo caratteri ASCII, sprite emulati con caratteri.
- Reference: Dwarf Fortress, NetHack, Caves of Qud.
- Generi: Roguelike, Mystery, Simulation.
- Engine: LÖVE, Godot, Defold.

**D02 — hand-drawn-rotoscope**
- Animazione rotoscope frame-by-frame.
- Reference: Cuphead, Another World.
- Generi: Action 2D, Boss rush, Cinematic adventure.
- Engine: Godot, MonoGame.

**D03 — ms-paint-childlike**
- Stile MS Paint deliberatamente ingenuo.
- Reference: Petscop, Frog Fractions.
- Generi: Horror sperimentale, Meme game.
- Engine: Phaser, Godot, Ren'Py.

**D04 — gritty-realistic-2d**
- Pixel art ad altissima risoluzione con tratti realistici.
- Reference: Ruined King, Disco Elysium (lato art), Pathologic 2.
- Generi: CRPG, Dark fantasy.
- Engine: MonoGame, Godot.

**D05 — visual-novel-photographic**
- Fondi fotografici manipolati + sprite anime.
- Reference: Steins;Gate, Famicom Detective Club.
- Generi: Visual Novel, Detective.
- Engine: Ren'Py.

**D06 — minimalist-mono**
- Singolo colore + bianco, forme essenziali.
- Reference: Limbo, Thomas Was Alone, A Dark Room.
- Generi: Puzzle platformer, Narrative, Idle.
- Engine: Godot, Phaser, LÖVE.

**D07 — synthwave-80s**
- Neon viola/rosa/ciano, griglia prospettica, sole sfumato.
- Reference: Hotline Miami 2, Far Cry 3 Blood Dragon, GRIDD.
- Generi: Twin-stick, Racing, Rhythm.
- Engine: Godot, Three.js, Phaser.

**D08 — dark-fantasy-painted**
- Pittura ad olio digitale, palette mortifera, stile Berserk.
- Reference: Darkest Dungeon, Blasphemous, Salt and Sanctuary.
- Generi: Dark RPG, Soulslike, Roguelite gotico.
- Engine: MonoGame, Godot.

## J.4 Style Inference Algorithm

Step di D.1 dopo aver parsato il brief:

```python
def infer_style_pack(brief: str,
                     uploaded_concept_art: list[Image] | None,
                     uploaded_music: Audio | None) -> StylePackId | StylePackDraft:
    candidates = []

    # 1. Keyword matching su brief
    for pack in STYLE_PACK_LIBRARY:
        score = lexical_similarity(brief, pack.description + pack.reference_games)
        if score > 0.3: candidates.append((pack.id, score))

    # 2. Vision analysis su concept art (Claude Vision)
    if uploaded_concept_art:
        vision_result = claude_vision_analyze(uploaded_concept_art)
        # vision_result = { palette_hex: [...], detected_style: str, mood: str }
        candidates += rank_packs_by_visual_match(vision_result, STYLE_PACK_LIBRARY)

    # 3. Audio mood analysis
    if uploaded_music:
        audio_features = librosa_extract(uploaded_music)
        mood = infer_mood(audio_features)  # MoodEnum
        candidates += rank_packs_by_audio_mood(mood, STYLE_PACK_LIBRARY)

    # 4. Genre default
    detected_genre = detect_genre(brief)
    if detected_genre:
        default_pack = get_default_pack_for_genre(detected_genre)
        if default_pack: candidates.append((default_pack.id, 0.5))

    # 5. Rank + present top-3 to user
    top3 = rerank_and_top(candidates, k=3)
    return propose_to_user(top3)  # mixed-initiative
```

## J.5 Aesthetic Coherence Validator (D.3 step)

Dopo che D.5 ha generato sprite/UI/audio:

```python
def validate_coherence(game_plan: GamePlan, generated_assets: list[Asset]) -> float:
    pack = STYLE_PACK_LIBRARY[game_plan.aesthetics.style_pack_ref]

    # 1. Palette adherence
    palette_score = palette_match(generated_assets.colors, pack.palette)

    # 2. Style classifier (CLIP-based)
    style_score = clip_similarity(generated_assets.images, pack.reference_games_imgs)

    # 3. Audio mood match
    audio_score = audio_mood_match(generated_assets.audio, pack.music_mood)

    # 4. Resolution coherence
    res_score = check_resolution_uniformity(generated_assets, pack.resolution_suggested)

    coherence = weighted_average([palette_score, style_score, audio_score, res_score])

    if coherence < 0.75:
        return reject_with_reasoning(coherence)  # → Reflexion loop
    return coherence
```

---

# PARTE K — ASSET LIBRARY INTEGRATION (Gap 2)

## K.1 Il problema

La Pietra §11-octies dichiara "Millions of ready-to-use assets" come
selling point centrale. Il blueprint v1 ignorava completamente:
ogni asset era trattato come "genera con AI". Costo alto, varianza
estetica alta, AI-slop garantito.

## K.2 Le 11 librerie CC0 indicizzate

| Libreria | Tipo | Asset stim. | Licenza |
|---|---|---|---|
| Kenney.nl | 2D + 3D + audio + UI | 40,000+ | CC0 |
| OpenGameArt.org | 2D + 3D + audio | 50,000+ | misti (filtro CC0/CC-BY) |
| Quaternius | 3D low-poly | 5,000+ | CC0 |
| KayKit (Kay Lousberg) | 3D low-poly stilizzato | 1,500+ | CC0 |
| Poly Haven | 3D + HDRI + texture | 3,000+ | CC0 |
| Freesound.org | SFX | 500,000+ | misti |
| OpenGameArt Audio | BGM + SFX | 10,000+ | misti |
| Kenney Audio | SFX + music | 5,000+ | CC0 |
| CraftPix Freebies | 2D pack pro | 1,000+ | free commercial |
| itch.io free assets | 2D + audio | 10,000+ | misti |
| GameAssets.com | CC0 mix | 60,000+ | CC0 |

Totale stimato: **~600,000 asset** (con duplicati). Dopo
deduplica e filtro licenza pulita: **~150,000-200,000 asset**
utilizzabili senza preoccupazioni.

## K.3 Schema Supabase `asset_library_index`

```sql
CREATE TABLE asset_library_index (
  id UUID PRIMARY KEY,
  source_library TEXT NOT NULL,           -- 'kenney', 'opengameart', ...
  source_url TEXT NOT NULL,
  license SPDX_LICENSE NOT NULL,
  license_verified_at TIMESTAMP NOT NULL,
  asset_type asset_type_enum NOT NULL,    -- sprite, tileset, model_3d, audio, sfx, ui, ...
  file_format TEXT,                       -- 'png', 'gltf', 'ogg', ...
  file_size_bytes INTEGER,
  width INTEGER, height INTEGER,          -- per immagini
  duration_seconds NUMERIC,               -- per audio
  triangle_count INTEGER,                 -- per 3D
  tags TEXT[],
  style_pack_compat TEXT[],               -- StylePackId con cui matcha
  genre_tags TEXT[],
  engine_compat TEXT[],
  category TEXT,                          -- 'character', 'enemy', 'prop', 'tile', ...
  semantic_description TEXT,              -- riempito da LLM al boot
  embedding VECTOR(1536),                 -- text-embedding-3-small
  thumbnail_url TEXT,
  download_url TEXT,
  attribution_text TEXT,                  -- se CC-BY
  quality_score NUMERIC,                  -- 0-100, riempito da indicizzazione
  usage_count INTEGER DEFAULT 0,
  success_score NUMERIC                   -- avg coherence quando usato
);

CREATE INDEX ON asset_library_index USING ivfflat (embedding vector_cosine_ops);
```

## K.4 Pipeline di indicizzazione

Stessa shape della Phase 1 RAG pipeline (`scripts/ingestion/`) ma
per asset:

```
01_scrape_assets.py  → scarica metadati da ogni libreria
02_filter_assets.py  → verifica licenza, dimensione, formato
03_classify_assets.py → LLM tag (style, genre, category) + embedding
04_dedupe_assets.py  → similarità per evitare duplicati cross-library
05_index_supabase.py → bulk insert in asset_library_index
```

Riutilizziamo `_classify_llm.py` con nuovi prompt strutturati.

## K.5 Asset Resolver Algorithm (D.5 step)

```python
def resolve_asset(request: AssetRequest, game_plan: GamePlan) -> AssetBinding:
    """
    Per ogni richiesta di asset del D.5 Execution Orchestrator:
    - prova prima la libreria CC0
    - se nessun match ≥ soglia → genera con AI
    """
    style_pack = STYLE_PACK_LIBRARY[game_plan.aesthetics.style_pack_ref]
    genre = game_plan.meta.genre
    engine = game_plan.meta.target_engine

    # 1. Query semantica sul library index
    query_embedding = embed_text(request.semantic_description)
    candidates = supabase.rpc('match_assets', {
        'query_embedding': query_embedding,
        'asset_type': request.type,
        'style_pack_compat': style_pack.id,
        'genre_tags': [genre],
        'engine_compat': [engine],
        'match_threshold': 0.78,
        'match_count': 5,
    })

    # 2. Re-rank by quality + success_score
    candidates = rerank(candidates, by=['quality_score', 'success_score'])

    if candidates and candidates[0].score > 0.85:
        return AssetBinding(
            source='cc0_library',
            asset_id=candidates[0].id,
            license=candidates[0].license,
        )

    # 3. Fallback: AI generation con style_pack hints
    return AssetBinding(
        source='generated',
        tool=request.preferred_tool,
        prompt=enrich_prompt(request, style_pack),
        seed=stable_seed(request),
    )
```

## K.6 Hybrid template come default Free tier

Per il Free tier: ogni Game Plan generato preferisce CC0 dove
possibile, AI solo dove necessario (es. character custom).
- Costo medio per gioco: $0.50-1.50 (vs $1.50-5.00 senza library).
- Qualità visiva: superiore (Kenney shipped > AI random).
- Coerenza: garantita dallo style_pack filter.

---

# PARTE L — GAME PLAN DIFF (Gap 3)

## L.1 Il problema

La Pietra §8.7 (micro-edit nel browser) e §8.9 (Game Plan View) e
§8.10 (Explainability) richiedono iterazione click-by-click sul
gioco generato. Il blueprint v1 era monolitico: brief → Game Plan
intero → materializzazione intera. Modificare un boss richiedeva
rigenerare tutto.

## L.2 La soluzione — JSON-Patch su Game Plan

Adottiamo RFC 6902 JSON-Patch come formato di diff sul Game Plan.

```ts
type GamePlanPatch = {
  patch_id: PatchId,
  parent_plan_version: number,
  ops: JsonPatchOp[],                     // RFC 6902
  reason: string,                          // human-readable
  author: 'user' | 'reasoning_engine',
  user_edit_natural_language?: string,    // se da micro-edit
  created_at: ISO8601,
  cost_usd: number,
  audit_signature: string,                 // SHA-256 di (parent_version + ops)
}

type JsonPatchOp =
  | { op: 'add', path: string, value: any }
  | { op: 'remove', path: string }
  | { op: 'replace', path: string, value: any }
  | { op: 'move', from: string, path: string }
  | { op: 'copy', from: string, path: string }
  | { op: 'test', path: string, value: any }
```

## L.3 D.2-Refine: edit naturale → patch

Nuova variant del Design Planner che accetta un comando in linguaggio
naturale e produce un GamePlanPatch.

```python
def refine_game_plan(current: GamePlan, edit: str) -> GamePlanPatch:
    # 1. Localizza i campi del Game Plan che l'edit tocca
    affected_paths = locate_affected_fields(edit, current)
    # es: "rendi il boss 2 più facile" → ['/rules/enemy_damage_range',
    #     '/world_graph/zones[id=boss2]/hp', '/pacing/director_rules[...]']

    # 2. DSPy signature per generare ops mirate
    ops = dspy_module_edit_to_patch(
        current=extract_subtree(current, affected_paths),
        edit=edit,
        rules=current.rules,
    )

    # 3. Valida che il patch sia ASP-consistent (D.3)
    test_plan = apply_patch(current, ops)
    if not consistency_manager.validate(test_plan):
        # Reflexion: ritorna a passo 2 con la critica
        return refine_with_reflexion(current, edit, ops, critique)

    return GamePlanPatch(
        ops=ops,
        parent_plan_version=current.meta.plan_version,
        reason=summarize_intent(edit),
        author='reasoning_engine',
        user_edit_natural_language=edit,
        audit_signature=sha256(...),
    )
```

## L.4 Incremental Materialization (D.5 step)

Dato un patch sul Game Plan, ricalcoliamo SOLO i nodi del
`execution_dag` che dipendono dai campi modificati.

```python
def materialize_patch(plan: GamePlan, patch: GamePlanPatch) -> ProjectDelta:
    # 1. Mappa: campi GamePlan → nodi DAG che li leggono
    field_to_nodes = build_field_dependency_index(plan.execution_dag)

    # 2. Per ogni op del patch, trova nodi affetti
    affected_nodes = set()
    for op in patch.ops:
        affected_nodes |= field_to_nodes[op.path]

    # 3. Cascading: aggiungi anche i discendenti DAG
    affected_nodes = transitive_closure(affected_nodes, plan.execution_dag)

    # 4. Esegui SOLO quei nodi
    new_artifacts = execute_subset(affected_nodes, plan_after=apply_patch(plan, patch))

    return ProjectDelta(
        changed_files=new_artifacts,
        unchanged_files=plan.previous_artifacts - affected_artifacts,
    )
```

Risultato: l'utente clicca "Rendi il boss 2 più facile", il sistema
modifica solo l'AI script del boss e il file del balance config.
Tempo: 5-10s vs 5-10min di rigenerazione totale. Costo: $0.05 vs $2.

## L.5 Audit trail come git

Ogni `GamePlanPatch` è salvato in tabella `game_plan_history`:

```sql
CREATE TABLE game_plan_history (
  patch_id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects,
  parent_plan_version INTEGER,
  new_plan_version INTEGER,
  ops_jsonb JSONB,
  reason TEXT,
  author TEXT,
  user_edit_natural_language TEXT,
  audit_signature TEXT,
  cost_usd NUMERIC,
  created_at TIMESTAMP DEFAULT now()
);
CREATE INDEX ON game_plan_history (project_id, new_plan_version);
```

Permette:
- **Undo/redo** sul Game Plan a livello concettuale
- **Branching alternativo**: "che succede se faccio il boss 2 più
  duro e il boss 3 più facile?"
- **Audit chi/cosa/quando** per esports/competition leagues future

---

# PARTE M — PLAYTEST SIMULATOR (Gap 4)

## M.1 Il problema

La Pietra §7 (QA a 6 livelli) si ferma a smoke test + property test.
Manca il pezzo dove agenti LLM *giocano davvero* il gioco prima
della consegna, accumulando metriche empiriche.

## M.2 La soluzione — Playtester Agent

Pattern composto: Voyager (skill memory) + CAMEL (player simulato) +
Cradle (screen understanding).

```python
class PlaytesterAgent:
    """
    Esegue N=10 playthrough sul build E2B del gioco.
    Cattura stress curve empirica, deaths, completion time, exploration.
    """

    def __init__(self, game_plan: GamePlan, build_url: str):
        self.plan = game_plan
        self.build = build_url
        self.skill_memory = load_skill_memory(game_plan.meta.genre)
        # ↑ pattern Voyager: il sistema ricorda come si giocano
        # platformer, VN, roguelike — riutilizza skill cross-progetto

    async def play_episode(self, persona: PlayerPersona) -> EpisodeLog:
        """
        Un playthrough con una persona definita:
        - casual_explorer: prova tutto, lento
        - speedrunner: prende la via più diretta
        - completionist: cerca tutti i collectible
        - frustrated: abbandona dopo 3 morti consecutive
        """
        episode_log = EpisodeLog()
        state = await self.boot_game()

        while not state.is_terminal():
            # 1. Cradle pattern: capture screenshot + LLM-vision parse
            screenshot = await self.capture()
            state_understanding = await self.parse_state(screenshot)

            # 2. Decide action via persona policy + skill library
            action = self.skill_memory.match(state_understanding, persona)
            if not action:
                # fallback: LLM ragiona da zero
                action = await self.llm_choose_action(state_understanding, persona)

            # 3. Execute, log, update stress estimate
            await self.execute(action)
            stress = self.estimate_stress(state_understanding, action)
            episode_log.append(state_understanding, action, stress)

        return episode_log

    async def run_full_playtest(self) -> PlaytestReport:
        personas = [casual_explorer, speedrunner, completionist, frustrated]
        episodes = []
        for persona in personas * 3:  # 12 episodes totali
            ep = await self.play_episode(persona)
            episodes.append(ep)

        return self.aggregate(episodes)
```

## M.3 Stress curve confronto

```python
def compare_stress_curves(target: list[float],
                          empirical_episodes: list[EpisodeLog]
                         ) -> CurveComparison:
    # Media empirica
    empirical = average_curves([e.stress_over_time for e in empirical_episodes])

    # Allinea per durata normalizzata
    aligned = time_warp_align(target, empirical)

    # RMSE + spot di discrepanza massima
    rmse = root_mean_square(target - aligned.empirical)
    max_gap_at = argmax(abs(target - aligned.empirical))

    return CurveComparison(
        rmse=rmse,
        max_gap_at_t=max_gap_at,
        max_gap_value=abs(target[max_gap_at] - aligned.empirical[max_gap_at]),
        target_curve=target,
        empirical_curve=aligned.empirical,
    )
```

## M.4 Auto-tuning loop

Se RMSE > 0.15 o gap > 0.30 in un punto:

```python
def auto_tune(plan: GamePlan, comparison: CurveComparison) -> GamePlanPatch:
    # Reflexion-style critica
    critique = f"""
    At normalized time t={comparison.max_gap_at_t},
    target stress was {comparison.target_curve[at]:.2f}
    but empirical playtests measured {comparison.empirical_curve[at]:.2f}.
    Identify which game_plan field is responsible and propose a patch.
    """

    # D.4 Balance Controller con critica precisa
    patch = balance_controller.refine_with_critique(plan, critique)
    return patch
```

Il loop converge in 1-2 iterazioni nella maggior parte dei casi.

## M.5 Property-tests formalizzati

(Già nel v1 sez. D.4, qui dichiarato come step automatico del D.6.)

```python
@given(
    boss_hp=st.integers(min_value=plan.rules.boss.hp_min, max_value=plan.rules.boss.hp_max),
    player_dps=st.floats(min_value=plan.rules.player.dps_min, max_value=plan.rules.player.dps_max),
)
def test_boss_fight_lasts_reasonable_time(boss_hp, player_dps):
    duration = boss_hp / player_dps
    assert 15 <= duration <= 180, f"Boss fight {duration}s out of range"
```

Hypothesis genera centinaia di varianti, cattura edge case che il
playtest random non vede.

---

# PARTE N — GENRE TEMPLATES (Gap 5)

## N.1 Il problema

Senza template, ogni Game Plan parte da brief vuoto. L'LLM
inventa il `world_graph`, il `pacing`, le `rules` da zero ogni volta.
Risultato: alta varianza, costo alto, qualità media bassa, AI-slop
quasi garantito per generi che l'LLM non "sente" bene (es. JRPG,
Metroidvania).

## N.2 La soluzione — Genre Template

Uno **Genre Template** è uno scheletro precompilato di Game Plan per
un genere specifico, su un engine specifico. Il D.1 lo usa come
baseline da personalizzare.

```ts
type GenreTemplate = {
  id: TemplateId,
  name: string,
  display_name: string,
  description: string,

  // === Target ===
  genre: GenreEnum,
  sub_genre: SubGenreEnum | null,
  target_engine: EngineEnum,
  alt_engines: EngineEnum[],              // engine alternativi compatibili

  // === Game Plan baseline ===
  baseline_meta: Partial<GamePlanMeta>,
  baseline_core_loop: CoreLoop,
  baseline_world_graph: WorldGraphTemplate,  // 3-5 zone tipo
  baseline_pacing: PacingTemplate,           // curva tipica
  baseline_rules: RulesTemplate,
  baseline_invariants: ASPClause[],

  // === Style affinity ===
  recommended_style_packs: StylePackId[],

  // === Reference games ===
  reference_games: ShippedGameRef[],

  // === OSS code references (per RAG retrieval) ===
  code_template_repos: GithubRef[],         // repo OSS che implementano questo template

  // === Engine-specific notes ===
  engine_specific_hints: Record<EngineEnum, string>,
}
```

## N.3 Genre Template Catalog — i 14 template day-1

Mappati 1:1 con la routing table Pietra §2.5. Ogni template ha:
- engine consigliato + alternativi
- 3 zone tipo con gating
- pacing curve a 5 punti (intro/build/climax/falling/end)
- rules range
- 3 reference games shipped
- 2-3 repo OSS reference

### T01 — Metroidvania Platformer Action ✅ tier wow

- **Engine**: Godot 4 (alt: MonoGame)
- **Style pack default**: A01 pixel-art-dark
- **Zone baseline** (5): cave_intro → forest_mid (dash gate) → ruins_late (double_jump gate) → boss_arena → reward_room
- **Pacing curve**: `[0.2, 0.4, 0.7, 0.9, 0.3]` (rilancio post-boss)
- **Rules**: HP 100-500, DMG 10-50, checkpoint ogni 3-5 stanze, durata run 15-30min
- **Note implementative**: Singleton Autoload per inventory cross-scene, Tilemap con Terrains per collisioni auto, `ResourceLoader.load_threaded_request` per zone, FSM nemici per patrol/chase/attack
- **Reference games**: Hollow Knight, Ori, Iconoclasts
- **Repo OSS verificati (round Fase 2, 2026-05-24)**:
  - [KoBeWi/Metroidvania-System](https://github.com/KoBeWi/Metroidvania-System) — MIT, 1.5k★ — già nel KB, **sopra-pesare**
  - [EladKarni/godot4-2d-platformer-template](https://github.com/EladKarni/godot4-2d-platformer-template) — MIT, coyote+jump-buffer expose
  - detour-adventure-framework — MIT, già nel KB

### T02 — Visual Novel / Dating Sim ✅ tier wow

- **Engine**: Ren'Py
- **Style pack default**: B04 anime-vn-soft (alt: B05 noir, A06 cyberpunk, D05 photographic)
- **Zone baseline** (5): prologo → hub_temporale → good_route (affection ≥50) → bad_route (affection <20) → epilogo
- **Gating**: branch_choice via `if character_affection >= 50` / azioni quotidiane su planner
- **Pacing curve**: `[0.1, 0.3, 0.5, 0.8, 0.2]` (climax letterario)
- **Rules**: affinity 0-100, dialog impact -10/+15, durata route 10-15min, autosave ogni 1-10 blocchi
- **Note implementative**: `default` per variabili rollback-safe, `Composite` per layering sprite, `label` + `jump` per branching, screen statistiche blocca avanzamento, post-processing matrici cromatiche
- **Reference games**: Doki Doki Literature Club, Va-11 Hall-A, Steins;Gate
- **Repo OSS verificati**:
  - [DRincs-Productions/DS-toolkit](https://github.com/DRincs-Productions/DS-toolkit) — MIT, 58★ — già nel KB
  - [remarkablegames/renpy-template](https://github.com/remarkablegames/renpy-template) — MIT, 3★ — GitHub Actions workflow
  - Encyclopaedia framework, BobcStats — già nel KB

### T03 — Mobile Casual Puzzle ⚠️ poco arricchito (compensa via britzl)

- **Engine**: Defold (alt: Phaser 3 per web)
- **Style pack default**: B01 flat-cute-vector
- **Zone baseline**: 50-100 livelli grid 3x3 → 5x5 → 7x7 → boss grid, sblocco progressivo via stelle
- **Gating**: validazione punteggio / completamento puzzle precedente / 15 stelle per boss
- **Pacing curve**: `[0.4, 0.5, 0.6, 0.9, 0.5]` (climax difficulty + cool-down)
- **Rules**: mosse disponibili 15-30, punti per match 100-500, durata livello 2-5min, autosave alla vittoria
- **Note implementative**: Collection Proxy per unload async tra livelli, matrice 2D adjacency separata dai componenti grafici, `go.animate` per swap, UI overlay separata dalla camera, `msg.post` per routing input→logica
- **Reference games**: Candy Crush, Two Dots, Threes
- **Repo OSS verificati**:
  - [Insality/cosmic-dash-jam-2025](https://github.com/Insality/cosmic-dash-jam-2025) — MIT, 36★ — già nel KB, ECS tiny-ecs
  - [aglitchman/defold-ld50-game](https://github.com/aglitchman/defold-ld50-game) — MIT, 25★ — già nel KB, merge mechanic
  - [Lerg/match3swipe](https://github.com/Lerg/match3swipe) — MIT, 2★ — input swipe→cell swap
  - britzl pacchetti (già nel KB)
- **NOTA**: Gemini conferma "area drammaticamente povera fuori dalle librerie ufficiali". OK comunque, copertura RAG Defold (796 chunk) + britzl bastano.

### T04 — Browser Arcade Game ✅ tier wow

- **Engine**: Phaser 3
- **Style pack default**: A08 pixel-art-arcade-neon (alt: D07 synthwave)
- **Zone baseline** (5): title (audioContext unlock) → wave_30s → density_ramp → boss_singolare → game_over
- **Gating**: time-based + score-based (1000pt per Fase 3)
- **Pacing curve**: `[0.5, 0.7, 0.8, 1.0, 0.0]` (death ramp totale)
- **Rules**: 1-3 vite, instakill, durata media run 1-3min, no checkpoint
- **Note implementative**: Phaser Groups + Object Pooling per proiettili, AudioContext unlock al primo touch, `window.onresize` per aspect ratio mobile, `LocalStorage` per highscore, `update()` delta-time-based
- **Reference games**: Geometry Dash, Super Hexagon, Crossy Road, Nuclear Throne
- **Repo OSS verificati**:
  - [digitsensitive/phaser3-typescript](https://github.com/digitsensitive/phaser3-typescript) — MIT, 1k★ — già nel KB
  - [samme/phaser-parcel](https://github.com/samme/phaser-parcel) — 74★ — già nel KB, Parcel bundle
  - [remarkablegames/phaser-platformer](https://github.com/remarkablegames/phaser-platformer) — MIT, 14★ — Arcade physics + overlap groups
  - phaserjs/examples — già nel KB

### T05 — JRPG Top-down ✅ tier wow (eccellente)

- **Engine**: Godot 4 (alt: MonoGame **beta**, vedi RAG_GAP_DECISIONS G.1)
- **Style pack default**: A05 pixel-art-snes-jrpg (alt: A02 vibrant)
- **Zone baseline** (5): città_principale (hub) → pianura_transito (encounters) → dungeon (puzzle) → arena_boss → santuario_segreto (opzionale, requires veicolo)
- **Gating**: oggetto-chiave / abilità / veicolo / completamento dungeon
- **Pacing curve**: `[0.15, 0.4, 0.55, 0.75, 0.95]`. Frequenza encounter 3-5min, scontro base 45-90s, boss 5-10min, save ogni 30-45min, curva XP +1 livello/60min
- **Rules formali**:
  - Iniziativa turno = `velocità + RNG(1,20)`
  - Danno = `(Attacco × 1.5) - Difesa`
  - HP scaling = `HP_base × 1.1^livello`
  - Economia 1 azione/turno, inventory 99/slot
- **Note implementative**: separazione gerarchica nodi map/battle, Resources Godot per database armi/nemici/stati, transition macchina a stati, dictionary per scaling complessità
- **Reference games**: Chrono Trigger, FF VI Pixel Remaster, Sea of Stars, To the Moon
- **Repo OSS verificati**:
  - [gdquest-demos/godot-open-rpg](https://github.com/gdquest-demos/godot-open-rpg) — MIT, **2.8k★** — già nel KB, JRPG turn-based completo
  - [bitbrain/pandora](https://github.com/bitbrain/pandora) — MIT, 1k★ — RPG data addon (alpha)
  - [newold3/Godot-RPG-Creator](https://github.com/newold3/Godot-RPG-Creator) — MIT, 51★ — editor visivo RPG
  - [tuananhcn/Turn-Base-RPG](https://github.com/tuananhcn/Turn-Base-RPG) — MIT — 2D turn-based + inventory scalabile
  - [Ziden/godot-turn-based-rpg](https://github.com/Ziden/godot-turn-based-rpg) — MIT — focused turn resolver
- **MonoGame alt**: `templates/monogame/jrpg_progression.cs` + `jrpg_dialogue.cs` (hardcoded scaffold, vedi G.1)

### T06 — Card Game / Autobattler ⚠️ poco arricchito (compensa via ink helper)

- **Engine**: LÖVE 11 (alt: Phaser per web, Godot)
- **Style pack default**: D08 dark-fantasy-painted (alt: A02 vibrant)
- **Zone baseline** (5): combat_base → elite (artefatti passivi) → campfire (heal/upgrade) → mercante (valuta) → evento_bivio
- **Gating**: economy currency / vittorie precedenti / scelte narrative
- **Pacing curve**: durata run 45-60min, 15 nodi per atto, sfoltimento mazzo fine atto 2, scaling +15% per atto, deck ottimale 20-25 carte
- **Rules**: HP 80 fissi (no heal tra match minori), mana 3/turno (non conservabile), pesca 5 iniziali, scarto a fine turno, costo rimozione +25 cumulativo
- **Note implementative**: tabelle Lua come data structures per carte, PRNG con seed deterministico per riproducibilità, alberi comportamentali minimi per AI opponent, drag-drop con Z-index manuale, ink helper per dialoghi narrativi (vedi RAG_GAP_DECISIONS G.5)
- **Reference games**: Balatro, Slay the Spire, Inscryption, Hearthstone
- **Repo OSS verificati**:
  - [Cod-e-Codes/CardGame](https://github.com/Cod-e-Codes/CardGame) — MIT, 10★ — turn-based + drag-drop + AI opponent
  - [heisenberg23911/CardGame](https://github.com/heisenberg23911/CardGame) — MIT — menu multi-scene + AI combat
  - bucketon/bots — Open Source — deck construction + matchmaking
  - liuzhch1/learn-balatro-card — replicazione shader Balatro

### T07 — Platformer Hardcore Pixel-Perfect ✅ tier wow (eccellente)

- **Engine**: MonoGame
- **Style pack default**: A01 pixel-art-dark (alt: A03 1bit)
- **Zone baseline** (5): screen_isolation → lato_A (linear) → lato_B (hardcore, collezionabili nascosti) → schermata_sicura → menu_capitoli
- **Gating**: collezionabili nascosti / marker completamento
- **Pacing curve**: respawn <0.5s, finestra esecuzione 10-15s/stanza, introduzione 1 meccanica per area, curva dissonance al climax, fallimento 20-30 tentativi/stanza
- **Rules game-feel (formule esatte Celeste)**:
  - Coyote Time: 5-6 frame
  - Jump Buffer: 4-5 frame
  - Apex Gravity: moltiplicatore 0.5x quando vel.y ≈ 0
  - Corner Correction: 4 pixel di traslazione invisibile
  - Stamina rimborso: totale quando piedi toccano suolo
- **Note implementative**: NO motori fisici generalisti (no Farseer/Box2D), collisioni AABB discrete in main loop, pixel-snapping su geometrie, gestione diretta memoria/input
- **Reference games**: Celeste, Super Meat Boy, N++
- **Repo OSS verificati**:
  - [NoelFB/Celeste](https://github.com/NoelFB/Celeste) — **MIT (partial source, archived)** — classe Player con formule esatte dash + corner correction
  - [endrealm/Monogame-Platformer-Example](https://github.com/endrealm/Monogame-Platformer-Example) — MIT, 3★ — camera + input + LDtk parsing
  - [jlauener/MonoPunk](https://github.com/jlauener/MonoPunk) — MIT, 2★ — engine 2D pixel-perfect, HaxePunk-inspired
  - [DreamyStranger/MonoGame-Platformer](https://github.com/DreamyStranger/MonoGame-Platformer) — OOP + component pattern

### T08 — Roguelike/Roguelite Dungeon ✅ tier wow

- **Engine**: Godot 4 (alt: LÖVE per puro roguelike)
- **Style pack default**: A01 pixel-art-dark (alt: D01 ASCII)
- **Zone baseline** (5): hub_centrale → dungeon_base (kill-all gate) → arena_miniboss (collision-locked) → dungeon_avanzato (key gate procedurale) → boss_finale
- **Gating**: nodi interfaccia per istanze / array nemici azzerati / variabili booleane chiavi / state boss
- **Pacing curve**: `[0.2, 0.45, 0.7, 1.0, 0.1]`, per-run 20-45min, livello procedurale 3-5min
- **Rules**: HP 100-500, DMG 10-50, checkpoint 0-3 transizioni, grid cell 16-64px, aggro radius 150-400, permadeath per run + meta-resources persistenti
- **Note implementative**: BSP algorithm partizionamento, A* pathfinding sulla griglia, behavior tree per AI, `change_scene_to_file` + reset variabili temporanee, Area2D/3D per portali
- **Reference games**: Hades, Dead Cells, Enter the Gungeon, Caves of Qud
- **Repo OSS verificati**:
  - [krazyjakee/DungeonTemplateLibrary-Godot](https://github.com/krazyjakee/DungeonTemplateLibrary-Godot) — MIT, 43★ — GDExtension DTL C++ per labirinti/stanze native
  - [statico/godot-roguelike-example](https://github.com/statico/godot-roguelike-example) — MIT, 18★ — BSP + behavior trees + inventory + D20 combat
  - GDQuest PCG Demos — già nel KB
  - **SCARTATO**: arabold/rogue-gauntlet (Apache + Commons Clause = no redist)
  - **SCARTATO**: abduznik/lumbermann (no license)

### T09 — 3D Browser Showcase ✅ tier wow (massimo boost da Fase 2)

- **Engine**: Three.js (alt: R3F)
- **Style pack default**: C08 abstract-geometric (alt: C04 PSX, C01 low-poly)
- **Zone baseline** (4): pre_loader (GLTF promises) → hub_espositivo (raycaster click) → dettaglio_modello_A (camera lerp) → dettaglio_modello_B (raycaster on mesh)
- **Gating**: HTML overlay rimosso al complete promises, click su mesh, raycasting target
- **Pacing curve**: `[0.1, 0.3, 0.5, 0.8, 0.4]` (idle dopo timeout input)
- **Rules**: HP 1 fisso (observer), DMG 0, no checkpoint, FOV 45-75, raycaster far 100-500, durata sessione 5-10min
- **Note implementative**: vector interpolation per camera transitions, OrbitControls reset, GLTFLoader async, octree per collisioni, EffectComposer per postprocessing
- **Reference games**: A Short Hike (port), GLTF showcases, Cyberpunk web demos
- **Repo OSS verificati** (i 5 + repo postprocessing):
  - [instructa/viber3d](https://github.com/instructa/viber3d) — MIT, 619★ — già nel KB, R3F + Rapier + Koota ECS
  - [ElementTech/create-threejs-game](https://github.com/ElementTech/create-threejs-game) — MIT — CLI scaffolding scene
  - **Postprocessing pipeline (chiude gap G.4)**:
    - [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing) — Zlib, 2.8k★ — EffectComposer (Bloom, DoF, ChromaticAberration, SMAA, ToneMapping, Vignette)
    - [N8python/n8ao](https://github.com/N8python/n8ao) — CC0, 466★ — SSAO drop-in con temporal stability
    - [FarazzShaikh/THREE-CustomShaderMaterial](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial) — MIT, 1.3k★ — toon/watercolor/painterly su MeshPhysicalMaterial
    - [Ameobea/three-good-godrays](https://github.com/Ameobea/three-good-godrays) — LICENSE da verificare, 223★ — volumetric godrays raymarched
    - [gkjohnson/three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) — MIT, 1.6k★ — DoF fisico + ACESFilmic + LUT tone mapping

### T10 — Stride 3D Action Adventure ⚠️ BETA ENGINE (confermato gap strutturale)

- **Engine**: Stride 4.3+ (Nov 2025)
- **Style pack default**: C07 fantasy-stylized (alt: C03 toon-anime)
- **Zone baseline** (5): ambito_tutorial (input sequence) → terreno_overworld (inventory gating) → dungeon_meccanico (trigger volumetrici) → dungeon_organico (mesh destroy gating) → arena_boss_action
- **Gating**: codified input scripts / inventory items / rigid body triggers / mesh destruction
- **Pacing curve**: `[0.3, 0.45, 0.65, 1.0, 0.2]` con slow-mo al colpo letale boss
- **Rules**: HP 100-1000 (scaling esperienza), DMG 15-100, checkpoint 10-15min, run totale 10-20h, livello 30-60min, gravity y -9.8/-15, dodge cooldown 500-1200ms
- **Note implementative**: scene loading sincrono con render disable, fade transitions, save state persistente, slow-motion factor su trigger
- **Reference games**: Genshin Impact (indie), Tunic, Death's Door (3D)
- **Repo OSS verificati**: **NESSUNO NUOVO**. Gemini conferma "ecosistema OSS Stride resta esaurito; raccomandare scaffold hardcoded custom" anche per 2024-2026. Stride 4.3 attivo + stride-community-toolkit (utility wrappers, no pattern gameplay).
- **DECISIONE FINALE**: T10 = **beta tier al day-1**. Visibile nel picker engine con badge "Best for advanced users — requires manual refinement". Scaffold `templates/stride/starter_scaffold/` hardcoded (vedi RAG_GAP_DECISIONS G.3). Reasoning Engine salta Playtester Agent per Stride.

### T11 — Multiplayer Arena ✅ tier wow

- **Engine**: Godot 4 + Nakama
- **Style pack default**: A08 pixel-art-arcade-neon (alt: C06 sci-fi-clean)
- **Zone baseline** (3): schermata_auth (token JWT gate) → matchmaker_lobby (numerical queue) → arena_chiusa (sync barrier)
- **Gating**: token sessione valido / coda raggiunge soglia / segnale sync globale
- **Pacing curve**: round 3-7min, `[0.1, 0.5, 0.7, 1.0, 0.0]` (close socket post-match)
- **Rules**: HP 1000-3000 (allungare TTK), DMG 50-300, network_tick 20-60Hz, max_players 4-16, no checkpoint, no level concept (single arena loaded), respawn 3-5s
- **Note implementative**: callback HTTP success per scene change, MultiplayerSpawner su match_id ricevuto, RPC validation server-side, interpolazione client-side
- **Reference games**: Brawlhalla, Crab Game, Move or Die
- **Repo OSS verificati**:
  - [RGonzalezTech/Friendslop-Template](https://github.com/RGonzalezTech/Friendslop-Template) — MIT, 80★ — sync scenes + spawning multiplayer
  - [heroiclabs/nakama-project-template](https://github.com/heroiclabs/nakama-project-template) — Apache-2.0 — scaffold backend ufficiale RPC
  - [DearFox/Nakama-Test](https://github.com/DearFox/Nakama-Test) — unspecified — login + matchmaking GDScript + Go/C# server
  - **SCARTATO**: newnoiseworks/omgd-godot4-dedicated-nakama3-example (no LICENSE)
  - foxssake/netfox — già nel KB
  - heroiclabs/nakama-godot — già nel KB

### T12 — Social Sim / Generative Agents ✅ tier wow ⬆️ PROMOSSO DA BETA

- **Engine**: Godot 4 + Ollama (LLM locale)
- **Style pack default**: A02 pixel-art-vibrant (alt: B01 flat-cute, A04 GBC)
- **Zone baseline** (5): hub_residenziale → piazza_centrale → area_lavorativa (tool gate) → mercato_locale (currency gate) → area_riservata (affinity ≥80 gate LLM-generated)
- **Gating**: ciclo diurno globale / inventario / currency / affinity score dall'LLM
- **Pacing curve day-cycle**: `[0.20, 0.50, 0.40, 0.90, 0.10]` — 08:00 spawn → 12:00 piazza → 15:00 dispersione → 19:00 climax sociale → 23:00 reset
- **Rules**:
  - HP "energia sociale" 0-100 (decreases -5/interazione)
  - DMG "danno relazionale" -20/+20 (sentiment analysis dall'LLM)
  - Checkpoint 1/ciclo (autosave fine giornata)
  - Run durata 10-20min real-time (1s = 1min simulato)
  - Contesto LLM 512-2048 token (truncate vecchi messaggi)
- **Note implementative**: prompt sistema per giornata, timer navigation forzato, sentiment parser mappato a int, JSON cronologia LLM serializzato, async background per evitare blocco thread principale
- **Reference games**: Stardew Valley (sociale), Animal Crossing, Smallville-clone academic
- **Repo OSS verificati** (3 trovati dal round Fase 2):
  - [code-forge-temple/local-llm-npc](https://github.com/code-forge-temple/local-llm-npc) — **CC-BY 4.0**, 47★ — Godot 4.4 C# + Gemma 3n locale via Ollama API
  - [nthnn/noko](https://github.com/nthnn/noko) — MIT, 7★ — plugin GDScript Ollama, background non-blocking
  - [af009/fuku](https://github.com/af009/fuku) — MIT, 56★ — multi-provider AI plugin (Ollama, OpenAI, Claude, Gemini, Docker)
- **NOTA**: Promosso da "beta" a "tier wow" grazie ai 3 repo Godot+Ollama emersi nel round Fase 2. Reference Smallville completo open-source non esiste ancora, ma il pattern di integration LLM locale è coperto.

### T13 — Bullet Hell / Arcade Puro ✅ tier wow

- **Engine**: LÖVE 11 (alt: Godot, Phaser)
- **Style pack default**: A08 pixel-art-arcade-neon (alt: D07 synthwave)
- **Zone baseline** (5): fase_iniziale (30s timer) → mid_boss → sciame_proiettili → boss_finale_F1 (2 torrette laterali gate) → boss_finale_F2 (60s Danmaku survival)
- **Gating**: timer interno, HP zero su boss, distruzione torrette
- **Pacing curve**: `[0.20, 0.60, 0.40, 1.0, 0.0]` con power-up rilascio nel mid
- **Rules**: 1-3 vite, hitbox 1 pixel, DMG 1-5 senza RNG (TTK prevedibile), 1000-5000 entità attive con `love.graphics.newSpriteBatch`, durata 120-180s per livello sincronizzato all'audio
- **Note implementative**: WaveSpawner sincronizzato al BGM, pattern vettoriali interpolati `math.sin`, spirali concentriche al climax (80% pixel screen), `love.update` timer-based
- **Reference games**: Touhou, Cave Story, Geometry Dash
- **Repo OSS verificati**:
  - [srijan-paul/bullet_hell](https://github.com/srijan-paul/bullet_hell) — MIT, 6★ — ECS bullet hell, fisica custom non-Box2D
  - [sharpobject/nbml](https://github.com/sharpobject/nbml) — license unspecified — BulletML parser
  - **SCARTATO**: Achie72/love2d-shmup — 404 allucinazione del prompt

### T14 — Retro 8-bit Restricted ✅ tier wow

- **Engine**: Godot 4 (con profile retro) o LÖVE
- **Style pack default**: A04 pixel-art-gbc (alt: A03 1bit, D06 minimalist-mono)
- **Zone baseline** (5): schermata_avvio → abisso_platform (pixel-perfect jumps) → stanza_potenziamento (singleton gate) → corridoio_sigillato (inventory destroy gate) → arena_boss
- **Gating**: Area2D transition, salto pixel-perfect, singleton globale modificato, `queue_free()` su tile barriera, camera-lock
- **Pacing curve**: `[0.20, 0.50, 0.80, 1.0, 0.0]`
- **Rules retro-enforced**:
  - Palette 4-16 colori (GDShader `floor()` su RGB)
  - Risoluzione 160x144 ÷ 320x240 (no antialias)
  - HP 1-6 punti (TextureRect discreti, no ProgressBar)
  - Checkpoint 1/livello (reload_current_scene)
  - Audio 11025-22050 Hz (AudioEffectBitCrush su Master)
- **Note implementative**: `nearest` texture filter, sub-pixel rendering disabilitato, CanvasLayer + ColorRect per shader retro overlay, no tween smooth, FSM rigida boss
- **Reference games**: Shovel Knight, Pico-8 jams, Sprout Lands, Castlevania-like
- **Repo OSS verificati**:
  - [ahopness/GodotRetro](https://github.com/ahopness/GodotRetro) — **CC0/MIT, 745★** — 22 shader retro: VHS, glitch, grain, dithering, CRT, NTSC
  - [glennDittmann/godot-pixel-art-template](https://github.com/glennDittmann/godot-pixel-art-template) — MIT, 8★ — config project.godot + nearest filter
  - [MaxiimPetrov/Divine-Retribution-8-bit-Project](https://github.com/MaxiimPetrov/Divine-Retribution-8-bit-Project) — MIT — Castlevania-like CharacterBody2D senza inerzia

---

## N.3.bis — Riepilogo template status day-1

| # | Template | Engine | Tier day-1 | Style pack | Repo verificati (Fase 2) |
|---|---|---|---|---|---|
| T01 | Metroidvania Platformer | Godot 4 | ✅ wow | A01 | 3 |
| T02 | Visual Novel | Ren'Py | ✅ wow | B04 | 3 |
| T03 | Mobile Casual Puzzle | Defold | ✅ wow | B01 | 3 |
| T04 | Browser Arcade | Phaser 3 | ✅ wow | A08 | 4 |
| T05 | JRPG Top-down | Godot 4 | ✅ wow | A05 | 5 |
| T06 | Card Game/Autobattler | LÖVE 11 | ✅ wow | D08 | 4 |
| T07 | Platformer Hardcore | MonoGame | ✅ wow | A01 | 4 |
| T08 | Roguelike Dungeon | Godot 4 | ✅ wow | A01 | 3 |
| T09 | 3D Browser Showcase | Three.js | ✅ wow | C08 | 7 |
| T10 | Stride 3D Action | Stride | ⚠️ beta | C07 | 0 (scaffold) |
| T11 | Multiplayer Arena | Godot+Nakama | ✅ wow | A08 | 5 |
| T12 | Social Sim Generative | Godot+Ollama | ✅ wow ⬆️ | A02 | 3 |
| T13 | Bullet Hell | LÖVE 11 | ✅ wow | A08 | 2 |
| T14 | Retro 8-bit | Godot/LÖVE | ✅ wow | A04 | 3 |

**13/14 template in tier wow day-1, 1 in beta (Stride).**

## N.4 D.1 modificato — baseline-then-diff

```python
def intent_interpreter_v2(brief: str, uploads: Uploads | None) -> GamePlan:
    # Step 1: detect genre + engine
    genre = detect_genre(brief)
    engine = recommend_engine(genre, user_pref=uploads.engine_pref)

    # Step 2: scegli template
    template = GENRE_TEMPLATE_CATALOG.find(genre=genre, engine=engine)
    if not template:
        # fallback al template più vicino + nota
        template = closest_template(genre, engine)

    # Step 3: inferenza style pack (vedi J.4)
    style_pack = infer_style_pack(brief, uploads.concept_art, uploads.music)

    # Step 4: parti dal template, applica solo il delta dal brief
    plan = template.to_game_plan_v0()
    plan.meta.template_origin = template.id
    plan.aesthetics.style_pack_ref = style_pack.id

    # Step 5: DSPy module per generare SOLO i delta necessari
    delta = dspy_baseline_to_brief(template=plan, brief=brief, uploads=uploads)
    plan = apply_delta(plan, delta)

    return plan
```

Costo D.1 con template: ~$0.02-0.05 (vs $0.20+ from-scratch).
Varianza: drasticamente ridotta. Qualità baseline: solida.

---

# PARTE O — RAG DECOMPOSE-THEN-RETRIEVE (Gap 6)

## O.1 Il problema

Abbiamo 7548 chunk in `code_knowledge` perfettamente classificati per
(engine, primary_category, genre_tags, key_features). Ma il
blueprint v1 non specificava *come* il D.5 li recuperasse al momento
di chiamare un code_gen tool. Senza pattern formale di retrieval, il
RAG sarebbe sotto-usato.

## O.2 Pattern — Decompose-then-Retrieve

Tre fasi prima di ogni chiamata a `code_gen_*`:

```python
def rag_retrieve_for_codegen(task: CodeGenTask, plan: GamePlan) -> RAGContext:
    # === Fase 1 — Decompose ===
    facets = decompose_task(task)
    # facets = {
    #   engine: 'godot',
    #   primary_category: 'A03_combat',
    #   sub_categories: ['boss_phase', 'state_machine'],
    #   genre_tags: ['metroidvania', 'action_2d'],
    #   key_features: ['boss_phase', 'enemy_ai'],
    #   complexity: 'intermediate',
    # }

    # === Fase 2 — Multi-axis retrieval ===
    candidates = []
    # 2a. Vector similarity sul semantic_description
    semantic = supabase.rpc('match_chunks', {
        'query_embedding': embed(task.description),
        'engine': facets.engine,
        'match_threshold': 0.75,
        'match_count': 20,
    })
    candidates += semantic

    # 2b. Filtro hard sui facets (boost rilevanza)
    facet_matches = supabase.rpc('match_chunks_facets', {
        'engine': facets.engine,
        'primary_category': facets.primary_category,
        'genre_tags': facets.genre_tags,
        'key_features': facets.key_features,
        'match_count': 10,
    })
    candidates += facet_matches

    # === Fase 3 — Rerank ===
    candidates = rerank_combined(candidates,
        weights={
            'semantic': 0.4,
            'facet_match': 0.3,
            'episodic_boost': 0.2,    # boost se usato con successo in passato
            'recency': 0.1,
        }
    )

    return RAGContext(
        chunks=candidates[:5],
        injection_strategy='prepend_as_examples',
    )
```

## O.3 Genre-aware ranking

Il `meta.genre` del Game Plan è bias di ranking. Chunk con
`genre_tags` matching guadagnano +0.15 nel score finale. Chunk con
genre mismatch importante (es: cerco metroidvania, chunk è JRPG)
perdono -0.10.

## O.4 Episodic-memory boost

Per ogni chunk usato in passato in una generazione che è stata
*evaluation-passed*:
```sql
UPDATE code_knowledge SET success_score = success_score * 0.95 + 1.0 * 0.05
WHERE id = $1;
```
Decadimento esponenziale: i chunk validati di recente pesano di più.

## O.5 Integrazione esplicita nei moduli

```
D.5 Execution Orchestrator
   ↓
For each code_gen task:
   ↓
[Decompose Task] → facets
   ↓
[Multi-axis Retrieval] → top-20 candidates
   ↓
[Rerank with episodic boost] → top-5
   ↓
[Inject into code_gen prompt] → call LLM
   ↓
After generation:
   ↓
[Update success_score on used chunks]
   (only if D.6 passes the build)
```

---

# PARTE P — TRE MODALITÀ — Mapping al Game Plan (Gap 7)

## P.1 Il problema

La Pietra §11-bis è chiara: Creator Mode + Studio Mode + Code Mode,
con backend identico. Il blueprint v1 non specificava *come* il
Game Plan venisse esposto come canvas visivo né come il DAG di tool
calls diventasse modificabile.

## P.2 Game Plan è il canvas

Il Game Plan v2 ha già struttura a grafo:
- `world_graph.zones` + `world_graph.edges` → nodi e archi nel
  canvas
- `pacing.target_curve` → grafico timeline editabile
- `rules` → form numerico con slider
- `aesthetics` → swatch palette + LoRA hints + preview

Studio Mode = React Flow consuma direttamente `game_plan.world_graph`.
Edits utente (drag nodo, modifica slider) producono un `GamePlanPatch`
(parte L) inviato a D.2-Refine.

## P.3 Tool DAG visualization

Il `execution_dag: ToolCallNode[]` del Game Plan è il "circuito" di
generazione. Studio Mode mostra:
- Ogni `ToolCallNode` come nodo nel canvas
- Edges = `depends_on`
- Click su nodo → input/output/cost/status
- "Re-run this node" → crea un GamePlanPatch che invalida e
  ri-esegue solo quel nodo

## P.4 Code Mode

Ogni `ToolCallNode.output_artifact` è un file generato (es. GDScript,
JSON, asset). Code Mode mostra:
- Lista file del progetto
- Editor con syntax highlight per engine corrente
- Diff viewer fra versioni (sfrutta `game_plan_history`)
- AI-assist localizzato: select code → "spiega/modifica/refactor"

## P.5 Mapping ai 3 strati

| Modalità | Cosa vede l'utente | Cosa modifica |
|---|---|---|
| Creator | Chat + preview giocabile | `brief`/`patch` in NL |
| Studio | Canvas React Flow (Game Plan + DAG) | Game Plan direttamente |
| Code | IDE con file generati | File source + GamePlanPatch via AI-assist |

Tutti e 3 producono `GamePlanPatch` o `GamePlan` completi. Backend
unico = Hermes + 6 moduli. Nessun divide tra modalità.

---
---

# PARTE Q — RIANALISI POST-V2: cosa cercare ancora

(L'utente ha chiesto: dopo il v2, rianalizza e capisci cosa cercare,
cosa aggiungere alla Pietra, dove trovare materiale per il wow
effect.)

## Q.1 Gap residui scoperti durante la scrittura del v2

Durante la stesura sono emersi nuovi buchi che il v2 non risolve da
solo. Saranno l'input della **Fase 2 Resource Hunt** del piano:

### Q.1.a Style Pack — dettagli mancanti
- Palette esatte (oklch) per i 30 pack: nel v2 ho dato riferimenti
  ma non i colori puntuali. Va completato in `docs/STYLE_PACK_REFERENCES.md`.
- LoRA verificate su Civitai/HuggingFace: vanno scaricate, testate,
  ognuna con licenza confermata.
- ControlNet reference images: 5-10 per pack, sono asset reali da
  raccogliere.
- Font: serve scegliere font CC0 o open-source per ogni pack.

### Q.1.b Asset Library — pipeline da implementare
- Lo schema `asset_library_index` esiste solo come SQL. Le 11
  librerie vanno *davvero* indicizzate. Costo embeddings: ~$5-10
  per 200k asset. Va pianificato in Fase 2.
- Verifica licenza per-pack: alcune librerie sono miste (CC0 +
  CC-BY). Serve filter automatico.
- Asset di qualità su Stride/MonoGame/Defold sono pochi: serve
  decidere se compensiamo con AI generation o limitiamo gli engine
  al day-1.

### Q.1.c Genre Template — gap di copertura
- 14 template scritti. Ma il nostro `code_knowledge` ha buchi
  strutturali confermati:
  - phaser × C03_dialogue_narrative (0 chunk) → T02 VN su Phaser è
    debole
  - monogame × C01_progression / C03 → T05 JRPG MonoGame è debole
  - stride × quasi tutto → T10 Stride 3D è il template più a rischio
- Decisione: per Fase 1, **escludiamo i template a rischio** dalla
  promessa "wow day-1" e li marchiamo come "beta". Day-1 wow = T01,
  T02 (Ren'Py only), T03, T04, T05 (Godot only), T07, T08, T09.

### Q.1.d Code mechanics kit — cosa cercare per engine

Per ogni engine, manca un set canonico di pattern "movimento +
camera + audio + UI" che il D.5 chiama come reference RAG. La
copertura del KB è disomogenea. Servono:

- **Godot**: già forte (3357 chunk). OK.
- **Phaser**: forte ma weak su dialogue/save. Cercare:
  rexrainbow/phaser3-rex-plugins (902 MB, troppo grosso → estrarre
  subdir specifiche), phaser-by-example.
- **Ren'Py**: 591 chunk dopo Fase 1ter, copre bene VN. OK.
- **Defold**: 796 chunk, copertura ampia. OK.
- **MonoGame**: forte ma weak su RPG dialogue. Cercare:
  craftworkgames/MonoGame.Extended (già curated), Monofoxe,
  Nez framework.
- **LÖVE**: 718 chunk, OK.
- **Three.js**: 1270 chunk, OK ma serve postprocessing pipeline
  (EffectComposer examples).
- **Stride**: solo 215, **gap strutturale**. Cercare: stride3d
  community samples, BepuPhysics demos, Stride community toolkit.

### Q.1.e Audio mood — completamente assente
- Catalogo `AUDIO_MOOD_LIBRARY.md` da scrivere in Fase 2.
- Per ogni mood (8-10): 3-5 tracce Suno reference + SFX bank +
  Freesound query.

### Q.1.f Reference games visual — moodboard
- Per ogni combo style_pack × genre: 5-10 screenshot da Steam/itch
  → embed + iniezione nel prompt LLM via Claude Vision.

## Q.2 Cosa aggiungere alla Pietra v4 → Pietra v5

La Pietra v4 è visione. Il v2 trasforma quella visione in tecnica.
Una **Pietra v5 Addendum** dovrebbe integrare:

1. **Catalog references**: ogni style pack/genre template di v2 va
   citato come scelta tecnica della Pietra.
2. **Pipeline anti-slop esplicita**: "Ogni gioco al primo prompt
   parte da Template + Style Pack + Asset Library + RAG. Non da
   LLM puro."
3. **Cost breakdown rivisto**: con template+CC0, il costo per gioco
   scende a $0.50-1.50 invece di $1.50-5. Riformulazione del
   pricing.
4. **Esclusioni day-1 dichiarate**: i template a rischio (T10
   Stride, T11 multiplayer, T12 social sim) vanno marcati "beta"
   nella Pietra v5.
5. **Wow Effect Promise**: dichiarazione esplicita di cosa il
   sistema garantisce al primo prompt:
   - completamento giocabile
   - coerenza estetica (Aesthetic Coherence ≥ 0.75)
   - balance verificato (RMSE stress < 0.15)
   - 0 soft-lock (ASP-verified)
   - tempo di generazione < 15 min
   - costo < $1.50 per Free tier

## Q.3 Dove cercare ancora materiale (Fase 2 → Fase 3)

Per ogni dominio, dove andare a recuperare il materiale di alta
qualità che fa la differenza:

| Dominio | Fonti | Metodo |
|---|---|---|
| Palette pixel art | Lospec.com (palettes), DB16, Endesga | WebFetch + verify license |
| LoRA SDXL/FLUX | Civitai (filter by license), HuggingFace | WebFetch + license check |
| ControlNet refs | Pinterest, ArtStation (no rights, only inspiration), Steam screenshots | manual + visual hash |
| 3D asset CC0 | Quaternius, KayKit, Poly Haven, Sketchfab CC0 filter | scraping pipeline ad-hoc |
| Game code template | GitHub topic search (`topic:godot-template`), itch.io game source releases | Deep Research mirato per engine |
| Audio reference | Suno gallery, BandLab Sound Pack, Kenney Audio | manual selection + Freesound API |
| Game design patterns | Game Programming Patterns (Robert Nystrom, free book), Game Feel (Steve Swink) | reading + extract patterns |
| PCG examples | Reddit /r/proceduralgeneration, /r/roguelikedev, /r/gamedev | scraping + curation |
| Reference games | Steam (screenshots ufficiali), itch.io devlog, GDC Vault | manual moodboard |

## Q.4 La Fase 2 Resource Hunt — programma esecutivo

Vedi piano `voglio-quanto-piu-materiae-distributed-tide.md` sez. 2.
In sintesi:

1. **Sett. 0 (questa)**: blueprint v2 ✓ FATTO.
2. **Sett. 1**: 6 documenti di Resource Hunt (Style Pack refs,
   Asset Library manifest, Audio mood lib, Reference games visual,
   RAG gap decisions, Engine mechanics kit).
3. **Sett. 1-2**: 5 Deep Research prompts per Genre Templates +
   Engine Mechanics nei buchi (stride, phaser dialogue, monogame
   RPG).
4. **Sett. 2**: Pietra v5 Addendum + Where-to-look-next.
5. **Sett. 3+**: SOLO ORA codice (Settimana 1 della roadmap parte H).

## Q.5 Cosa serve confermare prima della Fase 2

1. Verificare DOI Smith 2011 (IEEE paywall) — manuale.
2. Verificare DOI Liapis 2013 Sentient Sketchbook — manuale.
3. Leggere paper Riedl Suspense ACL — per D.6.
4. Leggere survey Gallotta/Liapis 2024 — per D.2/D.6.
5. Decidere DSPy vs Outlines come default: blueprint v2
   raccomanda **DSPy per pipeline, Outlines come fallback** per
   JSON-only enforce.
6. Decidere se T10/T11/T12 sono Fase 1 "wow" o Fase 2.
7. Confermare budget Fase 2 (Deep Research ~5 round + WebFetch
   verification interna ~6-8h).

---

# PARTE R — DEFERRED TUNING DECISIONS (Categoria 3)

Quattro decisioni che NON si possono chiudere prima del codice
perché richiedono generazioni reali da misurare. Documentate qui
con criterio di chiusura fisso, per non dimenticarle e non
chiuderle a caso.

## R.1 — Soglia Aesthetic Coherence (oggi 0.75, guess iniziale)

- **Dove**: parte J.5 (Aesthetic Coherence Validator nel D.3)
- **Quando chiudere**: Settimana 5 dev (dopo D.3)
- **Come**: generare 10-20 giochi test su 3-4 style pack diversi,
  misurare la distribuzione reale del coherence score (palette
  match + CLIP similarity + audio mood). Tarare la soglia al
  percentile che separa "wow" da "slop" empiricamente.
- **Rischio se sbagliata**: troppo alta → rigetta giochi buoni e
  loop infiniti; troppo bassa → AI-slop passa il gate.
- **Pre-lavoro ora**: nessuno. 0.75 resta placeholder dichiarato.

## R.2 — Stress curve RMSE (oggi <0.15, guess iniziale)

- **Dove**: parte M.3-M.4 (Playtester Agent confronto curve)
- **Quando chiudere**: Settimana 9 dev (dopo D.6)
- **Come**: playtest simulati reali su 3 generi (es. T01
  metroidvania, T05 JRPG, T13 bullet hell), misurare la varianza
  naturale della stress curve empirica vs target, tarare la soglia
  RMSE e la soglia di gap puntuale.
- **Rischio se sbagliata**: troppo stretta → auto-tuning loop
  costoso e infinito; troppo larga → giochi sbilanciati passano.
- **Pre-lavoro ora**: nessuno.

## R.3 — Formato scaffold hardcoded (compensazioni gap dataset)

- **Dove**: RAG_GAP_DECISIONS G.1/G.2/G.3/G.5 + ENGINE_MECHANICS_KIT
- **Quando chiudere**: Settimana 7 dev (durante D.5)
- **Come**: scrivere i 6 file scaffold guardando il code style
  reale degli engine (non in astratto):
  - `templates/monogame/jrpg_progression.cs`
  - `templates/monogame/jrpg_dialogue.cs`
  - `templates/phaser/phaser_save_helper.ts`
  - `templates/phaser/ink_phaser_runtime.ts`
  - `templates/love2d/love_ink_dialogue.lua`
  - `templates/stride/starter_scaffold/` (progetto Stride boot-ready)
- **Pre-lavoro ora**: path già fissati nei RAG_GAP_DECISIONS. Niente
  da scrivere prima del D.5.

## R.4 — Round Deep Research Animation 2D rotoscope (CONDIZIONALE)

- **Dove**: style pack D02 hand-drawn-rotoscope
- **Quando chiudere**: Settimana 4 dev, SOLO SE durante i test il
  pack D02 risulta visivamente insufficiente (rotoscope frame-by-
  frame è il pack più difficile da coprire con asset CC0).
- **Come**: prompt Deep Research mirato su tecniche rotoscope OSS +
  reference Cuphead-like, se e solo se serve.
- **Pre-lavoro ora**: nessuno. Decisione condizionale, non
  pianificata.

**Principio comune**: questi 4 tuning si chiudono con DATI di
generazioni reali, non con altre ricerche. Fissare le soglie ora
"a naso" sarebbe falsa precisione. Le lasciamo come placeholder
dichiarati e le caliamo quando il codice produce numeri veri.

---

# CONCLUSIONE

Il blueprint v2 è autoportante: definisce schema dati, algoritmi,
catalog, integrazioni e roadmap. Copre i 7 gap che separavano il
v1 dalla "macchina perfetta" della Pietra, più i 4 deferred tuning
(parte R) che si chiuderanno con dati reali durante lo sviluppo.

Stato al 2026-05-24: Fase 2 Resource Hunt completata, Categoria 1
(verifiche licenza) completata — 24 repo ingeribili confermati via
gh, 2 DOI accademici verificati, fintech-world AGPL intercettato e
scartato. Restano: Gap 1 (LoRA Civitai, serve login utente) +
Categoria 2 (ingestion code + asset + cataloghi).

Dopo Categoria 2, il codice diventa la parte facile.
