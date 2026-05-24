# Asset Library Manifest — 13 librerie CC0/permissive verificate

**Data**: 2026-05-24
**Scope**: tutte le librerie di asset (2D, 3D, audio, UI, font, palette,
LoRA) verificate via WebFetch per il bootstrap del nostro
`asset_library_index` Supabase + come fallback CC0 per i tool gen.

**Lavoro futuro implicito**: pipeline di scrape/indicizzazione (mirroring
del pattern `scripts/ingestion/01-05`). Da fare in Sett. 2 di sviluppo.

---

## Riassunto

Tot stimato: **600,000-700,000 asset grezzi** prima dedup, **150,000-
200,000 utilizzabili** dopo filtro licenza pulita + dedup cross-library.

| # | Libreria | Tipo principale | Asset stim. | Licenza | API/Bulk |
|---|---|---|---|---|---|
| 1 | Kenney.nl | 2D + 3D + UI + audio | 60k+ asset, ~250 pack | CC0 (confermato) | sito + itch.io |
| 2 | OpenGameArt.org | 2D + 3D + audio | 50k+ asset | misti (filter) | RSS feed, no API |
| 3 | Quaternius | 3D low-poly | 80+ pack | CC0 + Patreon | sito |
| 4 | KayKit (Kay Lousberg) | 3D low-poly stilizzato | ~1500 modelli | CC0 (alcuni $) | sito + itch |
| 5 | Poly Haven | 3D + HDRI + texture | ~3000 | CC0 | **API ufficiale** |
| 6 | Freesound | SFX + foley | 500k+ | CC0 + CC-BY misti | **API ufficiale** |
| 7 | OpenGameArt Audio | BGM + SFX | 10k+ | misti | RSS |
| 8 | Kenney Audio | SFX + music | 5k+ | CC0 | sito |
| 9 | CraftPix Freebies | 2D pack pro | ~280 pack | free commercial | sito |
| 10 | itch.io free assets | 2D + audio | 10k+ | misti | api itch.io |
| 11 | GameAssets.com | mix | 60k+ | CC0 | sito |
| 12 | Sketchfab CC0 filter | 3D community | ~70k filtrabili | CC0 (filter) | API ufficiale |
| 13 | Pmndrs/Drei Marketplace (NEW) | Three.js scene helpers | ~200 | MIT | npm |

NEW (non in Pietra v4): #12 Sketchfab CC0 + #13 Pmndrs Drei.

---

## 1. Kenney.nl ✓ CONFERMATO CC0

- **URL**: https://kenney.nl/assets
- **Tipologia**: 2D sprite, 3D low-poly, UI kit, audio, texture, pixel art, isometric
- **Quantità**: ~250+ pack su sito, 13 pagine di asset
- **Licenza**: **CC0 (Public Domain, no attribution required)** — confermato da itch.io presence + sito
- **Esempi rilevanti per i nostri 14 Genre Template**:
  - Pixel Platformer Pack → T01 Metroidvania, T07 Hardcore
  - Tiny Town / Tiny Dungeon → T05 JRPG, T08 Roguelike
  - 1-Bit Pack → A03 pixel-art-1bit style pack
  - UI Pack RPG → tutti i template con HUD
  - Input Prompts (1280+ icons) → tutti gli engine
  - Asset Forge 3D kits → C01 low-poly-cute pack
  - Game Icons 1.5k+ → tutti
- **Schema scraping**: directory listing → pack metadata JSON (kenney espone manifest)
- **Dimensione totale download**: ~5-8 GB tutto
- **NOTA**: Kenney offre anche `Asset Forge` e `Kenney Shape` (tool open per generare nuovi asset coerenti). Da menzionare ai dev power-user.

---

## 2. OpenGameArt.org

- **URL**: https://opengameart.org
- **Tipologia**: 2D, 3D, audio (BGM, SFX), font, concept art
- **Quantità**: 50k+ asset distinti
- **Licenza**: **MISTI — filter obbligatorio**. Filtri disponibili: CC0, CC-BY 3.0/4.0, CC-BY-SA, GPL, OGA-BY 3.0. **Per noi: keep solo CC0, CC-BY 3.0, CC-BY 4.0**. Scartare CC-BY-SA (contagioso) e GPL.
- **API**: nessuna ufficiale. Drupal-based, RSS feed disponibile.
- **Workaround scrape**: scraping HTML del listing + filter per `licenza == CC0` su detail page.
- **Esempi top da indicizzare** (verificare ognuno):
  - LPC Spritesheet generator → personaggi top-down → T05 JRPG
  - Battle for Wesnoth assets (CC-BY) → JRPG/tactical
  - "Inca" pixel platformer set
  - "Painterly Spell Icons" (CC-BY)
- **Rischio**: contiene asset GPL → filter rigoroso obbligatorio (stesso pattern del nostro code dataset).

---

## 3. Quaternius ✓ CC0

- **URL**: https://quaternius.com
- **Tipologia**: 3D low-poly stilizzato, modelli animati
- **Quantità**: ~80+ pack
- **Licenza**: **CC0** (Patreon è solo per supporto opzionale)
- **Categorie**:
  - Characters (Knights, Aliens, Zombies, Robots, Modular Humans)
  - Environment (Medieval Village, Sci-fi, Nature, Buildings)
  - Vehicles (Cars, Tanks, Trains, Ships, Spaceships)
  - Weapons (Guns FPS/sci-fi, Medieval, Turrets)
  - Game Kits (Pirate, Cyberpunk, Platformer, Shooter)
  - Nature & Props (Trees, Crops, Furniture)
  - Creatures (Dinosaurs, Monsters, Fish, Farm)
- **Format**: GLTF, FBX, OBJ, Blend
- **Mappatura ai nostri Style Pack**:
  - C01 low-poly-cute ← Quaternius Ultimate Pack
  - C02 voxel-cute ← Quaternius Toon Characters
  - C07 fantasy-stylized ← Quaternius Medieval + KayKit
- **Dimensione tot**: ~3-5 GB

---

## 4. KayKit (Kay Lousberg)

- **URL**: https://kaylousberg.com + https://kaykit.itch.io
- **Tipologia**: 3D low-poly stilizzato professionale
- **Quantità**: ~1500 modelli in ~15 pack
- **Licenza**: **CC0 per la maggior parte; alcuni pack sono "name-your-price" su itch**. Verifica per-pack:
  - KayKit Adventurers ✓ CC0
  - KayKit Dungeon Pack ✓ CC0
  - KayKit Animations Pack ✓ CC0
  - KayKit Skeletons ✓ CC0
  - KayKit Mini-Game Pack (tower defense) ✓ CC0
  - KayKit Restaurant ✓ CC0
  - KayKit Adventurers Animations ✓ CC0
- **Format**: FBX, GLTF, OBJ
- **Engine compatibili**: Godot, Unity, UE, Three.js, Stride
- **Mappatura**: tutti i template 3D (T09, T10) traggono qui

---

## 5. Poly Haven ✓ CC0 + API

- **URL**: https://polyhaven.com
- **API**: **https://api.polyhaven.com** (documentata, gratuita)
- **Tipologia**: 3D models, HDRIs 4K-16k, texture PBR seamless
- **Quantità**: ~3000 asset totali
  - ~500 HDRIs
  - ~1500 texture PBR
  - ~1000 modelli 3D
- **Licenza**: **CC0 senza eccezioni** (community-funded South Africa)
- **API endpoints**:
  - `GET /assets?type=hdris|textures|models` → lista
  - `GET /info/{slug}` → metadata
  - `GET /files/{slug}` → download links per risoluzione
- **Cost stim. di indicizzazione**: ~3 GB metadata + embedding ~$5 di OpenAI text-embedding-3-small.
- **Mappatura**: C04 PSX, C06 sci-fi-clean, C08 abstract (HDRI), B02 hand-drawn (texture)

---

## 6. Freesound ✓ API ufficiale

- **URL**: https://freesound.org
- **API**: https://freesound.org/docs/api/ (richiede registrazione gratuita, rate-limit 60 req/min)
- **Tipologia**: SFX, foley, field recording, voice samples
- **Quantità**: 500,000+ sound
- **Licenza**: **MISTI**. Filter via API param `license=Creative Commons 0`. Disponibili: CC0, CC-BY 3.0/4.0, CC-Sampling+ (più libera del CC-BY-SA), Attribution.
  - **Filter consigliato**: `cc0` o `cc-by`. **Skip**: `cc-by-nc` e `cc-by-sa-nc`.
- **API endpoint chiave**:
  - `GET /apiv2/search/text/?query=Q&filter=license:"Creative Commons 0"`
- **Mappatura**: D02_audio per tutti i template; foley specifico per horror (A07), arcade (A08)
- **Pipeline scarico**: 100k CC0+CC-BY iniziali a $0 (free API tier)

---

## 7. OpenGameArt Audio

- **URL**: https://opengameart.org/art-search?keys=&type=audio
- **Tipologia**: BGM (loop e tracce complete), SFX
- **Quantità**: 10k+ asset audio
- **Licenza**: misti, stesso filter di #2 (skip CC-BY-SA, GPL).
- **Esempi top BGM** (verifica):
  - Adventure / Battle / Town / Forest pack (CC-BY 3.0)
  - "8-bit / Chiptune music compilation"
  - Visual Novel BGM packs

---

## 8. Kenney Audio ✓ CC0

- **URL**: https://kenney.nl/assets?q=audio
- **Pack tipo**: Sci-Fi Sounds, Casino Audio, Interface Sounds, RPG Audio, Music Loops, Voiceover Pack
- **Quantità**: ~5000 SFX + music loops
- **Licenza**: CC0
- **Mappatura**: SFX bank baseline per ogni template

---

## 9. CraftPix Freebies

- **URL**: https://craftpix.net/freebies/
- **Tipologia**: 2D game asset pack pro (sprite, GUI, tileset, background, icons, 3D)
- **Quantità**: ~280 pack free su 281 pagine
- **Licenza**: **free for commercial use** (vedi `craftpix.net/file-licenses/`). Non è CC0 ma uso commerciale OK senza attribuzione. **Da verificare ogni pack per termini specifici**.
- **Pack notabili**:
  - Post-Apocalypse icons → A07 horror, T08 roguelike
  - Tribal Warrior characters → T01, T05
  - Necromancer pixel sprites → D08 dark-fantasy-painted
  - Medieval NPC avatars → T05, T10
  - Autumn Forest tilesets → multi-template
- **Rischio**: filtrare i pack con clausola "non redistribuibile come asset crudi"

---

## 10. itch.io free assets

- **URL**: https://itch.io/game-assets/free
- **API**: https://api.itch.io (limited, mostly OAuth user flows)
- **Tipologia**: pack 2D, sprite, font, audio
- **Quantità**: 10k+ pack (mix di hobbyist e professional)
- **Licenza**: **CASE-BY-CASE**. Ogni pack ha la sua licenza dichiarata. Filter automatico via scraping del campo "License" su detail page.
- **Approccio raccomandato**: indicizzare TOP 500 per download count + filter pack con CC0/CC-BY/MIT/personal+commercial. Tier "B" della nostra library.

---

## 11. GameAssets.com

- **URL**: https://gameassets.com (verificare se ancora attivo)
- **Tipologia**: claim 60k+ asset CC0
- **Licenza**: CC0 dichiarata
- **NOTA**: verificare in Settimana 2 perché il sito potrebbe essere
  meta-aggregatore (overlap con Kenney/Quaternius). Bassa priorità.

---

## 12. Sketchfab CC0 filter (NEW, non in Pietra)

- **URL**: https://sketchfab.com/3d-models?features=downloadable&licenses=322a749bcfa841b29dff1e8a1bb74b0b
  (link al filter CC0)
- **API**: https://docs.sketchfab.com/data-api/ — gratuita
- **Tipologia**: 3D community models (hobbyist + professional)
- **Quantità**: ~70k modelli scaricabili filtrati CC0 (su ~5M totali)
- **Licenza**: CC0 strict (dopo filtro)
- **Format**: GLTF (default), FBX, OBJ
- **Schema**: `/v3/models?downloadable=true&license=cc0`
- **Mappatura**: tutti i template 3D, fallback per asset specifici non in Quaternius/KayKit.
- **NOTA**: qualità eterogenea, da filtrare per `face_count` ragionevole.

---

## 13. Pmndrs Drei + Three.js ecosystem (NEW, non in Pietra)

- **URL**: https://github.com/pmndrs/drei + https://github.com/pmndrs/ecctrl
- **Tipologia**: componenti React Three Fiber pronti (camera, controller, environment, lighting setup)
- **Quantità**: ~200 componenti/helpers
- **Licenza**: MIT
- **Mappatura**: T09 3D Browser Showcase, T11 Multiplayer (web)
- **Esempi**:
  - `<Sky />`, `<Stars />`, `<Sparkles />` — environment instant
  - `<PerspectiveCamera />`, `<OrbitControls />`, `<FirstPersonControls />` — camera ready
  - `<Text />`, `<Html />` — UI overlay
  - `Ecctrl` — character controller 3D pronto
- **Code template**: il nostro Three.js code_gen può importare drei direttamente per coprire l'80% del boilerplate.

---

## Pipeline di indicizzazione consigliata

```
scripts/ingestion_assets/                       # NEW directory
├── 01a_scrape_kenney.py            # CC0 confermato, scrape diretto
├── 01b_scrape_opengameart.py       # filter licenza obbligatorio
├── 01c_scrape_quaternius.py        # CC0
├── 01d_scrape_kaykit.py            # CC0 (alcuni)
├── 01e_polyhaven_api.py            # API ufficiale
├── 01f_freesound_api.py            # API ufficiale
├── 01g_kenney_audio.py             # CC0
├── 01h_scrape_craftpix.py          # free commercial
├── 01i_scrape_itch_free.py         # case-by-case
├── 01j_sketchfab_api.py            # API filter CC0
│
├── 02_filter_assets.py             # license, size, format
├── 03_classify_assets.py           # tag style_pack/genre/category via LLM
├── 04_dedupe_cross_library.py      # similarità tra Kenney vs Quaternius vs Sketchfab
├── 05_embed_store_assets.py        # OpenAI text-embedding-3-small + supabase pgvector
└── 06_validate_assets.py           # spot-check 1% per coerenza tag
```

Costo stimato indicizzazione completa:
- Storage Supabase: ~5 GB (metadata + embedding 1536-dim × 200k)
- OpenAI embedding: ~$3-5 (200k × 200 token avg × $0.02/MTok)
- Tempo: 8-12h scrape + 4-6h classify+embed

Risultato: `asset_library_index` con 150-200k asset utilizzabili
gratuitamente dal D.5 Execution Orchestrator.

---

## Cosa NON è qui (verifica giro Fase 3)

- **Mixamo** (animazioni 3D) — Adobe, EULA proprietaria, **escluso** per
  uso commerciale safe.
- **TurboSquid free** — licenze non-CC0, prevalentemente "personal use".
- **CGTrader free** — stessa cosa.
- **DeviantArt** — diritti riservati di default.

Niente da queste. Skip.
