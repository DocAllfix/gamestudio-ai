# Review critica del report Gemini Deep Research — Game Reasoning Engine

**Data**: 2026-05-23
**Sorgente**: report Gemini Deep Research generato dal prompt
`docs/GAME_REASONING_ENGINE_RESEARCH_PROMPT.md`
**Metodo di review**: lettura parola per parola + verifica via WebFetch dei
link più critici/sospetti + confronto con la letteratura nota.

Verdetto sintetico: **report parzialmente utile**. Il 70-75% delle citazioni
è reale e usabile. Ma c'è una percentuale importante di errori che, se
fossero passati senza review, avrebbero contaminato il blueprint. La
prosa è anche peggio del primo prompt harvest v1: barocca, allucinatoria
sui dettagli implementativi, piena di neologismi.

Procedere così: tenere le citazioni che ho verificato, scartare le
errate, integrare quello che è stato omesso (vedi sezione 4).

---

## 1 — Cosa è stato verificato e confermato corretto

Citazioni che ho verificato via WebFetch e che reggono:

| Item | Link Gemini | Esito |
|---|---|---|
| Voyager (Wang et al. 2023) | arxiv.org/abs/2305.16291 | OK — titolo, autori, data confermati |
| Generative Agents (Park et al. 2023) | arxiv.org/abs/2304.03442 | OK |
| MetaGPT (Hong et al. 2023) | arxiv.org/abs/2308.00352 | OK |
| ChatDev (Qian et al. 2023) | arxiv.org/abs/2307.07924 | OK |
| AutoGen (Wu et al. 2023) | arxiv.org/abs/2308.08155 | OK |
| Tree of Thoughts (Yao et al. 2023) | arxiv.org/abs/2305.10601 | OK |
| Reflexion (Shinn et al. 2023) | arxiv.org/abs/2303.11366 | OK |
| GameGPT (Chen et al. 2023) | arxiv.org/abs/2310.08067 | OK — paper reale |
| Cradle (Tan et al. 2024) | arxiv.org/abs/2403.03186 | OK |
| GameGen-X (Tencent 2024) | arxiv.org/abs/2411.00769 | OK |
| Genie 2 blog DeepMind | deepmind.google/discover/blog/genie-2-... | OK — dicembre 2024 |
| Ludii Overview (Stephenson et al. 2019) | arxiv.org/abs/1907.00240 | OK — autori reali: Stephenson/Piette/Soemers/Browne (NB: il report dà l'ordine sbagliato "Piette, Stephenson, Soemers, Browne") |
| Outlines (libreria structured outputs) | github.com/outlines-dev/outlines | OK come funzionalità, ma il repo è stato rinominato in **`dottxt-ai/outlines`** (13.9k stelle). L'URL vecchio redirige. |
| py-vgdl schaul | github.com/schaul/py-vgdl | Esiste (161 stelle) ma è **DORMANT** — il README dice esplicitamente di usare il fork di Vereecken. Gemini lo nota nel testo ma poi cita entrambi come "implementazioni complete". Non lo sono: l'originale è dichiarato dormiente. |
| Ludii (Ludeme/Ludii) | github.com/Ludeme/Ludii | OK, 154 stelle, attivo (release giugno 2025) |
| fcsouza/agent-skills | github.com/fcsouza/agent-skills | Esiste, 10 stelle, contiene una skill "game-design-fundamentals" che menziona MDA — ma definirla "implementazione del framework MDA" è una forzatura: è una skill markdown che cita MDA, non un framework operativo. |
| Donchitos/Claude-Code-Game-Studios | github.com/Donchitos/Claude-Code-Game-Studios | Esiste, 19.7k stelle, MIT. È un template di workflow Claude Code per game studio, non un'implementazione di MDA. Stessa forzatura di sopra. |

## 2 — Errori, allucinazioni e attribuzioni sbagliate

Cose che il report dice e che sono **sbagliate**. Da non riusare.

### 2.1 Self-Refine attribuito a "Maman et al."
> "Self-Refine (Maman et al., https://arxiv.org/abs/2303.17651)"

Sbagliato. Il paper si chiama "Self-Refine: Iterative Refinement with
Self-Feedback" e il primo autore è **Aman Madaan** (non "Maman"). Errore
di OCR/typo, ma è il tipo di errore che si propaga se lo copi.

### 2.2 Genie 2 con URL arXiv inventato
> "Genie 2 (DeepMind, https://arxiv.org/pdf/2502.11537)"

**Allucinazione completa**. L'URL arxiv 2502.11537 esiste ma è il paper
"Simulus: Combining Improvements in Sample-Efficient World Model Agents"
di Cohen/Wang/Kang/Gadot/Mannor — nulla a che vedere con Genie 2. Genie
2 **non ha un paper arXiv**: esiste solo come post sul blog DeepMind
(dicembre 2024). Il report cita il blog corretto altrove, ma incolla un
arXiv inventato per dare credibilità accademica. È esattamente il tipo
di errore che il prompt v2 doveva impedire.

### 2.3 Outlines attribuito a "Willard, Louf, 2023"
> "Outlines / Instructor (Willard, Louf, 2023, https://github.com/outlines-dev/outlines)"

Outlines è un progetto, non un paper. Brandon Willard e Rémi Louf hanno
scritto il paper di accompagnamento (Willard & Louf, "Efficient Guided
Generation for Large Language Models", arXiv:2307.09702) — Gemini non lo
cita pur essendo il paper canonico. Inoltre il report fa il bundle
"Outlines / Instructor" — ma **Instructor** è un altro progetto (di
Jason Liu, github.com/567-labs/instructor), non parte di Outlines. Sono
due librerie diverse fuse arbitrariamente.

### 2.4 ABL attribuito al solo Mateas (manca Stern)
Il paper sul Behavior Language è Mateas **and Stern** 2002. Il report
elenca solo Mateas in una citazione, e poi nei link mostra l'AAAI
abstract dove Stern compare. Imprecisione che va sistemata.

### 2.5 SBDM attribuito a Magerko
> "architettura SBDM (Magerko, 2005)"

URL che cita è `eis.ucsc.edu/papers/Nelson_Mateas_-SBDM-_AIIDE05.pdf`. Il
nome del file dice **Nelson_Mateas**, non Magerko. Il PDF dell'URL ora
restituisce 404, ma il filename suggerisce che il paper SBDM AIIDE 2005
sia di **Mark J. Nelson e Michael Mateas**, non di Brian Magerko (Magerko
ha una linea di ricerca separata su Interactive Drama, con Riedl). Il
link è morto e l'attribuzione è probabilmente sbagliata.

### 2.6 "ic-pcg/waveFunctionCollapse" come implementazione di rilievo
Gemini cita questo repo. Esiste ma è un progetto studentesco Imperial,
non un'implementazione di riferimento. Il vero riferimento OSS è
`mxgmn/WaveFunctionCollapse` (citato) + `BorisTheBrave/DeBroglie`
(NON citato) che è la lib C# usata in produzione e che a noi serve di
più (la useremo dentro `tilemap_populate`).

### 2.7 Praxish/RePraxis/vscode-abl marcati "<50 stelle" e dati per
**ricostruzioni open source funzionanti** di ABL/Versu

`mkremins/praxish` è una **partial reconstruction** dichiarata. `RePraxis`
è una lib C# per Unity. `vscode-abl` è probabilmente l'estensione di
syntax-highlight per il linguaggio Progress ABL (database language)
— **non c'entra niente con A Behavior Language di Mateas**. Sono due
"ABL" diversi che Gemini ha fuso. Questo è un errore grave: lo capisci
solo se sai che Progress ABL è un linguaggio per DB enterprise. Da
buttare via.

### 2.8 Prosa allucinata sull'implementazione

Il report è pieno di frasi come:
- "risvegliare l'allocatore di RAM dell'engine di livello"
- "layer NeuralG-Bridge su WebGL" (su SEELE — è inventato di sana pianta)
- "Generative 4D AI" (su Roblox — è marketing, non architettura)
- "stack" detto in italiano con parentesi randomiche
- "scongiura loop irrisolvibili generati in cieco dal prompt prima del
  trigger asincrono della task project_validator"

Questa prosa **non descrive niente di reale**. È pseudo-tecnica. Va
ignorata. I link sotto sono spesso giusti, ma il testo che li avvolge
non aggiunge informazione: la confonde.

## 3 — Cose ambigue / da verificare ancora

| Item | Problema |
|---|---|
| Dormans 2010 "adventures.pdf" e Dormans/Bakkes 2011 | PDF non leggibili via WebFetch (binari). I link `pcgworkshop.com` e `sander.landofsand.com` esistono ma non sono verificabili automaticamente. Va aperto manualmente per confermare. La citazione formale è probabilmente OK (Dormans ha effettivamente questi due paper) ma da spot-check. |
| Tanagra (Smith/Whitehead/Mateas 2010) | URL `users.soe.ucsc.edu/~ejw/papers/smith-tanagra-fdg2010.pdf` — non leggibile via fetch. ResearchGate conferma esistenza. Probabilmente OK, autori da verificare contro la pagina FDG 2010. |
| Yannakakis "LevelDesign.pdf" | Stessa cosa. Il vero paper canonico "Experience-Driven Procedural Content Generation" è IEEE TAC 2011: Gemini cita l'URL del PDF su yannakakis.net che PUÒ essere quello giusto, ma il PDF è binario. Da scaricare manualmente. |
| Booth GDC 2009 L4D | URL `steamcdn-a.akamaihd.net/...ai_systems_of_l4d_mike_booth.pdf` — link che storicamente esiste; va verificato che sia ancora vivo (l'host akamai è instabile). |
| Versu (Evans/Short 2014) | URL su cs.uky.edu — non testato, ma Versu è reale e Evans+Short sono gli autori giusti. |
| GameGPT "AutoGame Research" | L'organizzazione attribuita non esiste con quel nome. Il paper è reale (Chen et al. 2023) ma "AutoGame Research" sembra un nome inventato dal report per dare un'identità istituzionale che il paper non ha. |
| `dgarijo/VideoGameOntology` come implementazione del Game Ontology Project | Da verificare: Daniel Garijo è ricercatore reale (semantic web), ma legare il suo repo al Game Ontology Project di Zagal/Bruckman 2007 va dimostrato. Probabilmente è un repo solo correlato, non una "conversione" del GOP. |

## 4 — Cosa è stato OMESSO e dovrebbe esserci

Lacune importanti del report rispetto al prompt che gli ho dato.

### 4.1 Filone 1 — Formalismi di game design

Non citato (o citato male):
- **Game Description Language (GDL)** di Genesereth/Love/Pell — il
  formalismo canonico della General Game Playing competition AAAI. È il
  parente più stretto di VGDL e ne va capita la differenza. (Paper:
  Love/Hinrichs/Schkufza/Genesereth 2008 "General Game Playing: Game
  Description Language Specification".)
- **Ludography di Wolf / Game Studies tradition** — irrilevante per
  noi, ma se Gemini ha citato Zagal/Bruckman, era da menzionare per
  scartare.
- **PuzzleScript** (Lavelle) — DSL operativo, open source, usato
  davvero per generare giochi. Più rilevante di Ludii per il nostro
  caso d'uso 2D.
- **Inform 7** — DSL per IF testuale. Rilevante per il Ren'Py / VN side.
- **Bipartite "design pattern" formalisms** — Björk & Holopainen
  "Patterns in Game Design" 2005, citatissimo nei lavori di PCG.

### 4.2 Filone 2 — PCG

Pesantemente sottodimensionato. Mancano:
- **Tracery** (Kate Compton) — grammar-based content generation. È
  letteralmente il pattern di "Design Planner" tradotto in lib.
- **Answer Set Programming PCG** (Smith/Mateas più altri) — Gemini cita
  Tanagra ma non Smith 2011 "Answer Set Programming for Procedural
  Content Generation: A Design Space Approach" (IEEE TCIAIG), che è IL
  paper sull'ASP-PCG.
- **Mixed-Initiative PCG** (Yannakakis/Liapis/Lopes 2014 "Mixed-Initiative
  Co-Creativity").
- **Sentient Sketchbook / Ropossum / Tanagra** come famiglia di tool
  Yannakakis-Liapis — solo Tanagra è citato.
- **PCGML — PCG via Machine Learning** (Summerville et al. 2018 IEEE
  TG) — review canonica.
- **WaveFunctionCollapse-style come constraint propagation**: Karth &
  Smith hanno almeno DUE paper sull'argomento (2017 e 2019). Il report
  ne cita uno solo.
- **Dwarf Fortress / Caves of Qud / RimWorld postmortem** — knowledge
  base pratica di PCG che esiste in talk GDC e blog, e che non è in
  paper accademici.
- **Britton's PCG patterns survey** o equivalenti.
- **DeBroglie** (BorisTheBrave) — implementazione C# di WFC con
  constraint propagation custom, usata in giochi reali (es. Caves of
  Qud). Per noi è la lib da usare nel `tilemap_populate`. Gemini la
  ignora completamente.

### 4.3 Filone 3 — LLM multi-agent

Mancano:
- **CAMEL** (Li et al. 2023) — il primo paper di role-playing multi-agent.
- **AgentVerse** (Chen et al. 2023) — citato nel prompt, omesso dal report.
- **Self-Discover** (Zhou et al. 2024) — reasoning structures.
- **DSPy** (Khattab et al.) — la libreria per "programmare i prompt", non
  Outlines/Instructor. Sarebbe più rilevante per noi del trio scelto da
  Gemini.
- **GenAgent / Designing Worlds** lavori specifici di Riedl 2024-2025 su
  game design con LLM.
- **TaleSpin / MEXICA** — old-school story generation, predecessori dei
  Generative Agents. Riferimenti per il Consistency Manager.

### 4.4 Filone 4 — Concorrenti

Mancano analisi rilevanti:
- **Suno per audio** (citato nel nostro pietra_v4 ma non come concorrente
  diretto).
- **Scenario.gg** (asset art per giochi).
- **Layer.ai** (asset art pipeline).
- **Promethean AI** (world-building 3D).
- **Convai** (alternativa diretta a Inworld, omessa).
- **GDevelop AI features** — GDevelop ha integrato AI assistance, va
  visto cosa fa.
- **Buildbox AI / Construct AI features** — concorrenti web-game.
- **Microsoft Muse (Xbox Game Intelligence)** — paper Microsoft Research
  2024-2025 su world models, da citare insieme a Genie 2.

L'analisi dei concorrenti che c'è è **descrittiva ma poco affidabile**:
attribuisce a SEELE un "Seele02 + eva01 con NeuralG-Bridge su WebGL"
che è verosimilmente inventato. A Rosebud attribuisce solo
"hypercasual ed endless-runner", ma Rosebud fa molto di più (è una
piattaforma di pubblicazione di giochi Phaser/Three con LLM
copilot). Le pipeline tecniche descritte vanno trattate come
narrazione, non come fact.

## 5 — Cosa è veramente utile, alla fine

Tagliando rumore e inesattezze, il report ci dà:

### 5.1 Lista verificata di paper LLM-multi-agent applicabili

Da copiare in `docs/GAME_REASONING_ENGINE_BLUEPRINT.md` come base:
- Voyager → pattern Episodic Memory + skill library
- Generative Agents → Memory Stream + Reflection
- MetaGPT → SOPs come barriere fra tool
- ChatDev → Chat Chain per il sequencing
- Tree of Thoughts → reasoning del Design Planner
- Reflexion → loop del Consistency Manager / Evaluation Agent
- Self-Refine (Madaan, NON Maman) → dialogue_gen self-correction
- Cradle → screen understanding per QA visivo headless
- Outlines (dottxt-ai/outlines) → JSON schema enforcement Game Plan

Tutti link verificati. Mappature ai nostri moduli grossolanamente sensate.

### 5.2 Conferma dei riferimenti PCG canonici da prendere come fondazione

Il report indica correttamente il *nucleo* della letteratura PCG che ci
serve, anche se incompleto:
- Togelius/Shaker/Nelson 2016 (libro PCG)
- Dormans 2010-2011 (mission/space)
- Karth/Smith 2017 (WFC come constraint programming)
- Smith/Whitehead/Mateas 2010 (Tanagra)
- Yannakakis/Togelius 2011 (EDPCG)
- Booth 2009 GDC (L4D AI Director)

Da integrare con le mancanze elencate nella sez. 4.2.

### 5.3 Mappatura preliminare PCG → moduli del Reasoning Engine

Il report propone (con prosa pessima ma logica accettabile):
- Dormans → Design Planner (mission/space → world_graph + gating)
- WFC → Execution Orchestrator (tilemap_populate)
- ASP/Tanagra → Consistency Manager (validazione geometrica)
- EDPCG → Evaluation Agent (metriche pacing/affect)
- Drama Management/L4D → Balance Controller (stress/pacing)

Questa mappatura è la cosa più utile del report. La adottiamo come
**punto di partenza** del blueprint, modulo per modulo.

---

## 6 — Azioni concrete

1. **Non salvare il report Gemini in `docs/`** così com'è. Salvarlo
   solo come `docs/RAW_gemini_reasoning_research.md` con un disclaimer
   sopra ("contiene errori — vedi `GEMINI_REASONING_REPORT_REVIEW.md`").
2. Quando andremo a scrivere `docs/GAME_REASONING_ENGINE_BLUEPRINT.md`,
   usare **solo** le citazioni verificate nella sezione 1 di questa
   review + le aggiunte della sezione 4.
3. Prima del blueprint, fare una seconda passata di Deep Research
   con un prompt v2 mirato sulle lacune di sezione 4 (PCG profondo,
   DSPy, CAMEL, Microsoft Muse). Stesso anti-pattern del prompt v2
   harvest: vietare neologismi, vietare attribuzioni senza link.
4. **Regola permanente**: ogni paper citato da Gemini va verificato
   contro arXiv / DOI / GitHub prima di entrare nel blueprint. Il
   rapporto verificato/inventato di questo report è circa 70/30 sui
   dettagli (autori, anni esatti, URL specifici). Non è un livello
   di affidabilità accettabile per fare design senza review umana.

## 7 — Una nota sulla qualità della prosa

Il prompt v2 vietava esplicitamente parole come "framework concettuale",
"decostruzione", "tassonomia di alto livello". Il report le ha evitate
in larga parte. Ma le ha sostituite con:
- "scongiura loop irrisolvibili"
- "popolamento e validazione incrociata"
- "barriere logiche imposte"
- "deduttiva alle entità"
- "Walled Garden (ecosistema chiuso)"
- "Generative 4D AI"
- "stack" (come neologismo italiano)

È un nuovo stile di rumore: meno accademico, più pseudo-ingegneristico.
Per la prossima sessione il prompt deve vietare anche questo registro.
Una regola tipo: *"se una frase non potresti spiegarla davanti a un
ingegnere senior senza che ti rida in faccia, riscrivila o cancellala"*.

---

**Conclusione**: il report è utile come **mappa**, inutile come
**verità**. Tieni i 12-15 paper verificati, scarta la prosa,
integra le omissioni della sezione 4, e prima di scrivere il
blueprint fai un secondo round di Deep Research mirato.
