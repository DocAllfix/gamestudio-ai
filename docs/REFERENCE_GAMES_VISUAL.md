# Reference Games Visual — moodboard pipeline per il "vibe target"

**Data**: 2026-05-24
**Scope**: per ogni combo `style_pack × genre`, lista di giochi
shipped come reference visiva. Gli URL Steam/itch ufficiali sono
fonte di screenshot legittimi da iniettare nel prompt LLM via
Claude Vision e/o ControlNet.

**Anti-slop principio**: l'LLM non genera mai un gioco "in stile X"
basandosi solo sul nome. Riceve sempre 3-5 screenshot reali della
combinazione richiesta come prompt visivo.

---

## Schema dati per reference

```ts
type ReferenceGame = {
  id: string,
  title: string,
  store_url: string,                // canonical Steam o itch
  screenshot_urls: string[],        // URL diretti agli screenshot ufficiali
  cover_url: string,
  developer: string,
  release_year: number,
  style_pack_tags: StylePackId[],
  genre_tags: GenreEnum[],
  engine_compat: EngineEnum[],      // dove è ragionevole replicare lo stile
  notable_features: string[],
  vision_analysis_cache: VisionAnalysis | null,  // generato in batch
}

type VisionAnalysis = {
  detected_palette: HexColor[],
  composition_pattern: string,
  ui_layout_pattern: string,
  notable_visual_elements: string[],
}
```

## Pipeline operativa

1. Per ogni reference game (~80 totali), scrape la pagina Steam o
   itch.io → estrai screenshot URL ufficiali (10-15 per gioco).
2. Salva URL in `reference_games` Supabase table.
3. Batch Claude Vision: analizza 5 screenshot per gioco → cache la
   `VisionAnalysis` (palette, composition, UI).
4. Al primo prompt utente, il D.1 Intent Interpreter recupera 3-5
   reference matching `style_pack` selezionato + genre, e li passa
   come reference image al tool sprite/UI gen.

Costo Claude Vision: ~$0.10 per gioco analizzato × 80 = ~$8 una
tantum.

---

## Reference Games — catalogo principale

Ogni gioco è elencato con (titolo, Steam/itch URL, anno, dev, style
pack matchanti, generi matchanti, note).

### Pixel art 2D

| # | Game | URL | Year | Dev | Style pack | Genere | Note visive |
|---|---|---|---|---|---|---|---|
| 1 | Hyper Light Drifter | https://store.steampowered.com/app/257850/ | 2016 | Heart Machine | A01 | Action 2D | Palette desaturata + neon accenti |
| 2 | Death's Door | https://store.steampowered.com/app/894020/ | 2021 | Acid Nerve | A01, C01 | Action adventure | Top-down isometric pixel-3D hybrid |
| 3 | Iconoclasts | https://store.steampowered.com/app/393520/ | 2018 | Joakim Sandberg | A01 | Metroidvania | Color saturated dark base |
| 4 | Stardew Valley | https://store.steampowered.com/app/413150/ | 2016 | ConcernedApe | A02 | Farming sim | Warm cozy pixel art |
| 5 | Eastward | https://store.steampowered.com/app/977880/ | 2021 | Pixpil | A02 | RPG | Cinematic pixel art alta risoluzione |
| 6 | Chicory: A Colorful Tale | https://store.steampowered.com/app/1123450/ | 2021 | Greg Lobanov | A02 | Adventure puzzle | Color-as-mechanic, palette dynamic |
| 7 | A Short Hike | https://store.steampowered.com/app/1055540/ | 2019 | adamgryu | A02, C01 | Adventure | Pixel art ibrido low-poly 3D |
| 8 | Downwell | https://store.steampowered.com/app/360740/ | 2015 | Moppin | A03 | Vertical shmup | 1-bit pixel, palette swap mechanic |
| 9 | Minit | https://store.steampowered.com/app/609490/ | 2018 | JW + Kitty + Jukio | A03 | Adventure | 1-bit minimal, 60-sec runs |
| 10 | Return of the Obra Dinn | https://store.steampowered.com/app/653530/ | 2018 | Lucas Pope | A03 | Mystery | Dithered 1-bit Macintosh-style |
| 11 | World of Horror | https://store.steampowered.com/app/913480/ | 2023 | Panstasz | A03, A07 | Horror RPG | 1-bit retro Mac horror |
| 12 | Pokémon Crystal | (Nintendo) | 2000 | Game Freak | A04 | JRPG | GBC reference (no Steam) |
| 13 | Final Fantasy VI Pixel Remaster | https://store.steampowered.com/app/1173820/ | 2022 | Square Enix | A05 | JRPG | SNES JRPG modern fidelity |
| 14 | Chrono Trigger | https://store.steampowered.com/app/613830/ | 1995/2018 | Square | A05 | JRPG | SNES Akira Toriyama style |
| 15 | Sea of Stars | https://store.steampowered.com/app/1244090/ | 2023 | Sabotage Studio | A05 | JRPG | SNES-inspired modern lighting |
| 16 | VA-11 Hall-A | https://store.steampowered.com/app/447530/ | 2016 | Sukeban Games | A06, B04 | VN bartender | Cyberpunk neon + anime sprite |
| 17 | The Red Strings Club | https://store.steampowered.com/app/589780/ | 2018 | Deconstructeam | A06 | Narrative cyberpunk | Pixel cyberpunk noir |
| 18 | Coffee Talk | https://store.steampowered.com/app/914800/ | 2020 | Toge Productions | A06, B04 | VN | Lofi cyberpunk cozy |
| 19 | Cloudpunk | https://store.steampowered.com/app/746850/ | 2020 | ION LANDS | A06, C06 | 3D narrative | Voxel cyberpunk (3D) |
| 20 | Lone Survivor | https://store.steampowered.com/app/209830/ | 2012 | Jasper Byrne | A07 | Horror | Pixel horror PSX-like |
| 21 | Faith: Unholy Trinity | https://store.steampowered.com/app/1043260/ | 2022 | Airdorf | A07 | Horror | C64-style horror minimal |
| 22 | Hotline Miami | https://store.steampowered.com/app/219150/ | 2012 | Dennaton | A08 | Top-down shooter | Hyper neon top-down |
| 23 | Hotline Miami 2 | https://store.steampowered.com/app/274170/ | 2015 | Dennaton | A08, D07 | Top-down shooter | Synthwave + neon |
| 24 | Nuclear Throne | https://store.steampowered.com/app/242680/ | 2015 | Vlambeer | A08 | Roguelite shooter | Pixel arcade neon |
| 25 | Furi | https://store.steampowered.com/app/423230/ | 2016 | The Game Bakers | A08 | Boss rush | Stylized neon boss |
| 26 | GRIDD: Retroenhanced | https://store.steampowered.com/app/559390/ | 2017 | Antab Studio | A08, D07 | Endless arcade | Tron synthwave |

### Stilizzato 2D non-pixel

| # | Game | URL | Year | Dev | Style pack | Genere | Note |
|---|---|---|---|---|---|---|---|
| 27 | Monument Valley | https://store.steampowered.com/app/1422510/ | 2014/2022 | ustwo games | B01 | Puzzle | Flat isometric pastel |
| 28 | Alto's Adventure | https://store.steampowered.com/app/440290/ | 2018 | Snowman | B01 | Endless runner | Silhouette + gradient sky |
| 29 | Donut County | https://store.steampowered.com/app/702670/ | 2018 | Ben Esposito | B01 | Physics puzzle | Flat vector cute |
| 30 | Mini Metro | https://store.steampowered.com/app/287980/ | 2015 | Dinosaur Polo Club | B01, D06 | Strategy | Minimal flat geometric |
| 31 | GRIS | https://store.steampowered.com/app/683320/ | 2018 | Nomada Studio | B02 | Platformer narrative | Watercolor + 2D art |
| 32 | Hollow Knight | https://store.steampowered.com/app/367520/ | 2017 | Team Cherry | B02 | Metroidvania | Hand-drawn dark fantasy |
| 33 | Ori and the Blind Forest | https://store.steampowered.com/app/261570/ | 2015 | Moon Studios | B02 | Metroidvania | Painted glow forest |
| 34 | Spiritfarer | https://store.steampowered.com/app/972660/ | 2020 | Thunder Lotus | B02 | Cozy narrative | Painted soft 2D |
| 35 | Cuphead | https://store.steampowered.com/app/268910/ | 2017 | Studio MDHR | B03, D02 | Run and gun | 1930s rubber hose |
| 36 | Borderlands 2 | https://store.steampowered.com/app/49520/ | 2012 | Gearbox | B03 | Shooter | Comic cel-shading 3D |
| 37 | Doki Doki Literature Club | https://store.steampowered.com/app/698780/ | 2017 | Team Salvato | B04 | VN | Anime soft VN |
| 38 | Steins;Gate | https://store.steampowered.com/app/412830/ | 2014 | MAGES | B04, D05 | VN | Anime + photo bg |
| 39 | Genesis Noir | https://store.steampowered.com/app/1310330/ | 2021 | Feral Cat Den | B05 | Narrative noir | Mono + jazz |
| 40 | Mad Father | https://store.steampowered.com/app/479660/ | 2012/2022 | Sen | B05, A07 | RPG Maker horror | Mono horror |
| 41 | Tearaway Unfolded | (PS exclusive) | 2015 | Media Molecule | B06 | Adventure | Paper craft 3D |
| 42 | Paper Mario series | (Nintendo) | 2000+ | Intelligent Sys | B06 | RPG | Paper craft canonico |

### 3D stilizzato

| # | Game | URL | Year | Dev | Style pack | Genere | Note |
|---|---|---|---|---|---|---|---|
| 43 | Untitled Goose Game | https://store.steampowered.com/app/837470/ | 2019 | House House | C01 | Sandbox puzzle | Low-poly cute |
| 44 | Lake | https://store.steampowered.com/app/1812120/ | 2021 | Gamious | C01 | Cozy narrative | Low-poly warm |
| 45 | Kind Words | https://store.steampowered.com/app/1070710/ | 2019 | Popcannibal | C01 | Cozy narrative | Voxel + low-poly |
| 46 | Cube World | https://store.steampowered.com/app/1128000/ | 2019 | Picroma | C02 | Sandbox RPG | Voxel cute |
| 47 | Cubic Odyssey | https://store.steampowered.com/app/2638680/ | 2024 | Atypical | C02 | Sandbox | Voxel adventure |
| 48 | Genshin Impact | https://genshin.hoyoverse.com | 2020 | HoYoverse | C03, C07 | Action RPG | Anime cel-shading 3D (no Steam) |
| 49 | Tales of Arise | https://store.steampowered.com/app/740130/ | 2021 | Bandai Namco | C03 | Action JRPG | Anime cel-shading 3D |
| 50 | Borderlands 3 | https://store.steampowered.com/app/397540/ | 2019 | Gearbox | C03 | Shooter | Cel-shading 3D |
| 51 | Tunic | https://store.steampowered.com/app/553420/ | 2022 | Andrew Shouldice | C03, C07 | Action adventure | Cute toon 3D |
| 52 | Crow Country | https://store.steampowered.com/app/1996610/ | 2024 | SFB Games | C04 | Horror PS1-style | PSX horror |
| 53 | Signalis | https://store.steampowered.com/app/1262350/ | 2022 | rose-engine | C04 | Survival horror | PSX inspired |
| 54 | Bloodborne PSX | https://lilithwalther.itch.io/bloodborne-psx | 2022 | Lilith Walther | C04 | Action RPG demake | PSX vertex jitter perfetto |
| 55 | Mortuary Assistant | https://store.steampowered.com/app/1295920/ | 2022 | DarkStone | C04 | Horror | PSX horror modern |
| 56 | Lunark | https://store.steampowered.com/app/1095830/ | 2023 | Canari | C05 | Platformer | N64-inspired |
| 57 | Yooka-Laylee | https://store.steampowered.com/app/360830/ | 2017 | Playtonic | C05 | 3D platformer | N64 spirito |
| 58 | Mirror's Edge | https://store.steampowered.com/app/17410/ | 2008 | DICE | C06 | Parkour | Sci-fi clean minimalista |
| 59 | Lightmatter | https://store.steampowered.com/app/971890/ | 2020 | Tunnel Vision | C06 | Puzzle FPS | Sci-fi clean |
| 60 | The Talos Principle 2 | https://store.steampowered.com/app/835960/ | 2023 | Croteam | C06 | Puzzle | Sci-fi clean alta fedeltà |
| 61 | Antichamber | https://store.steampowered.com/app/219890/ | 2013 | Alexander Bruce | C08 | Puzzle | Abstract minimal |
| 62 | Manifold Garden | https://store.steampowered.com/app/473950/ | 2019 | William Chyr | C08 | Puzzle | Escher inspired |
| 63 | Sayonara Wild Hearts | https://store.steampowered.com/app/1115050/ | 2019 | Simogo | C08, D07 | Rhythm | Pop synth abstract |

### Sperimentale/nicchia

| # | Game | URL | Year | Dev | Style pack | Genere | Note |
|---|---|---|---|---|---|---|---|
| 64 | Dwarf Fortress | https://store.steampowered.com/app/975370/ | 2022 | Bay 12 | D01 | Roguelike sim | ASCII + tileset opt |
| 65 | Caves of Qud | https://store.steampowered.com/app/333640/ | 2024 | Freehold | D01 | Roguelike | ASCII rich |
| 66 | Cogmind | https://store.steampowered.com/app/722730/ | 2017+ | Grid Sage | D01 | Roguelike | ASCII modern |
| 67 | Another World | https://store.steampowered.com/app/233710/ | 1991/2014 | Éric Chahi | D02 | Cinematic | Rotoscope vector |
| 68 | Flashback | https://store.steampowered.com/app/305920/ | 1992/2018 | Delphine | D02 | Cinematic | Rotoscope sequel |
| 69 | Frog Fractions | https://store.steampowered.com/app/261720/ | 2014 | Twinbeard | D03 | Meta | MS Paint deliberate |
| 70 | Disco Elysium | https://store.steampowered.com/app/632470/ | 2019 | ZA/UM | D04 | CRPG | Painted realistic |
| 71 | Ruined King | https://store.steampowered.com/app/1500750/ | 2021 | Airship | D04 | CRPG | Painted hi-res |
| 72 | Pathologic 2 | https://store.steampowered.com/app/505230/ | 2019 | Ice-Pick Lodge | D04 | Survival CRPG | Painted gritty |
| 73 | Pyre | https://store.steampowered.com/app/462770/ | 2017 | Supergiant | D04 | CRPG ritual | Painted vibrant |
| 74 | Limbo | https://store.steampowered.com/app/48000/ | 2010 | Playdead | D06 | Puzzle platformer | Mono silhouette |
| 75 | Thomas Was Alone | https://store.steampowered.com/app/220780/ | 2012 | Mike Bithell | D06 | Puzzle | Mono rectangles |
| 76 | A Dark Room | https://store.steampowered.com/app/1029610/ | 2017 | Doublespeak | D06 | Text-based | Mono interactive fiction |
| 77 | Far Cry 3 Blood Dragon | https://store.steampowered.com/app/233270/ | 2013 | Ubisoft | D07 | FPS | Synthwave 80s parody |
| 78 | Darkest Dungeon | https://store.steampowered.com/app/262060/ | 2016 | Red Hook | D08 | Roguelite RPG | Oil painted gothic |
| 79 | Blasphemous | https://store.steampowered.com/app/774361/ | 2019 | The Game Kitchen | D08 | Metroidvania | Painted dark fantasy |
| 80 | Salt and Sanctuary | https://store.steampowered.com/app/283640/ | 2016 | Ska Studios | D08 | Soulslike | Painted dark |

---

## Schema query per il D.1 Intent Interpreter

```python
def fetch_visual_references(style_pack: StylePackId,
                            genre: GenreEnum,
                            n: int = 5) -> list[ReferenceGame]:
    # Filter su style pack + genere matching
    candidates = supabase.from('reference_games').select('*') \
        .contains('style_pack_tags', [style_pack]) \
        .contains('genre_tags', [genre]) \
        .order('release_year', desc=True) \
        .limit(n * 2)

    # Tieni i N più recenti per dare al modello uno "stato dell'arte"
    return rank_by_recency_and_relevance(candidates, top_n=n)
```

Il `D.1` poi passa `vision_analysis_cache.detected_palette` come
override del `style_pack.palette` se l'utente ha richiesto
"ispirazione da gioco X" (es. "tipo Hollow Knight" → query
ricerca su titoli → match → usa la palette emergente da Vision).

---

## Cose da raccogliere ANCORA

Cose mancanti che andrebbero aggiunte in Sett 2 di sviluppo:

1. **Itch.io free games**: ci sono centinaia di game jam entries
   visivamente forti (Ludum Dare, GMTK). Selezione manuale.
2. **GameJolt indie**: spotlight pixel art mensile.
3. **Screenshots ad alta risoluzione**: alcuni Steam screenshot sono
   compressi. Considerare GamersGate/Press Kit ufficiali per
   versioni hi-res.
4. **Concept art ufficiali**: ArtStation è una miniera, ma diritti
   riservati. Solo come reference cognitiva per il modello, NON
   training/upload.
5. **GDC postmortem talks**: per ogni gioco shipped, 1-2 talk GDC
   spesso esiste con detail tecnico stile. Da indicizzare in
   `reference_postmortems`.
