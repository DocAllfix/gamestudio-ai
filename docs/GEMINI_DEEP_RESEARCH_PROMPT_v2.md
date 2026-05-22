# Prompt da incollare in Gemini Deep Research (v2 — brutale, no teoria)

> **Come usarlo**: incolla letteralmente il testo del blocco qui sotto come
> prompt in Gemini Deep Research, dopo aver allegato i 2 file indicati. Non
> aggiungere commenti tuoi, non spiegare il contesto: il prompt fa già tutto.
> Se Gemini inizia a scrivere teoria/metodologia, interrompilo e ricomincia.

---

## File da allegare (esattamente questi 2, niente altro)

1. `docs/COVERAGE_SNAPSHOT_for_gemini.md` — la tabella dei gap, fonte di verità
2. `docs/FINDING_phase1ter_residual_gaps.md` — le cose già escluse (no GPL,
   no mega-repo, no Stride OSS, no unknown-license)

Gli altri file del repo NON servono e confondono. Niente prompt brief
precedente, niente blueprint, niente FINDING_kb_value_eval.

---

## Prompt (copia tutto, dalla riga dopo il delimitatore fino alla fine)

````
NON scrivere teoria. NON scrivere metodologia. NON scrivere "framework",
"tassonomia", "decostruzione", "campionamento", "raffinamento iterativo".
NON spiegare cosa stai per fare.

Voglio SOLO una lista di repository GitHub/GitLab/Codeberg reali, con
URL verificato, per riempire dei gap precisi nel nostro RAG dataset di
sviluppo videoludico.

Negli allegati trovi:
- COVERAGE_SNAPSHOT_for_gemini.md: i numeri esatti di chunk per ogni cella
  engine x categoria, generi, e key-features del nostro dataset attuale
  (7503 chunk). Usalo SOLO per sapere cosa NON cercare (le celle e i
  generi gia ben coperti) e quali sono i veri buchi.
- FINDING_phase1ter_residual_gaps.md: cose gia escluse — non ripeterle.

Cosa devi cercare, in ordine di priorita:

PRIORITA 1 - Generi a 0 o quasi (cerca per OGNI genere):
- "stealth" (0 chunk) — su tutti gli 8 engine
- "jrpg" (1 chunk) — su tutti gli 8 engine
- "horror" (8 chunk) — su tutti gli 8 engine
- "fighting" (12 chunk) — su tutti gli 8 engine
- "tower_defense" (12 chunk) — su tutti gli 8 engine

PRIORITA 2 - Zero-cells (22 coppie engine x categoria a 0 chunk).
Vedi la sezione 2 di COVERAGE_SNAPSHOT_for_gemini.md per la lista
completa. Le piu importanti:
- phaser × C03_dialogue_narrative
- phaser × C04_save_load
- phaser × E04_genre_specific
- phaser × B04_navigation
- monogame × C01_progression
- monogame × C03_dialogue_narrative
- stride × C01/C02/C03/C04/E04 (5 celle)
(Ignora le celle renpy × A/B perché normali per un engine VN.)

PRIORITA 3 - Key-features thin (<10 chunk):
- hit_stop (7 chunk) — hit-stop / time freeze su impatto
- boss_phase (6 chunk) — boss state machine multi-fase
- footstep_system (9 chunk) — passi spazializzati su materiali

GLI 8 ENGINE: godot (Godot 4 GDScript), phaser (Phaser 3 JS/TS),
renpy (Ren'Py 8 .rpy), defold (Defold Lua .script), monogame
(MonoGame C#), love2d (LÖVE 11 Lua), threejs (Three.js JS/TS),
stride (Stride3D C#).

VINCOLI ASSOLUTI:
- Licenza permissiva verificata. Accettate: MIT, Apache-2.0,
  BSD-2-Clause, BSD-3-Clause, CC0-1.0, Unlicense, ISC, Zlib,
  CC-BY-4.0, MPL-2.0, EPL-2.0.
- Escluse: GPL (qualsiasi versione), AGPL, LGPL, CC-BY-NC, CC-BY-SA,
  "noassertion", "unknown", "no license file". Se non sei certo della
  licenza, NON includere il repo.
- Dimensione < 100 MB. Sopra: solo se identifichi una subdir specifica
  da clonare separatamente (es. "questo repo e 500MB ma solo il path
  src/dialogue/ ci serve, 4MB").
- Almeno 300 LOC di codice engine-specifico (no progetti tutorial
  microscopici).
- Niente repo che dichiarano "AI-generated" o "GPT wrote this".

FORMATO OUTPUT (rigido, copia questo schema esatto):

```
## Gap: <genre o engine.categoria o feature>

- URL: https://github.com/<owner>/<repo>
  Licenza: MIT  | Stars: 240  | Size: 18 MB
  Engine: phaser
  File concreto: src/dialogue/DialogueManager.js
  Perché: implementa branching dialogue con typewriter e choice menu;
    Phaser 3.60+.

- URL: https://github.com/<owner>/<repo2>
  Licenza: Apache-2.0  | Stars: 89  | Size: 5 MB
  Engine: phaser
  File concreto: src/save/SaveSystem.js
  Perché: localStorage save/load con versioning, da un game jam vincitore.
```

Una sezione `## Gap: ...` per ogni gap delle 3 priorita sopra. Per ogni
gap, da un minimo di 3 a un massimo di 15 candidati ordinati per qualita
(stars + chiarezza del codice, non per quantita).

Se per un gap non trovi 3 candidati validi DOPO aver cercato seriamente,
scrivi solo:
```
## Gap: <nome>
NESSUN CANDIDATO TROVATO — l'ecosistema OSS non ha materiale verificato
permissivo per questa nicchia.
```

VERIFICA OBBLIGATORIA PRIMA DI SCRIVERE OGNI VOCE:
1. Hai aperto il link e visto la pagina del repo? (Niente URL inventati,
   niente "https://github.com//something" con owner vuoto. Gli URL devono
   essere REALI e cliccabili.)
2. La licenza e dichiarata esplicitamente nel repo (file LICENSE o
   campo "license" nel sidebar GitHub)?
3. Il file concreto che citi esiste davvero in quel repo?

Se non riesci a verificare uno dei 3 punti per un candidato, NON
includerlo. Meglio dare 3 candidati veri che 15 inventati.

DOVE CERCARE (esplora ovunque, non solo github.com):
- github.com (default)
- gitlab.com
- codeberg.org
- bitbucket.org
- gitee.com (ecosistema cinese, ricchissimo di JRPG/visual novel/horror
  su Ren'Py, Phaser, MonoGame — cerca con caratteri cinesi se serve)
- sr.ht (SourceHut, comunita Lua/Defold)
- defold.com/assets/ (community library Defold con link a GitHub)
- godotengine.org/asset-library/ (Asset Library Godot)
- itch.io con filter "open source" + link nei devlog a repo
- ldjam.com (Ludum Dare archive) — repository di finalisti MIT
- github.com/topics/<topic> con topic tipo "jrpg-engine", "stealth-game",
  "tower-defense-game", "fighting-game-engine"
- university coursework: cerca "CS-game-development", "game-programming-course"
- conference talk companion repos (GDC vault, IndieDev)

NON CERCARE:
- Awesome-list (sono meta-elenchi inutili, vai ai repo)
- Engine sources monolitici sopra 100MB
- Tutorial repo sotto 300 LOC
- Repo che hai gia visto nel COVERAGE_SNAPSHOT (celle con > 20 chunk)

REGOLA FINALE: l'output deve essere SOLO la lista delle sezioni
`## Gap: ...`. Niente introduzione, niente conclusione, niente analisi
metodologica, niente "framework di ricerca", niente tabelle pivot,
niente sintesi finale. SOLO la lista.

Vai.
````

---

## Cosa fare se Gemini fallisce di nuovo

Se la risposta contiene:
- Parole tipo "framework", "metodologia", "tassonomia", "decostruzione",
  "campionamento", "raffinamento" → ferma e ripeti il prompt aggiungendo
  in cima: `STAI INIZIANDO A SCRIVERE TEORIA. RIPARTI. Solo lista repo.`
- URL del tipo `https://github.com//something` (doppio slash, owner
  mancante) → URL inventati, ferma e ripeti aggiungendo: `URL FASULLI
  RILEVATI. Apri davvero la pagina di ogni repo che scrivi.`
- Meno di 30 candidati totali su tutto il documento → ha barato, ripeti
  aggiungendo: `Voglio almeno 50 repo verificati totali. Cerca di piu.`

Se dopo 2 tentativi Gemini non collabora, passa a Perplexity Pro
(stesso prompt, allega solo il COVERAGE_SNAPSHOT). Perplexity ha web
search piu disciplinato e tende a citare URL reali con frequenza
maggiore.
