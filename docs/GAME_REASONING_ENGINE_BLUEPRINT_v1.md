# Game Reasoning Engine — Blueprint v1 (consolidato)

**Data**: 2026-05-23
**Stato**: prima sintesi dopo 2 round Deep Research + verifica manuale
**Input**: pietra_v4 (1).md, RAW reports Gemini round 1+2, review v1+v2,
verifiche spot WebFetch.

Documento operativo: prepara la transizione da "il Reasoning Engine è
6 moduli vaghi e un AI Director come metafora" a "ogni modulo ha un
algoritmo, un riferimento, e una metrica misurabile".

---

# PARTE A — Bilancio della Pietra v4 (perché era ancora vago)

Nel mio audit della Pietra v4 erano emersi 4 punti di mediocrità sul
Reasoning Engine:

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
   "stato dell'arte" — il rischio è di reinventare PCG male.

Dopo 2 round Deep Research + review, abbiamo materiale per coprire
tutti e 4 i punti. Questo blueprint lo formalizza.

---

# PARTE B — Riferimenti VERIFICATI da usare

Lista finale, dopo spot-check WebFetch e verifica primi autori.

## B.1 Paper canonici da incorporare

| Item | Autore (cognome verif.) | Anno | Link | Ruolo |
|---|---|---|---|---|
| Voyager | Wang G. | 2023 | arXiv:2305.16291 | Skill memory pattern |
| Generative Agents | Park J.S. | 2023 | arXiv:2304.03442 | Memory Stream / Reflection |
| MetaGPT | Hong S. | 2023 | arXiv:2308.00352 | SOPs handoff |
| ChatDev | Qian C. | 2023 | arXiv:2307.07924 | Chat Chain sequencing |
| AutoGen | Wu Q. | 2023 | arXiv:2308.08155 | Multi-agent conv. |
| Tree of Thoughts | Yao S. | 2023 | arXiv:2305.10601 | Reasoning Design Planner |
| Reflexion | Shinn N. | 2023 | arXiv:2303.11366 | Loop Evaluation Agent |
| Self-Refine | **Madaan A.** | 2023 | arXiv:2303.17651 | Dialog self-correct |
| Cradle | Tan W. | 2024 | arXiv:2403.03186 | Screen-based QA |
| CAMEL | Li G. | 2023 | arXiv:2303.17760 | Role-play multi-agent |
| AgentVerse | Chen W. | 2023 | arXiv:2308.10848 | Parallel exec |
| Self-Discover | Zhou P. | 2024 | arXiv:2402.03620 | Reasoning composition |
| Story2Game | Zhou E. | 2025 | arXiv:2505.03547 | Story → code IF |
| WHAT-IF | **Huang R.** | 2024 | arXiv:2412.10582 | Branching narrative |
| MT-Bench LLM-judge | Zheng L. | 2023 | arXiv:2306.05685 | Eval pattern |
| LLM+Games Survey | Gallotta R. (+ Liapis) | 2024 | arXiv:2402.18659 | Survey area |
| MarioGPT | Sudhakaran S. | 2023 | arXiv:2302.05981 | Text→Level LLM |
| GameGPT | Chen D. | 2023 | arXiv:2310.08067 | Multi-agent game dev |
| Ludii Overview | Stephenson M. | 2019 | arXiv:1907.00240 | General game system |
| MDA | Hunicke R. | 2004 | cs.northwestern.edu/~hunicke/MDA.pdf | Lente design |

## B.2 PCG canonici (da verificare a campione, alcuni paywall)

| Item | Autore | Anno | Note |
|---|---|---|---|
| ASP-PCG | Smith G./Mateas M. | 2011 | IEEE TCIAIG — paywall, da verificare il DOI esatto |
| PCGML Survey | **Summerville A.** | 2018 (arXiv 2017) | arXiv:1702.00539 ✓ |
| WFC discriminativo | Karth I. | 2019 | FDG, da verificare |
| Mixed-Initiative | Yannakakis G./Liapis A. | 2014 | FDG |
| Sentient Sketchbook | Liapis A. | 2013 | CIG/FDG |
| Ropossum | Shaker M./Shaker N./Togelius J. | 2013 | AAAI AIIDE |
| Sonancia | Lopes P. | 2015 | ICCC |
| Dormans mission/space | Dormans J. | 2010-2011 | PCG workshop |
| EDPCG | Yannakakis G./Togelius J. | 2011 | IEEE TAC |
| Tanagra | Smith G./Whitehead J./Mateas M. | 2010 | FDG |
| Booth L4D | Booth M. | 2009 | GDC slides |
| WFC as constraint prog | Karth I./Smith A. | 2017 | EXAG workshop |
| Caves of Qud history | Grinblat J. | 2018 | GDC YouTube |
| Dwarf Fortress | Adams T. | varie | StackOverflow blog + GDC |
| RimWorld | Sylvester T. | 2017 | GDC YouTube |

## B.3 Repos / librerie operative

| Repo | Linguaggio | Stelle | Licenza | Uso nel nostro stack |
|---|---|---|---|---|
| stanfordnlp/dspy | Python | molto attivo | MIT | Game Plan compilation |
| BorisTheBrave/DeBroglie | C# | 513 | MIT | `tilemap_populate` |
| galaxykate/tracery | JS | 2.2k | Apache-2.0 | Design Planner lore |
| increpare/PuzzleScript | JS | 1.1k | MIT | DSL ref. per 2D Game Plan |
| ganelson/inform | C/CWeb | 1.6k | Artistic-2.0 | DSL ref. per IF/VN |
| dottxt-ai/outlines | Python | 13.9k | Apache-2.0 | Structured JSON enforce |
| Ludeme/Ludii | Java | 154 | proprietary | NON adottato (giochi astratti) |
| mxgmn/WaveFunctionCollapse | C# | 25k | MIT | WFC riferimento |

## B.4 Concorrenti — analisi positioning

| Competitor | Cosa fa | Gap rispetto a noi |
|---|---|---|
| Rosebud AI | Web games Phaser/Three con LLM copilot | No multi-engine, no export desktop |
| SEELE | Text→3D scene base | Black box, no export |
| Ludo.ai | GDD/concept art | No build giocabile |
| Inworld AI | NPC autonomi text+voice | Middleware, no game generation |
| Convai | NPC vocali low-latency | Solo NPC, non gameplay |
| Charisma.ai | Narrative branching deterministico | Solo storytelling |
| Hidden Door | IP-licensed narrative roleplay | No engine, no rendering |
| Astrocade | Casual UGC mobile | Walled garden |
| Roblox AI | Code Assist + Material Gen | Solo Roblox |
| Unity Muse/Sentis | In-editor assist + ONNX local | Solo Unity, no orchestrator |
| Unreal PCG | Procedural node graph | Solo Unreal, technical-artist required |
| Promethean AI | 3D set dressing | Solo Unreal AAA |
| Scenario.gg | Asset 2D consistent | Solo asset, no logica |
| Layer.ai | Batch asset enterprise | Solo asset volume |
| GDevelop AI | No-code game logic | Solo GDevelop |
| Buildbox AI | Hyper-casual mobile | Walled garden |
| Microsoft Muse | Video prediction Xbox | Non genera codice |
| Tales.world | (scam, escluso) | N/A |

**Pattern**: nessun competitor copre *contemporaneamente*
(a) multi-engine export con codice owned-by-developer,
(b) game reasoning a livello di sistema (non solo asset o NPC),
(c) tier indie/free.

---

# PARTE C — Schema dati formalizzato del Game Plan

Sostituiamo le stringhe descrittive della Pietra v4 con tipi
computabili. Inspirato a VGDL (Schaul 2014), PuzzleScript (Lavelle) e
Tanagra (Smith/Whitehead/Mateas 2010).

```ts
type GamePlan = {
  meta: {
    genre: GenreEnum,                  // enum chiuso (no stringa libera)
    sub_genre: SubGenreEnum,
    target_engine: EngineEnum,         // 1 dei nostri 8
    target_duration_minutes: number,
    audience: AudienceEnum,
    difficulty: DifficultyCurve,       // funzione, non stringa
  },
  core_loop: {
    primary_actions: ActionEnum[],     // dal Game Ontology / nostro tassonomico
    secondary_actions: ActionEnum[],
    reward_cycle: RewardPattern,       // enum: ability_gating, score, lore, currency
    risk_reward: {
      death_penalty: PenaltyEnum,
      recovery_mechanic: RecoveryEnum,
    },
  },
  world_graph: {
    zones: Zone[],                     // nodi
    edges: Edge[],                     // archi con gating typed
    soft_lock_invariants: Invariant[], // condizioni ASP-style (Smith 2011)
  },
  pacing: {
    target_curve: Float[],             // sample da Yannakakis EDPCG: stress(t)
    stress_metrics: StressDef,         // come misurarlo (enemies/min, hp_loss/min, etc.)
    director_rules: DirectorRule[],    // L4D-style ma formalizzati
  },
  aesthetics: {
    art_style: StyleEnum,
    palette: HexColor[],               // tipo, validato
    resolution: Vec2,
    music_mood: MoodEnum,
    sfx_style: SfxStyleEnum,
  },
  rules: {                             // tutto numeric, validabile via ASP
    player_hp_range: [number, number],
    enemy_damage_range: [number, number],
    boss_phases: { min: number, max: number },
    max_simultaneous_enemies: PerZone<number>,
    checkpoint_frequency: number,      // in stanze
  },
  invariants: GlobalInvariant[],       // soft-lock, coerenza narrativa, etc.
}
```

**Differenze chiave vs Pietra v4**:
- `difficulty` da stringa `"medium-hard"` → funzione `DifficultyCurve`
  parametrizzabile (sample da curva Yannakakis EDPCG).
- `pacing.stress` da stringa `"building"` → array di sample temporali
  + regole director esplicite.
- `world_graph.gating` da stringa `"requires_dash"` → tipo `Edge` con
  `gating: AbilityRequirement[]` validabile.
- Aggiunto `invariants[]`: lista di condizioni globali (no soft-lock,
  coerenza lore) verificabili come Answer Set Programming a la
  Smith/Mateas 2011.

---

# PARTE D — I 6 moduli, blueprint operativo

Per ogni modulo: **input precisi, algoritmo, riferimento canonico,
metrica di successo, modello LLM consigliato**.

## D.1 Intent Interpreter

**Compito**: da brief utente → Game Plan v0 con i campi `meta`,
`core_loop.primary_actions`, `aesthetics` riempiti.

**Algoritmo**:
1. DSPy signature `BriefToGamePlanV0` con structured outputs Outlines.
2. Mixed-Initiative (Yannakakis 2014) — se brief è sotto soglia di
   chiarezza, il sistema propone varianti proattive invece di chiedere
   chiarimenti seriali.
3. Vocabolario chiuso: `genre`/`sub_genre`/`audience` da enum
   esplicito (ispirato a Game Ontology Project di Zagal 2007, ma
   nostro).

**Riferimenti**: DSPy (Khattab), Yannakakis 2014, Self-Discover
(Zhou P. 2024) per la composizione di reasoning module.

**Metrica**: % di campi Game Plan v0 riempiti senza follow-up. Target
≥80% al primo prompt.

**Modello**: Claude Sonnet (reasoning forte, output strutturato OK).

## D.2 Design Planner

**Compito**: da Game Plan v0 → Game Plan raffinato con `world_graph`,
`pacing.target_curve`, `rules` numeriche.

**Algoritmo**:
1. **Mission/Space generation** (Dormans 2010-2011): prima si
   genera il grafo della missione (sfide+gating), poi lo si traduce
   in topologia spaziale.
2. **Tracery** per pre-generare scheletri di lore/dialoghi prima di
   spendere token LLM su prosa finale.
3. **Caves of Qud pattern** (Grinblat GDC 2018): generate-then-justify
   per la storia delle zone, non simulazione cronologica completa.
4. **Tree of Thoughts** (Yao 2023) per il branching delle scelte di
   design (provare N varianti di world_graph, valutarne le metriche,
   tenere la migliore).
5. **AgentVerse** (Chen W. 2023) per esecuzione parallela: 3 agenti
   (combat designer, economy designer, narrative designer) lavorano
   in parallelo sui rispettivi campi e poi convergono.

**Riferimenti**: Dormans 2011, Tracery (Compton 2015), ToT,
AgentVerse, Caves of Qud talk Grinblat 2018.

**Metrica**:
- Game Plan completo (tutti i campi tipati riempiti).
- 0 soft-lock nel `world_graph` (verificato dal Consistency Manager).
- `pacing.target_curve` con varianza > 0 (no curva piatta).

**Modello**: Claude Sonnet (reasoning), GPT-4o (varianti rapide).

## D.3 Consistency Manager

**Compito**: validare che il Game Plan sia *coerente* (no soft-lock,
no contraddizioni narrative, no regole numeriche incompatibili).

**Algoritmo**:
1. **Answer Set Programming** (Smith G./Mateas M. 2011): tradurre
   `world_graph.soft_lock_invariants` e `invariants[]` in clausole
   ASP, eseguire un solver (clingo/Potassco) per verificare
   soddisfacibilità. Se UNSAT → reject + report del conflitto.
2. **PuzzleScript** come solver di backup per puzzle 2D: se il Game
   Plan include puzzle, generare la rule grammar PuzzleScript e farla
   eseguire headless.
3. **Reflexion** (Shinn 2023): in caso di UNSAT, generare critica
   verbale, ri-prompt al Design Planner con la critica come hint.
4. **Dwarf Fortress pattern** (Adams): separazione macro-generazione
   (biomi) da micro-validazione (drenaggio/erosione) — adatto se
   includeremo terrain 2.5D/3D.

**Riferimenti**: Smith G. 2011 ASP-PCG, PuzzleScript (Lavelle),
Reflexion, DF blog Adams.

**Metrica**: 100% dei Game Plan emessi sono soft-lock-free e
ASP-consistent. Tempo di check < 10s.

**Modello**: DeepSeek V4 Pro (cheap reasoning) + clingo (Python
binding, niente LLM per la parte ASP).

## D.4 Balance Controller

**Compito**: parametri numerici di `rules` e `pacing` portati a valori
ragionevoli per il genere/difficoltà target.

**Algoritmo**:
1. **Experience-Driven PCG** (Yannakakis/Togelius 2011): partendo
   dalla `pacing.target_curve`, calcolare i parametri concreti
   (enemy_damage, spawn_rate, checkpoint_frequency) che generano
   quella curva *attesa*.
2. **Sonancia pattern** (Lopes 2015): se incluso audio dinamico,
   mappare la curva di tensione a parametri audio (volume, BPM,
   layer attivi).
3. **AI Director rules** (Booth 2009 L4D, formalizzate): definire
   regole tipo `if avg_player_hp < 0.4 over 30s then spawn_rate *=
   0.6 for next 60s`. Queste regole sono parte del Game Plan, non
   sono esecuzione runtime — vengono *generate* qui, *eseguite* dal
   runtime di gioco.
4. **Property-based testing** (lib hypothesis Python): gen N varianti
   stocastiche dei parametri, simulare runs astratte, scartare
   varianti che esplodono (boss 1-shot, dps player > boss hp/sec).

**Riferimenti**: Yannakakis/Togelius 2011, Booth 2009, Lopes 2015,
Horn 2014 PCG metrics Mario.

**Metrica**: curva di stress simulata entro ±10% della target.
0 parametri "broken" (rilevati da property-test).

**Modello**: DeepSeek V4 Pro o GPT-4o per le proposte numeriche,
property-test runs in Python puro.

## D.5 Execution Orchestrator

**Compito**: dal Game Plan finale → chiamate ordinate ai 48 tool →
progetto engine assemblato (.zip).

**Algoritmo**:
1. **MetaGPT SOPs** (Hong 2023): ogni tool ha SOP rigida di input/
   output. Niente improvvisazione.
2. **ChatDev Chat Chain** (Qian 2023): sequenza fissa code → art →
   audio → assembly → QA. Niente loop liberi tra dipartimenti.
3. **DeBroglie** (BorisTheBrave) per `tilemap_populate`: WFC C# con
   backtracking, propaga i constraints da `world_graph` ad ogni zona.
4. **CAMEL role-play** (Li G. 2023) per il modulo NPC dialogue
   coherence: assistant agent (NPC) + user agent (player simulato)
   simulano scambi prima del rendering finale, per filtrare
   incoerenze.
5. **Hermes Agent pattern**: 3 memorie (short-term scratchpad,
   long-term user prefs, episodic skill memory à la Voyager).
6. **Episodic Memory à la Voyager** (Wang G. 2023): salva
   (Game Plan, tool calls, success) tuple in Supabase; alla prossima
   richiesta simile, attinge da lì.
7. **RimWorld ECS pattern** (Sylvester GDC 2017): separare logica
   entità da AI Director — il file generato deve avere questa
   architettura per restare modificabile.

**Riferimenti**: MetaGPT, ChatDev, DeBroglie, CAMEL, Voyager,
RimWorld talk.

**Metrica**:
- 100% dei Game Plan validi producono uno zip che compila/build.
- Tempo di materializzazione < 15 min per gioco indie standard.
- Cost < $0.50 per generazione completa (target Pietra: $0-30/mese).

**Modello**: Trigger.dev orchestrator + DeepSeek V4 Pro per code gen
+ tool specialistici (SDXL/FLUX/Meshy/Suno/ElevenLabs).

## D.6 Evaluation Agent

**Compito**: valutare il gioco generato (e ri-proporre patch al Game
Plan se sotto soglia).

**Algoritmo**:
1. **Smoke test headless**: build del progetto + boot + 10s di input
   automatici. Se crash → reject. (Pattern da Cradle, Tan W. 2024.)
2. **Cradle screen understanding**: durante lo smoke test, capture
   screenshot ogni 1s + LLM-vision parser per verificare che la
   scena renderizzi (no schermo nero, no error text on screen).
3. **PCG metrics** (Horn 2014 Mario framework): per ogni livello
   tilemap-based, calcolare linearità, density, leniency.
   Scartare livelli con metriche fuori range definito da
   `pacing.target_curve`.
4. **LLM-as-a-judge** (Zheng L. 2023 MT-Bench pattern): rubrica
   tecnica + Sonnet-4-6 valuta i log testuali (dialoghi, lore) per
   coerenza con `meta.sub_genre` e con il Game Plan.
5. **Ropossum solver pattern** (Shaker 2013): per puzzle generati,
   verificare con un solver simbolico che siano risolvibili.
6. **Reflexion loop** (Shinn 2023): se evaluation < soglia, generare
   critica verbale e re-invocare Design Planner sul subset
   problematico — non rigenerare il gioco intero.

**Riferimenti**: Cradle, MT-Bench, Mario PCG metrics, Ropossum,
Reflexion.

**Metrica**:
- Smoke test pass rate ≥ 95%.
- Evaluation report human-readable per il creatore (cosa funziona,
  cosa migliorare).
- ≤ 2 iterazioni Reflexion in media prima di consegnare.

**Modello**: Claude Sonnet (judge), GPT-4o-mini (parser visivo
veloce), clingo per puzzle solving.

---

# PARTE E — Architettura tecnica complessiva

```
┌─────────────────────────────────────────────────────────────┐
│  Hermes Agent (TypeScript in Trigger.dev)                   │
│  - short-term context (RAM)                                 │
│  - long-term user prefs (Supabase user_preferences)         │
│  - episodic skill memory (Supabase episodic_skills)         │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  Game Reasoning Engine                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐    │
│  │ D.1 Intent   │→ │ D.2 Design   │→ │ D.3 Consist.   │    │
│  │ Interpreter  │  │ Planner      │  │ Manager (ASP)  │    │
│  └──────────────┘  └──────────────┘  └────────────────┘    │
│        DSPy           Dormans              clingo           │
│        Tracery        ToT/AgentVerse       Reflexion        │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐    │
│  │ D.4 Balance  │→ │ D.5 Exec.    │→ │ D.6 Evaluation │    │
│  │ Controller   │  │ Orchestr.    │  │ Agent          │    │
│  └──────────────┘  └──────────────┘  └────────────────┘    │
│        EDPCG          MetaGPT SOPs          Cradle          │
│        AI Director    DeBroglie             MT-Bench judge  │
│        Sonancia       Voyager mem           Ropossum solver │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  48 specialist tools (code_gen, sprite_gen, audio_gen, ...) │
│  → file di progetto per 1 degli 8 engine target             │
│  → KB RAG (`getReferences()` da code_knowledge) chiamato    │
│    PRIMA di ogni code_gen                                   │
└─────────────────────────────────────────────────────────────┘
```

**Tecnologie principali**:
- **DSPy** sostituisce Outlines come motore di compilation prompt-modulo
- **clingo** (Python binding) per ASP validation in D.3
- **DeBroglie** (C# via subprocess) per WFC tilemap_populate in D.5
- **Tracery** (JS) per pre-LLM lore generation in D.2
- **Hypothesis** (Python) per property-based testing parametri in D.4
- **PuzzleScript headless** per puzzle validation in D.3/D.6 (se incluso)

---

# PARTE F — Dove sta il VANTAGGIO competitivo

Audit basato sulla tabella concorrenti (B.4). Nessuno copre
contemporaneamente:

## F.1 La combinazione vincente che proteggiamo

| Asse | Game Studio AI | Best competitor su quell'asse |
|---|---|---|
| Multi-engine code export | 8 engine | Rosebud (2-3) |
| Game Reasoning a livello sistema | Sì (questo blueprint) | Nessuno |
| KB RAG verificata per engine | Sì (7548 chunk, 0 GPL) | Nessuno |
| Owned-by-developer code | Sì (.zip export) | Inworld no, Roblox no |
| Tier indie ($0-30/mese) | Sì | Promethean no (AAA), Layer no (B2B) |
| Asset gen multi-modale | Sì (8 dipartim.) | Scenario solo art |
| NPC autonomi opzionali | Sì (può usare Convai) | Inworld solo NPC |

Nessuno dei 17 concorrenti analizzati copre 5+ di queste righe. Noi
puntiamo a coprirle tutte e 7.

## F.2 I 4 moat reali (non slide)

1. **Game Plan tipato + ASP validation**: nessun competitor ha
   un'oggetto formale del gioco che si valida via solver. Tutti
   lavorano in prosa LLM o in node-graph visivo. È la differenza tra
   un *modello del gioco* e un *flusso di prompt*.

2. **Episodic Memory di skill di generazione**: à la Voyager. Dopo
   N giochi generati, il sistema sa che "per VN comedy 1-2h →
   prompt X funziona". Nessun competitor lo fa.

3. **KB RAG verificata e curata**: nessun competitor pubblicizza
   un dataset interno di codice game-dev con 0 GPL e per 8 engine.
   Inworld/Convai usano LLM general-purpose; Rosebud usa template.

4. **Reasoning Engine come prodotto, non come buzzword**: dopo
   questo blueprint abbiamo un modulo per modulo con citazioni
   reali. Il pitch passa da *"abbiamo un AI Director ispirato a Left
   4 Dead"* a *"il Consistency Manager esegue ASP via clingo sul
   world_graph; metrica X, tempo Y"*. È vendibile a investitori
   tecnici.

---

# PARTE G — Cosa fare per AUMENTARE il gap

Cose oltre quello che è già nel blueprint, ordinate per ROI.

## G.1 Ricerca primaria mirata (ROI alto, costo basso)

Non vale un altro Deep Research. Vale aprire Google Scholar e fare
ricerche puntuali sui buchi noti:

1. **Riedl group lavori 2023-2025**: ACL/EMNLP "Iterative Planning",
   "Suspense", AI Dungeon postmortem. Leggerli tutti, sintetizzarli
   in 1 paragrafo per il D.6.
2. **MarioGPT (Sudhakaran 2023, arXiv:2302.05981) + follow-up**.
   Vedere se l'approccio text2level si può adottare come *cold start*
   per D.5 quando non c'è una zona già definita.
3. **Liapis/Gallotta "LLMs and Games Survey" (arXiv:2402.18659)** —
   è IL nostro survey di riferimento. Da leggere tutto e citarlo in
   ogni modulo dove pertinente.
4. **PCG Benchmark** (cerca "PCG Benchmark" su arXiv) — testbed
   standardizzato per misurare PCG. Adottarlo per validare il D.2/D.4.

## G.2 Game design "lente" da incorporare (ROI medio)

- **MDA framework** come *lente di comunicazione* col creatore: il
  brief utente è in "Aesthetics" (cosa vuole far sentire), il Design
  Planner ragiona in "Dynamics" (loop), l'Execution Orchestrator
  scrive "Mechanics" (regole). Mappare i campi del Game Plan a
  questo triplo livello.
- **Game Design Patterns** (Björk & Holopainen 2005) come
  *vocabolario di vincoli*: il D.3 può usare un dizionario di
  pattern conosciuti per evitare combinazioni incompatibili (es.
  "permadeath + autosave aggressivo" non è coerente).

## G.3 Differenziazione tecnica forte (ROI alto, costo medio)

Cose che NESSUN competitor fa e che possiamo costruirci:

1. **"Decompose-then-RAG"**: prima di chiamare un code_gen_tool, il
   modulo decompone il task in sotto-task tipati, e per ciascuno
   chiama RAG con keyword *categoria+engine+genre*. Già la KB ce
   l'abbiamo (7548 chunks). Nessun competitor pubblicizza una RAG
   curata per game-dev.

2. **"Game Plan Diff"**: ogni iterazione del Reasoning Engine emette
   un diff strutturato del Game Plan (non un nuovo Game Plan
   intero). Permette undo, audit trail, branching alternativi. Stile
   git-for-game-design. Nessun competitor lo offre.

3. **"Playtest Simulator"**: prima di consegnare, il D.6 esegue N=10
   playthrough simulati via agenti LLM (pattern Voyager+CAMEL) e
   raccoglie stress metrics. Confronto vs `pacing.target_curve` →
   adjustment. Nessuno fa playtest sim *prima* del rilascio.

4. **"Constraint Solver per balance"**: il D.4 può modellare il
   balance come constraint satisfaction (a la Tanagra) e
   garantire risultati provably-fair, non vibe-based. Nessuno lo fa.

5. **"Engine-aware code gen"**: il KB RAG già ci permette di
   chiamare il code_gen con context specifico per engine. È più di
   quello che Rosebud o GDevelop fanno (loro hanno 1 engine fisso).

## G.4 Posizionamento narrativo (ROI altissimo, costo zero)

La pietra v4 ha la frase: *"È la differenza tra generare un video e
dirigere un film"*. È buona ma vaga. Dopo questo blueprint diventa:

> *"Gli altri generano asset o NPC o testo. Noi modelliamo il gioco
> come un sistema formale (Game Plan tipato + ASP-verified), lo
> sviluppiamo con 6 moduli specialistici basati su 15 anni di
> ricerca PCG, e lo esportiamo come progetto compilabile su 8 engine
> reali. È la differenza fra un generatore di immagini e un IDE."*

Questa frase è difendibile davanti a un investitore tecnico perché
ogni claim ha un riferimento (Smith 2011 ASP-PCG, Dormans 2011
mission/space, Yannakakis 2011 EDPCG, Voyager skill memory, Booth
2009 director).

---

# PARTE H — Roadmap d'implementazione

Non urgente, ma per fissare le idee:

1. **Settimana 1**: schema dati Game Plan tipato (TypeScript + JSON
   Schema). Test su 3 brief di esempio.
2. **Settimana 2**: D.1 Intent Interpreter con DSPy. Misurare
   completamento campi.
3. **Settimana 3-4**: D.2 Design Planner con Dormans-style mission
   grammar + Tracery + ToT branching.
4. **Settimana 5**: D.3 Consistency Manager con clingo + ASP regole.
5. **Settimana 6**: D.4 Balance Controller con property-test
   parametri.
6. **Settimana 7-8**: D.5 Execution Orchestrator (integrazione con
   i 48 tool esistenti) — è il modulo più lungo.
7. **Settimana 9**: D.6 Evaluation Agent con Cradle pattern + judge.
8. **Settimana 10**: end-to-end test su 3 brief diversi, 3 engine
   diversi.

---

# PARTE I — Cosa serve confermare prima di iniziare

1. Verificare DOI Smith 2011 (IEEE paywall): aprire manualmente.
2. Verificare DOI Liapis 2013 Sentient Sketchbook.
3. Leggere paper Riedl Suspense ACL (per il D.6).
4. Leggere survey Gallotta/Liapis 2024 (cap. per cap.).
5. Decidere se DSPy o Outlines come default — è una decisione
   architetturale. Raccomandazione: DSPy per pipeline, Outlines come
   fallback per JSON-only enforcement.

Tutto il resto è pronto per costruire.
