# Deep Research Prompts — Fase 2 Resource Hunt

**Data**: 2026-05-24
**Scope**: 5 prompt da incollare in **chat NUOVE** di Deep Research
per coprire i buchi che la mia ricerca interna non poteva colmare.

**Cosa serve da te**:
1. Apri 5 chat nuove (consigliato Gemini Deep Research, alternative
   ChatGPT Deep Research / Perplexity Pro / Claude.ai Search)
2. Incolla il prompt del blocco corrispondente
3. Allega `pietra_v4 (1).md` + il file indicato nella sezione "File
   da allegare"
4. Quando torna l'output, mandami il `.md` e io faccio review +
   WebFetch verification come per i round Reasoning Engine

**Tempo stimato**: 5 × 30min = 2-3h tue.
**Costo**: 0 (incluso nei tier Pro).

---

## Anti-pattern (validi per TUTTI i 5 prompt)

Stesse regole già messe a punto nel prompt v3 Reasoning Engine:

1. NON scrivere teoria, metodologia, "framework concettuale".
2. NON scrivere prosa pseudo-ingegneristica italiana (no "scongiura
   loop irrisolvibili", no "Generative 4D AI", no "stack" come
   sostantivo).
3. NON inventare URL GitHub. Se cit un repo, deve essere
   verificabile via `https://github.com/{owner}/{repo}`.
4. NON inventare licenze. Per ogni repo cit: verificare label
   licenza da GitHub API o sito ufficiale.
5. Se un'area è povera, DIRLO. No invenzione.
6. Output: liste e tabelle. Una frase per item.

---

## PROMPT 1 — Genre Templates batch 1 (T01-T04)

**File da allegare**: `pietra_v4 (1).md` + `STYLE_PACK_REFERENCES.md`
+ `REFERENCE_GAMES_VISUAL.md` + questo file.

**Obiettivo**: per 4 generi, raccogliere repo OSS "starter" reali +
schemi world_graph / pacing / rules ranges concreti che il D.1
Intent Interpreter userà come baseline.

```
Stai lavorando come ricercatore per Game Studio AI, un prodotto
multi-engine di AI game generation. Devo definire i Genre Template
operativi per 4 generi di gioco. Per ognuno: ho già lo style pack
visivo (vedi STYLE_PACK_REFERENCES.md allegato) e la lista dei
reference games (vedi REFERENCE_GAMES_VISUAL.md). NON ridocumentare
quelli.

Cosa ti chiedo è MATERIALE OPERATIVO per il code generation:
- repo OSS starter/template/example che implementano DAVVERO il
  genere su un engine specifico (Godot 4 / Phaser 3 / Ren'Py /
  Defold 1.9)
- world graph tipico: 3-5 zone, edges, gating tipico del genere
- pacing curve tipica (5 sample 0-1 normalizzati: intro/build/mid/
  climax/end)
- rules ranges sensati (HP, DMG, checkpoint freq, durata media run/
  livello)

I 4 generi:

T01 - Metroidvania Platformer Action (engine: Godot 4)
T02 - Visual Novel / Dating Sim (engine: Ren'Py)
T03 - Mobile Casual Puzzle (engine: Defold)
T04 - Browser Arcade Game (engine: Phaser 3)

REGOLE ASSOLUTE:

- Repo OSS già nel nostro dataset NON vanno ri-cercati. Liste di
  esclusione esplicite (cogli i nomi dalla blueprint v2 parte B.3 +
  l'esistente):
  Per Godot 4 SKIP: uheartbeast/metroidvania-godot-4, noidexe/top-
  down-action-rpg-template, Bozar/godot-4-roguelike-tutorial,
  SelinaDev/Godot-Roguelike-Tutorial, EeroLai/abyssal-walker,
  Heart-Platformer-Godot-4, 2D-Platformer-Starter-Kit,
  GDQuest demos, Whimfoome/godot-FirstPersonStarter,
  expressobits/character-controller, foxssake/netfox.
  Per Phaser SKIP: phaserjs/examples, phaser-by-example, ffx0s/
  mario-html5, photonstorm.
  Per Ren'Py SKIP: Encyclopaedia framework, BobcStats, Ren'Py
  Cookbook, Ren'Py official tutorial.
  Per Defold SKIP: britzl pacchetti, defold-orthographic.

- Cerca DAVVERO repo nuovi non già nei nostri 968 manifest entries.
  Topic GitHub utili: topic:godot4-template, topic:phaser3-template,
  topic:renpy-template, topic:defold-template.

- Per ogni repo che cit: link GitHub + stelle approx + licenza
  (MIT/Apache/BSD/Zlib/Unlicense OK, NO GPL).

- Per ogni genere, proponi 3-5 candidati repo + 1 schema world_graph
  + 1 pacing curve + 1 rules ranges.

OUTPUT atteso: 4 sezioni (T01, T02, T03, T04). Per ognuna:
1. Repo candidates (3-5, tabella: repo/stars/license/cosa offre)
2. World graph baseline (3-5 zone con gating)
3. Pacing curve (array di 5 numeri tra 0 e 1)
4. Rules ranges (HP min/max, DMG min/max, durata media, checkpoint
   frequency)
5. Note specifiche del genere (es. T02 narrativa branching, T03
   level progression)

PROCEDI. Output 1500-2500 parole totali.
```

---

## PROMPT 2 — Genre Templates batch 2 (T05-T07)

Stesso file da allegare + questo. Genere più complessi.

```
Stesse regole del prompt 1. 3 generi questa volta:

T05 - JRPG Top-down (engine: Godot 4)
T06 - Card Game / Autobattler (engine: LÖVE 11)
T07 - Platformer Hardcore Pixel-Perfect (engine: MonoGame)

Per ognuno: 3-5 repo OSS starter + world_graph + pacing + rules.

EXCLUSIONS:

Per Godot SKIP: noidexe/top-down-action-rpg-template,
TetraForce, guladam/deck_builder_tutorial.
Per LÖVE SKIP: love2d/love, Stabyourself/mari0,
hawkthorne/hawkthorne-journey, srijan-paul/shriek.
Per MonoGame SKIP: MonoGame/MonoGame, MonoGame-Extended/*,
MonoGame.Samples, FNA-XNA/FNA, craftworkgames/MonoGame.Extended,
friflo/Friflo.Engine.ECS, Martenfur/Monofoxe, SkyAlpha/luminus-rpg.

NOTA SPECIFICA per T07: cerca progetti che ricreano Celeste/Super
Meat Boy/N++ con MonoGame. Pixel-perfect physics, sub-second jump,
coyote+jump-buffer pattern.

NOTA SPECIFICA per T05: il dataset ha già copertura JRPG su Godot.
Cerca repo che implementano combat turn-based con visual feedback
JRPG (es. tipo Sea of Stars, Chrono Trigger remake fan).

NOTA SPECIFICA per T06: deck building + match system. Esempi tipo
Slay the Spire / Balatro / Inscryption con LÖVE.

OUTPUT atteso: 3 sezioni come prompt 1. 1200-1800 parole.

PROCEDI.
```

---

## PROMPT 3 — Genre Templates batch 3 (T08-T11)

```
Stesse regole. 4 generi:

T08 - Roguelike/Roguelite Dungeon (engine: Godot 4)
T09 - 3D Browser Showcase (engine: Three.js)
T10 - Stride 3D Action Adventure (engine: Stride3D)
T11 - Multiplayer Arena (engine: Godot 4 + Nakama)

EXCLUSIONS:

Per Godot SKIP: SelinaDev/Godot-Roguelike-Tutorial,
Bozar/godot-4-roguelike-tutorial, foxssake/netfox,
heroiclabs/nakama-godot, devloglogan/MultiplayerFPSTutorial,
Treacherous, broken_seals, OpenLiberty.
Per Three.js SKIP: mrdoob/three.js, donmccurdy/*,
Alchemist0823/three.quarks, DmitriyGolub/threejs-devtools-mcp,
gkjohnson/*, blaze33/map33.js, akarlsten/cuberun,
sombraSoft/solda-slug.
Per Stride SKIP: stride3d/stride, BepuPhysics, Stride Community
Toolkit, SDSL, Xenko sample, qualsiasi cosa dentro stride3d
organization. (NB: l'ecosistema OSS Stride è stato già esaurito.
Verifica se esiste qualcosa di NUOVO dal 2024 al 2026 — magari
demo da blog post community Stride / talk Unite-like. Se nulla
DILLO ESPLICITAMENTE.)

NOTA SPECIFICA T10: gap strutturale confermato. Cerca solo se
emergono progetti nuovi da 2024-2026. Altrimenti scrivi "Stride
ecosystem OSS resta esaurito; raccomandare scaffold hardcoded
custom".

NOTA SPECIFICA T11: il pattern è Godot 4 client + Nakama server.
Cerca template/starter completi più recenti (2024-2026).

OUTPUT: 4 sezioni come sopra. 1500-2000 parole.

PROCEDI.
```

---

## PROMPT 4 — Genre Templates batch 4 (T12-T14)

```
Stesse regole. 3 generi:

T12 - Social Sim / Generative Agents (engine: Godot 4 + Ollama)
T13 - Bullet Hell / Arcade Puro (engine: LÖVE)
T14 - Retro 8-bit Restricted (engine: Godot 4 con profile retro)

EXCLUSIONS:

Per Godot SKIP: ROTA, tiny_crate, MenacingMecha/godot-psx-style-
demo, MenacingMecha/godot-n64-shader-demo, godot-tiny-mmo (parziale).
Per LÖVE SKIP: love2d/love samples, Stabyourself/mari0.

NOTA SPECIFICA T12: cerca progetti che hanno integrato LLM nei
giochi (es. Smallville-clone in Godot, NPC con memoria persistente
via Ollama/local LLM). Topic: topic:llm-game, topic:generative-
agents. Anche se sono prototipi è OK — il valore è il pattern di
integration.

NOTA SPECIFICA T13: bullet hell con WaveSpawner, pattern-based
enemy waves. Esempi tipo Touhou clone, Geometry Dash, danmaku.

NOTA SPECIFICA T14: cerca progetti che usano vincoli retro
deliberati su Godot 4 (palette ridotta, no tween smooth, 8-bit
audio only). Pico-8-inspired ma su Godot. Topic: topic:pico-8-
style, topic:godot-retro.

OUTPUT: 3 sezioni. 1200-1800 parole.

PROCEDI.
```

---

## PROMPT 5 — Three.js Postprocessing + Engine Gap Coverage

Questo è il prompt più focalizzato. Chiude il G.4 di
RAG_GAP_DECISIONS.

**File da allegare**: `RAG_GAP_DECISIONS.md` + `ENGINE_MECHANICS_KIT.md`
+ questo file.

```
Lavoro per Game Studio AI. Ho un gap minore nel mio dataset RAG di
codice game-dev su Three.js: pochi chunk su postprocessing
pipeline e shader vfx avanzati. Devo riempire il gap con harvest
mirato.

Cerca repo OSS che implementano postprocessing avanzato per
Three.js (web 3D). Vincoli:
- Licenza permissiva (MIT/Apache/BSD/Zlib/Unlicense). NO GPL.
- Dimensione < 100 MB.
- Non già nel nostro KB. Skip: mrdoob/three.js, donmccurdy/*,
  pmndrs/drei (lo conosciamo già).

Topic GitHub interessanti: topic:threejs-shaders, topic:
postprocessing, topic:webgl-vfx, topic:r3f-shader.

Cerco specificamente esempi/repo per:

1. EffectComposer pipeline (bloom, FXAA, depth-of-field, chromatic
   aberration, color grading via LUT)
2. Toon / cel-shading shaders Three.js
3. Volumetric lighting / godrays
4. Outline / postprocessing per highlight oggetti
5. Stylized rendering (watercolor, painterly, PSX-style filters)
6. Particle systems shader-based

Per ognuno: link GitHub + stelle + licenza + 1 frase su cosa offre.

Output: una tabella + 5-10 link verificati.

REGOLA ANTI-INVENZIONE: ogni link DEVE essere reale. Se non sei
sicuro, NON includere.

Aggiungi anche, in coda, un mini-paragrafo: "Stato Stride OSS al
2026" — cerca brevemente se nel periodo 2024-2026 sono comparsi
NUOVI progetti OSS Stride permissivi (oltre stride3d organization
e BepuPhysics). Se nulla, dichiaralo. 100 parole max.

OUTPUT totale: 800-1500 parole.

PROCEDI.
```

---

## Cosa fare con l'output

Per ogni round di Deep Research che ricevo:

1. **Verifica WebFetch** dei link più sospetti (random 5/round). Le
   regole del round 1/2 Reasoning Engine valgono: Gemini inventa
   URL il 10-15% delle volte.
2. **Scarta** i repo già nel manifest (Bash query in `data/manifest.json`).
3. **Stage 1 review**: salvo l'output verificato in
   `docs/RESEARCH_OUTPUT_<topic>.md` con disclaimer.
4. **Stage 2 review**: scrivo un Add-On al `GENRE_TEMPLATE_CATALOG`
   (nel blueprint v2 parte N.3) con i repo + schemi confermati.

---

## Strumenti aggiuntivi disponibili

Oltre a Gemini Deep Research, ti elenco alternative se vuoi
parallelizzare:

| Tool | Quando usarlo | Pro | Contro |
|---|---|---|---|
| **Gemini Deep Research** | default per i 5 prompt | output strutturato, ottime fonti web | a volte verbose; può inventare URL |
| **ChatGPT Deep Research** (Pro) | parallelo, cross-check | meno verbose, fonti academic-friendly | richiede subscription Pro |
| **Perplexity Pro Deep Research** | quando servono accademici | bibliografia formale | meno bravo su code repos |
| **Claude.ai con Web Search** (Pro) | code reading specifico | ottimo su README GitHub | meno multi-source |
| **Grok Deep Search (xAI)** | segnali community/social | trova post Twitter/Reddit rilevanti | meno strutturato |
| **Genspark Autopilot** | multi-LLM compare | confronto rapido tra fonti | output meno coeso |

**Raccomandazione**: lancia i 5 prompt su Gemini come primario. Se
un risultato è debole, ri-lancia lo stesso prompt su ChatGPT Deep
Research per confronto.

---

## Cosa NON gli stiamo chiedendo (lasciato a me / ricerca interna)

- ✅ Style pack details (palette/LoRA/font) — già fatto in
  `STYLE_PACK_REFERENCES.md`
- ✅ Asset library manifest — già fatto in `ASSET_LIBRARY_MANIFEST.md`
- ✅ Audio mood library — già fatto in `AUDIO_MOOD_LIBRARY.md`
- ✅ Reference games visual — già fatto in `REFERENCE_GAMES_VISUAL.md`
- ✅ RAG gap decisions — già fatto in `RAG_GAP_DECISIONS.md`
- ✅ Engine mechanics kit — già fatto in `ENGINE_MECHANICS_KIT.md`

Gemini si concentra solo su quello che NON posso fare bene da solo:
trovare repo OSS recenti specifici per template di genere.

---

## Tempo totale Fase 2

- Documenti interni (fatti oggi): 6 file ~5h
- 5 prompt Deep Research (tu): ~2-3h
- Review degli output (io): ~2h
- Aggiornamento blueprint v2 con materiali raccolti: ~1h
- **Totale**: ~10-12h di calendario per essere pronti allo sviluppo
  Sett 1.

Dopo questo: codice.
