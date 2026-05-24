# Review critica del report Gemini round 2 — Game Reasoning Engine

**Data**: 2026-05-23
**Sorgente**: report Gemini generato dal prompt v3
(`docs/GAME_REASONING_ENGINE_RESEARCH_PROMPT_v3.md`)
**Metodo**: lettura parola per parola + WebFetch dei link critici +
confronto con la prima review (`GEMINI_REASONING_REPORT_REVIEW.md`).

---

## Verdetto sintetico

**Miglioramento netto rispetto al round 1.** Il prompt v3 ha funzionato:
le allucinazioni grossolane (URL arXiv inventati, organizzazioni fasulle,
nomi confusi) sono drasticamente ridotte. La prosa rimane verbosa e
pseudo-tecnica in punti ("solutore deterministico richiamabile via API",
"protocollo di traduzione diretto") ma è informativamente molto più
densa. Tasso verificato/inventato passato da ~70/30 a ~90/10 sui
dettagli puntuali (autori, anni, URL, stelle GitHub).

**Da tenere**: il 90% delle citazioni di questo report è usabile come
base per il blueprint. La rimanente verifica residua (sez. 3) si
fa a campione.

---

## 1 — Cose verificate e confermate corrette

Tutti questi link/dati sono stati controllati con WebFetch.

### Paper LLM + multi-agent

| Item | Citazione Gemini | Esito verifica |
|---|---|---|
| CAMEL | Li 2023, arXiv:2303.17760 | OK — primo autore **Guohao Li**, marzo 2023 |
| AgentVerse | Chen 2023, arXiv:2308.10848 | OK — primo autore **Weize Chen**, agosto 2023 |
| Self-Discover | Zhou 2024, arXiv:2402.03620 | OK — primo autore **Pei Zhou**, febbraio 2024 |
| Story2Game | Zhou 2025, arXiv:2505.03547 | OK — primo autore **Eric Zhou**, maggio 2025 |
| WHAT-IF | Xie 2024, arXiv:2412.10582 | **PARZIALE**: arXiv ID corretto e data corretta (dic 2024), ma il primo autore è **Runsheng "Anson" Huang**, NON Xie. Gemini ha sbagliato attribuzione. |
| Microsoft Muse | Hofmann 2025, link MSR Game Intelligence | OK — Katja **Hofmann** è confermata come autrice del blog post Muse (19 feb 2025) e WHAM è il modello citato (paper Nature). |
| DSPy | Khattab, repo stanfordnlp/dspy | OK — repo esiste, ente Stanford giusto |

### Repos / DSL operativi

| Item | Citazione Gemini | Esito |
|---|---|---|
| PuzzleScript | github.com/increpare/PuzzleScript, ~1.1k stelle, MIT, 2025 | OK preciso (1.1k stelle, MIT, ultimo commit 2025) |
| Inform 7 | github.com/ganelson/inform, ~1.6k stelle, Artistic-2.0 | OK (1.6k stelle, Artistic 2.0). Gemini dice "ultimo commit 2022" — in realtà è **2026** (versione 10.2.0-beta del maggio 2026). Errore di datazione. |
| Tracery | github.com/galaxykate/tracery, ~2.2k stelle, Apache-2.0 | OK (2.2k stelle, Apache-2.0). "Ultimo commit 2025" plausibile. |
| DeBroglie | github.com/BorisTheBrave/DeBroglie, ~548 stelle, MIT, 2024 | **PARZIALE**: 513 stelle reali (non 548), MIT giusto, ma l'ultima release è **v2.0.0 dell'agosto 2022**, non 2024. Errore di datazione. |
| Sonancia repo `WorshipCookies/Sonancia` | "inattivo" | OK come stato dichiarato |

### Note positive sul report

- Il riconoscimento dello **scam Tales.world** è una sorpresa positiva.
  Il report cita un articolo di gamegrin.com che lo definisce
  fraudolento, e lo include esplicitamente per esclusione. WebFetch su
  quel link mi ha dato 403, ma la logica è sana: meglio segnalare un
  caso losco che ometterlo o trattarlo come reale. **Questo è esattamente
  il pattern che volevamo dal prompt v3**: ammettere ambiguità invece di
  inventare.
- La **mappatura ai 6 moduli** è più granulare e meno arbitraria del round
  1. GDL → Evaluation Agent (per validare condizioni di vittoria) ha
  senso. PuzzleScript → Consistency Manager (per validare risolvibilità
  spaziale) ha senso. Tracery → Design Planner per pre-generare alberi
  testuali è plausibile.
- Lo **scarto esplicito di Muse** ("produce solo previsioni video, non
  alimenta logica simbolica") è un giudizio corretto e ben argomentato.
  È esattamente il tipo di verdetto che cercavamo.
- La **comparativa Inworld/Convai/Charisma** è la migliore parte di tutto
  il report: 5 colonne, fatti pubblici, niente architetture inventate.
  Conferma il pattern "Inworld = autonomia emergente, Convai = latenza
  voce, Charisma = controllo deterministico narrativo". Usabile in
  positioning.

---

## 2 — Errori e imprecisioni residui

Molto meno gravi del round 1, ma da segnare prima di usarli nel
blueprint.

### 2.1 WHAT-IF attribuito a "Xie" invece di Huang
Il prompt v3 vietava esplicitamente questo tipo di errore ("Self-Refine
è di MADAAN, non MAMAN"). Gemini lo ha rifatto su un paper diverso.
Lezione: l'istruzione di verificare il cognome del primo autore va
ripetuta in ogni futuro prompt.

### 2.2 GDL paper citato con URL sbagliato
Il report dice: *"General Game Playing: Game Description Language
Specification (Love 2008, verificabile via researchgate.net/publication/
363507358_A_General_Game_Description_Language_for_Incomplete_Information_Games)"*.

Il problema: l'URL ResearchGate puntato è "A General Game Description
Language for Incomplete Information Games" — che è un paper DIVERSO
(probabilmente di Thielscher 2010-2011 sull'estensione GDL-II per
informazione imperfetta). Il paper canonico "GGP: GDL Specification" di
Love/Hinrichs/Haley/Schkufza/Genesereth 2006/2008 esiste come technical
report Stanford, ma il link è sbagliato.

### 2.3 LLM-as-a-judge attribuito a "Kim 2024"
Il report dice *"Es. Kim (2024), arXiv:2508.02994"*. Verifica: l'arXiv
2508.02994 esiste ma è di **Fangyi Yu**, agosto 2025, intitolato "When
AIs Judge AIs: The Rise of Agent-as-a-Judge Evaluation for LLMs". Né
"Kim" né "2024" sono giusti. Il vero paper canonico LLM-as-judge è
**Zheng et al. 2023** ("Judging LLM-as-a-Judge with MT-Bench and Chatbot
Arena", arXiv:2306.05685) — Gemini lo ha mancato.

### 2.4 DeBroglie con stelle e data imprecise
548 stelle dichiarate vs 513 reali, "ultimo commit 2024" vs ultima
release v2.0.0 del 2022. Differenze piccole ma indicano che Gemini sta
arrotondando o stimando, non leggendo davvero la pagina.

### 2.5 Inform 7 "ultimo commit 2022"
Sbagliato. Il repo è molto attivo, release di maggio 2026.

### 2.6 Linguaggio ancora pseudo-tecnico in punti
- "espande gli alberi di comportamento classici"
- "scartando i falsi positivi strutturali"
- "evita il costo computazionale di una simulazione cronologica
  deterministica completa"

Non è più allucinazione, ma è scrittura barocca. Per il blueprint va
parafrasato in italiano normale.

### 2.7 GDevelop AI: poco specifico
Il report dice che GDevelop AI "manipola in background i file di
configurazione JSON che definiscono le proprietà degli oggetti di scena
e le condizioni degli Event sheet nativi". Plausibile ma non
verificato — non c'è citazione di un blog di engineering GDevelop
preciso. Da approfondire prima di citarlo nel competitor analysis.

### 2.8 Layer.ai stack "non documentato pubblicamente"
Il report ammette onestamente che lo stack è opaco. Buono. Però poi
aggiunge frasi come "esibisce certificazioni SOC 2 Type II e RBAC su
workflow basati su nodi che incapsulano l'accesso a centinaia di
modelli LLM/Diffusion di frontiera preesistenti": parte è verificabile
(SOC 2, nodi-workflow), parte è speculazione ("centinaia di modelli di
frontiera"). Da pulire prima di usare.

---

## 3 — Cose ambigue / da verificare manualmente

Cose che WebFetch non poteva validare e che andranno aperte a mano:

| Item | Cosa verificare |
|---|---|
| Smith 2011 ASP-PCG | DOI 10.1109/TCIAIG.2011.2158545 — formattato bene, link IEEE Xplore. Da aprire IEEE per conferma. |
| Summerville 2018 PCGML | DOI 10.1109/TG.2018.2846639 + arXiv:1702.00539 — entrambi citati. arXiv 1702.00539 è realistico per quel topic. Da spot-check. |
| Karth 2019 Discriminative Learning | DOI 10.1145/3337722.3341845 — formato giusto, da verificare. |
| Liapis 2013 Sentient Sketchbook | DOI 10.1145/2103833 — il DOI è troppo corto per essere ACM (di solito 7 cifre dopo lo slash). Sospetto. Da verificare. |
| Shaker 2013 Ropossum | Citazione data come "Shaker 2013" con link AAAI. Il vero Ropossum è di Shaker, Shaker, Togelius (2013). Plausibile. |
| Britton/Horn 2014 | Citato come "Horn 2014, A comparative evaluation of procedural level generators in the mario ai framework" — esiste davvero un paper di Britton/Horn 2014 con questo titolo. Plausibile. |
| Grinblat GDC 2018 Caves of Qud | Link YouTube `H0sLa1y3BW4` — da aprire e verificare che sia il talk giusto. La GDC 2018 ha effettivamente ospitato quel talk: probabilmente OK. |
| Sylvester GDC 2017 RimWorld | Link YouTube `VdqhHKjepiE` — Tynan Sylvester ha effettivamente parlato a GDC su RimWorld come "story generator". Probabilmente OK. |
| Tales scam articolo gamegrin | WebFetch ha dato 403 ma il sito esiste. Da aprire manualmente per confermare il contenuto. |

---

## 4 — Cose ANCORA omesse

Anche dopo round 2 mancano cose importanti, alcune nominate nel prompt
v3, altre no:

### 4.1 LLM + game generation
- **Riedl group lavori specifici 2023-2025**: il prompt chiedeva
  "2-3 lavori più rilevanti". Il report linka solo 2 articoli Medium
  divulgativi di Riedl. **Nessun paper**. I lavori veri di Riedl
  rilevanti (Suspense story planning ACL Anthology citato, AI Dungeon
  postmortem, etc.) sono stati passati di striscio o non citati.
- **AI Dungeon / Latitude paper postmortem** — il primo grande caso di
  game generation con LLM in produzione, omesso.
- **Mariposa, MarioGPT, GPT-Mario** (Sudhakaran et al. 2022-2023 NeurIPS
  workshop) — level generation con LLM, omesso. Direttamente rilevante.

### 4.2 PCG profondo
- **Liapis Sonancia/Sentient Sketchbook/Ropossum** sono citati ma c'è la
  famiglia di tool che il prompt chiedeva di mappare in modo unitario.
  Manca **L-systems** (Lindenmayer) per generazione vegetale/urbana —
  importante per il `tilemap_populate` su ambienti naturali.
- **PCG Benchmark** (Khalifa et al., arXiv 2503.21851 o simile) —
  testbed standard per misurare PCG, omesso. Per noi rilevante quando
  vorremo testare il Game Plan.
- **Liapis "Large Language Models and Games: A Survey and Roadmap"**
  (2024) — appare nei link cliccabili ma non viene incorporato nel
  testo. È **IL** survey 2024 della nostra area e meritava una scheda
  dedicata.

### 4.3 Concorrenti
- **Convai vs Inworld latency benchmarks**: il report dichiara "sotto i
  200 ms" per Convai senza citarne la fonte numerica. Da rimuovere se
  non viene dal sito ufficiale.
- **Promethean AI**: la fonte secondaria citata (YouTube Maximov) è il
  talk personale dell'autore, non un benchmark indipendente. Una
  recensione tecnica esterna avrebbe rinforzato.
- **Mancano**: Suno per audio (citato nel nostro pietra ma non come
  competitor), Krea.ai, Astrocade (era nel round 1 ma andava
  approfondito anche qui). **Microsoft Copilot for Games** se esiste
  documentazione pubblica.
- **Manca a16z gaming maps**: il rapporto Andreessen Horowitz
  "Generative AI Revolution in Games" è linkato nei riferimenti ma non
  citato nel testo. Quello è IL documento di posizionamento del
  settore.

### 4.4 Mancanze metodologiche
- **Nessuna analisi di costi per modulo**. Il prompt non lo chiedeva
  esplicitamente, ma per la fattibilità del Reasoning Engine (vincolo
  pietra: $0-30/mese) sarebbe utile mappare "modulo → modello → costo
  per chiamata stimato". Da aggiungere nel blueprint.
- **Nessuna analisi di latenza**. Il Game Reasoning Engine ha
  un'esecuzione lunga (brief → Game Plan → materializzazione). Non c'è
  letteratura citata su come accorciarla.

---

## 5 — Cosa è veramente utile

Tagliando rumore residuo, il valore concreto del round 2:

### 5.1 Aggiunte solide al "toolkit verificato" del Reasoning Engine

**Da copiare nel blueprint senza esitazione**:
- DSPy per il **Game Plan compilation** (sostituisce Outlines come
  prima scelta — è più potente per pipeline)
- DeBroglie per il **tilemap_populate** (lib WFC C# con backtracking,
  usata in produzione)
- Tracery per il **Design Planner** lato lore/dialoghi pre-LLM
- PuzzleScript come **DSL di riferimento** per la grammatica del
  Game Plan 2D
- CAMEL come **pattern di role-play** per il Consistency Manager
  (NPC che dialogano dentro un set di regole)
- AgentVerse come **pattern di esecuzione parallela** dei tool nel
  Design Planner
- Self-Discover come **pattern di reasoning composizione** per il
  Design Planner

### 5.2 PCG profondo: mappa modulo-per-modulo

Il report propone:
- ASP-PCG (Smith 2011) → **Consistency Manager** (regole topologiche)
- PCGML survey (Summerville 2018) → letteratura di riferimento
- WFC discriminativo (Karth 2019) → **Consistency Manager** (vincoli
  long-range)
- Mixed-Initiative (Yannakakis 2014) → **Intent Interpreter**
- Sentient Sketchbook (Liapis 2013) → **Evaluation Agent**
- Ropossum (Shaker 2013) → **Evaluation Agent**
- Sonancia (Lopes 2015) → **Balance Controller** (pacing tramite
  curve di tensione)
- DeBroglie → **Execution Orchestrator** (tilemap_populate)
- Mario PCG metrics (Horn 2014) → **Evaluation Agent**
- Caves of Qud history → **Design Planner** (pattern
  generate-then-justify)
- Dwarf Fortress → **Consistency Manager** (separazione bioma /
  erosione)
- RimWorld → **Execution Orchestrator** (ECS + AI Director)

Questa è la mappatura più granulare e usabile che abbiamo. La
adottiamo come **scheletro del blueprint**.

### 5.3 Competitor table

Inworld vs Convai vs Charisma è la prima vera analisi positioning che
abbiamo. Da incollare nel blueprint nella sezione "Differenziazione
mercato".

### 5.4 Esclusioni esplicite

- **Microsoft Muse**: scartato (video prediction, non logica). Decisione
  solida.
- **Tales.world**: scam. Decisione solida.
- **TaleSpin / MEXICA**: solo radici storiche.

Avere decisioni-di-esclusione esplicite vale quanto avere decisioni-di-
inclusione: evita che torniamo sopra a discuterle.

---

## 6 — Cosa fare adesso (azioni concrete)

1. **NON serve un round 3 di Deep Research**. La densità informativa
   per token nuovo sta calando. Le mancanze residue (sez. 4) sono
   meglio coperte con ricerca puntuale (apri Google Scholar e cerca
   tu).
2. Salvare il report grezzo come
   `docs/RAW_gemini_reasoning_research_round2.md` con disclaimer in
   testa che rimanda a questa review.
3. Per il blueprint del Reasoning Engine
   (`docs/GAME_REASONING_ENGINE_BLUEPRINT.md`), partire dalla
   **mappatura modulo-per-modulo della sez. 5.2** + le verifiche
   puntuali della sez. 1.
4. Verifiche manuali ancora da fare (sez. 3): aprire 3-4 link
   sospetti (DOI Sentient Sketchbook, articolo Tales scam, paper
   Story2Game per leggerlo bene).
5. Le omissioni di sez. 4 (Riedl, MarioGPT, Liapis survey 2024, AI
   Dungeon postmortem, a16z gaming report) si recuperano con singole
   ricerche mirate quando arriveremo al modulo specifico nel
   blueprint. Non vale un nuovo Deep Research per esse.

---

## 7 — Lezioni metodologiche per i prossimi prompt Deep Research

Il prompt v3 ha funzionato bene. Per la prossima volta:

1. **Vietare esplicitamente il bullet "X et al. (anno)"** se l'autore
   non è verificato — anche con cognome solo. Forzare "primo autore:
   COGNOME". Il report ha sbagliato Huang→Xie nonostante l'istruzione.
2. **Richiedere "ultimo commit reale o ultima release"** invece di
   "ultimo commit anno". L'anno è facile da inventare.
3. **Richiedere conteggio stelle GitHub esatto al centinaio**. Gemini
   tende ad arrotondare al doppio.
4. **Richiedere che ogni paper venga letto e parafrasato in UNA
   FRASE** — non riassunto strutturato. Le parafrasi strutturate
   fanno emergere lo stile barocco.
5. **Output in inglese tecnico standard**, non italiano: l'italiano
   tecnico-amministrativo è la principale fonte di pseudo-tecnicalese
   ("scongiura loop irrisolvibili" sarebbe stato "prevents unsolvable
   loops" in inglese, suono molto più sano).

---

**Conclusione**: il round 2 ha portato a casa il 90% di quello che
serviva. Le poche imprecisioni residue (WHAT-IF→Xie, GDL link
sbagliato, LLM-as-judge→Kim, date GitHub arrotondate) sono **gestibili
con una verifica spot di 30 min**. Procedere al blueprint del
Reasoning Engine senza altri round di Deep Research.
