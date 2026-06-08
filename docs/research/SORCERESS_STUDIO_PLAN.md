# Assorbire Sorceress come "Asset Studio" di GameSmith

Piano in 3 fasi (richiesta utente): (1) inventario di OGNI tool Sorceress, (2) come
li mette in piedi e li fa usare lato UX, (3) come integrarli in una funzionalità
nostra "Studio" che prepara gli asset PRIMA, per poi costruire il gioco con asset
già generati.

Fonti: 4 video del creatore (transcript in `data/research/sorceress_*_transcript.txt`,
`v3/suite/3dchar_clean.txt`), pagine tool, blog, + dati r/aigamedev. Sorceress NON
ha modelli propri: è **orchestrazione di provider terzi** (parole del creatore: "all
the best models in one place", "the raw ingredients are there but fragmented").

---

## FASE 1 — Inventario completo (ogni tool + tecnologia sottostante)

### Sprite & 2D
| Tool | Cosa fa | Tech sotto |
|---|---|---|
| **Auto-Sprite v2** | AI img → AI video → estrae frame → sprite sheet (PNG grid + JSON manifest) | Img: Nano Banana/Flux/GPT Image; Video: Grok/Kling/Wan/Seedance; chroma: corridor key (GPU locale) |
| **True Pixel / Pixel Snap** | qualsiasi img/video → pixel art pixel-perfect | post-process proprietario (open-source-style: nearest-neighbor + quantize palette) |
| **Quick Sprites** | generazione sprite rapida | modelli immagine |
| **Tileset Forge** | AI art → detect-tiles → tileset allineato | Nano Banana + detect (manuale placement) |
| **Seamless Tile Gen** | tile ripetibile | image model + tiling |
| **3D-to-2D** | render di un 3D → sprite/anim 2D | rendering |
| **Sprite Analyzer** | analizza sprite sheet → emette codice (frame w/h, fps) per l'agente | logica propria |
| **Slicer** | taglia sprite sheet in frame, detect griglia | logica propria (CV) |

### 3D & Animazione
| Tool | Cosa fa | Tech sotto |
|---|---|---|
| **3D Studio** | prompt→img→3D→decimate→auto-rig→text-to-anim→GLB | Hunyuan 3.1, Meshy 6, TRELLIS 2, Rodin 2, Tripo 3.1 |
| **Auto-Rigging** | scheletro humanoid + weight paint (brush refine) | proprietario / libreria rig |
| **Text-to-Animation** | animazione da descrizione testuale | modello motion |
| **Procedural Walk** | auto-rig multi-gamba + IK su terreno | sistema IK proprietario |
| **Material Forge** | 1 base color AI → deriva normal/rough/metallic/AO/emissive (PBR) | Flux per base; derivati deterministici |

### Voxel
| Tool | Cosa fa |
|---|---|
| **Voxel Studio** | voxel da prompt/img/3D |
| **Voxel Text-to-Animation** + **Procedural Walk Voxel** | anima voxel |

### Image utility
Background Remover (batch, hard-alpha), Image Expander (outpaint), **Canvas** (editor in-browser), Corridor Chroma (neural keying).

### Audio
Music Gen (Suno), SFX Gen, Speech Gen + voice clone (ElevenLabs), SFX Editor, Sound Studio (slice MP3).

### Publishing / utility
Publishing, Play Arcade, Layout Preview, Marketplace, **bitrate converter** (riduce file size audio).

### Game engine
**WizardGenie** — "come Cursor/VSCode", chat con Opus/GPT/Gemini → codice gioco, preview. NESSUNA verifica. = il loro punto debole.

---

## FASE 2 — UX: come li mette in piedi e li fa usare

**Pattern UX ricorrente (ogni tool è una schermata dedicata, stesso scheletro):**
1. **Input area** (prompt testuale e/o upload img/video, drag&drop)
2. **Model selector** — "all the best models in one panel" (scegli Hunyuan vs Meshy vs Tripo; Grok vs Kling per video). L'utente prova più modelli perché "non sono uguali, danno risultati diversi".
3. **Generate** → output nel viewport (three.js live per il 3D, preview frame per gli sprite)
4. **Refine in-place** — slider/brush/chat ("too shiny", weight paint, decimate triangles, ruota il modello, scegli i frame da tenere)
5. **Export** (GLB / PNG sheet+JSON / PBR maps)

**Caratteristiche UX chiave (da rubare come principi):**
- **Multi-model in un pannello**: togli all'utente il "which tool?" (= pain Reddit #1). Decisione: provo più modelli, scelgo il migliore per quel caso.
- **Pipeline guidata a step** ("step 1, step 2..."): il 3D Studio incatena gen→decimate→rig→anim in una sequenza, non tool separati.
- **Entra a qualsiasi stadio**: porti il tuo asset e usi solo il pezzo che ti serve (es. solo rigging su un GLB esistente).
- **Refine conversazionale** (Material Forge: chat "too flat"; coding: chat con l'agente).
- **Batch** (Auto-Sprite processa tutte le animazioni insieme; BG remover multi-file).

**Attriti UX reali (da NON replicare):** tanti passaggi manuali (pulizia frame,
detect che sbaglia, placement tile a mano), e l'utente deve **orchestrare a mano** la
catena tra i tool. GameSmith deve automatizzare la catena, non solo offrire i pezzi.

---

## FASE 3 — Lo "Studio" di GameSmith (asset PRIMA, poi il gioco)

### Idea (utente)
Una funzionalità **"Studio" separata** dove l'utente prepara/genera tutti gli asset
(sprite, 3D, tileset, audio, materiali) — poi questi asset **già generati** entrano
nella generazione del gioco vera e propria, invece di essere generati al volo.

### Come si innesta sull'architettura esistente (verificato)
GameSmith HA GIÀ le porte esagonali in `lib/contracts/generative.contract.ts`:
`ImageGenPort`, `Model3DPort`, `AudioGenPort`, `WorldGenPort`. Gli adattatori vivono
in `lib/tools/{sprite,3d,audio,world}/`. → "Prendere i tool uno a uno" = **riempire/
estendere queste porte con gli stessi provider** (Meshy/TRELLIS/Flux/Suno) + aggiungere
le pipeline (chroma, slice, PBR-derive). NON è riscrivere l'architettura.

### Il pezzo nuovo: un "Asset Workspace" persistente
Oggi il flusso è prompt→`GamePlan`→tool generano asset al volo→build. Lo Studio
aggiunge uno **stato persistente di asset** prima del piano:

1. **`project_assets`** (nuova tabella, migration NNN): asset che l'utente genera/carica
   nello Studio (tipo, url R2, style_pack, metadata, license). Riusa il pattern BYOA.
2. **Studio UI** (`app/studio/`): una superficie con i tool-come-pannelli (stesso
   pattern UX di Sorceress: input→model selector→generate→refine→save-to-project).
   Ogni pannello chiama una porta generativa esistente. Gli asset salvati vanno in
   `project_assets`.
3. **Aggancio al GamePlan**: in fase di generazione, l'`asset_resolver` (già esistente!)
   prima cerca in `project_assets` del progetto (gli asset che l'utente ha già
   preparato), POI nel catalogo CC0, POI generativo paywall. Cioè: gli asset dello
   Studio diventano la **prima fonte** del match — il gioco si costruisce con gli asset
   che l'utente ha già curato.

### Capability da costruire dietro le porte (ordine valore/sforzo)
1. 🟢 **Audio** — `AudioGenPort` ha già il codice (`lib/tools/audio/`), serve: collegarlo + tool "match da catalogo CC0" (2.488 SFX). Quasi pronto.
2. 🟢 **Auto-Sprite pipeline** — la capability più forte di Sorceress: video→frame→chroma→sheet+JSON. Risolve "sprite coerenti" (pain Reddit). Estende `sprite/`.
3. 🟡 **3D Studio** — riempire `Model3DPort` con Meshy/TRELLIS ([[reference_trellis2]]) + decimate + rig. Paywall.
4. 🟡 **Material Forge** — nuova `MaterialPort`: 1 img → 5 PBR map (derivati deterministici, no AI).
5. ⚪ **Utility**: Slicer, Pixel-Snap, BG-remover, 3D-to-2D (leggeri, open-source-style).
6. ❌ **Skip**: Voxel, Canvas, WizardGenie (nicchia o = nostro punto di forza già coperto).

### Principi UX dello Studio (da Sorceress, filtrati)
- Multi-model selector dietro ogni porta (toglie il "which tool").
- Pipeline a step automatizzata (NON orchestrazione manuale come loro).
- Entra a qualsiasi stadio + porta-il-tuo-asset (BYOA esiste già).
- Tutto CC0-first/gratis dove possibile; generativo AI dietro paywall (no critica "wrapper costoso").
- Anti-slop di default (style_pack/palette) = il claim "less AI style" che la community chiede.

### Verifica / done
- Migration `project_assets` applicata; `asset_resolver` legge prima da lì (test).
- 1 porta riempita end-to-end (audio): genera nello Studio → salva → il GamePlan lo usa nel gioco buildato.
- UI Studio: pannello per dominio, model selector, save-to-project; tsc + build verdi.
- Nessuna regressione sul flusso di generazione esistente.

### Nota onesta (scope)
È un'espansione grossa (settimane, 5-6 capability + UI + migration). Va fatta
**incrementale** dietro le porte che già esistono, NON tutta insieme, e DOPO aver
validato che il loop base (primo gioco reale) funziona — sennò si costruisce uno
studio di asset per un motore di gioco non ancora provato end-to-end.
