# COMPETITIVE LANDSCAPE 2026 — Game Studio AI

**Data**: 2026-06-03
**Status**: fonte autorevole per la strategia competitiva e il posizionamento.
**Sostituisce** (sui dati di mercato/competitor): `pietra_v4 (1).md` §1-TER e
`PIETRA_v5_ADDENDUM.md` §D. Quei documenti restano validi sulla visione e
sull'architettura; i loro **dati competitivi sono superati** da questo file.

---

## §0 — Perché questo documento esiste

La Pietra v4 (maggio 2026) e l'addendum v5 (24 maggio 2026) descrivono un
mercato "scarno, poco toccato, con competitor deboli" e 5+ moat con gap "∞".
Una verifica via web di **giugno 2026** dimostra che quella fotografia è
**obsoleta**: il mercato è affollato e capitalizzato. Continuare a pianificare
sui dati v4/v5 porterebbe a un posizionamento basato su un vantaggio che non
esiste più.

Questo documento ricostruisce la realtà verificata e definisce il
posizionamento difendibile che ne consegue.

### Disclaimer di metodo (il rigore che il progetto già applica)

Il progetto ha una regola interna nata in Fase 1: *"Gemini mente sulle licenze
— la verifica via API è non negoziabile"* (`FINDING_phase1ter_residual_gaps`).
**La stessa regola si applica ai competitor**: il sito di un competitor non è
una fonte, è marketing. Ogni claim qui sotto ha un livello di affidabilità:

- ✅ **Verificato indipendente** — fonte terza (Fortune, Bloomberg, Crunchbase,
  annuncio ufficiale di una big-tech, report GDC).
- 🟡 **Reale ma marketing-gonfiato** — l'azienda esiste ed è finanziata, ma le
  capacità del prodotto vengono dal loro marketing e non sono verificabili
  indipendentemente.
- ⚠️ **Solo dal sito del competitor** — claim non confermato da terzi.

---

## §1 — La correzione esplicita (claim Pietra → realtà 2026)

| Claim Pietra v4/v5 | Realtà verificata giugno 2026 | Verdetto |
|---|---|---|
| "Competitor scarni, mercato poco toccato" | Astrocade: 5M MAU, 140M partite/mese, $56M da Sequoia/Google/Nvidia ✅ | **FALSO** |
| "Multi-engine export = nessun comparabile, gap 4x" | SEELE rivendica export Unity 6 + Unreal + Three.js 🟡; Rosebud esporta codice ✅ | **FALSO** (il claim è occupato) |
| "Game Reasoning sistemico = gap ∞" | Astrocade è "agentic" — team di agenti AI specializzati in produzione a scala ✅ | **FALSO** |
| "Rosebud = 1-2 web genres" | Rosebud fa 2D/3D/voxel, export codice, monetizzazione integrata (Tip Jar) ✅ | **DATATO** |
| "KB RAG verificata = moat ∞" | I finding INTERNI del progetto (`FINDING_kb_value_eval`) dicono 0/8 gate superati sui task mainstream | **RIDIMENSIONATO** |
| "AI Game Generator market vergine" | $2.1B investiti in studi AI-first 2025-26; 52% dei dev a GDC 2026 dice che la gen-AI "danneggia l'industria" ✅ | **FALSO + sentiment ostile** |

**Conseguenza**: il progetto NON è più "il primo / l'unico". Deve essere il
**migliore / il diverso** su un asse che i competitor non presidiano.

---

## §2 — La mappa competitiva per tier (giugno 2026)

### Tier 1 — Giganti di piattaforma (la minaccia che la Pietra ignora)

| Player | Cosa fa | Affidabilità | Perché conta |
|---|---|---|---|
| **Roblox Cube / 4D** | Genera oggetti 3D *funzionali* da prompt dentro Roblox ("genera un'auto, sali, guidala"); +64% playtime testato in Wish Master | ✅ (annuncio ufficiale, feb 2026, beta live) | Centinaia di milioni di utenti. Locked-in a Roblox. |
| **Unity Muse / Sentis** | AI dentro l'engine, nel 75% dei nuovi progetti Unity, ~$500M/anno ricavi AI | ✅ (dato di mercato) | Se l'AI matura dentro Unity, il "multi-engine export" perde valore. |
| **Microsoft Muse (WHAM)** | World/Human Action Model addestrato su gameplay reale (Ninja Theory) | ✅ (Microsoft/Nature) | Frontiera world-model, Xbox dietro. |

**Rischio strategico n.1**: Unity e Roblox stanno **internalizzando** la
generazione AI dentro l'engine. Il "multi-engine export" come moat ha una
**finestra temporale stretta**.

### Tier 2 — Competitor diretti seri (il campo di battaglia)

| Player | Modello | Finanziamento | Affidabilità | Minaccia |
|---|---|---|---|---|
| **Astrocade** | Feed casual social, play-in-place, remix, creator fund $10M | $56M (Sequoia/Google/Nvidia) | ✅ 5M MAU, 140M partite/mese | **Alta sul casual**, ma locked-in, no export |
| **Rosebud** | Browser 2D/3D/voxel, export codice, Tip Jar Stripe, community | $9.2M (a16z/Animoca) | ✅ community/game-jam reali | **Il gemello più vicino**, piccolo ma reale |
| **SEELE** | Multi-engine export (Unity/Three.js/Unreal), 3D, ownership | $10M (Baidu) | 🟡 prodotto non verificabile, SEO spam, 0 feedback indipendente | Media — rivendica il nostro pitch, non dimostrato |
| **Hytopia** | SDK TS voxel MMO browser, royalty creator 5% | n/d | ✅ 2.5M download | Media — nicchia voxel MMO |

### Tier 3 — Long tail (~13 player, segnale di affollamento)

Summer Engine (export claim, nuovo), Bitmagic (3D, pricing opaco), Jabali
(3D closed beta), GDevelop+AI (engine maturo open, export reale), Replit AI
Game Builder, Buildbox 4, + prototype-level: Sider, Upit, Makko, Dreamable,
Base44, Websim, Lovable, MGX. **La maggior parte è prototype-level / web /
non-production.** Indicano *quanto è affollato* lo spazio, non occupano il
nostro quadrante.

### Tier 4 — World models (la frontiera, miliardi)

| Player | Valutazione | Ruolo per noi |
|---|---|---|
| **Decart** | $3.1B (Series B $100M) | Competitor/frontiera world-model |
| **World Labs (Marble)** | round $1B (Fei-Fei Li) | **FORNITORE integrabile** (vedi §6) — non solo competitor |
| **Vast / Tripo** | >$1B | **FORNITORE 3D-gen** (adattatore `Model3DPort`) |

NOTA: Tier 4 non è solo minaccia. **World Labs Marble e Vast/Tripo sono
provider che possiamo consumare** via le porte esagonali. Marble genera mondi
3D giocabili da prompt; Tripo genera modelli 3D. Diventano nostri adattatori,
non solo rivali.

---

## §3 — Teardown di Rosebud (il gemello più vicino, verificato)

Profilo: fondata 2019 (il più "vecchio"), $9.2M (a16z, Animoca), 36
investitori, mai un Series A vero in 7 anni. Storia di pivot: avatar AI →
game maker Phaser (2024) → 3D/voxel "vibe coding" (2026). Stack: browser-based,
output HTML5, costruito attorno a Phaser, asset dai loro tool (PixelVibe).

**Cosa fanno BENE (da rispettare/copiare):**
- ⭐ Velocità d'iterazione + share istantaneo (prompt → URL giocabile in minuti).
- ⭐ **Tip Jar Stripe integrato, 0% fee** ("100% dei profitti sono tuoi").
- ⭐ Community + game jam reali, cultura di creazione.
- Diritti commerciali chiari sui tier paganti.

**Dove FALLISCONO (verificato — il nostro varco):**
- ⭐ **Profondità**: per loro stessa ammissione consigliano *"resta su Unity per
  il commerciale", "vai su Godot per imparare un engine vero"*. Recensione
  indipendente: *"output shallow, non production-grade"*.
- ⭐ **Browser-only**: *"a playable page, not a project you can open in another
  tool"*. No Steam/mobile nativo, no import asset, no scene editor.
- ⭐ **3D = "pseudo-3D base"** (dal comparativo di un concorrente).
- I giochi reali pubblicati (itch.io) sono prototipi da game-jam: "Fairy Tooth
  Hunter", match-3 in 1 settimana, FLOW STATE = "pianificava di portarlo su
  Steam" (futuro, mai fatto). Zero titoli commerciali spediti.
- "edits don't stick", bug d'iterazione, supporto 3.5/5.

**Lettura strategica**: Rosebud ha SCELTO di essere il tool veloce/casual per
prototipi browser, e *lo dice apertamente*. Ci cede il terreno del "gioco vero,
serio, posseduto". Il loro modello di business (browser, no export nativo) NON
può inseguirci senza riscriversi.

---

## §4 — La matrice di posizionamento

Due assi che separano davvero i player:

```
                   ALTA STICKINESS / DISTRIBUZIONE
                              │
       Astrocade ●            │            ● Roblox Cube
       (casual, feed,         │            (locked-in,
        5M MAU, locked)       │             300M+ utenti)
                              │
       Rosebud ●              │       ● Unity Muse
       (prototipi browser,    │         (AI dentro l'engine)
        share, Tip Jar)       │
   ───────────────────────────┼─────────────────────────────
    BASSA PROFONDITÀ          │          ALTA PROFONDITÀ
    (giochino, locked)        │          (gioco vero, posseduto,
                              │           verificato, multi-target)
              SEELE ●         │       ◇ ←── NOI
              (claim alta     │          (verifica + ownership +
               profondità,    │           3D vero + mobile native)
               non provato)   │
                              │       Summer Engine ◇ (non provato)
                  BASSA STICKINESS / DISTRIBUZIONE
```

**Il quadrante "alta profondità + ownership + verifica" è privo di occupanti
solidi**: SEELE lo rivendica ma non lo dimostra; Summer Engine è nuovo/non
provato; Rosebud lo ha esplicitamente abbandonato. **È il nostro spazio
d'ingresso.** Strategia: entrare lì (profondità+ownership+verifica), poi salire
verso la stickiness (velocità, share, monetizzazione, feed).

---

## §5 — Il posizionamento difendibile

**La frase**: *"Gli altri generano da un prompt isolato e ti lasciano un
giochino bloccato sulla loro piattaforma. Noi partiamo dal TUO contesto
(immagini, musica, storyboard), generiamo su più dipartimenti, VERIFICHIAMO che
il gioco giri e sia bilanciato, e te lo consegnamo come progetto VERO — su 5
motori, browser e mobile, che possiedi e spedisci. È la differenza tra un
generatore e uno studio."*

Ogni pezzo attacca una debolezza verificata. (✅ = già contrattualizzato nel
codice di Fase 0.)

1. **Verifica anti-slop (moat primario)** — D.3 (no soft-lock, ASP) + D.6
   (smoke test: gira/non crasha) + `game_parameters` (game-feel da giochi
   shipped). ✅ `SmokeTestReportSchema`, `StressCurveInputSchema`,
   `num_playtests` nei contratti. **NESSUN competitor verifica la giocabilità
   prima della consegna.** Cavalca il sentiment GDC 2026 (52% anti-slop): noi
   siamo l'anti-slop *dimostrato*.

2. **BYOA — input multimodale** ✅ — l'utente carica immagini/musica/storyboard
   → contesto per la generazione (`moodboard_image_urls` in
   `IntentInterpreterInput` + `HermesPlanRequest`; `byoa_analyzer`;
   `style-inference` Vision+librosa). **Rosebud non importa asset tuoi;
   Astrocade è prompt-only.** Si genera da contesto ricco, non da prompt isolato.

3. **Ownership + export multi-engine** ✅ — progetto engine vero, scaricabile,
   apribile in editor (8 assembler + `EngineAdapter` + `BuildArtifact` +
   `ItchPackager`). vs Rosebud "playable page", vs Astrocade locked-in. (SEELE
   lo rivendica senza prova; noi a contratto.)

4. **3D vero, multi-via, day-1** — showcase 3D (Three.js, template T09),
   **giochi 3D veri (Babylon, fisica/GUI built-in)**, 3D capace (Godot, KB ha
   pattern FPS). Due fonti: asset CC0 (Quaternius/KayKit/Poly Haven indicizzati
   + style pack C01-C08) e generazione AI custom (`model_3d_gen`, dietro
   paywall). Astrocade è 2D casual; Rosebud "pseudo-3D base".

5. **Mobile-native posseduto** — Defold .apk native + PWA su tutti i motori
   browser. Segmento quasi vuoto (Astrocade casual locked, Rosebud web).

6. **Audio generativo** — Suno BGM + ElevenLabs SFX/voci (dietro paywall).

7. **Play-in-feed** — consumo stile Astrocade, ma con output posseduto
   (acquisizione + conversione).

8. **Asset CC0 curati + Style Pack + Game-Plan Diff** — anti-slop estetico +
   git-for-design, che i prototype-tool non hanno.

9. **World Labs Marble** (vedi §6) — mondi 3D giocabili da prompt, orchestrati
   e **verificati** (Rosebud lo usa a mano e senza verifica).

10. **Architettura esagonale** — i 5 motori + i provider (3D/audio/LLM/Marble)
    sono adattatori dietro porte; il dominio è testabile offline (incl.
    `NullEngine` Babylon, headless Defold). Differenziatore strutturale: ogni
    provider è sostituibile senza toccare il cuore.

**La narrazione che lega tutto**: contesto multimodale (BYOA) → generazione
multi-dipartimento → **verifica** → export posseduto. Generatore vs studio.

---

## §6 — World Labs Marble: fornitore integrabile (stato legale verificato)

Marble (World Labs) genera mondi 3D navigabili da testo/immagini, esportabili
come **collider GLB** (3-4MB, glTF standard → entra in Three.js/Babylon/Godot) +
Gaussian splat. Il problema "splat non-walkable" è risolto (collider mesh +
splat-transform; estensione glTF `KHR_gaussian_splatting` ratificata 2026).
Costo ~$1.20/mondo (1.500 crediti).

**Stato legale (dal ToS ufficiale World Labs):**
- ✅ Account API/paid: §3.3(b) *"Paid Users own all rights to Outputs"*; §3.3(d)
  *"may grant end-user licenses to their Output"* per customer-facing apps;
  §6.2(b) prodotto commerciale sopra l'API permesso.
- ⚠️ Per esporre la generazione **agli utenti finali in volume** serve un
  **Order Form custom** (SaaS multi-utente, rate limit, sublicenza downstream).
- ⚠️ §3.6: World Labs mantiene license-back/data-use rights → il messaging
  "ownership" dev'essere onesto (il *gioco* è tuo; il *mondo Marble* è "tuo da
  sublicenza commerciale piena", non "generato da zero da te").

**Sequenza decisa**: integrare e testare Marble **dall'inizio** (porta
`WorldGenPort` + adattatore + smoke test — un account API paid basta, è legale
per il test interno). **Contattare World Labs per l'Order Form solo quando il
prodotto ha volume di utenti.**

**Attenzione strategica**: Rosebud l'ha **già fatto** (case study ufficiale
World Labs: Marble→collider→"Rosie" aggiunge mechanics→prototipo multiplayer),
MA con "passaggi manuali (export/stitch/setup fisica)" e **senza verifica**.
Il nostro moat NON è "usare Marble" — è **"Marble orchestrato automaticamente +
VERIFICATO"** (D.6 cammina nel mondo, conferma percorribilità/no-soft-lock).

---

## §7 — Rischi strategici (da tenere in testa)

1. **Internalizzazione AI negli engine** (Unity Muse, Roblox Cube): erode il
   "multi-engine export". → Finestra stretta, muoversi ora; appoggiarsi sulla
   *verifica* (che loro non fanno) più che sul multi-engine.

2. **Superiorità tecnica ≠ adozione**: Rosebud insegna che velocità + share +
   monetizzazione rendono appiccicosi. Il nostro wow (verifica/ownership) è il
   gancio; ma SENZA velocità/share/Tip-Jar comparabili si perde l'adozione.
   → Copiare le cose che Rosebud fa bene, non solo batterli sulla qualità.

3. **Il flywheel parte da zero**: il moat di auto-miglioramento (validazione
   utente → success_score) è di mese-6+, non di day-1. Astrocade ha già 140M
   partite/mese di vantaggio sui dati. → Accenderlo presto (vedi
   `WOW_CONTRACT.md` §5) ma non contarci per il wow iniziale.

4. **Sentiment ostile**: 52% dei dev (GDC 2026) vede la gen-AI come dannosa.
   → Posizionarsi *contro* lo slop, verso il controllo/ownership/qualità
   verificata, non come "l'ennesimo generatore".

---

## §8 — Fonti (verificate giugno 2026)

- Astrocade $56M / 5M MAU / 140M partite: [Fortune](https://fortune.com/2026/05/05/astrocade-raises-56-million-series-b-sequoia-video-games-platform-ali-amir-sadeghian/), [Astrocade Creators](https://www.astrocade.com/creators)
- Rosebud $9.2M / pricing / limiti: [Toolworthy](https://www.toolworthy.ai/blog/best-ai-game-maker), [Summer Engine — Rosebud alternatives](https://www.summerengine.com/blog/rosebud-alternatives), [Rosebud pricing](https://lab.rosebud.ai/blog/pricing-subscription-faqs)
- SEELE Baidu $10M / Shenzhen / Wang Shimu: [AInvest](https://www.ainvest.com/news/baidu-backed-seele-ai-powered-engine-fueling-3d-game-development-revolution-2505/), [Scam Detector — seeles.ai](https://www.scam-detector.com/validator/seeles-ai-review/)
- Roblox Cube 4D: [Roblox newsroom](https://about.roblox.com/newsroom/2026/02/accelerating-creation-powered-roblox-cube-foundation-model)
- Unity Muse / mercato AI gaming / $2.1B: [Hashmeta — Generative AI Gaming 2026](https://www.hashmeta.ai/en/generative-ai/generative-ai-gaming)
- GDC 2026 sentiment (52% dannosa): [GIANTY — GDC 2026 report](https://www.gianty.com/gdc-2026-report-about-generative-ai/)
- World models (Decart/World Labs/Tripo): [TechCrunch — Origin Lab](https://techcrunch.com/2026/05/13/origin-lab-raises-8m-to-help-video-game-companies-sell-data-to-world-model-builders/), [Tripo Series A](https://www.financialcontent.com/article/gnwcq-2026-6-1-tripo-ai-raises-nearly-200-million-in-series-a-and-series-a-financing-to-advance-ai-3d-and-world-model-roadmap)
- World Labs Marble (API/export/legale/Rosebud): [World API](https://www.worldlabs.ai/blog/announcing-the-world-api), [Marble mesh export](https://docs.worldlabs.ai/marble/export/mesh), [World Labs ToS](https://www.worldlabs.ai/terms-of-service), [case study Rosebud](https://www.worldlabs.ai/case-studies/rosebud)
- Babylon.js / NullEngine: [Babylon vs Three.js production](https://dev.to/devin-rosario/babylonjs-vs-threejs-the-360deg-technical-comparison-for-production-workloads-2fn6), [Babylon server-side](https://doc.babylonjs.com/setup/support/serverSide/)
- Nakama: [Heroic Labs / Nakama](https://heroiclabs.com/nakama/)
