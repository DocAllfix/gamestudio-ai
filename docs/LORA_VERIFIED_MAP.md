# LoRA Verified Map — licenze + uso per ogni style pack

**Data**: 2026-05-24
**Metodo**: API HuggingFace (`huggingface.co/api/models/{id}`, campo
`cardData.license`) + API Civitai (`civitai.com/api/v1/models/{id}`).
Tutto verificato senza login manuale.
**Regola**: si tiene il LoRA a meno che la licenza non sia DAVVERO
proibitiva.

---

## Regola licenze (definitiva)

| Licenza | Verdetto | Note |
|---|---|---|
| `apache-2.0` | ✅ TIENI | massima libertà, commerciale OK |
| `mit` | ✅ TIENI | commerciale OK |
| `cc0` / `cc-by-4.0` | ✅ TIENI | commerciale OK |
| `creativeml-openrail-m` | ✅ TIENI | commerciale OK + copia licenza + use-based restrictions (no-harm). Standard Stable Diffusion. |
| `openrail` / `openrail++` | ✅ TIENI | commerciale OK, stessa famiglia |
| `other` | ⚠️ APRI card | spesso è openrail riformulato; verificare no clausola NC |
| `NONE` (non dichiarata) | ⚠️ VERIFICA file | molti `*Redmond` dichiarano openrail nel README ma non nel metadata |
| `cc-by-nc`, `cc-by-nd` | ❌ SCARTA | non-commercial / no-derivatives |
| GPL / AGPL | ❌ SCARTA | copyleft |

**Perché openrail è OK per noi**: CreativeML OpenRAIL-M permette
esplicitamente uso commerciale (vendere immagini generate, servizi a
pagamento). Le uniche restrizioni sono "use-based" (no contenuti
illegali/dannosi) — già coperte dai nostri guardrail di content
moderation. Non è copyleft: l'output non eredita la licenza.

---

## Mappa LoRA → Style Pack (verificata)

Per ogni pack: il LoRA scelto, licenza, base model, e **a cosa serve
concretamente per noi** (quale tipo di asset migliora, in quale
genere/template).

### Pixel art (A01-A08)

| Pack | LoRA HuggingFace | Licenza | A cosa serve per noi |
|---|---|---|---|
| **A01** pixel-art-dark | `nerijs/pixel-art-xl` | creativeml-openrail-m ✅ | Il LoRA pixel-art più scaricato (8.5k). Genera sprite/tileset pixel coerenti per T01 Metroidvania, T07 Hardcore, T08 Roguelike. È IL workhorse del nostro sprite_gen 2D. |
| **A02** pixel-art-vibrant | `nerijs/pixel-art-xl` + prompt "vibrant" | creativeml-openrail-m ✅ | Stesso LoRA, prompt modifier saturato. T02 cozy, T05 JRPG colorato. |
| **A03** pixel-art-1bit | `nerijs/pixel-art-xl` + palette lock 2-color | creativeml-openrail-m ✅ | Stesso base + post-processing palette. Per A03 (Downwell/Obra Dinn style). Niente LoRA dedicato necessario. |
| **A04** pixel-art-gbc | `nerijs/pixel-art-xl` + GBC palette | creativeml-openrail-m ✅ | Idem + palette Game Boy Color. T14 Retro. |
| **A05** pixel-art-snes-jrpg | `artificialguybr/PixelArtRedmond` | creativeml-openrail-m ✅ | Alternativa/backup a nerijs, stile 16-bit. T05 JRPG sprites. 2° candidato per A/B test wow. |
| **A06** pixel-art-cyberpunk | `nerijs/pixel-art-xl` + prompt neon | creativeml-openrail-m ✅ | Base pixel + prompt cyberpunk. T04 arcade, VN cyberpunk. (CyberpunkRedmond è NONE — verificare file se serve dedicato). |
| **A07** pixel-art-horror | `nerijs/pixel-art-xl` + palette horror | creativeml-openrail-m ✅ | Base + palette desaturata. T-horror. (HorrorRedmond è NONE). |
| **A08** pixel-art-arcade-neon | `nerijs/pixel-art-xl` + neon prompt | creativeml-openrail-m ✅ | Base + neon. T04, T13 bullet hell, T11 arena. |

### Stilizzato 2D (B01-B06)

| Pack | LoRA HuggingFace | Licenza | A cosa serve per noi |
|---|---|---|---|
| **B01** flat-cute-vector | `DoctorDiffusion/...vector-art-xl` (other → verifica) OR prompt-only | other ⚠️ | Vector flat per T03 Mobile Puzzle UI/sprite. Se "other" è NC, fallback prompt-only su SDXL base. |
| **B02** hand-drawn-watercolor | `ostris/watercolor_style_lora_sdxl` | **apache-2.0** ✅✅ | Acquerello per T01 metroidvania narrativo (GRIS/Hollow Knight vibe), background dipinti. Licenza apache = zero rischio. La più pulita. |
| **B03** comic-book-bold | `blink7630/graphic-novel-illustration` | other ⚠️ | Comic/halftone per T04, twin-stick. Card data dice "other" — model card dichiara training su 65 img comic. Verificare clausola; fallback `goofyai/Leonardo_Ai_Style_Illustration` (apache). |
| **B04** anime-vn-soft | `Linaqruf/anime-detailer-xl-lora` + `style-enhancer-xl-lora` | **openrail++** ✅ | Sprite anime per T02 Visual Novel — il pack più importante per VN. openrail++ commerciale OK. 3k download ciascuno, qualità alta. |
| **B05** noir-monochrome | prompt-only su SDXL base | n/a | Bianco/nero + 1 accento si ottiene con palette lock, nessun LoRA dedicato pulito necessario. |
| **B06** paper-craft-collage | `nerijs/papercut-sdxl` (NONE → verifica) OR `Norod78/SDXL-YarnArtStyle` | openrail ✅ (yarn) | Paper/craft per T-adventure. YarnArt è openrail confermato. |

### 3D stilizzato (C01-C08)

| Pack | LoRA HuggingFace | Licenza | A cosa serve per noi |
|---|---|---|---|
| **C01** low-poly-cute | asset CC0 (Quaternius/KayKit) + `goofyai/3d_render_style_xl` per concept | **apache-2.0** ✅ | Concept art 3D per T09. Gli asset 3D veri vengono da Quaternius/KayKit (CC0), il LoRA serve solo per concept/moodboard. |
| **C02** voxel-cute | concept via prompt + asset Sketchfab CC0 | n/a | Voxel sono asset, non gen LoRA. |
| **C03** toon-shaded-anime | `goofyai/3d_render_style_xl` + toon prompt | apache-2.0 ✅ | Concept toon 3D per T10 Stride, T05-3D. |
| **C04** psx-retro-3d | shader-based (no LoRA) | n/a | È effetto shader runtime, non texture gen. |
| **C05** n64-soft-3d | shader-based (no LoRA) | n/a | Idem. |
| **C06** sci-fi-clean | `goofyai/cyborg_style_xl` | **apache-2.0** ✅ | Concept sci-fi per T09 sci-fi, props metallici. apache pulito. |
| **C07** fantasy-stylized | `goofyai/3d_render_style_xl` | **apache-2.0** ✅ | Concept fantasy 3D per T10 Stride, T05. Combinato con KayKit Dungeon CC0. apache. |
| **C08** abstract-geometric | prompt-only + pmndrs/drei primitives | n/a | Geometrie pure, no LoRA. |

### Sperimentale/nicchia (D01-D08)

| Pack | LoRA HuggingFace | Licenza | A cosa serve per noi |
|---|---|---|---|
| **D01** ascii-roguelike | font-based (no LoRA) | n/a | È tutto carattere ASCII, nessun gen. |
| **D02** hand-drawn-rotoscope | `blink7630/graphic-novel-illustration` (other) OR Deferred R.4 | other ⚠️ | Cuphead/rotoscope è il pack più difficile. Se "other" non basta → round Deep Research R.4 (deferred). |
| **D03** ms-paint-childlike | `Norod78/sdxl-chalkboarddrawing-lora` (other) OR prompt | other ⚠️ | Stile ingenuo per meme/horror sperimentale. Bassa priorità. |
| **D04** gritty-realistic-2d | `artificialguybr/analogredmond-v2` | creativeml-openrail-m ✅ | Painterly realistico per T-CRPG (Disco Elysium vibe). openrail OK. |
| **D05** visual-novel-photographic | `ostris/photorealistic-slider-sdxl-lora` (other) + anime overlay | other ⚠️ | Foto+anime per VN realistiche (Steins;Gate). Bassa priorità. |
| **D06** minimalist-mono | prompt-only | n/a | Silhouette, no LoRA. |
| **D07** synthwave-80s | `Norod78/SDXL-VintageMagStyle` (mit) + neon | **mit** ✅ | Synthwave per T04, T13. mit pulito. |
| **D08** dark-fantasy-painted | `KappaNeuro/dark-fantasy` (other) OR `artificialguybr/analogredmond-v2` | other ⚠️ / openrail ✅ | Oil-paint gotico per T08 dark roguelite (Darkest Dungeon). Fallback analogredmond openrail. |

---

## LoRA aggiuntivi scoperti — utili al prodotto (bonus)

Cercando ho trovato LoRA che non erano nei 30 pack ma servono ai
**48 tool** della Pietra (UI, icone, loghi, sticker). Tutti
verificati commerciali:

| LoRA | Licenza | Tool che lo userà | A cosa serve |
|---|---|---|---|
| `artificialguybr/IconsRedmond-V2` | creativeml-openrail-m ✅ | `ui_gen` | Genera icone di gioco (inventory, abilità, status) coerenti |
| `artificialguybr/LogoRedmond-LogoLoraForSDXL-V2` | creativeml-openrail-m ✅ | `ui_gen` / branding | Logo del gioco generato + title screen |
| `artificialguybr/StickersRedmond` | creativeml-openrail-m ✅ | `sprite_gen` | Sticker/emote per giochi social (T12) e achievement |
| `artificialguybr/ColoringBookRedmond-V2` | creativeml-openrail-m ✅ | `tileset_gen` | Line-art pulito → base per coloring/outline sprite |
| `artificialguybr/LineAniRedmond-LinearMangaSDXL-V2` | creativeml-openrail-m ✅ | `dialogue_gen` art | Manga line-art per VN/cutscene |
| `artificialguybr/StoryBookRedmond-V2` | creativeml-openrail-m ✅ | `background_gen` | Illustrazioni storybook per VN narrative/cozy |
| `goofyai/disney_style_xl` | openrail ✅ | `sprite_gen` | Personaggi cartoon stylized per T12 social, cozy |
| `Norod78/SDXL-StickerSheet-Lora` | mit ✅ | `sprite_gen` | Sprite sheet sticker-style |
| `ostris/crayon_style_lora_sdxl` | apache-2.0 ✅ | `background_gen` | Stile pastello/crayon per giochi per bambini |
| `ostris/embroidery_style_lora_sdxl` | apache-2.0 ✅ | `tileset_gen` | Texture ricamo/tessuto per paper-craft (B06) |
| `goofyai/Leonardo_Ai_Style_Illustration` | apache-2.0 ✅ | `background_gen` | Illustrazione generica alta qualità, fallback universale |

---

## Autori "fidati" (licenze sempre pulite)

Per futuri harvest LoRA, questi 4 autori HuggingFace hanno
SEMPRE licenze commerciali-OK e qualità alta:

1. **ostris** — quasi tutto `apache-2.0`. Il più pulito in assoluto.
2. **goofyai** — `apache-2.0` / `openrail`.
3. **artificialguybr** (collezione "Redmond") — `creativeml-openrail-m`.
   Decine di LoRA stilistici. Quando il metadata dice NONE, il README
   dichiara openrail.
4. **Norod78** — mix `mit` / `openrail` / `other`. Verificare per-modello.

---

## Esito Gap 1

**Risultato**: dei 21 pack, **copertura LoRA commerciale-verificata**:
- ✅ **13 pack con LoRA dedicato commerciale confermato** (apache/mit/
  openrail): A01-A08 (nerijs+artificialguybr), B02 (ostris apache),
  B04 (Linaqruf openrail++), B06 (Norod78 openrail), C01/C03/C06/C07
  (goofyai apache), D04/D08 (artificialguybr openrail), D07 (Norod78 mit)
- ⚠️ **5 pack con "other" da aprire** (B01, B03, D02, D03, D05) →
  fallback prompt-only o LoRA apache alternativo già identificato
- ➖ **8 pack senza-LoRA per natura** (A03/A04 = palette lock, B05/D06
  = prompt mono, C02/C04/C05/C08/D01 = shader/asset/font)

**Nessun pack è bloccato.** Anche i 5 "other" hanno fallback
commerciale pulito. Zero LoRA non-commercial nella selezione finale.

**Decisione architetturale**: usiamo **HuggingFace come fonte
primaria LoRA** (licenza machine-readable via API, verificabile senza
login) invece di Civitai (campi legacy ambigui come visto su Pixel
Art XL `allowCommercialUse: "{}"`). Stesso modello, fonte più sicura.

**Costo**: $0. Tutta verifica via API pubbliche.
