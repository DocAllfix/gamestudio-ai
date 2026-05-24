# Audio Mood Library — 12 mood × BGM/SFX/prompt

**Data**: 2026-05-24
**Scope**: catalogo di mood audio canonici con (a) prompt Suno
pre-pronti, (b) SFX bank Freesound + Kenney + OpenGameArt, (c) BPM/
key range, (d) layering pattern.

Risolve il gap: ogni Genre Template deve avere un audio baseline
coerente al primo prompt. Niente "Suno random + slop".

---

## Schema MoodEnum nel Game Plan

```ts
type MoodEnum =
  | 'epic_orchestral'   // boss fight, climax
  | 'dark_ambient'      // horror, exploration tense
  | 'chiptune_arcade'   // retro, fast-paced
  | 'lofi_chill'        // cozy, VN slice-of-life
  | 'synthwave_neon'    // cyberpunk, action
  | 'orchestral_calm'   // exploration, peaceful
  | 'jazz_noir'         // detective, mystery
  | 'fantasy_celtic'    // RPG town, journey
  | 'electronic_tense'  // stealth, sci-fi
  | 'piano_emotional'   // narrative, ending
  | 'metal_hardcore'    // bullet hell, action arcade
  | 'tropical_island'   // casual mobile, exotic
```

12 mood = copertura ragionevole per i 14 Genre Template.

---

## 1. epic_orchestral

- **Uso**: T01 climax_room, T05 dungeon boss, T07 chapter boss,
  T08 final floor, T10 boss_lair
- **BPM**: 90-130 (climax: 140-160)
- **Key**: D minor / E minor (drammatica) o C major (eroica)
- **Strumenti**: orchestra completa, choir, taiko, brass full
- **Suno prompt esempio**:
  ```
  Epic orchestral battle theme, full orchestra with brass section,
  choir vocals, taiko drums, building tension, key of D minor,
  duration 90 seconds, looping
  ```
- **Layering** (per AI Director runtime):
  - Layer 1 (intro): solo strings + horn
  - Layer 2 (build): add percussion + choir
  - Layer 3 (climax): full orchestra + brass spike
- **SFX bank**:
  - Sword clash, magic spell impact, boss roar
  - Freesound query: `license:cc0 OR cc-by AND tag:sword,clash,impact`
  - Kenney pack: Impact Sounds + RPG Audio
- **Reference giochi**: Hollow Knight (Radiance theme), Death's Door
  (final boss), Hades (Charon Obol)

## 2. dark_ambient

- **Uso**: T07 horror exploration, T01 ruins_late, dungeon scuro
- **BPM**: 50-70 (slow)
- **Key**: drone in C / D / F# minor con dissonance
- **Strumenti**: synth pad, processed strings, choir reverse,
  field recording deep
- **Suno prompt**:
  ```
  Dark ambient drone, deep synth pad, reverse choir whispers,
  industrial low rumble, no melody, atmospheric tension,
  duration 60 seconds, seamless loop
  ```
- **Layering**:
  - Layer 1: drone constant
  - Layer 2 (event triggered): whisper pulse, distant scream
  - Layer 3 (chase): faster drone modulation
- **SFX bank**:
  - Footsteps stone/wood, distant breath, door creak, monster
  - Freesound: `tag:horror,ambient,dark license:cc0`
  - OpenGameArt: "Lone Survivor inspired" packs
- **Reference**: Lone Survivor, Silent Hill 2, Layers of Fear

## 3. chiptune_arcade

- **Uso**: T04 browser arcade, T13 bullet hell, T14 retro 8-bit
- **BPM**: 130-180 (fast)
- **Key**: C major / A minor (NES typical)
- **Strumenti**: 8-bit square + triangle + noise, NES audio chip emulation
- **Suno prompt**:
  ```
  Chiptune 8-bit arcade game music, NES style, fast tempo 150bpm,
  square wave melody + triangle bass + noise drums, energetic,
  duration 60 seconds, seamless loop
  ```
- **Layering**:
  - Boss vs. stage: dynamic key shift down 2 semi
  - Game over jingle, victory fanfare
- **SFX bank**:
  - Coin, jump, enemy hit, power-up, game over
  - Kenney Digital Audio (8-bit pack) — CC0 perfetto
  - Freesound: `tag:chiptune,8bit,nes license:cc0`
- **Reference**: Super Meat Boy, Nuclear Throne, Shovel Knight

## 4. lofi_chill

- **Uso**: T02 VN slice-of-life, T03 mobile puzzle relaxing,
  T12 social sim daytime
- **BPM**: 70-90 (chill)
- **Key**: any with jazz chords (Cmaj7, Dm7, etc.)
- **Strumenti**: vinyl crackle, jazz piano, soft drums, mellow bass,
  rain field recording
- **Suno prompt**:
  ```
  Lofi chill hip hop beat, jazzy piano, vinyl crackle, soft drums,
  rain ambience background, key of C major, 80bpm, relaxed mood,
  duration 90 seconds, looping
  ```
- **SFX bank**:
  - UI clicks soft, page turn, sip of coffee, ambient cafe
  - Freesound: `tag:lofi,jazz,piano,cafe license:cc0`
- **Reference**: VA-11 Hall-A, Coffee Talk, Spiritfarer

## 5. synthwave_neon

- **Uso**: T08 cyberpunk roguelike, A06/A08 pixel-art-cyberpunk
- **BPM**: 100-130
- **Key**: F# minor / B minor (synthwave classic)
- **Strumenti**: analog synth lead, gated reverb drums, sidechain
  bass, arpeggio, vocoder occasionale
- **Suno prompt**:
  ```
  Synthwave 80s retro neon, analog synthesizer lead, gated reverb
  snare, side-chained bass, arpeggio synth, F# minor, 110bpm,
  cinematic, duration 90 seconds, looping
  ```
- **SFX bank**:
  - Laser, neon hum, glitch UI, electronic impact
  - Kenney Sci-Fi Sounds + OpenGameArt synthwave packs
- **Reference**: Hotline Miami OST, Far Cry 3 Blood Dragon, Cyberpunk
  2077 driving music

## 6. orchestral_calm

- **Uso**: T05 JRPG town/world map, T01 cave_intro, T09 3D ambient
- **BPM**: 60-90 (relaxed)
- **Key**: C/G/D major
- **Strumenti**: solo flute, oboe, soft strings, harp, no percussion
- **Suno prompt**:
  ```
  Calm orchestral ambient music, solo flute melody, soft string
  pad, gentle harp arpeggio, key of C major, 75bpm, peaceful,
  no percussion, duration 90 seconds, looping
  ```
- **SFX bank**:
  - Wind, birds, footstep grass, water gentle, NPC chatter
  - Freesound + Kenney Nature Pack
- **Reference**: Stardew Valley spring theme, A Short Hike, Spiritfarer

## 7. jazz_noir

- **Uso**: B05 noir-monochrome, T02 detective VN
- **BPM**: 80-100
- **Key**: minor 7th chords (Dm7, Gm7, Am7)
- **Strumenti**: muted trumpet, brushed drums, walking bass, sax sub
- **Suno prompt**:
  ```
  Jazz noir detective theme, muted trumpet melody, walking bass,
  brushed drums, minor seventh chords, smoky bar atmosphere,
  90bpm, duration 75 seconds, looping
  ```
- **SFX bank**:
  - Cigarette light, rain on window, footsteps wet pavement, type-
    writer (cit. Special Elite font), telefono vintage
  - Freesound: `tag:noir,rain,typewriter,jazz license:cc0`
- **Reference**: LA Noire (Cole's theme), Mafia 1, Disco Elysium
  (parziale)

## 8. fantasy_celtic

- **Uso**: T05 JRPG village, T08 roguelike hub, C07 fantasy-stylized
- **BPM**: 90-120
- **Key**: D mixolydian / E minor (celtic typical)
- **Strumenti**: tin whistle, bouzouki/mandolin, bodhran, fiddle,
  harp celtic, accordion sub
- **Suno prompt**:
  ```
  Celtic fantasy tavern music, tin whistle melody, bodhran drum,
  bouzouki and harp, key of D mixolydian, 110bpm, lively pub
  atmosphere, duration 90 seconds, looping
  ```
- **SFX bank**:
  - Tankard clink, fire crackle, crowd chatter tavern, sword sheath
  - OpenGameArt celtic pack + Freesound
- **Reference**: Witcher 3 tavern themes, Skyrim mead hall, Bardic
  Inspiration playlists

## 9. electronic_tense

- **Uso**: T06 card game late game, T11 multiplayer arena, T08
  stealth roguelike
- **BPM**: 100-140
- **Key**: F minor / A minor con drone
- **Strumenti**: synth bass deep, glitch percussion, processed vocal
  chops, sub bass pulse
- **Suno prompt**:
  ```
  Electronic tense stealth music, deep synth bass, glitch percussion,
  pulsing sub bass, A minor, 115bpm, suspenseful, cinematic,
  duration 75 seconds, looping
  ```
- **SFX bank**:
  - Heart beat, sneak step, alert beep, technology hum
  - Freesound: `tag:tension,electronic,stealth license:cc0`
- **Reference**: Hitman series, Mark of the Ninja, Mr. Robot OST

## 10. piano_emotional

- **Uso**: T02 climax narrative, T05 ending JRPG, T12 social moments
- **BPM**: 60-80
- **Key**: Eb major / F minor (emozionale)
- **Strumenti**: solo piano (felt o classical), soft strings sub,
  no percussion
- **Suno prompt**:
  ```
  Emotional solo piano theme, soft felt piano, gentle string pad
  in background, key of Eb major, 72bpm, melancholic, romantic,
  duration 90 seconds, looping
  ```
- **SFX bank**:
  - Heart beat, breath, rain soft, paper rustle, photograph
  - Freesound: `tag:emotional,piano,strings license:cc0`
- **Reference**: To the Moon main theme, Spiritfarer, Florence

## 11. metal_hardcore

- **Uso**: T07 hardcore platformer boss, T08 boss roguelike,
  T13 bullet hell stage 5+
- **BPM**: 140-200
- **Key**: E phrygian / D minor (metal canonico)
- **Strumenti**: distorted guitar, double bass drums, growl vocals
  optional, synth lead high
- **Suno prompt**:
  ```
  Heavy metal boss fight music, distorted electric guitar, fast
  double bass drums, screaming lead, E phrygian, 170bpm, aggressive,
  duration 75 seconds, looping
  ```
- **SFX bank**:
  - Sword/saw clash, explosion, screams enemies
  - Freesound + Kenney Impact Sounds
- **Reference**: Hollow Knight (Grimm Troupe), Doom Eternal (lite
  version), Furi OST

## 12. tropical_island

- **Uso**: T03 mobile casual, T02 VN cheerful, casual hyper-casual
- **BPM**: 100-120
- **Key**: C major / G major (felici)
- **Strumenti**: ukulele, steel drum, marimba, soft percussion,
  whistle melody
- **Suno prompt**:
  ```
  Tropical island ukulele music, steel drum, marimba, soft beach
  percussion, whistle melody, key of C major, 110bpm, happy,
  duration 75 seconds, looping
  ```
- **SFX bank**:
  - Wave gentle, seagull, splash, sand step
  - Freesound + Kenney Audio "tropical" tag
- **Reference**: Alto's Adventure (parziale), Donut County, Animal
  Crossing (chill)

---

## SFX Bank — corredo trasversale

Indipendentemente dal mood, ogni gioco serve:

| Categoria | Quantità minima | Fonte primaria |
|---|---|---|
| UI clicks (menu/buttons) | 10-20 varianti | Kenney UI Audio CC0 |
| Player footsteps × material | 5 materiali (grass, stone, wood, water, metal) | Freesound CC0 |
| Damage / hit | 5-10 varianti | Kenney Impact Sounds |
| Death / game over | 3-5 jingle | Kenney Music Jingles |
| Coin/pickup | 5 varianti | Kenney Casino + Digital |
| Door open/close | 3 tipi | Freesound |
| Ambient loops × biome | 5 biomi base | Freesound + OGA |

Total bank trasversale: ~100 SFX. Indicizzati nell'`asset_library_
index` con `category='sfx'` + `genre_tags=*` (cross-genre).

---

## Pipeline di indicizzazione audio (in Sett 2)

```
scripts/ingestion_audio/
├── 01_freesound_api.py     # query CC0/CC-BY, 100k seed
├── 02_kenney_audio.py      # tutti pack CC0
├── 03_openga_audio.py      # filter licenza
├── 04_classify_audio.py    # LLM tag: mood, instruments, loop_ok, BPM est.
├── 05_embed_audio.py       # CLAP embedding (vs CLIP per immagini) per ricerca semantica
└── 06_suno_prompt_lib.py   # salva i prompt Suno pre-curati per ogni mood
```

**CLAP** (Contrastive Language-Audio Pretraining, LAION) è
l'embedding model audio standard, gratis via HuggingFace. Genera
1024-dim vectors compatibili con pgvector.

Costo stim: ~$2-3 di compute embedding per 50k audio chunks.

---

## Decisioni anti-slop per audio

1. **Niente Suno random**: ogni mood ha 3-5 prompt pre-curati. Il D.4
   Balance Controller seleziona quello matching `pacing.target_curve`
   intensity al momento.
2. **Layering dinamico**: ogni traccia Suno generata in **3 layer
   stems** (intro/main/climax) — Suno supporta stems export su tier
   Pro. Il runtime li fonde via Web Audio API in base allo stress
   metric.
3. **SFX preferiti CC0 a generati**: ElevenLabs SFX gen costoso e
   spesso "AI-y". Kenney + Freesound CC0 = 95% dei casi coperti
   gratis.
4. **Validation**: il D.6 Evaluation Agent verifica che la traccia BGM
   matchi il `music_mood` dichiarato (CLAP similarity > 0.7) e che
   non ci sia clipping audio.
