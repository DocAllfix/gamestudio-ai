# Deep Research Prompt v3 — Game Reasoning Engine (round 2)

Secondo round di ricerca, mirato a colmare le lacune del primo report
(documentate in `docs/GEMINI_REASONING_REPORT_REVIEW.md`).

**Versione**: 3.0 — 2026-05-23
**Round**: 2 di 2 previsti

---

## Cosa serve da questo round

Il round 1 ha coperto il "centro" del campo (Voyager, MetaGPT, Tanagra,
WFC, Booth L4D, etc.) ma ha lasciato fuori 4 cluster importanti e ha
introdotto allucinazioni gravi (Genie 2 con arXiv inventato, Self-Refine
attribuito a "Maman", ABL del database enterprise confuso con ABL di
Mateas). Questo prompt v3:

- copre solo i 4 cluster mancanti (non ridocumenta quello già coperto);
- aggiunge regole anti-allucinazione più strette;
- richiede verifica esplicita di ogni autore (cognome+iniziale) per
  evitare typo che si propagano.

---

## File da allegare

1. Questo file (`GAME_REASONING_ENGINE_RESEARCH_PROMPT_v3.md`).
2. `docs/pietra_v4 (1).md` — contesto progetto.

**Non** allegare il report Gemini precedente né la review. Il
contesto del round 1 va passato in linea nel prompt sotto, in
forma sintetica.

---

## Prompt (copia-incolla letterale)

````
NON scrivere teoria, metodologia, "framework concettuale",
"decostruzione", "tassonomia di alto livello". NON scrivere prosa
pseudo-ingegneristica fatta di neologismi italiani ("walled garden",
"scongiura loop irrisolvibili", "popolamento incrociato", "Generative
4D AI", "stack" usato come sostantivo italiano, "deduttiva alle
entità"). Se una frase non potresti spiegarla a un ingegnere senior
senza che ti rida in faccia, cancellala.

NON inventare URL arXiv. NON inventare nomi di organizzazioni
("AutoGame Research" non esiste). NON inventare architetture di
prodotti commerciali (no "Seele02 + eva01 + NeuralG-Bridge"). NON
attribuire paper a "X et al." se non hai verificato il cognome del
primo autore: Self-Refine è di MADAAN, non MAMAN. Generative Agents
è di PARK. ChatDev è di QIAN. Se non sai il cognome, ometti il paper.

Questo è il SECONDO round di una ricerca per progettare il Game
Reasoning Engine di un prodotto chiamato Game Studio AI. Il round 1
ha già coperto, in modo verificato:
- Voyager, Generative Agents, MetaGPT, ChatDev, AutoGen, ToT,
  Reflexion, Self-Refine, GameGPT (Chen 2023), Cradle, GameGen-X,
  Genie 2 (blog DeepMind, niente arXiv), Outlines (dottxt-ai/outlines).
- VGDL/GVGAI, Ludii, MDA framework, Tanagra (Smith/Whitehead/Mateas
  2010), WFC (Gumin), Dormans mission/space, Yannakakis EDPCG 2011,
  Booth L4D GDC 2009.
- Rosebud, SEELE, Ludo.ai, Inworld, Charisma, Hidden Door,
  Astrocade, Roblox AI, Unity Muse/Sentis, Unreal PCG Framework.

NON ridocumentare questi. Riapparire un secondo significa rumore.

Devi coprire 4 cluster MANCANTI, e basta.

═══════════════════════════════════════════════════════════════════
CLUSTER 1 — Formalismi e DSL operativi per game design
═══════════════════════════════════════════════════════════════════

Tutti questi sono noti, esistono, e vanno solo trovati con link
verificabili e una nota di applicabilità.

1. Game Description Language (GDL) — Genesereth, Love, Pell e poi
   Schkufza/Hinrichs. È il formalismo della Stanford General Game
   Playing competition (AAAI). Cerca: "General Game Playing: Game
   Description Language Specification" (Love et al. 2008).
2. PuzzleScript — Stephen Lavelle. DSL operativo open source che
   ha generato giochi reali. Repo GitHub + sito puzzlescript.net.
3. Inform 7 — Graham Nelson. DSL per interactive fiction. Rilevante
   per il Ren'Py / VN side.
4. Tracery — Kate Compton. Lib JS di grammar-based content
   generation. Repo: galaxykate/tracery. Paper FDG 2015.
5. Game Design Patterns — Björk & Holopainen 2005 (libro Charles
   River Media). Vedi se esiste ancora come PDF open-access.
6. ABL (A Behavior Language) — Mateas & Stern 2002. NB: non
   confondere con Progress ABL (linguaggio database). Cerca il paper
   AAAI 2002 + qualsiasi reimplementazione moderna (la `mkremins/
   praxish` è dichiarata "partial reconstruction"; serve sapere se
   esiste qualcosa di più completo).

Per ognuno: 1 link al paper canonico + 1 link al repo/sito operativo
+ 1 frase di applicabilità ai nostri 6 moduli (Intent Interpreter,
Design Planner, Consistency Manager, Balance Controller, Execution
Orchestrator, Evaluation Agent) o NOTA: "non applicabile per X
motivo".

═══════════════════════════════════════════════════════════════════
CLUSTER 2 — PCG profonda (oltre Tanagra/WFC/Dormans)
═══════════════════════════════════════════════════════════════════

Cose specifiche. Cercale per nome, non per area.

1. Smith & Mateas 2011, "Answer Set Programming for Procedural
   Content Generation: A Design Space Approach", IEEE TCIAIG. È IL
   paper canonico su ASP-PCG. Verifica DOI o link IEEE.
2. Summerville et al. 2018, "Procedural Content Generation via
   Machine Learning (PCGML)", IEEE Transactions on Games. Survey.
3. Karth & Smith 2019, secondo paper su WFC (oltre al 2017 già
   coperto). Cerca: "Addressing the Fundamental Tension of PCGML
   with Discriminative Learning" o simile sotto Karth.
4. Yannakakis, Liapis, Lopes 2014, "Mixed-Initiative Co-Creativity".
   Foundations of Digital Games.
5. Liapis et al., famiglia di tool: Sentient Sketchbook, Ropossum,
   Sonancia. Servono link a paper + repo (anche se vecchi/inattivi,
   dirlo).
6. DeBroglie — BorisTheBrave/DeBroglie su GitHub. Implementazione
   C# di WFC con constraint propagation custom, usata in giochi
   shipped (Caves of Qud). Stelle attuali + ultimo commit + licenza.
7. Britton (o equivalente) — esistono survey "PCG patterns" su
   GameAI.com / blog tecnici. Cercare review pratiche.
8. Caves of Qud / Dwarf Fortress / RimWorld — postmortem tecnici e
   talk GDC sui loro sistemi di generazione. Sono knowledge base
   reale, non accademica. Almeno 1 link per gioco se esiste.

Per ognuno: link verificato + applicabilità a uno dei 6 moduli o
NOTA di non-applicabilità.

═══════════════════════════════════════════════════════════════════
CLUSTER 3 — LLM agent / multi-agent NON coperti nel round 1
═══════════════════════════════════════════════════════════════════

1. CAMEL — Li et al. 2023, "Communicative Agents for 'Mind'
   Exploration of Large Language Model Society". arXiv. Primo lavoro
   serio di role-playing multi-agent.
2. AgentVerse — Chen et al. 2023, arXiv. (Era nel prompt round 1,
   omesso.)
3. DSPy — Khattab et al., Stanford. Repo: stanfordnlp/dspy. NON è
   Outlines/Instructor. È una libreria che programma i prompt come
   moduli compilabili. Per noi è probabilmente più importante di
   Outlines per il Game Plan.
4. Self-Discover — Zhou et al. 2024, Google DeepMind. arXiv.
5. Microsoft Muse — paper Microsoft Research sul world model di
   Xbox Game Intelligence (2024-2025). Cerca link al paper Nature
   o blog Microsoft Research. NB: è diverso da Unity Muse.
6. Riedl group 2023-2025 — Mark Riedl (Georgia Tech) ha pubblicato
   lavori specifici su LLM + game generation / narrative planning.
   Cerca i 2-3 più rilevanti.
7. TaleSpin (Meehan 1977) e MEXICA (Pérez y Pérez 2001) — story
   generation classica. Predecessori di Generative Agents. Da citare
   solo come radici, 1 riga ciascuno.
8. LLM-as-judge per game evaluation — esiste letteratura specifica
   su usare LLM come valutatori di output di gioco (non solo di
   testo)? Se sì, citare. Se no, dirlo.

Tabella richiesta: Lavoro / anno / cosa produce / cosa NON produce /
quale dei nostri 6 moduli può usarlo (o "scartato perché X").

═══════════════════════════════════════════════════════════════════
CLUSTER 4 — Concorrenti NON coperti nel round 1
═══════════════════════════════════════════════════════════════════

1. Convai — convai.com. Alternativa diretta a Inworld per NPC AI.
   Stack, integrazioni Unity/Unreal, fascia di prezzo.
2. Scenario.gg — generazione asset 2D coerenti per giochi. Cosa
   genera, come si integra in pipeline.
3. Layer.ai — concorrente di Scenario.
4. Promethean AI — world-building 3D AI-assistito (Andrew Maximov).
   Talk GDC, demo pubbliche.
5. GDevelop AI features — GDevelop ha integrato AI assist per
   eventi/scripting. Cosa fa concretamente.
6. Buildbox AI — concorrente web/mobile game builder.
7. Tales (tales.io) o equivalenti narrative-AI.
8. Inworld vs Convai vs Charisma — tabella comparativa breve, 5
   colonne max, fatti pubblici verificabili.

Per ognuno: cosa generano (concretamente, con esempio) / stack
tecnico noto da fonti pubbliche / posizionamento di mercato / 1-2
link verificati a fonti ufficiali (sito + 1 talk/blog/paper).
NIENTE architetture inventate. Se non sai lo stack tecnico, scrivi
"stack tecnico non documentato pubblicamente". Quello è OK.

═══════════════════════════════════════════════════════════════════
REGOLE DI OUTPUT
═══════════════════════════════════════════════════════════════════

- 4 sezioni, una per cluster, nell'ordine sopra.
- Liste e tabelle. Una frase per item. Niente prosa esplicativa.
- Lunghezza target: 2000-3500 parole. Sotto le 1500 stai
  sottodimensionando; sopra le 4000 stai riempendo.
- Ogni paper: autore COGNOME (verificato) + anno + link arXiv/DOI/
  IEEE/PDF diretto.
- Ogni repo: link GitHub + stelle approssimative + licenza + ultimo
  commit (anno).
- Ogni concorrente: link al sito ufficiale + 1 fonte secondaria
  (talk, blog, paper, recensione tecnica).
- In coda: sezione "DUBBI E VERIFICHE INCOMPLETE" — 5-10 righe con
  le cose che non hai potuto verificare con certezza. È meglio
  ammetterlo che inventare.

PROCEDI.
````

---

## Note operative (NON parte del prompt)

### Come gestire la sessione

**Domanda originale**: lo posso inviare nella stessa chat del round 1?

**Raccomandazione**: NO. Aprire una chat nuova. Tre motivi:

1. La chat del round 1 ha già 6000+ parole di contesto allucinato.
   Quel contesto biaserà il round 2 — Gemini tenderà a riusare gli
   stessi neologismi e gli stessi pattern di prosa che vogliamo
   evitare.
2. Il prompt v3 dice "non ridocumentare X, Y, Z" — se Gemini ha
   ancora in memoria il round 1, è più probabile che disobbedisca
   e riapra il sipario su Voyager etc.
3. Una chat pulita è anche un test: se Gemini fa lo stesso tipo di
   errori (URL inventati, attribuzioni sbagliate) in una sessione
   fresca, sappiamo che è un problema sistemico e non legato al
   contesto. Informazione utile per il futuro.

Quindi: **nuova chat, alleghi questo file + `pietra_v4 (1).md`, e
basta**. Non incollare il report precedente, non incollare la review.
Il prompt v3 contiene già la sintesi di cosa è stato coperto.

### Cosa fare dopo l'output del round 2

1. Stessa procedura di verifica del round 1: WebFetch dei link più
   critici, controllo che il primo autore esista e che il paper sia
   davvero quello citato.
2. Salvare l'output verificato come `docs/RESEARCH_OUTPUT_reasoning_engine_round2.md`.
3. A quel punto abbiamo abbastanza per scrivere
   `docs/GAME_REASONING_ENGINE_BLUEPRINT.md`. Non prima.
