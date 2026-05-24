# Style Pack References — 30 pack con palette/LoRA/font/asset

**Data**: 2026-05-24
**Scope**: per ognuno dei 30 style pack del blueprint v2 (parte J.3),
fornisco i 5 elementi operativi: palette concreta, LoRA candidato,
font, asset library affini, reference games.

**Convenzione**:
- Palette: oklch + hex
- LoRA: nome modello + URL Civitai/HuggingFace (✓ se verificato a
  mano, ⚠️ se da verificare in Sett 2 sviluppo)
- Font: Google Fonts (SIL OFL) o specifico CC0
- Asset library: pack specifici da Kenney/Quaternius/KayKit/etc.
- Reference games: 3-5 link Steam/itch ufficiali

---

# GRUPPO A — Pixel art 2D (8 pack)

## A01 — pixel-art-dark

- **Palette ufficiale**: Endesga 16 (DB16-inspired, comune in pixel
  community)
  - `#140c1c #442434 #30346d #4e4a4e #854c30 #346524 #d04648 #757161`
  - `#597dce #d27d2c #8595a1 #6daa2c #d2aa99 #6dc2ca #dad45e #deeed6`
  - Fonte palette: Lospec.com (DB32 / Endesga 32 + filtraggio 16)
- **LoRA SDXL**: ⚠️ Civitai "Pixel Art XL" (cercare 8086/Nerijs) — versione
  più scaricata, license "Free for commercial use" da verificare
- **LoRA fallback**: HuggingFace `nerijs/pixel-art-xl` ✓ verificare licenza
- **Font UI**: VT323 (Google Fonts) ✓ OFL — monospace pixel
- **Font dialog**: Press Start 2P (Google Fonts) ✓ OFL
- **Kenney pack**: Pixel Platformer Pack + 1-Bit Pack
- **Reference games (Steam URL canonici)**:
  - Hyper Light Drifter: https://store.steampowered.com/app/257850/
  - Death's Door: https://store.steampowered.com/app/894020/
  - Iconoclasts: https://store.steampowered.com/app/393520/
  - Eitr (in dev, screenshot ArtStation): https://www.artstation.com/eitr

## A02 — pixel-art-vibrant

- **Palette**: Sweetie 16 (Lospec)
  - `#1a1c2c #5d275d #b13e53 #ef7d57 #ffcd75 #a7f070 #38b764 #257179`
  - `#29366f #3b5dc9 #41a6f6 #73eff7 #f4f4f4 #94b0c2 #566c86 #333c57`
- **LoRA**: stessa "Pixel Art XL" + prompt modifier "vibrant, saturated"
- **Font UI**: Pixelify Sans (Google Fonts) ✓ OFL
- **Font dialog**: M PLUS Rounded 1c
- **Kenney pack**: Tiny Town + Tiny Farm + Roguelike Caves & Dungeons
- **Reference**:
  - Stardew Valley: https://store.steampowered.com/app/413150/
  - Eastward: https://store.steampowered.com/app/977880/
  - Chicory: https://store.steampowered.com/app/1123450/
  - A Short Hike: https://store.steampowered.com/app/1055540/

## A03 — pixel-art-1bit

- **Palette**: 2 colori
  - White/Black: `#ffffff #000000`
  - Alternative: Obra Dinn green `#f7e7c6 #1f1f1f` o GB-Light
- **LoRA**: Civitai "1-bit Pixel" ⚠️ verificare disponibilità
- **Font UI**: Silkscreen (Google Fonts) ✓ OFL
- **Kenney pack**: **1-Bit Pack** (perfetto, oltre 1500 sprite 1-bit)
- **Reference**:
  - Downwell: https://store.steampowered.com/app/360740/
  - Minit: https://store.steampowered.com/app/609490/
  - Return of the Obra Dinn: https://store.steampowered.com/app/653530/
  - World of Horror (parziale): https://store.steampowered.com/app/913480/

## A04 — pixel-art-gbc

- **Palette**: Game Boy Color (4 sub-palette)
  - Default Green: `#0f380f #306230 #8bac0f #9bbc0f`
  - Pokémon Crystal Blue: `#0f3868 #5878a8 #80c0f8 #f8f8f8`
- **LoRA**: Civitai "GBC Game Boy Color Style" ⚠️
- **Font**: Early GameBoy.ttf (CC0 da fontstruct community)
- **Asset library**: Kenney Tiny Pixels (sprite 8x8) + 16x16
- **Reference**:
  - The Legend of Zelda: Link's Awakening DX (original GBC)
  - Pokémon Crystal (original GBC)
  - **Note**: i remake di Zelda Awakening 2019 NON sono target stile

## A05 — pixel-art-snes-jrpg

- **Palette**: SNES Default 256-color subset (16-color baseline)
  - `#1e1e2c #2e3850 #4860a0 #6088c0 #88b0e0 #ffe8a0 #ffb060 #d04030`
  - `#a02020 #602020 #404040 #707070 #a0a0a0 #d0d0d0 #ffffff #ffe0d0`
- **LoRA**: Civitai "SNES JRPG Style" o "16-bit RPG" ⚠️
- **Font UI**: Manaspace (CC0 fontstruct)
- **Font dialog**: PixeloidSans (SIL OFL via Github @ggbot/pixeloid-font)
- **Kenney pack**: Roguelike RPG Pack + JRPG UI (custom da Tiny Town)
- **Reference**:
  - Chrono Trigger (no Steam, ArtStation refs)
  - Secret of Mana original
  - Final Fantasy VI Pixel Remaster: https://store.steampowered.com/app/1173820/
  - Sea of Stars (moderno ma stile): https://store.steampowered.com/app/1244090/

## A06 — pixel-art-cyberpunk

- **Palette**: cyberpunk neon
  - `#0a0e27 #1a1f3a #ff006e #fb5607 #ffbe0b #8338ec #3a86ff #00f5d4`
  - `#ffffff #2d3a5e #7209b7 #f72585`
- **LoRA**: Civitai "Cyberpunk Pixel" ⚠️ + neg prompt anti-sterile
- **Font UI**: Major Mono Display (Google Fonts) ✓ OFL — futuristico mono
- **Font dialog**: VT323
- **Asset library**: itch.io free cyberpunk tilesets (manual curation)
- **Reference**:
  - VA-11 Hall-A: https://store.steampowered.com/app/447530/
  - The Red Strings Club: https://store.steampowered.com/app/589780/
  - Coffee Talk: https://store.steampowered.com/app/914800/
  - Cloudpunk (3D ma palette riferimento): https://store.steampowered.com/app/746850/

## A07 — pixel-art-horror

- **Palette**: monocromatica scura con accenti
  - `#0a0a0a #1a0a0a #2d0a0a #4d1010 #8a0303 #d40000` (red horror)
  - `#0a0a0a #0a1a0a #0a2d0a #105510 #03b403` (green sickly)
  - + 1 accento orange (`#ff7800`) per UI critica
- **LoRA**: Civitai "Horror Pixel" o "Dark Pixel Art" ⚠️
- **Font UI**: Special Elite (Google Fonts) ✓ OFL — typewriter eerie
- **Font dialog**: Creepster (Google Fonts) ✓ OFL — solo per titoli, evitare per testo lungo
- **Asset library**: OpenGameArt "horror pixel" filter CC0 + Lone Survivor postmortem refs
- **Reference**:
  - Lone Survivor: https://store.steampowered.com/app/209830/
  - Faith: The Unholy Trinity: https://store.steampowered.com/app/1043260/
  - World of Horror: https://store.steampowered.com/app/913480/

## A08 — pixel-art-arcade-neon

- **Palette**: Hotline Miami-style
  - `#1a0000 #ff0096 #ff6900 #00fff9 #fffb00 #00ff77 #f200ff`
  - + nero/bianco contrasto: `#000000 #ffffff`
- **LoRA**: Civitai "Synthwave Arcade Pixel" ⚠️
- **Font UI**: Audiowide (Google Fonts) ✓ OFL — retrofuture
- **Font dialog**: VT323
- **Asset library**: Kenney Arcade Platformer Characters + Pixel Shmup Pack
- **Reference**:
  - Hotline Miami: https://store.steampowered.com/app/219150/
  - Nuclear Throne: https://store.steampowered.com/app/242680/
  - Furi: https://store.steampowered.com/app/423230/
  - GRIDD: Retroenhanced: https://store.steampowered.com/app/559390/

---

# GRUPPO B — Stilizzato 2D non-pixel (6 pack)

## B01 — flat-cute-vector

- **Palette**: pastello
  - `#ffd6e0 #ffefd6 #d6ffea #c2e3f5 #d9c2f5 #ffffff #2d3142 #4f5d75`
- **LoRA**: Civitai "Flat Vector Cute" o "Kawaii Vector" ⚠️
- **Font UI**: Quicksand (Google Fonts) ✓ OFL
- **Font dialog**: Nunito ✓ OFL
- **Asset library**: Kenney Tappy Plane + Roguelike modern (vector)
- **Reference**:
  - Monument Valley: https://store.steampowered.com/app/1422510/
  - Alto's Adventure: https://store.steampowered.com/app/440290/
  - Donut County: https://store.steampowered.com/app/702670/
  - Mini Metro: https://store.steampowered.com/app/287980/

## B02 — hand-drawn-watercolor

- **Palette**: watercolor saturated soft
  - `#3c2415 #6b3e2e #a86b3c #d4a574 #e8c39e #f4dbb5 #8b7355 #5a4a3a`
  - + accent emerald/teal: `#2d6e5b #5fa394`
- **LoRA**: Civitai "Watercolor Painting" ✓ (molteplici disponibili)
- **Font UI**: Caudex (Google Fonts) ✓ OFL — fantasy gentle
- **Font dialog**: Lora (Google Fonts) ✓ OFL
- **Asset library**: nessuna corrispondenza CC0 forte → AI gen primario
- **Reference**:
  - GRIS: https://store.steampowered.com/app/683320/
  - Hollow Knight: https://store.steampowered.com/app/367520/
  - Ori and the Blind Forest: https://store.steampowered.com/app/261570/
  - Spiritfarer: https://store.steampowered.com/app/972660/

## B03 — comic-book-bold

- **Palette**: forte e satura, halftones
  - `#000000 #ffffff #ff3a3a #ffd900 #2196f3 #00c853 #9c27b0`
  - + halftone dots overlay
- **LoRA**: Civitai "Comic Book Style" ⚠️
- **Font UI**: Bangers (Google Fonts) ✓ OFL — comic action
- **Font dialog**: Comic Neue (Google Fonts) ✓ OFL
- **Asset library**: Kenney UI Pack RPG (overrides palette)
- **Reference**:
  - Cuphead UI (NB: lo stile in-game è 1930s cartoon, UI è comic): https://store.steampowered.com/app/268910/
  - Comix Zone (classico): refs ArtStation
  - Borderlands cel-shading: https://store.steampowered.com/app/49520/

## B04 — anime-vn-soft

- **Palette**: soft anime
  - `#fff5f5 #ffe5e5 #ffd9d9 #ffb8b8 #d4a5d4 #b8a5d4 #5d5d8a #2d2d4a`
  - + accent rosa: `#ff8a9a`
- **LoRA**: Civitai "Anime VN Style" o "Visual Novel CG" ⚠️ + NoCrypt
  Anime Style (popular)
- **Font UI**: Zen Maru Gothic (Google Fonts) ✓ OFL — soft JP-style
- **Font dialog**: Klee One (Google Fonts) ✓ OFL — anime visual novel
- **Asset library**: nessun CC0 strong → AI gen + community Ren'Py templates
- **Reference**:
  - Doki Doki Literature Club: https://store.steampowered.com/app/698780/
  - VA-11 Hall-A: https://store.steampowered.com/app/447530/
  - Steins;Gate: https://store.steampowered.com/app/412830/
  - Tsukihime / Fate (no Steam, ref Wiki)

## B05 — noir-monochrome

- **Palette**: bianco nero + 1 accento
  - Black: `#0a0a0a #1a1a1a #4a4a4a #888888 #cfcfcf #ffffff`
  - Accent (1 solo): rosso `#c41010` o giallo `#e6b800`
- **LoRA**: Civitai "Sin City" o "Film Noir" ⚠️
- **Font UI**: Cinzel (Google Fonts) ✓ OFL — serif elegante
- **Font dialog**: Special Elite ✓ OFL — typewriter
- **Asset library**: AI gen primario
- **Reference**:
  - Genesis Noir: https://store.steampowered.com/app/1310330/
  - Mad Father (parziale): https://store.steampowered.com/app/479660/
  - Sin City graphic novel refs
  - LA Noire (palette refs)

## B06 — paper-craft-collage

- **Palette**: carta materica
  - `#f5e9d4 #e8d5b7 #d4b89a #a8896d #856b52 #5a4634 #3d2f24`
  - + accenti colorati saturati: `#e63946 #2a9d8f #f4a261 #264653`
- **LoRA**: Civitai "Paper Craft" o "Origami" ⚠️
- **Font UI**: Fredoka (Google Fonts) ✓ OFL — soft cartoon
- **Font dialog**: Patrick Hand (Google Fonts) ✓ OFL — handwritten
- **Asset library**: AI gen primario
- **Reference**:
  - Tearaway Unfolded: https://www.playstation.com/games/tearaway-unfolded/
  - Paper Mario series (ref Wiki)
  - Yoshi's Crafted World

---

# GRUPPO C — 3D stilizzato (8 pack)

## C01 — low-poly-cute

- **Palette**: pastello vibrante
  - `#a0e7e5 #b4f8c8 #fbe7c6 #ffaebc #ff968a #ffcad4 #c9c9ff #efb7ff`
- **LoRA**: N/A (3D pipeline)
- **Font UI**: Nunito ✓ OFL
- **Font dialog**: Quicksand ✓ OFL
- **Asset library PRIMARY**: **Quaternius Ultimate Pack** + **KayKit
  Adventurers** + **KayKit Mini-Game Pack**
- **Reference**:
  - A Short Hike: https://store.steampowered.com/app/1055540/
  - Untitled Goose Game: https://store.steampowered.com/app/837470/
  - Lake: https://store.steampowered.com/app/1812120/
  - Kind Words: https://store.steampowered.com/app/1070710/

## C02 — voxel-cute

- **Palette**: Minecraft-inspired ma saturated
  - blocco terra/cielo/lava: `#8b5a2b #4a9eff #ff6b35`
  - + verde fresco `#7fc242` + accenti
- **LoRA**: Civitai "Voxel MagicaVoxel" ⚠️
- **Font UI**: Bungee (Google Fonts) ✓ OFL — bold blocky
- **Asset library**: Quaternius Voxel Pack + Sketchfab voxel CC0 filter
- **Reference**:
  - Cube World: https://store.steampowered.com/app/1128000/
  - Tinker World (custom): refs YouTube
  - Hytale (in dev): https://hytale.com
  - Cubic Odyssey: https://store.steampowered.com/app/2638680/

## C03 — toon-shaded-anime

- **Palette**: anime cel-shading
  - `#fff5e1 #f4b88f #d97a3c #8b3a2b #2d4a5e #4a7c9e #b8d4e3`
- **LoRA**: Civitai "Anime Cel Shading 3D" ⚠️
- **Font UI**: M PLUS 1p ✓ OFL
- **Asset library**: KayKit Adventurers (toon shader compatible) +
  Quaternius
- **Engine note**: Stride supporta cel-shading nativamente, Three.js
  via three-toon-material
- **Reference**:
  - Genshin Impact (mobile): https://genshin.hoyoverse.com
  - Ni no Kuni Wrath of the White Witch: https://store.steampowered.com/app/798460/
  - Borderlands (cel-shading 3D): https://store.steampowered.com/app/49520/
  - Tunic (parziale): https://store.steampowered.com/app/553420/

## C04 — psx-retro-3d

- **Palette**: PS1 limited
  - 32-color limit, dithering on
  - typical: `#202028 #3c2c34 #685058 #b87858 #f0d090 #ffffff`
- **LoRA**: N/A (è effetto shader, non texture)
- **Shader effects**: vertex jitter (snap), affine texture mapping,
  fog dense, no anti-aliasing, palette dither 256-color
- **Font UI**: VCR OSD Mono (web/itch CC0 release)
- **Font dialog**: BIOS PSX Mono (refs CC0)
- **Asset library**: KayKit (low-poly compatible) + Quaternius
- **Reference**:
  - Crow Country: https://store.steampowered.com/app/1996610/
  - Signalis (parziale): https://store.steampowered.com/app/1262350/
  - Bloodborne PSX demake: https://lilithwalther.itch.io/bloodborne-psx
  - Mortuary Assistant: https://store.steampowered.com/app/1295920/

## C05 — n64-soft-3d

- **Palette**: N64 bilinear filter
  - texture morbide, warm saturated
  - `#c8a878 #a08858 #707048 #604030 #d0c0a0 #e8d8b8`
- **Shader effects**: bilinear filtering ON, soft fog, vertex
  smoothing, lighting Gouraud, color tint warm
- **Font UI**: Fredoka One (Google Fonts) ✓ OFL
- **Asset library**: Quaternius Animated Humans + KayKit Adventurers
- **Reference**:
  - Super Mario 64 (ref Nintendo)
  - Banjo-Kazooie (ref Rare)
  - Lunark (parziale): https://store.steampowered.com/app/1095830/
  - Yooka-Laylee: https://store.steampowered.com/app/360830/

## C06 — sci-fi-clean

- **Palette**: tech minimal
  - `#0a0e1a #1a2440 #2a3a5e #6080a8 #a8c4ec #ffffff` (cool blues)
  - + accent: `#ff8c00` (caldo) o `#00ffaa` (alien green)
- **LoRA**: Civitai "Sci-Fi Concept Art" ⚠️
- **Font UI**: Orbitron (Google Fonts) ✓ OFL — sci-fi mono
- **Font dialog**: Exo 2 ✓ OFL
- **Asset library**: Quaternius Sci-Fi pack + Poly Haven HDRI sci-fi
- **Reference**:
  - Tron 2.0 (ref)
  - Mirror's Edge: https://store.steampowered.com/app/17410/
  - Lightmatter: https://store.steampowered.com/app/971890/
  - The Talos Principle 2: https://store.steampowered.com/app/835960/

## C07 — fantasy-stylized

- **Palette**: fantasy saturated
  - `#3d2818 #6b4a2e #a87a4c #d4b88f #ecdab8 #2d4a3e #4a8c64`
  - + magic accent: `#b86fff` o `#fec5ff`
- **LoRA**: Civitai "Stylized Fantasy 3D" ⚠️
- **Font UI**: Cinzel ✓ OFL
- **Font dialog**: Crimson Text ✓ OFL
- **Asset library**: **KayKit Adventurers + KayKit Dungeon Pack +
  Quaternius Medieval Village**
- **Reference**:
  - Genshin Impact: https://genshin.hoyoverse.com
  - Tunic: https://store.steampowered.com/app/553420/
  - Tales of Arise: https://store.steampowered.com/app/740130/
  - Eastward (parziale 2D→3D inspiration)

## C08 — abstract-geometric

- **Palette**: gradient minimal
  - mono base + 1 vibrant gradient
  - `#1a1a2e #16213e #0f3460 #e94560` (popular abstract)
  - oppure pastel gradient
- **Shader effects**: post-processing heavy (bloom, chromatic
  aberration, fxaa)
- **Font UI**: Space Grotesk (Google Fonts) ✓ OFL
- **Font dialog**: Inter ✓ OFL
- **Asset library**: pmndrs/drei primitives + Poly Haven HDRI
- **Reference**:
  - Antichamber: https://store.steampowered.com/app/219890/
  - Manifold Garden: https://store.steampowered.com/app/473950/
  - Glitchspace: https://store.steampowered.com/app/290060/
  - Sayonara Wild Hearts: https://store.steampowered.com/app/1115050/

---

# GRUPPO D — Sperimentale/nicchia (8 pack)

## D01 — ascii-roguelike

- **Palette**: terminale (default + custom)
  - Classic: `#000000 #ffffff #ff0000 #00ff00 #ffff00 #0000ff #ff00ff #00ffff`
  - Modern: Solarized Dark, Gruvbox, Nord
- **Font**: Cousine (Google Fonts) ✓ OFL — monospace pulito
- **Alt font**: Fira Code, JetBrains Mono — pixel-perfect ASCII
- **Asset library**: N/A (è tutto carattere)
- **Reference**:
  - Dwarf Fortress: https://store.steampowered.com/app/975370/
  - Caves of Qud: https://store.steampowered.com/app/333640/
  - NetHack (refs)
  - Cogmind: https://store.steampowered.com/app/722730/

## D02 — hand-drawn-rotoscope

- **Palette**: cinematica
  - cuphead-inspired: `#f5f3ed #d4a574 #8b6f47 #2d1810 #c41e3a`
- **LoRA**: Civitai "Rubber Hose Animation" o "Cuphead Style" ⚠️
- **Font UI**: Yeseva One (Google Fonts) ✓ OFL — vintage display
- **Asset library**: AI gen primario (rotoscope frame-by-frame)
- **Reference**:
  - Cuphead: https://store.steampowered.com/app/268910/
  - Another World: https://store.steampowered.com/app/233710/
  - Out of This World (1991): refs
  - Flashback: https://store.steampowered.com/app/305920/

## D03 — ms-paint-childlike

- **Palette**: caotica deliberatamente
  - colori puri: `#ff0000 #00ff00 #0000ff #ffff00 #ff00ff #000000`
- **LoRA**: Civitai "MS Paint Style" ⚠️
- **Font UI**: Comic Sans MS (ironicamente). Alternative CC0: Comic Neue ✓ OFL
- **Asset library**: AI gen
- **Reference**:
  - Petscop (web series, refs YouTube)
  - Frog Fractions: https://store.steampowered.com/app/261720/
  - Earthbound (psicodelico)
  - Off (RPG Maker game, refs)

## D04 — gritty-realistic-2d

- **Palette**: muted realistic
  - `#3d3530 #5a4f44 #7a6b5c #9a8a78 #b8a895 #d4c4ad`
  - + accent rosso fresco: `#b03020`
- **LoRA**: Civitai "Painted Realistic Game Art" o "Disco Elysium Style" ⚠️
- **Font UI**: Cormorant Garamond ✓ OFL
- **Font dialog**: EB Garamond ✓ OFL
- **Asset library**: AI gen primario (alta risoluzione)
- **Reference**:
  - Disco Elysium: https://store.steampowered.com/app/632470/
  - Ruined King: https://store.steampowered.com/app/1500750/
  - Pathologic 2: https://store.steampowered.com/app/505230/
  - Pyre: https://store.steampowered.com/app/462770/

## D05 — visual-novel-photographic

- **Palette**: foto realistica leggermente lavata
  - cool tone: `#3a4a5e #5e7088 #88a0b8 #c4d0dc #f0f4f8`
  - warm tone alternative
- **LoRA**: Civitai "Anime + Photo Realistic" ⚠️
- **Font UI**: Sawarabi Mincho (Google Fonts) ✓ OFL — JP mincho
- **Font dialog**: Noto Serif JP ✓ OFL
- **Asset library**: Pexels CC0 stock photography + AI sprite anime overlay
- **Reference**:
  - Steins;Gate: https://store.steampowered.com/app/412830/
  - Famicom Detective Club (Switch refs)
  - 428: Shibuya Scramble: https://store.steampowered.com/app/715090/
  - Chaos;Head: refs

## D06 — minimalist-mono

- **Palette**: 2 colori massimo
  - Limbo: `#0a0a0a #f0f0f0`
  - Thomas Was Alone: 1 colore per personaggio + bg neutral
- **LoRA**: N/A
- **Font UI**: Cormorant Garamond ✓ OFL (Limbo-style)
- **Asset library**: AI gen (è SILHOUETTE only)
- **Reference**:
  - Limbo: https://store.steampowered.com/app/48000/
  - Thomas Was Alone: https://store.steampowered.com/app/220780/
  - A Dark Room: https://store.steampowered.com/app/1029610/
  - Mini Metro: https://store.steampowered.com/app/287980/

## D07 — synthwave-80s

- **Palette**: neon retrofuture
  - `#0a0a0a #1a0033 #2d0080 #ff006e #fb5607 #ffbe0b #00f5d4`
- **LoRA**: Civitai "Synthwave" o "80s Retrowave" ⚠️ (popolare)
- **Font UI**: Audiowide ✓ OFL — retrofuture display
- **Font dialog**: VT323 ✓ OFL
- **Asset library**: itch.io free synthwave packs (curare)
- **Reference**:
  - Hotline Miami 2: https://store.steampowered.com/app/274170/
  - Far Cry 3 Blood Dragon: https://store.steampowered.com/app/233270/
  - GRIDD: Retroenhanced: https://store.steampowered.com/app/559390/
  - The Crew Wild Run (refs)

## D08 — dark-fantasy-painted

- **Palette**: oil paint dark
  - `#1a0e0a #2d1a0e #4a2818 #6e3a24 #8a5230 #a87040 #cfa080`
  - + sangue/highlight rosso: `#9a0c0c`
- **LoRA**: Civitai "Dark Fantasy Painting" o "Berserk Style" ⚠️
- **Font UI**: Caudex ✓ OFL — fantasy gentle
- **Font dialog**: Cormorant Garamond ✓ OFL
- **Asset library**: AI gen primario (Darkest Dungeon style)
- **Reference**:
  - Darkest Dungeon: https://store.steampowered.com/app/262060/
  - Blasphemous: https://store.steampowered.com/app/774361/
  - Salt and Sanctuary: https://store.steampowered.com/app/283640/
  - The Witcher 3 (concept art refs)

---

# Tabella riepilogativa LoRA da verificare

| Pack | LoRA candidate (Civitai/HF) | Priorità verifica Sett 1 |
|---|---|---|
| A01 | Pixel Art XL by Nerijs ✓ HF | ALTA |
| A02 | Pixel Art XL + prompt vibrant | MEDIA (uso baseline) |
| A03 | 1-bit Pixel | ALTA |
| A04 | GBC Game Boy Color Style | MEDIA |
| A05 | SNES JRPG Style / 16-bit RPG | ALTA |
| A06 | Cyberpunk Pixel | ALTA |
| A07 | Horror Pixel | MEDIA |
| A08 | Synthwave Arcade Pixel | MEDIA |
| B02 | Watercolor Painting (multi) | ALTA |
| B03 | Comic Book Style | MEDIA |
| B04 | NoCrypt Anime Style / Anime VN | ALTA |
| B05 | Sin City / Film Noir | BASSA |
| B06 | Paper Craft / Origami | BASSA |
| C03 | Anime Cel Shading 3D | MEDIA |
| C06 | Sci-Fi Concept Art | MEDIA |
| C07 | Stylized Fantasy 3D | ALTA |
| D02 | Rubber Hose Animation / Cuphead | BASSA |
| D03 | MS Paint Style | BASSA |
| D04 | Disco Elysium Style | BASSA |
| D05 | Anime Photo Realistic | BASSA |
| D07 | Synthwave 80s | MEDIA |
| D08 | Dark Fantasy Painting / Berserk | ALTA |

ALTA = pack tra i baseline più probabili per il primo prompt utente.
Da verificare manualmente su Civitai entro Sett 1: licenza
(commerciale OK?), download count, modello base compatibile (SDXL
1.0 / FLUX dev / Pony XL).

---

# Note operative

1. **Civitai licensing**: ogni LoRA ha icone "Use the model" — verificare
   che siano TUTTE verdi (allow generation + use for commercial
   purposes + sell merch). Ne basta una rossa per scartare.
2. **HuggingFace licensing**: card del modello — `license: cc-by-4.0`
   o `apache-2.0` o `mit` OK. `creativeml-openrail-m` OK con condizioni
   (no harm clauses).
3. **Backup LoRA**: per ogni pack ALTA, scaricare due LoRA candidati e
   confrontarli nel test "wow effect" durante Sett. 14 della roadmap
   blueprint.
4. **Palette → JSON**: convertire ogni palette a `palette.hex[]` nel
   `style_pack` schema del Game Plan.
5. **Font self-hosted**: Google Fonts → @fontsource npm package o
   download manual + servire da R2 nostro per latenza.
6. **Negative prompts comuni anti-slop**: ogni pack ha `negative_prompt:
   "low quality, blurry, jpeg artifacts, ai-generated, generic"`.
