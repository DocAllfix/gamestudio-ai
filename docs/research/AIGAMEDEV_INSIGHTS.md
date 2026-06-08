# r/aigamedev — Market Research Insights

**Fonte:** r/aigamedev via archivio Arctic Shift (l'API Reddit e gli endpoint
`.json` sono bloccati 403 da datacenter). **Dataset:** 2.996 post (ultimi 18 mesi,
engagement ≥3 commenti o ≥5 score) + 42.960 commenti. **Analisi:** 100% del corpus
taggato (`scripts/research/analyze_full.py`) + lettura qualitativa dei thread top.
**Data:** giugno 2026.

> **Bias da tenere presente:** è UN solo subreddit, pro-AI per autoselezione →
> sovrastima l'entusiasmo, e l'engagement alto su un tema NON significa "problema
> importante" (lo stigma è rumoroso ma di nicchia). I numeri rankano *dove
> guardare*; le citazioni dicono *cosa serve davvero*.

---

## 1. La classifica dei temi (tutto il corpus, pesata per discussione)

| Tema | Post | Commenti sui post | Upvote commenti |
|---|---|---|---|
| Engine / coding | 1.204 | 16.562 | 9.591 |
| **Quale modello / tool usare** | 972 | 13.268 | 7.161 |
| **Testing / bug / "gira?"** | 646 | 8.535 | 4.176 |
| Vendere su Steam / policy AI | 408 | 7.030 | 2.035 |
| 3D / rigging / cleanup | 565 | 6.969 | 4.339 |
| Sprite / pixel 2D | 378 | 5.956 | 3.291 |
| **Vibecodare un gioco COMPLETO** | 321 | 5.245 | 1.909 |
| Marketing / trovare giocatori | 304 | 4.627 | 2.251 |
| Coerenza di stile tra asset | 258 | 3.947 | 1.642 |
| Audio / musica / sfx | 269 | 3.736 | 1.362 |
| Costo / crediti | 267 | 3.717 | 2.394 |
| Memoria / coerenza (RPG AI) | 247 | 3.499 | 1.397 |
| "Sembra troppo AI" / slop | 106 | 2.728 | 1.644 |
| Stigma anti-AI | 67 | 2.448 | 1.250 |
| Legale / copyright | 50 | 792 | 512 |

Domande più frequenti nei commenti: **"which..." (244x)**, **"how do..." (222x)**,
"what do/is/are" (~400x combinati), "is there..." (112x). → La community vive in
modalità **"quale strumento" + "come si fa"**.

---

## 2. I pain point chiave (con voice-of-customer reale)

### A. "Non riesco a finire un gioco COMPLETO" (vibecoding)
> *"I just can't seem to find anything that works for more than a couple of days a
> month. I've tried Ludus for UE... Coplay for Unity, and Unity AI, but they only
> perform so well."*
Workflow fragili, si rompono a metà. La gente costruisce a mano GDD + roadmap per
non perdere coerenza. **→ È esattamente il problema che GameSmith risolve:** dal
prompt al gioco verificato e giocabile, senza orchestrare 5 tool che si rompono.

### B. "Quale tool/modello uso?" (decision paralysis)
Il tema #2 per volume. "which..." è la domanda più frequente in assoluto. La gente
è persa tra Claude/GPT/Gemini/Cursor/ComfyUI/Nano Banana. **→ GameSmith toglie la
scelta:** un flusso unico che decide il modello giusto per task (router LLM).

### C. "Testing / il gioco gira?" (#3, 8.535 commenti)
> *"The bottleneck of AI game dev is not coding. It's testing."* (post, 40 commenti)
> *"First 100% AI Game is Now Live on Steam + How to bugfix in AI Game."*
Confermato come bisogno reale e diffuso, non una nostra fissa. **→ Il moat di
GameSmith (verifica anti-break: 0 soft-lock, smoke test) parla a questo.** E apre
la pista del **Playtester LLM** (vedi ricerca dedicata: LAP 79% coverage, TITAN
deploy reale — fattibile via stato strutturato, non pixel).

### D. Coerenza di stile + "sembra slop" (asset)
> *"Figured out how to prompt consistent 8-direction pose sheets"* (la gente
> inventa hack manuali: slicing + GPT Image).
> *"How can I make my sprites 'Less AI style'?"* / *"What's the best way to clean
> AI generated 3D models?"* (retopo a mano in Blender).
Generare 1 asset è facile; **50 asset coerenti e non-slop** è il problema vero.
**→ style_pack + palette swap + autotiling di GameSmith fanno nativamente ciò che
loro fanno a mano.** Il nostro framing "anti-slop verificato" è LETTERALMENTE la
loro richiesta ("less AI style").

### E. Pubblicare/vendere (Steam policy, marketing)
Steam policy + "come trovo giocatori" sono molto sentiti (7.030 + 4.627 commenti).
**→ Tocca il feed/share/ownership di GameSmith** (gioco posseduto + esportabile +
condivisibile con link).

---

## 3. Le opportunità (gap da riempire / forze da amplificare)

| Pain point | Quanto è sentito | GameSmith oggi | Mossa |
|---|---|---|---|
| Finire un gioco completo | Alto | ✅ loop genera+verifica | **Amplificare** nel messaging: "finisci davvero" |
| Testing / "gira?" | Alto | ✅ smoke + D.3/D.6 | **Amplificare** + costruire Playtester LLM |
| Coerenza stile / anti-slop | Medio-alto | ✅ style_pack/palette/autotile | **Amplificare**: è il claim killer |
| Quale tool usare | Altissimo | ✅ router nasconde la scelta | **Amplificare**: "un flusso, zero scelte" |
| Audio | Medio | ⚠️ 2.488 SFX CC0, tool gen mancante | **Riempire**: tool audio-da-catalogo (basso sforzo) |
| 3D cleanup/rigging | Alto | ⚠️ 554 model CC0, gen 3D paywall | **Riempire** progressivo (Meshy/TRELLIS) |
| Marketing/visibilità | Medio | ✅ feed/share | **Riempire** parziale: trailer/cover auto |

### Insight di posizionamento (non di feature)
1. **Lo stigma anti-AI è rumoroso ma di nicchia** (67 post). NON costruirci il brand
   sopra, ma il messaging può dare sollievo ("il gioco vero parla per te").
2. **Il claim più forte non è "generiamo"** (lo fanno tutti, è commodity in corsa al
   ribasso, cfr. Sorceress $49 lifetime). È **"finisci un gioco vero, verificato,
   che possiedi"** — i tre punti che la community fatica a ottenere da sola.
3. La community chiede **"which tool"** ossessivamente → c'è fatica da
   tool-sprawl. GameSmith come *un flusso unico* è un sollievo, non un tool in più.

---

## 4. Metodo e limiti (onestà)
- Copertura: 100% dei testi taggati; 18% post / 59% commenti senza tema (coda
  lunga + commenti brevi tipo "nice!"). Phrase-mining data-driven copre parte del gap.
- Euristiche regex = buone per rankare e trovare dove leggere, non verità assolute.
- Un solo subreddit pro-AI → bias di entusiasmo. Validare con altre fonti
  (r/gamedev, r/IndieDev) prima di decisioni grosse.
- Artefatti: `data/research/ANALYSIS.md`, `ANALYSIS_FULL.md`; dati grezzi in
  `data/research/*.jsonl`; script in `scripts/research/`.
