# LoRA Library Expanded — copertura completa + Selection Engine

**Data**: 2026-05-24
**Metodo**: scansione API HuggingFace di 483 modelli da 7 autori
fidati → 82 con licenza commerciale-pulita confermata + filtro
rumore (LLM/VAE/NSFW) → ~40 LoRA grafici utili.
**Costo**: $0 (solo API pubbliche).
**Estende**: `LORA_VERIFIED_MAP.md` (i 21 style pack base).

Questo documento risponde a 2 domande:
1. Quanti più stili/generi possiamo coprire con LoRA sicuri?
2. Come fa il Reasoning Engine a sapere quale LoRA chiamare?

---

## PARTE 1 — Libreria LoRA verificata (commerciale-safe)

Tutti con licenza in allowlist (apache-2.0 / mit / openrail* /
creativeml-openrail-m / cc0 / cc-by). Zero non-commercial.

### 1.1 — Base model: SDXL vs FLUX

Scoperta importante: i LoRA si dividono per modello base.
- **SDXL 1.0**: ecosistema maturo, veloce, economico. Default per
  bulk sprite generation.
- **FLUX.1-dev**: più recente, qualità superiore, più caro/lento.
  Per hero assets / concept art di alto livello.

Teniamo entrambi. Il `sprite_gen` usa SDXL per volume, `background_gen`
hero usa FLUX dove serve qualità.

### 1.2 — Catalogo grafico (40 LoRA)

#### Gruppo PIXEL / 2D game sprites

| LoRA | Licenza | Base | Uso prodotto |
|---|---|---|---|
| `nerijs/pixel-art-xl` | openrail-m | SDXL | **Workhorse sprite pixel**. A01-A08. 8.5k dl. |
| `nerijs/pixel-art-3.5L` | apache-2.0 | SD3.5 | Pixel art next-gen, qualità superiore |
| `artificialguybr/PixelArtRedmond` | openrail-m | SDXL | Backup pixel A05 JRPG (A/B test) |
| `artificialguybr/PIXELART-REDMOND-FLUXKLEIN9B` | apache-2.0 | FLUX | Pixel art FLUX, hero sprites |
| `nerijs/coralchar-diffusion` | openrail-m | SDXL | **Character sprite** generation (NPC/eroi) |

#### Gruppo PAINTERLY / 2D illustration

| LoRA | Licenza | Base | Uso prodotto |
|---|---|---|---|
| `ostris/watercolor_style_lora_sdxl` | **apache-2.0** | SDXL | B02 watercolor. Background dipinti (GRIS) |
| `nerijs/dark-fantasy-illustration-flux` | **mit** | FLUX | **D08 dark-fantasy** (Darkest Dungeon). Pulito |
| `nerijs/dark-fantasy-movie-flux` | mit | FLUX | Variante cinematica dark fantasy |
| `nerijs/pastelcomic-flux` | mit | FLUX | B03 comic soft / cozy narrative |
| `ostris/crayon_style_lora_sdxl` | apache-2.0 | SDXL | Giochi per bambini, stile pastello |
| `artificialguybr/analogredmond-v2` | openrail-m | SDXL | D04 gritty-realistic (Disco Elysium) |
| `goofyai/Leonardo_Ai_Style_Illustration` | apache-2.0 | SDXL | Illustrazione generica HQ (fallback) |
| `nerijs/animation2k-flux` | mit | FLUX | Animazione 2D fluida stile film |

#### Gruppo ANIME / manga

| LoRA | Licenza | Base | Uso prodotto |
|---|---|---|---|
| `Linaqruf/anime-detailer-xl-lora` | openrail++ | SDXL | **B04 anime VN** (T02). 3k dl |
| `Linaqruf/style-enhancer-xl-lora` | openrail++ | SDXL | Enhancer anime, combinato con detailer |
| `artificialguybr/LineAniRedmond-LinearMangaSDXL-V2` | openrail-m | SDXL | Manga line-art per cutscene VN |

#### Gruppo 3D render / concept

| LoRA | Licenza | Base | Uso prodotto |
|---|---|---|---|
| `goofyai/3d_render_style_xl` | **apache-2.0** | SDXL | C01/C03/C07 concept 3D. Pulito |
| `goofyai/3D_Render_for_Flux` | apache-2.0 | FLUX | Concept 3D FLUX, qualità superiore |
| `goofyai/cyborg_style_xl` | **apache-2.0** | SDXL | C06 sci-fi, robot/mech |
| `jbilcke-hf/sdxl-zelda64` | openrail-m | SDXL | C05 n64-soft (Zelda 64 vibe) |
| `nerijs/lego-minifig-xl` | apache-2.0 | SDXL | C02 voxel/toy, personaggi LEGO-like |
| `nerijs/lego-brickheadz-xl` | apache-2.0 | SDXL | Voxel/toy props |
| `artificialguybr/ToyRedmond-ToyLoraForSDXL10` | openrail-m | SDXL | T12 cozy, render giocattolo |
| `artificialguybr/ClayAnimationRedmond` | openrail-m | SDXL | Claymation stop-motion style |

#### Gruppo RETRO / synthwave / vintage

| LoRA | Licenza | Base | Uso prodotto |
|---|---|---|---|
| `Norod78/SDXL-VintageMagStyle-Lora` | **mit** | SDXL | D07 synthwave / retro mag |
| `Norod78/SDXL-LofiGirl-Lora` | mit | SDXL | Lofi cozy aesthetic (T12, VN chill) |
| `artificialguybr/CINEMATIC-FILMSTILL-REDMOND-FLUXKLEIN9B` | apache-2.0 | FLUX | Cutscene cinematiche film-still |
| `artificialguybr/FILMGRAIN-REDMOND-FLUXKLEIN9B` | apache-2.0 | FLUX | Post-fx film grain per horror/noir |
| `artificialguybr/CinematicRedmond-SDXL` | openrail | SDXL | Concept cinematici |

#### Gruppo ENVIRONMENT / world

| LoRA | Licenza | Base | Uso prodotto |
|---|---|---|---|
| `artificialguybr/360Redmond` | bigscience-openrail-m | SDXL | **Skybox/panorami 360°** per 3D (T09/T10) |
| `artificialguybr/360VIEW-REDMOND-FLUXKLEIN9B` | apache-2.0 | FLUX | Skybox FLUX HQ |
| `artificialguybr/NebulRedmond` | openrail | SDXL | Sfondi spaziali/nebulose (sci-fi) |
| `artificialguybr/ISOMETRIC-REDMOND-FLUXKLEIN9B` | apache-2.0 | FLUX | **Tileset isometrici** (JRPG/strategy) |

#### Gruppo PAPER / craft / texture

| LoRA | Licenza | Base | Uso prodotto |
|---|---|---|---|
| `Norod78/sdxl-PaperCutouts-Dreambooth` | mit | SDXL | B06 paper-craft (Paper Mario) |
| `Norod78/SDXL-YarnArtStyle-LoRA` | openrail | SDXL | B06 yarn/tessuto (Yoshi's Wool) |
| `ostris/embroidery_style_lora_sdxl` | apache-2.0 | SDXL | Texture ricamo |

#### Gruppo FUNCTIONAL (UI / icone / logo / sticker — i 48 tool)

| LoRA | Licenza | Base | Tool / uso |
|---|---|---|---|
| `artificialguybr/IconsRedmond-IconsLoraForSDXL-V2` | openrail-m | SDXL | `ui_gen`: icone gioco (inventory/abilità) |
| `artificialguybr/LogoRedmond-LogoLoraForSDXL-V2` | openrail-m | SDXL | branding: logo + title screen |
| `artificialguybr/Logo-Redmond-FLUXKLEIN9B` | apache-2.0 | FLUX | Logo FLUX HQ |
| `artificialguybr/StickersRedmond` | openrail-m | SDXL | `sprite_gen`: sticker/emote (T12 social) |
| `Norod78/SDXL-StickerSheet-Lora` | mit | SDXL | Sprite-sheet sticker style |
| `artificialguybr/ColoringBookRedmond-V2` | openrail-m | SDXL | `tileset_gen`: line-art base (11.5k dl!) |
| `artificialguybr/StoryBookRedmond-V2` | openrail-m | SDXL | `background_gen`: illustrazioni VN |
| `artificialguybr/TshirtDesignRedmond-V2` | openrail-m | SDXL | merch/achievement flat graphics |
| `artificialguybr/UiUxAppModelForSd2.0` | openrail | SD2 | mockup UI/UX HUD |

### 1.3 — Copertura totale

| Categoria stile | LoRA disponibili | Pack coperti |
|---|---:|---|
| Pixel/2D sprite | 5 | A01-A08 |
| Painterly/illustration | 8 | B02, B03, D04, D08 |
| Anime/manga | 3 | B04, D05 |
| 3D render/concept | 8 | C01-C07 |
| Retro/synthwave/cinema | 5 | D07, A06, horror fx |
| Environment/world | 4 | skybox, isometric |
| Paper/craft/texture | 3 | B06 |
| Functional (UI/logo/icon) | 9 | i 48 tool |
| **Totale verificato** | **~40 commerciale-safe** | tutti i 21 pack + extra |

**Risposta alla domanda "ci servono altri pack?"**: i 30 style pack
erano sufficienti per gli STILI. Questi 40 LoRA li **implementano** +
coprono asset funzionali (icone, logo, skybox, isometric, sticker)
che i 48 tool della Pietra richiedono. Ora la copertura è completa.

---

## PARTE 2 — LoRA Selection Engine (come il Reasoning sceglie)

Il punto cruciale: come fa il D.5 Execution Orchestrator a sapere
QUALE LoRA caricare quando genera un asset?

### 2.1 — Schema dati: ogni LoRA è un record

Nuova tabella Supabase `lora_library` (migration futura):

```sql
CREATE TABLE lora_library (
  id uuid primary key default gen_random_uuid(),
  hf_repo text not null unique,           -- "nerijs/pixel-art-xl"
  display_name text not null,
  license text not null,                  -- verificata, in allowlist
  base_model text not null,               -- "SDXL-1.0" | "FLUX.1-dev" | "SD3.5"
  trigger_words text[],                   -- prompt tokens richiesti
  recommended_weight numeric default 0.8, -- forza LoRA 0-1
  -- mapping semantico
  style_pack_ids text[],                  -- ["A01","A02",...] pack compatibili
  asset_types text[],                     -- ["sprite","background","icon","logo"]
  genre_affinity text[],                  -- ["metroidvania","jrpg",...]
  tool_affinity text[],                   -- ["sprite_gen","ui_gen",...]
  -- ricerca
  semantic_description text,              -- per embedding match
  embedding vector(1536),                 -- text-embedding-3-small
  -- quality
  downloads int,
  quality_score numeric,                  -- nostra valutazione post-test
  success_score numeric default 0,        -- episodic (quante volte usato bene)
  negative_prompt text,                   -- anti-slop guardrail per questo LoRA
  created_at timestamptz default now()
);
```

### 2.2 — L'algoritmo di selezione (in D.5)

Quando il D.5 deve generare un asset, sceglie il LoRA in 4 passi:

```python
def select_lora(asset_request: AssetRequest, plan: GamePlan) -> LoraChoice:
    style_pack = plan.aesthetics.style_pack_ref   # es. "A01"
    asset_type = asset_request.type               # es. "sprite"
    genre = plan.meta.genre                        # es. "metroidvania"

    # === Passo 1 — Filtro hard ===
    # Solo LoRA compatibili con lo style pack + asset type + licenza ok
    candidates = db.query(lora_library,
        style_pack_ids__contains=style_pack,
        asset_types__contains=asset_type,
        license__in=ALLOWLIST,
    )

    # === Passo 2 — Se zero match sul pack, fallback per asset_type ===
    if not candidates:
        candidates = db.query(lora_library, asset_types__contains=asset_type)
        # es. nessun LoRA pixel per "logo" → usa LogoRedmond generico

    # === Passo 3 — Rerank ===
    ranked = rerank(candidates, weights={
        'genre_affinity_match': 0.35,   # genere del Game Plan
        'quality_score': 0.25,          # nostra valutazione
        'success_score': 0.25,          # episodic memory (Voyager-style)
        'downloads': 0.15,              # popolarità HF come proxy qualità
    })

    # === Passo 4 — Scegli base model in base al tier ===
    best = ranked[0]
    if plan.meta.tier == 'free':
        # preferisci SDXL (economico/veloce) se disponibile
        best = prefer_base(ranked, 'SDXL-1.0') or best
    elif plan.meta.tier in ('pro','studio'):
        # hero assets: preferisci FLUX se disponibile
        best = prefer_base(ranked, 'FLUX.1-dev') or best

    return LoraChoice(
        repo=best.hf_repo,
        weight=best.recommended_weight,
        trigger_words=best.trigger_words,
        negative_prompt=best.negative_prompt,
        base_model=best.base_model,
    )
```

### 2.3 — Come il LoRA entra nel prompt SDXL/FLUX

Il `sprite_gen` poi compone così:

```python
def generate_sprite(request, plan):
    lora = select_lora(request, plan)
    style_pack = STYLE_PACK_LIBRARY[plan.aesthetics.style_pack_ref]

    prompt = build_prompt(
        subject=request.description,          # "knight idle animation"
        trigger=lora.trigger_words,           # "pixel art" (richiesto dal LoRA)
        style_modifiers=style_pack.prompt_modifiers,
        palette_hint=style_pack.palette,
    )
    return image_gen_api(
        base_model=lora.base_model,
        lora=lora.repo,
        lora_weight=lora.weight,
        prompt=prompt,
        negative_prompt=lora.negative_prompt,  # anti-slop
        controlnet=style_pack.controlnet_refs,  # coerenza compositiva
    )
```

### 2.4 — Combinare 2 LoRA (stacking)

Alcuni casi richiedono 2 LoRA insieme (es. B04 anime = detailer +
enhancer). Il selection engine supporta stacking:

```python
# B04 anime-vn-soft
loras = [
    ("Linaqruf/anime-detailer-xl-lora", 0.7),
    ("Linaqruf/style-enhancer-xl-lora", 0.4),  # peso minore = sottile
]
```

Regola: max 2 LoRA stack (oltre degrada). Pesi sommati ≤ 1.2.

### 2.5 — Episodic learning (il sistema migliora)

Pattern Voyager (blueprint v2 parte O.4): quando un asset generato
con un LoRA passa l'Aesthetic Coherence Validator (D.3) e il
Playtester (D.6), il `success_score` di quel LoRA per quel
(genre, style_pack) sale. Alla generazione successiva simile, quel
LoRA è preferito. Il sistema impara quali LoRA funzionano per cosa.

```sql
UPDATE lora_library
SET success_score = success_score * 0.95 + 1.0 * 0.05
WHERE hf_repo = $1;  -- solo se D.3 + D.6 passano
```

---

## PARTE 3 — Pipeline di ingestion LoRA

Per popolare `lora_library` (durante Categoria 2 ingestion):

```
scripts/ingestion_assets/
└── 07_index_lora.py
    ├── lista dei ~40 LoRA verificati (questo doc)
    ├── per ognuno: fetch metadata HF (trigger words da README,
    │   base model, downloads)
    ├── classify via gpt-4o-mini: style_pack_ids, asset_types,
    │   genre_affinity, tool_affinity (da descrizione + tags)
    ├── embed semantic_description (text-embedding-3-small)
    ├── license re-check (allowlist, hard gate)
    └── insert in lora_library
```

Costo: ~$0.02 (40 LoRA × classify gpt-4o-mini). Embedding trascurabile.

**NON scarichiamo i pesi LoRA** (centinaia di MB ciascuno). Salviamo
solo `hf_repo` + metadata. Al runtime, il tool di image gen
(Replicate/locale) carica il LoRA da HuggingFace on-demand.

---

## PARTE 4 — Verifica licenze (audit finale)

Tutti i ~40 LoRA in questo doc hanno licenza in:
`{apache-2.0, mit, cc0, cc-by-4.0, creativeml-openrail-m, openrail,
openrail++, bigscience-openrail-m}`.

**0 non-commercial. 0 no-derivatives. 0 copyleft.**

I LoRA con metadata `NONE` o `other` NON sono in questo catalogo
(scartati o messi in "da-verificare" separato). Solo licenze
esplicitamente commerciali-OK.

**Nota OpenRAIL**: tutte le varianti OpenRAIL (CreativeML, BigScience,
openrail++) permettono uso commerciale. Le "use-based restrictions"
(no contenuti illegali/dannosi) sono già coperte dai nostri
guardrail di content moderation della Pietra §9. L'output generato
NON eredita la licenza del LoRA (non è copyleft).

---

## PARTE 5 — Cosa resta scoperto (onestà)

Generi/stili senza LoRA dedicato pulito (si usa prompt-only su base
model + style pack modifiers, qualità comunque buona):

- **ASCII roguelike** (D01): è font, non gen — nessun LoRA serve
- **Minimalist mono** (B05, D06): palette lock, prompt-only
- **PSX/N64 shader** (C04/C05): effetto shader runtime, non texture
- **Abstract geometric** (C08): prompt + drei primitives
- **MS-Paint childlike** (D03): nicchia, prompt-only sufficiente
- **Rotoscope Cuphead** (D02): il più difficile. Deferred R.4 — se i
  LoRA painterly + animation2k-flux non bastano, round Deep Research
  dedicato.

Nessuno di questi è bloccante: tutti hanno fallback prompt-only che
con lo style pack (palette + reference games + modifiers) dà
risultati accettabili.

---

## Esito

**Da ~21 pack stilistici → ~40 LoRA commerciali verificati** che li
implementano + coprono asset funzionali dei 48 tool.

**LoRA Selection Engine progettato**: schema `lora_library` +
algoritmo 4-passi (filtro hard → fallback → rerank → base-model
tier) + stacking + episodic learning.

Il Reasoning Engine ora sa esattamente quale LoRA chiamare per ogni
(style_pack × asset_type × genere × tier), e migliora nel tempo via
success_score.

**Costo totale ricerca**: $0. **Ingestion futura**: ~$0.02.
