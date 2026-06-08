# Sorceress — i 30 tool: inventario + mapping codice + precisione di ricreazione

Fasi 1 (inventario) e 2 (UX) completate. Lista canonica estratta dal payload della
landing (`sorceress.games`). UX verificata su 13 pagine dedicate `/pages/<tool>` +
transcript di 10 video del creatore (in `data/research/`). La Fase 3 (design dello
Studio integrato) è separata e parte SOLO su tua richiesta di pianificazione.

**Verità di fondo (dal creatore stesso):** Sorceress non ha modelli propri. È
**orchestrazione**: UI + pipeline (chroma key, slicing, detect, PBR-derive) sopra
provider terzi. Alcuni provider sono API a pagamento (Meshy, Suno, ElevenLabs),
alcuni open-source/eseguibili in casa (TRELLIS, palette/dither, connected-components).

**Legenda precisione di ricreazione:**
- 🟢 **Alta** = logica deterministica/open, ricreabile 1:1 in casa (no provider esterno costoso)
- 🟡 **Media** = serve un provider (API o modello self-host); l'adattatore è semplice, il costo/qualità dipende dal provider
- 🔵 **Già nostro** = GameSmith lo copre già (a volte meglio)
- ⚪ **Skip** = nicchia o fuori dal nostro core

---

## Inventario completo (30) con mapping

### Sprite & 2D (9)
| # | Tool | Cosa fa (UX) | Mapping codice GameSmith | Precisione |
|---|---|---|---|---|
| 1 | **Auto-Sprite v2** | img→video→estrai frame→chroma→sprite sheet+JSON. UX: 3 pannelli (genera/anima/estrai), batch | nuova pipeline su `sprite/` + `ImageGenPort` (video provider) + chroma deterministico | 🟡 (video provider) + 🟢 (chroma/slice) |
| 2 | **Quick Sprites** | gen sprite rapida 4-direzionale, ~10s | `sprite_gen` (esiste) + preset pose | 🔵 estende l'esistente |
| 3 | **True Pixel** | img/video→pixel art. UX: input→cleanup(palette PICO-8/NES/GB + dither Floyd-Steinberg)→export | utility deterministica: downscale+quantize palette+dither | 🟢 **alta** (algoritmo puro, zero AI) |
| 4 | **Pixel Snap** | converte img in pixel-perfect | come True Pixel (variante) | 🟢 alta |
| 5 | **Tileset Forge** | AI art→detect tiles(connected-components)→chroma→fit-grid→paint test→PNG tileset+normal | `tilemap_populate` + `_autotile.ts` (già 47-blob) + connected-components | 🔵 **già superiore** (autotile da 1 tile) |
| 6 | **Seamless Tile Gen** | tile ripetibile senza giunte | image model + tiling offset check | 🟡 (img) + 🟢 (tiling) |
| 7 | **Sprite Analyzer** | analizza sheet→emette metadata (frame w/h, fps) per l'agente | logica CV deterministica | 🟢 alta |
| 8 | **Slicer** | taglia sheet in frame, detect griglia | connected-components/grid detect | 🟢 alta |
| 9 | **3D-to-2D** | rende un 3D→sprite/anim 2D (billboard) | render headless (E2B/three) dei 554 model CC0 | 🟢 alta (abbiamo i model + il sandbox) |

### 3D & Animazione (5)
| # | Tool | Cosa fa (UX) | Mapping | Precisione |
|---|---|---|---|---|
| 10 | **3D Studio** | prompt→img→3D→decimate→rig→anim→GLB. UX: model-selector (Hunyuan/Meshy/TRELLIS/Rodin/Tripo), viewport three.js, decimate slider, ruota | `Model3DPort` (porta ESISTE) + adattatori provider | 🟡 media (provider 3D) |
| 11 | **Auto-Rigging** | scheletro humanoid + weight paint brush | libreria rig (es. auto-rig open) dietro `Model3DPort` | 🟡 media |
| 12 | **Text-to-Animation** | animazione da testo | modello motion provider | 🟡 media |
| 13 | **Procedural Walk** | auto-rig multi-gamba + IK terreno | sistema IK (open, calcolabile) | 🟢 alta ma ⚪ nicchia |
| 14 | **Material Forge** | 1 base color AI→deriva normal/rough/metallic/AO/emissive. UX: chat-refine ("too shiny") | nuova `MaterialPort`: img + derivati DETERMINISTICI | 🟢 **alta** (5/6 map sono derivati, no AI) |

### Voxel (3) — ⚪ tutti nicchia
| 15 | **Voxel Studio** | voxel da prompt/img/3D, export GLB/VOX | 🟡 + ⚪ skip day-1 |
| 16 | **Voxel Text-to-Animation** | anima voxel | ⚪ skip |
| 17 | **Procedural Walk Voxel** | IK walk voxel | ⚪ skip |

### Image utility (4)
| 18 | **Background Remover** | rimuove bg, batch, hard-alpha | `rembg`/open model + alpha | 🟢 alta |
| 19 | **Image Expander** | outpaint/estende | image model (inpaint/outpaint) | 🟡 media |
| 20 | **Canvas** | editor immagini in-browser | ⚪ skip (non core) |
| 21 | **Corridor Chroma** | neural green-screen keying | chroma deterministico + (opz. matting model) | 🟢 alta (chroma) / 🟡 (neural matting) |

### Audio (5)
| 22 | **Music Gen** | musica AI (Suno) | `AudioGenPort` (codice ESISTE in `lib/tools/audio/`) | 🟡 (Suno) + 🔵 wire |
| 23 | **SFX Gen** | sfx AI (ElevenLabs) | idem `AudioGenPort` + **2.488 SFX CC0 nel DB** | 🟢 (catalogo CC0) + 🟡 (gen) |
| 24 | **Speech Gen** | voce/TTS + clone (ElevenLabs) | `AudioGenPort.voice_gen` (esiste) | 🟡 media |
| 25 | **SFX Editor** | edita/taglia sfx | utility audio (waveform) | 🟢 alta |
| 26 | **Sound Studio** | slice MP3 in clip | utility deterministica | 🟢 alta |

### Publishing / utility (4) — 🔵 in gran parte già nostro
| 27 | **Publishing** | esporta/pubblica gioco | ✅ W3 webExport + zip + itch | 🔵 già nostro |
| 28 | **Play Arcade** | gioca in-place | ✅ feed iframe | 🔵 già nostro |
| 29 | **Layout Preview** | anteprima layout | ⚪ minore |
| 30 | **Marketplace** | vendi asset | ⚪ futuro |
| (+) | **Bitrate converter** | riduce file size audio | 🟢 utility |
| (+) | **WizardGenie** (game engine) | prompt→codice→preview, NO verifica | 🔵 **il nostro core è superiore** (verifica anti-break) — mai assorbire |

---

## Sintesi: con quanta precisione possiamo ricrearli/integrarli

**🟢 Alta precisione (ricreabili 1:1 in casa, logica open/deterministica) — 12 tool:**
True Pixel, Pixel Snap, Sprite Analyzer, Slicer, 3D-to-2D, Material Forge (derivati),
Background Remover, Corridor Chroma (chroma), SFX Editor, Sound Studio, Procedural
Walk (IK), Bitrate. → Questi NON dipendono da provider costosi: sono algoritmi
(palette/dither, connected-components, chroma key, derivazione PBR, IK). Li scriviamo noi.

**🟡 Media (serve un provider dietro una porta che spesso ESISTE già) — 9 tool:**
Auto-Sprite (video), 3D Studio + Auto-Rig + Text-to-Anim (Meshy/TRELLIS), Material
base color, Seamless, Image Expander, Music/SFX/Speech Gen. → L'architettura è già
pronta (porte esagonali `ImageGenPort`/`Model3DPort`/`AudioGenPort`). Riempire un
adattatore è semplice; il costo/qualità è del provider, e va dietro paywall.

**🔵 Già nostro (a volte meglio) — 5+:** Tileset (autotile superiore), Quick Sprites,
Publishing, Play Arcade, e il game-engine (WizardGenie) dove il nostro verificato vince.

**⚪ Skip day-1 — Voxel ×3, Canvas, Layout/Marketplace.**

### Conclusione di precisione (la tua domanda)
- **~12 tool li ricreiamo 1:1** senza dipendenze esterne (sono codice deterministico). Precisione alta, costo zero, free tier.
- **~9 tool li integriamo riempiendo porte esagonali che già abbiamo** con provider terzi (Meshy/TRELLIS/Suno/Flux). Precisione = quella del provider; vanno a paywall. L'audio è il più pronto (codice già scritto).
- **~5 già coperti** (e Tileset/engine meglio di loro).
- **Vantaggio strutturale nostro:** l'architettura esagonale + le porte generative
  esistono già → "prendere i tool uno a uno" = riempire porte, non riscrivere.
- **Limite onesto:** non ho potuto vedere i FRAME dei video (solo transcript) né
  l'app live (login/JS); la UX è ricostruita da 13 pagine-tool + 10 transcript, è
  accurata sul "cosa/come" ma non ho il pixel-level della loro UI.

> Mi fermo qui come richiesto. Quando vuoi, ti pianifico l'integrazione (Fase 3:
> lo "Studio" che prepara gli asset → poi costruisce il gioco con asset già pronti).
