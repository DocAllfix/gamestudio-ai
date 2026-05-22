# FINDING — Fase 1ter: stato del dataset e gap residui

**Data**: 2026-05-22
**Dataset**: `code_knowledge` su Supabase pgvector
**Totale chunk**: **9 005** (era 8 834 a inizio Fase 1ter)

## Cosa è stato fatto in Fase 1ter

1. **Pipeline non-GitHub (Fase 1bis) committata** in 3 commit puliti.
2. **Filtro qualità irrobustito** (`02_filter.py` + `_filter_rules.py`):
   - Bypass del cap LOC (30k→100k) per repo fidati (`bypass_filters`), per
     raccogliere il corpo completo di engine ufficiali / mono-repo curati.
   - **Guard licenze copyleft**: GPL/AGPL/LGPL/CC-BY-NC/CC-BY-SA bloccati anche
     per repo fidati (RAG riproduce i chunk quasi verbatim nell'output → la
     licenza si trasmette al gioco generato). Matching sul *head* del file
     LICENSE con override permissivo per evitare falsi positivi su liste di
     dipendenze (es. `license.txt` di LÖVE che è zlib ma elenca dep GPL).
   - **Unknown droppato** se non verificato out-of-band.
3. **44 chunk GPL/AGPL rimossi dalla produzione** (MD-Sudo, enkindle) —
   contaminazione legale reale già presente nel DB.
4. **detour-adventure-framework recuperato** (MIT, 62k LOC, +137 chunk).
5. **Re-classificazione "dominio vs forma" per Ren'Py** (`09_requalify_quarantine.py`):
   - Re-tag dei 402 D01_ui: **58 spostati** nelle categorie corrette
     (C04_save_load +25, C03 +16, C02_inventory +9, D02_audio +4, C01 +3).
   - Quarantine recovery: **78 chunk promossi** da quarantine a code_knowledge.

### Esito Ren'Py (il collo di bottiglia n.1)

Le 4 categorie target che la Fase 1bis NON era riuscita a riempire ora sono
popolate, **senza nuovo harvest** — solo riclassificando meglio:

| Categoria | Fase 1bis | Ora |
|---|---:|---:|
| C03_dialogue_narrative | 48 | **122** |
| C04_save_load | 0 | **26** |
| C02_inventory | 0 | **12** |
| D02_audio | 0 | **7** |
| C01_progression | 0 | **5** |
| E04_genre_specific | 15 | 21 |

Ren'Py totale: **591** (era 420). `visual_novel` e `rpg` ora hanno Ren'Py tra
gli engine "backed".

## Coverage per engine (stato attuale)

| Engine | Chunk | Note |
|---|---:|---|
| godot | 3 357 | dominante, copertura completa |
| threejs | 1 270 | forte su 3D/vfx |
| monogame | 1 090 | gap su C01/C03 (RPG) |
| phaser | 968 | gap su C03/C04 (narrative/save) |
| defold | 796 | copertura ampia |
| love2d | 718 | C03 sottile |
| renpy | 591 | VN ora completo |
| stride | 215 | **esaurito** (vedi sotto) |

## Generi videoludici coperti

`html5_casual` coperto da 7/8 engine; `platformer`, `puzzle`, `sandbox_3d`
da 6/8. `rpg` e `visual_novel` da 3 (godot, renpy, defold). `shooter` da 4.

## Gap residui (dove ampliare in futuro)

### P1 — chiudibili con harvest mirato di qualità
- **phaser × C03_dialogue_narrative / C04_save_load** (0/0): Phaser è il 2°
  engine del KB ma nudo su dialogo e save. Mini-harvest topic `phaser+rpg`,
  `phaser+visual-novel`, Phaser Examples ufficiali.
- **monogame × C01_progression / C03_dialogue** (0/0): ecosistema RPG MonoGame
  (MonoGame.Extended SceneManagement, fan-project).

### P2 — strutturali, accettabili
- **renpy × A/B** (player controller, combat, physics, navigation = 0): atteso.
  I VN raramente hanno controller fisici; non è un vero buco di prodotto.
- **Categorie-discarica (fat cells)**: godot.E01 (810), threejs.E01 (539),
  monogame.E01 (497) — boilerplate project-structure sovra-rappresentato.
  Non dannoso ma diluisce il retrieval; valutare un cap per categoria.

### P3 — irrisolvibili senza fonti che non esistono
- **Stride × quasi tutto C/D02/E04**: l'ecosistema OSS Stride conta solo ~6
  repo (stride3d/stride, BepuPhysics, StrideToolkit, SDSL, Xenko sample), tutti
  **già processati e splittati in 9 subdir samples**. 215 chunk è il tetto
  pratico. Crescere richiederebbe materiale che non esiste pubblicamente o
  fonti non-permissive. **Gap strutturale, non un TODO.**

## Aggiornamento — sessione di chiusura P1+P2

Dopo il finding originale ho provato a chiudere P1 e P2 in maniera definitiva.

### P2 — risolto al 100%
Implementato `11_apply_caps.py` con cap=250 sulle celle che empiricamente
crescevano a category-discarica. Rimossi **1 508 chunk boilerplate** totali in
due passi (1 096 + 412 dopo che il parse li aveva re-immessi via embed_store).
Lo script è idempotente e va richiamato dopo ogni `05_embed_store.py`.
**0 fat cells** nel report finale. Tagliati ordinando per `(quality + reuse)`
crescente + `loc` crescente, quindi i tenuti sono i migliori 250 esempi per
cella. Backup degli ID rimossi in `data/caps_backup_latest.json`.

### P1 — gap strutturale confermato
Harvest mirato `phaser+rpg/visual-novel/dialogue/save` + `monogame+jrpg/
dialogue/inventory` + 2 notable (`SkyAlpha/luminus-rpg` MIT, `Martenfur/Monofoxe`
MIT). Esito reale:
- **5 nuovi repo clonati**, 2 entrano in `repos_clean` dopo filter.
- **+24 chunk phaser** (3 accepted, 12 quarantined, 9 rejected). C03 +1, C02 +0.
- **+200 chunk monogame** ma **1.5% accept rate** (Monofoxe è low-level
  framework, classifier non sa categorizzarlo). C01 +0, C03 +0.
- I 76 chunk phaser in quarantine contengono solo 1×C03 e 1×C02 promuovibili.

**Conclusione**: l'ecosistema OSS Phaser/MonoGame su GitHub non sviluppa
dialogue/save in modo verificabile. Questi feature in Phaser vengono spesso da
plugin commerciali (es. rexrainbow/phaser3-rex-plugins è MIT ma 902 MB, fuori
dai limiti di disco). MonoGame RPG OSS è poverissimo. **Phaser.C03/C04 e
monogame.C01/C03 sono gap strutturali, come Stride** — non chiudibili senza
materiale che non esiste in forma OSS+permissiva pubblicabile.

## Stato finale dataset (post sessione P1+P2)

- **Total: 7 503 chunk** (era 9 005 prima del cap E01).
- **0 fat cells**, **0 chunk GPL/copyleft**, generi coperti: 8/8 con almeno 1
  engine (vedi heatmap nel coverage_report_phase1ter.json).
- Tutte le decisioni di curation sono ora **persistenti** (`11_apply_caps.py`
  + filtro irrobustito).

## Raccomandazione per Fase 1quater (se si procede)

1. **Nessuna**. Il dataset è in equilibrio: i gap rimasti sono strutturali
   dell'ecosistema OSS, non risolvibili con più harvest senza inquinare il
   dataset con materiale di bassa qualità o licenza incerta.
2. La prossima fase utile è probabilmente l'**uso del dataset** (RAG retrieval
   + comparison test) per misurare l'impatto reale sui task di generazione,
   non l'espansione.

## Costo Fase 1ter totale

~$0.55 di API (~$0.40 prima sessione + ~$0.15 questa: phaser+monogame
classify+embed). Zero clone multi-GB. Vincolo disco rispettato.
