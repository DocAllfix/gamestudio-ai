# Deep Research Prompt — Game Reasoning Engine

Documento operativo per lanciare una sessione di **Deep Research** (Gemini /
ChatGPT / Perplexity Pro) che raccolga la letteratura tecnica necessaria a
progettare in concreto il **Game Reasoning Engine**: il layer sopra Hermes
che modella un gioco come sistema coerente (Game Plan + Game Graph) prima
che venga generato un singolo file.

Versione: 1.0 — 2026-05-23
Output atteso: un report con citazioni reali (paper, codice OSS, blog
tecnici, talk GDC) che useremo come base per scrivere il blueprint del
Reasoning Engine in Fase 2.

---

## Parte A — Perché serve questa ricerca

### Cosa abbiamo già deciso (NON va ri-ricercato)

Dal documento `docs/pietra_v4 (1).md` (Parte I-BIS):

- L'orchestratore è **Hermes Agent pattern** (memoria a 3 livelli, tool
  registry, retry ricorsivo) reimplementato in TypeScript in Trigger.dev.
  Non LangGraph, non CrewAI, non AutoGen.
- Sopra Hermes c'è il **Game Reasoning Engine** con 6 moduli (Intent
  Interpreter, Design Planner, Consistency Manager, Balance Controller,
  Execution Orchestrator, Evaluation Agent).
- L'oggetto centrale è il **Game Plan** (JSON strutturato: meta, core_loop,
  world_graph, pacing, aesthetics, rules) e il **Game Graph** (zone+gating,
  NPC+lore, dipendenze gameplay).
- Ispirazione narrativa: AI Director di Left 4 Dead.

Tutto questo è già fissato. La ricerca NON deve mettere in discussione la
scelta dell'orchestratore o dei moduli — quelle decisioni sono congelate.

### Cosa è ancora VAGO e va riempito con letteratura

Il problema concreto: oggi sappiamo *cosa* fa il Reasoning Engine ma non
sappiamo *come* farlo bene. Il Game Plan è un JSON con campi sensati a
intuito, non basato su un modello formale di game design. Senza fondamenta
rischiamo di:
- inventarci metriche di pacing/difficulty arbitrarie che non corrispondono
  a niente di misurabile;
- produrre Game Plan che generano giochi tecnicamente assemblati ma
  ludicamente piatti (l'opposto del nostro selling point);
- duplicare lavoro che esiste già in PCG accademica (procedural content
  generation) e nei generatori multi-agente recenti.

I quattro buchi concreti da riempire con la ricerca:

1. **Formalizzazione game design.** Esiste un modo *standard* di rappresentare
   un gioco come oggetto strutturato? (Spoiler: sì, ma vanno trovati i
   nomi giusti e visti i pro/contro.)
2. **PCG mission/space/quest generation.** Quarant'anni di letteratura su
   come generare livelli, missioni, narrativa procedurale. Cosa è
   riutilizzabile per noi, cosa no.
3. **LLM-driven game generation / agent orchestration recente (2023–2026).**
   Cosa hanno provato Voyager, Generative Agents, MetaGPT, ChatDev e i lavori
   GameGPT-like. Quali pattern di orchestrazione funzionano, quali falliscono.
4. **Concorrenti reali.** Rosebud, SEELE, Ludo.ai, Inworld, Charisma, Hidden
   Door, Astrocade. Cosa fanno *esattamente*, cosa generano, cosa NON
   generano, qual è il loro pipeline pubblico (papers/blog/talk/leak).

### Cosa faremo con i risultati

I risultati della ricerca diventano la base per:
- `docs/GAME_REASONING_ENGINE_BLUEPRINT.md` — schema dati definitivo del
  Game Plan, regole formali per ogni modulo, metriche concrete.
- Decidere se certi moduli (Balance Controller, Consistency Manager) si
  appoggiano a librerie/algoritmi già pubblicati invece di reinventare.
- Identificare gap di prodotto rispetto ai concorrenti che possiamo coprire
  con dati nostri.

Non è ricerca accademica fine a sé stessa: ogni paper citato deve avere
una chiara "applicabilità" sul nostro pipeline.

---

## Parte B — I 4 filoni di ricerca, in dettaglio

### Filone 1 — Formalismi di game design

Vogliamo sapere quali sono i framework *consolidati* per rappresentare un
gioco come struttura dati. Non vogliamo l'ennesima riassunto di "cos'è un
videogioco" — vogliamo schemi e ontologie utilizzabili come blueprint per
il nostro Game Plan JSON.

Termini chiave da cercare:
- **MDA framework** (Hunicke, LeBlanc, Zubek 2004) — Mechanics, Dynamics,
  Aesthetics. È citatissimo ma è davvero operativo o solo descrittivo?
- **VGDL — Video Game Description Language** (Schaul 2014) + **GVGAI
  competition** — un DSL formale per descrivere giochi 2D. Esempi reali,
  granularità, limiti.
- **Ludi / Ludii general game system** (Browne, Stephenson) — formalizzazione
  giochi astratti, possibilmente non applicabile a noi ma vale capire.
- **Game ontology project** (Zagal et al.) — tassonomia accademica di
  meccaniche/elementi di gioco.
- **Story-driven game design formalisms**: ABL, Façade, Versu — modelli
  formali per gameplay narrativo (interessante per Ren'Py / VN).
- **Mechanic-Dynamic-Aesthetic in pratica**: ci sono case study di studi
  AAA che lo usano davvero, o è solo materiale da corso universitario?

Output richiesto per ogni framework citato:
- 1 paper canonico (autore, anno, link)
- 2-3 implementazioni open source o tool reali, se esistono
- Verdetto: "applicabile al nostro Game Plan", "applicabile parzialmente"
  o "solo storico/non utile" — con motivo concreto.

### Filone 2 — Procedural Content Generation (PCG)

Quarant'anni di letteratura. Ci servono i sottoinsiemi davvero rilevanti per
"generare contenuti di un gioco a partire da un piano di alto livello".

Sotto-aree da scandagliare:
- **PCG via search / constraint** (Togelius, Yannakakis): pattern di base.
  *Procedural Content Generation in Games* (libro Togelius/Shaker/Nelson
  2016) è la bibbia — vogliamo i capitoli più applicabili.
- **PCG-G — generic** vs **PCG-Mission/Space generation** (Dormans,
  Bakkes) — schemi a livelli misti: prima la *missione* (grafo di sfide),
  poi lo *spazio* (mappa concreta). Questo è esattamente il nostro pattern
  Game Plan → Game Graph: c'è già teoria pronta.
- **Mission graph generation**: papers di Joris Dormans, generative
  grammars per dungeon e missioni.
- **Wave Function Collapse** (Maxim Gumin) e implementazioni reali (DeBroglie
  in C#, WFC in Godot). Utile per `tilemap_populate`, ma anche come case
  study di "regole locali → output globale coerente".
- **Constraint-based level generation** (ASP/Answer Set Programming,
  Smith/Mateas): Tanagra, Cellular automata per cave. Pro/contro vs
  WFC.
- **Experience-driven PCG (EDPCG)** — Yannakakis/Togelius: generazione
  guidata da modello del giocatore (curva di tensione, flow). Direttamente
  collegato al nostro Balance Controller e pacing.
- **Drama management / AI Director** — paper Magerko, Mateas, Riedl. L'AI
  Director di Left 4 Dead ha pubblicazioni Valve associate (Booth 2009 GDC).

Output richiesto:
- Per ogni sotto-area, 2-3 paper o tool citabili.
- Mappare ogni cosa trovata su uno dei nostri 6 moduli del Reasoning
  Engine (Intent Interpreter, Design Planner, Consistency Manager,
  Balance Controller, Execution Orchestrator, Evaluation Agent) — o
  scartare se non applicabile.

### Filone 3 — LLM + multi-agent per generazione contenuti (2023–2026)

L'ondata recente di lavori dove un LLM orchestra processi creativi o
costruttivi. Vogliamo distillare *pattern architetturali* riutilizzabili,
non hype.

Cose specifiche da cercare:
- **Voyager** (Wang et al. 2023, MineDojo) — LLM agente in Minecraft che
  scrive skill in JS e le accumula in una skill library. Pattern di
  *skill memory* direttamente rilevante per la nostra Episodic Memory.
- **Generative Agents** (Park et al. 2023, Stanford) — simulazione NPC con
  memoria/riflessione/pianificazione. Schema della loro memory stream
  applicabile alla nostra Long-Term Knowledge.
- **MetaGPT / ChatDev / Agentverse / AutoGen** — multi-agent system per
  software engineering. Pattern di handoff, code review, role-based
  prompting. Quali sopravvivono al banco di prova, quali sono paper-only.
- **GameGPT, GameGen-X, GameLLM, Genie 2 (Google DeepMind), GenLM**: lavori
  specifici su generazione videoludica con LLM o modelli world-generation.
  Cosa generano *davvero* (codice, livelli, world models)?
- **WorldGPT / Cradle / GPT-4 Architect**: agenti che usano LLM per
  costruire mondi 3D o assemblare progetti.
- **Tree of Thoughts / Reflexion / Self-Refine** — pattern di reasoning
  iterativo che servono al nostro Consistency Manager e Evaluation Agent.
- **Structured outputs / function calling reliability**: Outlines, Instructor,
  guidance — come garantire che il Game Plan JSON sia sempre valido.

Output richiesto:
- Tabella: lavoro / anno / cosa produce / cosa NON produce / pattern
  riutilizzabile per noi.
- Identificare 3-5 paper la cui architettura possiamo *clonare* direttamente
  per un nostro modulo (non solo "leggere e ispirarsi").

### Filone 4 — Reverse engineering dei concorrenti

Vogliamo capire, con materiale pubblico verificabile, cosa fanno
*davvero* gli altri. Non opinion piece, ma:
- documentazione tecnica pubblicata,
- blog di engineering,
- talk a conferenze (GDC, NeurIPS workshop, Game AI Summit),
- video demo dettagliati,
- recensioni tecniche di chi li ha usati seriamente.

Concorrenti da analizzare:
- **Rosebud AI** (rosebud.ai) — genera giochi web. Quale stack? Quali
  engine target? Solo Phaser/web o anche Godot? Genera asset o usa CC0?
- **SEELE** — generatore 3D AI. Quale tipo di output, quale qualità.
- **Ludo.ai** — assistente game design. Strumenti, output, posizionamento.
- **Inworld AI** — character/NPC generation. Architettura del loro Character
  Engine, integrazione con Unity/Unreal.
- **Charisma.ai** — narrative engine. Approccio rispetto a un classico tree.
- **Hidden Door** — generative narrative platform. Vincenze Bonelli ha
  fatto post tecnici.
- **Astrocade** — UGC + AI assist.
- **Roblox AI tools** (Code Assist, Material/Texture Generator) — i loro
  paper / blog tecnici pubblici (Roblox ha un team di ricerca attivo).
- **Unity Muse / Sentis** — AI tooling di Unity, cosa fanno *davvero*.
- **Unreal Procedural Content Generation Framework (PCG)** — è uscito in
  Unreal 5.2+, pattern e limiti.

Output richiesto per ognuno:
- Cosa generano (concretamente, con esempi).
- Stack tecnico noto (LLM usati, engine target, pipeline).
- Quale fascia di gioco coprono (gen 1 web games / 3D demo / character / etc.).
- Gap rispetto al nostro positioning multi-engine + Game Reasoning Engine.
- Citazioni pubbliche (no rumor).

---

## Parte C — Anti-pattern (cosa NON vogliamo nel report)

In base al fallimento del prompt v1 dell'harvest (Gemini ha scritto un
saggio metodologico di 6000 parole e 8 URL allucinati), valgono queste
regole assolute per il Deep Research:

1. **Niente teoria generica.** "Cos'è il game design", "perché serve un
   reasoning engine", "panoramica della PCG" sono spazzatura. Sappiamo già.
2. **Niente metodologia.** Non vogliamo sapere *come* Gemini ha cercato.
   Vogliamo i risultati.
3. **Niente parole come "framework concettuale", "decostruzione",
   "tassonomia di alto livello", "lente metodologica".**
4. **Ogni paper citato deve avere autore + anno + link verificabile** (DOI,
   arXiv, ACM, IEEE, link diretto al PDF). Niente "Smith et al. discusses
   this in a 2019 paper" senza link.
5. **Ogni tool open source citato deve avere link GitHub/GitLab verificato.**
   No URL inventati. No `github.com//` con owner vuoto. No repo archiviati
   senza dirlo.
6. **Ogni concorrente citato deve avere fonti pubbliche linkate** (loro
   sito, blog, talk YouTube, demo verificabile). No "si dice che".
7. **Quando un'area è povera, dirlo esplicitamente** ("non ho trovato lavori
   recenti su X") invece di inventarsi citazioni.
8. **Output finale: liste e tabelle, no narrativa.** Una bullet per item.
9. **Lingua: inglese tecnico è ok**, italiano va benissimo, mix è ok.
   Niente fronzoli.
10. **Se l'autore del paper o il nome del progetto non è ricordato con
    certezza, ometterlo invece di inventare.**

---

## Parte D — Prompt da incollare (copia-incolla letterale)

> Allegare a Gemini Deep Research **solo questo file**
> (`GAME_REASONING_ENGINE_RESEARCH_PROMPT.md`) e il file
> `docs/pietra_v4 (1).md` (per il contesto del progetto). Nient'altro:
> blueprint del RAG, finding sulla copertura, prompt harvest precedenti
> NON servono e confondono.

````
Sei in modalità Deep Research per un progetto reale, non un esercizio
accademico. Negli allegati c'è la specifica completa del problema.

IL TUO COMPITO

Produrre UN report che mi serve come base per progettare il Game Reasoning
Engine di un prodotto chiamato Game Studio AI. Il documento allegato
"GAME_REASONING_ENGINE_RESEARCH_PROMPT.md" definisce esattamente 4 filoni
di ricerca, l'output richiesto per ognuno, e un elenco di anti-pattern.
Seguilo alla lettera.

REGOLE ASSOLUTE (non negoziabili)

1. NON scrivere teoria, metodologia, "framework concettuale",
   "decostruzione", "campionamento", "raffinamento iterativo". Se ti
   trovi a scriverle, fermati e cancella.
2. NON spiegare cosa stai per fare o come stai facendo la ricerca.
3. NON parafrasare le mie istruzioni: vai direttamente ai risultati.
4. Ogni paper citato: autore + anno + link verificabile (arXiv/DOI/ACM/
   IEEE/PDF diretto). Se non hai il link, ometti il paper.
5. Ogni tool/repo open source citato: link GitHub/GitLab verificato. NIENTE
   URL inventati. Se il repo è archiviato o ha <50 stelle, dillo.
6. Ogni concorrente citato: link diretto a fonte pubblica (sito ufficiale,
   blog di engineering, talk YouTube, paper). NIENTE "si dice che".
7. Se un'area è povera di letteratura recente, DILLO. Non inventare.
8. Output: liste e tabelle compatte. UNA frase per item. Niente prosa
   discorsiva, niente introduzioni, niente conclusioni filosofiche.
9. Lingua: italiano o inglese tecnico, indifferente. Vietate parole come
   "olistico", "paradigma", "ecosistema concettuale".

I 4 FILONI

Vedi la Parte B del documento allegato. In sintesi:

FILONE 1 — Formalismi di game design (MDA, VGDL/GVGAI, Ludii, Game
Ontology Project, ABL/Façade/Versu). Per ognuno: 1 paper canonico + 2-3
implementazioni reali + verdetto applicabile/parziale/non-utile per il
nostro Game Plan JSON.

FILONE 2 — PCG (Procedural Content Generation): Togelius/Shaker/Nelson
2016, Dormans mission/space generation, Wave Function Collapse,
constraint-based (ASP/Smith/Mateas), Experience-driven PCG
(Yannakakis), Drama Management / AI Director (Magerko/Mateas/Riedl/Booth
GDC 2009). Per ogni sotto-area: 2-3 paper o tool citabili + mappatura
a uno dei nostri 6 moduli (Intent Interpreter, Design Planner,
Consistency Manager, Balance Controller, Execution Orchestrator,
Evaluation Agent) o scartato con motivo.

FILONE 3 — LLM + multi-agent per generazione (2023-2026): Voyager,
Generative Agents (Park 2023), MetaGPT, ChatDev, AutoGen, GameGPT,
GameGen-X, Genie 2 (DeepMind), Cradle, Tree of Thoughts, Reflexion,
Self-Refine, Outlines/Instructor per structured outputs. Tabella
obbligatoria: lavoro / anno / cosa produce / cosa NON produce /
pattern riutilizzabile per noi. Identificare 3-5 lavori la cui
architettura possiamo clonare per un modulo specifico.

FILONE 4 — Reverse engineering concorrenti: Rosebud AI, SEELE, Ludo.ai,
Inworld AI, Charisma.ai, Hidden Door, Astrocade, Roblox AI tools
(Code Assist, Material Generator), Unity Muse / Sentis, Unreal PCG
Framework. Per ognuno: cosa generano concretamente / stack tecnico noto
/ fascia di gioco coperta / gap rispetto al nostro positioning / 1-3
link a fonti pubbliche verificate.

OUTPUT FINALE

Quattro sezioni, una per filone, nell'ordine sopra. Ogni sezione una
serie di item brevi con link. Tabelle dove indicato. Lunghezza target
totale: 2500-4000 parole. Se ti accorgi di andare oltre con prosa di
riempimento, taglia.

In coda al report, una sezione "GAPS NELLA LETTERATURA" di 5-10 righe
con quello che NON hai trovato e che meriterebbe ricerca primaria
(intervista esperti, contatto autori, etc.).

PROCEDI.
````

---

## Parte E — Cosa fare dopo il report

1. Salvare l'output di Gemini in `docs/RESEARCH_OUTPUT_reasoning_engine.md`.
2. Verificare ogni link citato (script di check rapido o spot-check
   manuale dei primi 10). Quelli morti/inventati → segnali di
   allucinazione, da rimuovere.
3. Per ognuno dei 6 moduli del Reasoning Engine, scegliere 1-2 paper/tool
   come fondazione concreta.
4. Scrivere `docs/GAME_REASONING_ENGINE_BLUEPRINT.md` con: schema dati
   formalizzato del Game Plan, algoritmi scelti modulo per modulo, metriche
   misurabili (non vibe-based) per pacing/difficulty/coerence.
5. Solo dopo il blueprint, scrivere codice.

Il vincolo: **niente codice del Reasoning Engine prima del blueprint, e
niente blueprint prima dei riferimenti**. Stesso anti-pattern del Game
Plan: prima il piano, poi l'implementazione.
