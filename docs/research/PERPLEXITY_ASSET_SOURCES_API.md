# Perplexity — fonti asset MACHINE-READABLE (API/dump), anti-duplicati (2026-06-07)

Risposta alla ricerca mirata: fonti consumabili via REST/API/dump (NO scraping HTML
fragile), filtrabili sull'allowlist licenze, mirate ai BUCHI (musica/animazioni/
tileset/background/mappe) senza ri-prendere ciò che abbiamo (Freesound/OGA/Polyhaven).
Le 3 leve forti: **Openverse API** (aggregatore img/audio CC0/CC-BY), **OpenGameArt su
HuggingFace** (JSONL+ZIP con metadata), **alcuni repo GitHub CC0** (musica/sprite/mappe).

## 1. MUSICA (buco #1, abbiamo 0)
### Openverse Audio API (aggregatore, con tag/durata/genere)
- Search: `GET https://api.openverse.engineering/v1/audio/?q={q}&license=cc0,by&license_type=commercial,modification&category=music&page_size=N`
- Detail: `GET .../v1/audio/{id}/`
- Campi: `id,title,creator,foreign_landing_url, url (DIRECT file), license,license_version,
  provider,source, category(music|sound_effect), genres[], tags[{name}], duration, filetype, thumbnail/waveform`.
- Auth: pubblica, no key (uso "ragionevole", non bulk-mirror; per volumi → self-host).
- DEDUP: chiave = `provider`+`foreign_landing_url`/`url`. Escludere `source=freesound` (già nostro) con query.
### SoundSafari/CC0-1.0-Music (GitHub, ~7000 brani, tutto CC0, ~40GB)
- `GET https://api.github.com/repos/SoundSafari/CC0-1.0-Music/git/trees/main?recursive=1` → lista file.
- Canonical = `raw.githubusercontent.com/.../{path}`. NO metadata mood (solo path) → classificare noi.
- Rate: GitHub 60/h anon, 5k/h con token. NON scaricare i 40GB → indicizzare URL (disco-safe).

## 2. OpenGameArt su HuggingFace (musica/tileset/animazioni/background/mappe) — LA FONTE CHIAVE
- Dataset: `nyuuzyou/OpenGameArt-CC-BY-4.0` (licenza dati CC-BY-4.0; usabile col nostro allowlist).
- File: `2D_Art.jsonl.zst`, `3D_Art.jsonl.zst`, `Music.jsonl.zst`, `Sound_Effect.jsonl.zst`,
  `Texture.jsonl.zst` + ZIP binari + `archive_index.csv` (filename→archivio).
- Record JSONL: `url (pagina OGA, canonical per DEDUP), title, author, art_type, tags[],
  licenses[] (CC-BY-4.0/OGA-BY-4.0), preview_images[], files[{url (DIRECT download), name, size}]`.
- USO per i buchi (filtri su tags):
  - Musica: `Music.jsonl` + tags loop/background/ambient.
  - Tileset: `2D_Art.jsonl` + tags tileset/tile/platformer/top-down.
  - Animazioni: `2D_Art.jsonl` + tags animated/spritesheet/idle/run/jump/attack.
  - Background: `2D_Art`/`Texture` + tags background/parallax.
  - Mappe: `files[].name` con `.tmx/.tmj/.tsx`.
- Accesso: HTTP diretto ai `.jsonl.zst` (decomprimi con zstd) — **scarico solo il JSONL (piccolo)**,
  NON gli ZIP binari; uso `files[].url` come download on-demand (disco-safe).
- DEDUP: campo `url` (pagina OGA) vs i nostri OGA esistenti → se c'è, arricchisci non duplicare.
- NB licenze: usare SOLO il dataset CC-BY-4.0 (e OGA-BY-4.0 rilicenziabile CC-BY-4.0). EVITARE i
  dataset CC-BY-SA / BY-SA-3.0 (copyleft, fuori allowlist).

## 3. Sprite/tileset/background via GitHub CC0
- `doficia/project-cordon-sprites` (CC0 pixel art: tileset/character/environment, alcune anim).
  GitHub trees API + raw URL. Metadata da path/naming (no tag) → inferire.

## 4. Background / parallax
- Openverse Image API: `GET .../v1/images/?q=game background&license=cc0,by&license_type=commercial,modification&category=illustration`.
  Campi: `url,height,width,license,tags,category`. Escludere `source` polyhaven/ambientcg (già nostri).

## 5. Mappe Tiled pronte (CC0)
- `jamesbowman/tiled-maps` (.tmx CC0 + tileset, es. desert 512x2048). GitHub trees + raw.
- Tiled examples repo (`bjorn/tiled` /examples) — arte CC0, codice GPL (prendiamo solo le risorse/.tmx).
- Allegro platformer demo: tileset "Sunset Temple" è CC-BY-3.0 → FUORI allowlist, skip o estendere policy.

## 6. Aggregatori (indici, non API)
- `madjin/awesome-cc0` (README CC0): indice di FONTI, non asset → backlog da esplorare, non ingest diretto.
- artgamesound / gameidea.org: solo frontend web, no API → evitare (sarebbe scraping).

## Riassunto per gap → fonte (ordine d'uso)
- MUSICA: Openverse Audio (mood/genere) + OGA-HF Music.jsonl. [SoundSafari = bulk CC0 ma senza mood]
- ANIMAZIONI 2D: OGA-HF 2D_Art (tags animated/spritesheet) + project-cordon-sprites.
- TILESET: OGA-HF 2D_Art (tags tileset) + project-cordon-sprites.
- BACKGROUND: Openverse Image (illustration) + OGA-HF 2D_Art/Texture (tags background).
- MAPPE: jamesbowman/tiled-maps + Tiled examples (.tmx CC0).
> Tutto INDEX-only: scarico JSONL/feed (piccoli), salvo URL+metadata+embedding, file via `files[].url`
> on-demand nel sandbox/R2. Disco locale intatto. DEDUP su url canonico (OGA url / openverse
> foreign_landing_url / github raw). Licenze: solo allowlist.
