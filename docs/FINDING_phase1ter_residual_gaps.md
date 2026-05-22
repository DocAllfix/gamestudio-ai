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

## Raccomandazione per Fase 1quater (se si procede)

1. Mini-harvest **phaser C03/C04** + **monogame C01/C03** (P1), stesso pattern
   di filtro irrobustito di questa fase. Stima +200-400 chunk.
2. Eventuale **cap per categoria** sulle fat cells E01 per ridurre il rumore di
   retrieval (decisione di prodotto, non di harvest).
3. Stride: lasciare a 215 e documentarlo come limite dell'ecosistema.

## Costo Fase 1ter

API (classify + re-tag + quarantine, tutto OpenAI gpt-4o-mini, DeepSeek
esaurito): ~$0.30 utili + ~$0.10 sprecati in 2 run crashati prima del fix
decoupling = **~$0.40 totali**. Zero nuovi clone multi-GB (vincolo disco
rispettato).
