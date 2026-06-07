# Asset Ingestion Spec (FASE 2.5b) — schema-target + flusso

Disegno dell'ingestione per ampliare `asset_library_index` con asset CC0 (tileset,
sprite, animazioni, mappe, musica), **categorizzati con precisione** (stile/genere/
motore/qualità), **senza duplicati**, **senza riempire il disco locale** (file su
R2/sandbox, non sul PC). Lo schema esiste già ed è completo — qui fissiamo COSA
riempire e COME classificare.

## Vincoli (memoria utente)
- **Disco locale poco** → INDEX-only: salva URL+metadata+embedding. Per classificare
  con la VISIONE → download TEMP usa-e-getta (1 file → classifica → cancella) o nel
  sandbox. File processati (Sorceress) → **R2** (1.7/10GB free, illimitato a centesimi).
- **Niente duplicati** → dedup su `source_url` (UNIQUE) + `content_hash` (SHA-256).
- **Licenze**: solo allowlist (`CC0-1.0, CC-BY-4.0, MIT, Apache-2.0, BSD-2/3, ISC,
  Zlib, Unlicense, OFL-1.1`). Mai GPL/sconosciute.

## Schema-target (colonne di `asset_library_index` da riempire BENE)
Identità/licenza (NOT NULL): `source_library, source_url(UNIQUE), download_url,
thumbnail_url, content_hash, license, attribution_required, creator_name`.
Tipo: `asset_type` (sprite|tileset|ui_element|icon|background|model_3d|animation_3d|
texture|hdri|audio_sfx|audio_bgm|audio_voice|font...), `file_format`, `file_size_kb`.
Dimensioni (per tipo): `image_width/height`, `image_color_palette[]`,
`audio_duration_s/bpm/key`, `model_triangle_count/has_rig/animation_count`.
**Tassonomia (gli assi del match, da classificare con cura):**
- `style_pack_compat[]` → A01-A08 pixel, B01-B06 stylized-2d, C01-C08 3d, D01-D08 special.
  Specifico per TEMA (cyberpunk→A06/D07, horror→A07/D08...), non il gruppo intero.
- `genre_affinity[]` → i 14 generi seeded.
- `use_case_tags[]` → character|enemy|boss|prop|decoration|hud_element|tile|platform|
  background|pickup|icon|... (cosa È l'asset nel gioco → serve al code_gen per usarlo).
- `engine_compat[]` → godot|phaser|... (per i giochi: 2D vale per tutti i 2D engine).
- `semantic_description` (per embedding) + `keywords[]`.
- `embedding` (text-embedding-3-small, 1536) — per ricerca semantica.
Qualità: `quality_score` (1-5), `confidence_score` (0-100 della classificazione).

## Flusso di ingestione (per fonte)
1. **Discover**: dalla fonte (lista/API/sitemap) → elenco asset con source_url + download_url + licenza.
2. **Dedup**: skip se `source_url` già presente (o `content_hash` se calcolabile senza scaricare).
3. **Classify (qui i FILE migliorano la qualità)**:
   - metadata di base dal testo (titolo/descrizione/tag della fonte) → semantic_description, keywords, use_case_tags, genre_affinity.
   - **VISIONE (download-temp usa-e-getta)**: scarica la thumbnail/immagine in temp →
     un classificatore (LLM-vision o euristica pixel: dimensione, palette, pixel-or-not)
     determina `style_pack_compat` SPECIFICO + `image_width/height` + `image_color_palette`
     + `quality_score` → **cancella il file**. Per animazioni: rileva grid/frame
     (model_animation_count o frame count per sprite-sheet).
4. **Embed**: embedding della semantic_description (tiny).
5. **Insert**: una riga; file binario NON salvato (URL alla fonte; ciò che processiamo → R2).

## Fonti (Perplexity, mappate ai buchi) — ordine
1. **OpenGameArt** (sprite animati, **musica**, sfx) — ha contenuti CC0/CC-BY, pagine strutturate.
2. **Kenney** (tileset, sprite, ui, audio) — no API → Playwright headless o slug noti.
3. **Quaternius** (3D low-poly + **animazioni**) — itch, pack CC0.
4. **FreePD / Duckhive** (**musica** CC0 per mood) — il buco #1 (audio_music=0).
5. **jamesbowman/tiled-maps, OGA Top-Down Dungeon** (**mappe** pronte .tmx CC0).
> Mappe-pronte (.tmx) si indicizzano come asset_type nuovo o come "level_template"
> (valutare: una colonna/tipo per i livelli importabili).

## Verifica
Dopo ogni fonte: count per asset_type cresce; `match_assets` con genre+engine+style
trova i nuovi (test query "forest platform tile" → hit dei tileset nuovi); nessun
duplicato (source_url unique regge); disco locale invariato.
