# Studio + Asset Library — piano consolidato (recupero)

> Recupero e fusione di tre documenti di ricerca (`research/SORCERESS_30_TOOLS.md`,
> `research/SORCERESS_MAPPING.md`, `research/GAMESMITH_LAB_VISION.md`) in un unico
> piano azionabile: **quali tool costruire**, **la UI come l'avevamo pensata**, e
> **con quanta certezza** ognuno si può realizzare. Ancorato a cosa ESISTE già nel
> codice (giugno 2026).

---

## 0. Il modello (la differenza che non si perde)

- **Sorceress** = generativo-a-tutto-costo (lock-in sui crediti, ~$10-100/mese), zero verifica del gioco, orchestrazione manuale di 5+ tool.
- **GameSmith** = **CC0-first gratis + generativo solo a paywall**, asset integrati in un gioco **verificato** che l'utente **possiede ed esporta**.
- Non copiamo il prodotto: **prendiamo le capability che ci mancano e le mettiamo nel NOSTRO flusso** (automatico + verificato).

**Library e Gioco sono pari dignità, comunicano nei due sensi** (genero → estraggo asset → li miglioro nello Studio → rigenero meglio; la Library accumula coerenza). Non "la library serve il gioco": è un ciclo.

---

## 1. Cosa ESISTE GIÀ (verificato nel codice — non si riparte da zero)

| Pezzo | File | Stato |
|---|---|---|
| Slicer (taglia sheet per griglia/size data) | `lib/studio/slicer.ts` | ✅ reale (92 righe) |
| Pixel-snap (quantizza a palette nota + posterize) | `lib/studio/pixel-snap.ts` | ✅ reale (82 righe) |
| Material maps (deriva normal/roughness/AO) | `lib/studio/material-maps.ts` | ✅ reale (123 righe) |
| Pagina Studio (legge `project_assets`) | `app/(dashboard)/studio/` | ✅ reale (page+actions) |
| Bridge: la library utente è consultata PRIMA del CC0 | `lib/tools/asset-resolver/index.ts` (`findUserAsset`) | ✅ wired |
| Audio gen (Suno/ElevenLabs, paywall) | `lib/tools/audio/` (`SunoElevenAudioPort`) | ⚠️ scritto, NON nel registry |
| Porte esagonali generative | `ImageGenPort` / `Model3DPort` / `AudioGenPort` | ✅ esistono → si riempiono |
| Tileset/autotile (47-blob da 1 tile) | `lib/tools/level/tilemap_populate/` + `_autotile.ts` | ✅ superiore a Sorceress |
| Catalogo CC0 categorizzato | `asset_library_index` (~8.267 asset, 6.861 con style_pack) | ✅ + 2.488 SFX, 1.406 musica |

**Conseguenza:** lo Studio non è da costruire — è da **completare**. Mancano i tool di *detection/enrichment* (l'inverso di quelli che hai) + la Library sfogliabile sul catalogo + il wiring audio.

---

## 2. I tool — "buona parte", curati e prioritizzati

Legenda certezza: 🟢 deterministico, in casa, costo zero (free) · 🟡 serve provider dietro porta esistente (paywall) · 🔵 già nostro · ⚪ skip.

### Tier A — Build in casa, certezza alta (🟢) — il cuore dello Studio
Questi sono **algoritmi puri**, nessun provider, free tier. Sono anche ciò che il *composer di scena* consuma.

| Tool | Cosa fa | Come si realizza (con certezza) | Stato |
|---|---|---|---|
| **Tile-size detector** | rileva la griglia di un tileset (16/32/48…) | prova divisori comuni + autosimilarità tra blocchi (FFT/autocorrelazione o match a finestra) | ❌ da fare (l'inverso dello slicer) |
| **Palette extractor** | estrae la palette dominante di un asset | k-means / median-cut sui pixel non-trasparenti | ❌ da fare |
| **Sprite/Frame analyzer** | rileva frame_w/h, count, fps, anchor (piedi/centro) | connected-components + grid detect; emette metadata per l'agente | ⚠️ metà (slicer c'è, manca il detect) |
| **Slicer** | taglia sheet in frame | per griglia o size | ✅ esiste |
| **True Pixel / Pixel Snap** | post-fx pixel-art (palette PICO-8/NES/GB + dither Floyd-Steinberg) | downscale + quantize + dither | ✅ esiste (pixel-snap) |
| **Background Remover** | ritaglio bg, batch, hard-alpha | `rembg` / modello open + alpha | ❌ leggero |
| **Corridor Chroma** | green-screen keying (il forte di Sorceress per le animazioni) | chroma key deterministico (+ opz. matting neurale) | ❌ leggero |
| **Material Forge** | da 1 base color → normal/rough/metallic/AO/emissive | 5/6 map sono **derivati deterministici** (no AI) | ⚠️ metà (material-maps c'è) |
| **3D-to-2D** | renderizza un model 3D → sprite/animazione 2D (billboard) | render headless (E2B/three) dei **554 model CC0** | ❌ (abbiamo model + sandbox) |
| **SFX Editor / Sound Studio** | taglia/edita clip audio (waveform) | utility audio deterministica | ❌ leggero |
| **Bitrate converter** | riduce peso audio | utility | ❌ banale |
| **Collision-box from sprite-sheet** | JSON di hitbox per frame | bounding-box su alpha per frame | ❌ **alto valore** (il creatore di Sorceress se l'è dovuto costruire live) |

### Tier B — Riempi una porta esistente, certezza media (🟡) — premium/paywall
L'architettura c'è già (porte esagonali). Riempire un adattatore = semplice; qualità/costo = del provider.

| Tool | Cosa fa | Porta | Note |
|---|---|---|---|
| **Auto-Sprite v2** | char → **clip video 1s (Grok)** → estrai frame → **chroma batch** → sprite-sheet + JSON | `ImageGenPort` (video) + chroma 🟢 | **la capability migliore da rubare** (animazioni coerenti) |
| **Music Gen / SFX Gen / Speech Gen** | Suno / ElevenLabs | `AudioGenPort` (**già scritto**) | basta **collegarlo al registry** + binario CC0 gratis dal catalogo |
| **3D Studio** | prompt→img→3D(GLB)→decimate→rig→anim | `Model3DPort` | Meshy / TRELLIS.2 (già valutato, ~$0.005/asset) |
| **Auto-Rigging / Text-to-Animation** | scheletro + anim | `Model3DPort` | progressivo, dopo il 3D gen |
| **Seamless Tile Gen** | tile ripetibile senza giunte | `ImageGenPort` + tiling check 🟢 | complementare all'autotile |
| **Image Expander** | outpaint / estende | `ImageGenPort` | nice-to-have |

### Tier C — Già nostro (🔵) / da non fare (⚪)
- 🔵 **Tileset Forge** (`tilemap_populate`+autotile, **superiore**), **Publishing** (webExport+zip+itch), **Play Arcade** (feed iframe), **Quick Sprites** (estende `sprite_gen`).
- ⚪ **Skip day-1:** Voxel ×3, Canvas (editor img in-browser), Marketplace, Procedural Walk (IK nicchia).
- 🚫 **Mai assorbire:** WizardGenie (il loro game-engine senza verifica — il nostro core verificato è il punto di forza).

---

## 3. La UI come l'avevamo pensata

**Lo Studio NON è un prodotto separato: è una superficie dentro il flusso GameSmith.** Sei sottosistemi, un solo motore, più punti d'accesso, **due profondità** (utente medio: prompt→gioco; esperto: library curata + edit granulare).

### 3.1 Asset Library (entità autonoma)
- griglia sfogliabile, **organizzata per RUOLO nel gioco**: tiles · sprite 2D · modelli 3D · animazioni · audio · materiali
- **filtri** (tipo / stile / genere / 2D-3D) + **ricerca semantica** (pgvector — già nostra; doppio uso: barra manuale + match-auto in generazione)
- ogni asset mostra i metadati arricchiti (style_pack, tile_size, palette, frame_size, licenza)
- **posseduta ed esportabile**; si riempie in 2 modi: **curando** nello Studio **o estraendo** asset da un gioco generato
- `save → project_assets` (la pagina attuale già legge questa tabella)

### 3.2 Studio (i tool)
- ogni tool ha la sua mini-UX (ricostruita da 13 pagine-tool + transcript):
  - **Auto-Sprite**: 3 pannelli — genera / anima / estrai — con batch
  - **3D Studio**: model-selector (Meshy/TRELLIS/…), viewport three.js, slider decimate, “ruota”
  - **Material Forge**: anteprima dei 5 map + **chat-refine** (“too shiny” → riduci roughness)
  - **True Pixel**: input → cleanup (palette retro + dither) → export
  - **Tile/Slicer**: drop sheet → detect griglia → frame evidenziati → export + JSON
- **doppio binario per ogni capability**: CC0-first gratis · generativo AI a paywall
- gli asset prodotti si **provano sui NOSTRI motori e mappe** (non nel vuoto come Sorceress)

### 3.3 Il ciclo bidirezionale (il cuore)
```
   GIOCO (generato, verificato)  ──estrai asset→ ASSET LIBRARY (posseduta, coerente)
        ▲ valido da solo (prompt→gioco)        usa asset curati come input ▼
        └───────────────────  rigenero meglio  ───────────────────────────┘
```

### 3.4 Modifica granulare ("Higgsfield dei videogiochi") — profondità esperto
- mentre giochi, prompt per aggiustare cose specifiche; per area/livello; doppio canale (utente diretto + agente); fino all'edit del codice.

---

## 4. Con quanta certezza si realizzano (la tua domanda)

- **~12 tool li ricreiamo 1:1 in casa** — sono codice deterministico (palette/dither, connected-components, chroma key, derivazione PBR, bounding-box, autocorrelazione tile). **Certezza alta, costo zero, free tier.** Di questi, 3 sono già scritti (slicer, pixel-snap, material-maps).
- **~8 tool li integriamo riempiendo porte esagonali che ESISTONO già** (`ImageGenPort`/`Model3DPort`/`AudioGenPort`) con provider terzi (Grok-video/Meshy/TRELLIS/Suno/ElevenLabs/FLUX). Certezza = quella del provider; vanno a **paywall**. **L'audio è il più pronto: il codice è già scritto, manca solo il wiring al registry.**
- **~5 già coperti** (Tileset/autotile, Publishing, Play Arcade, Quick Sprites) — alcuni meglio di Sorceress.
- **Vantaggio strutturale:** porte + adattatori esistono → "prendere i tool uno a uno" = **riempire porte, non riscrivere**.
- **Limite onesto:** la UX è ricostruita da pagine-tool + transcript (accurata su cosa/come, non pixel-level della loro UI). I provider a paywall hanno costo/qualità non sotto nostro controllo.

---

## 5. Perché lo Studio-prima ha senso (legame con l'architettura cross-engine)

Il **composer di scena** (la spina dorsale cross-engine, motori×archetipi) **presuppone** asset arricchiti: `tile_size` noto, palette estratta, ruoli-tile, frame-size. Lo Studio è **lo strato che li produce**. Costruirlo prima:
1. è il prerequisito del composer (non un detour);
2. dà valore **visibile e di prodotto** subito (Library sfogliabile + tool che si vedono funzionare) → morale + moat;
3. è la parte **meno dipendente** dal problema duro cross-engine (lavora su immagini/audio → metadati).

**Tre paletti (obbligatori):** (a) Studio v1 = Library-browse + i ~4 tool di *detection/enrichment*, non tutti e 30; (b) schema asset **co-disegnato col contratto GameSpec** del composer (così arricchisci i campi giusti); (c) "in parallelo" = Studio in **codice** + motori su **carta** (GameSpec + porta EngineComposer + filtro pseudo-codice).

---

## 6. Ordine consigliato (incrociato coi pain point r/aigamedev)

1. **🟢 Detection/enrichment** (tile-size, palette, frame-analyzer) + gira a **ingestione** sul catalogo → sblocca il composer. *(prerequisito)*
2. **🟢 Audio dal catalogo CC0** + **wire `SunoElevenAudioPort`** al registry → giochi non più muti, free. *(Reddit tema #1 audio, 3.736 commenti; codice già scritto)*
3. **🟢 Library sfogliabile** (griglia + filtri + ricerca semantica sul catalogo) → valore visibile.
4. **🟢 Background Remover + Chroma + Slicer-detect** → pipeline asset pulita (BYOA/upload).
5. **🟡 Auto-Sprite v2** (clip video 1s → frame → chroma batch) → animazioni coerenti. *(la capability migliore da rubare)*
6. **🟡 Material Forge completo + 3D-to-2D** → gap 3D.
7. **🟡 3D Studio / rig / anim** (Meshy/TRELLIS) → premium.
8. **🟢 Collision-box from sheet** → hitbox per frame (alto valore, lo Studio lo offre, il gioco lo consuma).

---

## 7. Moat (perché non è "un wrapper")
1. **Export + ownership** — possiedi Library E giochi, su motori veri (l'opposto del lock-in Sorceress).
2. **Dati su giochi creati e apprezzati** — feed/flywheel: più valore creato → più dati → il sistema migliora.
Il generativo AI è il **premium** (paywall), non il cuore. Il cuore è: Library posseduta + gioco verificato + modifica granulare + community.
