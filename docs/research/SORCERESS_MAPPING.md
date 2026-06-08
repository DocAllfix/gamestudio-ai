# Sorceress → GameSmith — Mappatura precisa tool-per-tool

**Obiettivo:** assorbire Sorceress come UNA parte di GameSmith (l'asset studio),
non come prodotto a sé. Per ogni tool Sorceress: cosa fa (tecnicamente), se
GameSmith lo copre già, e la mossa. Incrociato coi pain point r/aigamedev
([[AIGAMEDEV_INSIGHTS]]).

**Cos'è Sorceress (preciso):** asset studio AI (~30 tool) + WizardGenie (game
engine AI debole). Pricing $49 lifetime + crediti AI $10-100/mese. Tutto
**generativo a consumo** (lock-in sui crediti). Modelli aggregati: Nano Banana,
Flux 2, GPT Image 2, Seedream, Grok + Hunyuan3D/Meshy6/TRELLIS2/Rodin/Tripo (3D)
+ Suno/ElevenLabs (audio).

> **Differenza di modello da non perdere:** Sorceress = generativo-a-tutto-costo.
> GameSmith = **CC0-first gratis + generativo solo paywall**, e gli asset sono
> integrati nel gioco che generi+verifichi+possiedi. Non copiamo il modello;
> prendiamo le *capability* che ci mancano e le inseriamo nel NOSTRO flusso.

---

## Stato GameSmith verificato (giugno 2026)
- **Tool nel registry (eseguibili):** asset_resolver, sprite_gen, tilemap_populate,
  entity_placement, heightmap_gen, level_layout_2d/3d, code_gen ×5, code_validator,
  project_validator, byoa_analyzer.
- **Scritto ma NON nel registry:** `lib/tools/audio/index.ts` → `SunoElevenAudioPort`
  (bgm_gen/sfx_gen/voice_gen, con gating paywall). Esiste, non collegato.
- **DB asset CC0:** 2.488 audio_sfx, 1.238 sprite, 554 model_3d, 35 tileset,
  30 style_pack, 12 audio_mood, 40 LoRA.

---

## Mappatura (tool Sorceress → GameSmith)

| Tool Sorceress | Cosa fa (preciso) | GameSmith oggi | Mossa | Domanda Reddit |
|---|---|---|---|---|
| **Auto-Sprite v2** | prompt→char→video→sprite-sheet (PNG grid + JSON manifest Phaser/Godot/Unity) | ✅ `sprite_gen` (CC0 + FLUX paywall) | **Estendi**: aggiungi l'estrazione sprite-sheet da video + manifest JSON | "sprite gen", "consistent pose sheets" (alta) |
| **Tileset Forge** | AI art → tileset allineato a griglia, pronto per engine | ✅ `tilemap_populate` + `_autotile.ts` (bitmask 47-blob) | **Già coperto**, anzi superiore (autotiling da 1 tile) | "tileset", "pixel art" |
| **Material Forge** | 1 base color AI → deriva normal/roughness/metallic/AO/emissive (PBR) | ❌ assente | **Riempi** (per il 3D): tool `material_gen` che deriva i 5 map da 1 immagine. Deterministico (no AI per i derivati) | 3D cleanup (alta) |
| **3D Studio** | prompt→img→3D(GLB)→auto-rig humanoid→text-to-anim | ⚠️ 554 model CC0 + `model_3d_gen` paywall (da fare); no rigging | **Riempi progressivo**: gen 3D (Meshy/TRELLIS, già in [[reference_trellis2]]) poi auto-rig | "clean 3D models", "rigging" (alta) |
| **Audio Studio** (Music/SFX/Speech Gen) | Suno/ElevenLabs → musica/sfx/voce | ⚠️ **codice esiste** (`SunoElevenAudioPort`) ma NON nel registry; + 2.488 SFX CC0 inutilizzati | **Collega + raddoppia**: (1) wire i tool gen nel registry; (2) NUOVO tool audio **da catalogo CC0** (free, riusa asset_resolver) | "audio/music/sfx" (3.736 commenti) |
| **Background Remover** | rimuove sfondo da immagine | ❌ assente (ma sprite_gen ha già bg trasparente) | **Utility leggera** se serve per BYOA/upload | upload asset |
| **Slicer / Sprite Analyzer** | taglia uno sprite-sheet in frame, rileva griglia | ❌ assente | **Utility leggera** alto-valore: la gente lo fa a mano | "slicing manually" (citato) |
| **True Pixel / Pixel Snap** | post-process → pixel-perfect retro | ⚠️ parziale (style_pack pixel) | **Utility**: post-fx pixel-snap | "less AI / pixel art" |
| **Seamless Tile Gen** | tile ripetibile senza giunte | ⚠️ parziale (autotile) | **Utility** complementare | "tileset" |
| **3D-to-2D** | rende un 3D come sprite 2D | ❌ assente | **Nice-to-have** (billboard sprites da 554 model CC0!) | sprite 2D |
| **Voxel Studio** (gen + rig + walk) | voxel da prompt/img/3D, auto-rig, IK-walk | ❌ assente | **Skip day-1** (nicchia) | basso |
| **Procedural Walk** | auto-rig multi-gambe + IK su terreno | ❌ assente | **Skip** (avanzato) | basso |
| **Canvas** | editor immagini in-browser | ❌ assente | **Skip** (non è il nostro core) | basso |
| **Image Expander** | outpaint / estende immagine | ❌ assente | **Nice-to-have** | basso |
| **Publishing / Arcade / Marketplace** | pubblica + gioca + vende asset | ✅ feed + share + ownership (più forte) | **Già coperto** | "Steam/selling" (alta) |
| **WizardGenie** (game engine AI) | prompt→codice→preview giocabile, NO verifica | ✅✅ **il nostro CORE è superiore** (genera+verifica+5 motori+export+ownership) | **Non assorbire**: è il loro punto debole, il nostro forte | "vibecode full game" (alta) |

---

## Sintesi: cosa prendere, in ordine (incrociato coi dati Reddit)

**🟢 Alto valore / basso sforzo (le fondamenta ci sono):**
1. **Audio**: collega `SunoElevenAudioPort` al registry + crea `sfx_match`/`bgm_match`
   da catalogo CC0 (2.488 SFX inutilizzati). → giochi non più muti, free. *Tema #10 Reddit, 3.736 commenti.*
2. **Slicer + Sprite-sheet da video** (estende sprite_gen): la gente lo fa a mano,
   è citato esplicitamente. Basso sforzo.

**🟡 Medio (riempie un gap 3D reale):**
3. **Material Forge** → `material_gen` (1 img → 5 PBR map, derivati deterministici).
4. **3D gen + auto-rig** (Meshy/TRELLIS): più pesante, paywall. *"clean 3D models" molto chiesto.*

**🔴 Skip day-1:** Voxel, Procedural Walk, Canvas, Image Expander (nicchia/non-core).
**Mai assorbire:** WizardGenie (il loro game-gen debole è il nostro punto di forza).

**Framing dell'asset studio in GameSmith:** non un prodotto separato, ma una
**superficie "Studio"** dentro il flusso, dove gli asset (CC0-first) si rifiniscono
prima di entrare nel gioco. Coerente col claim anti-slop ("less AI style") che i
dati Reddit confermano essere la richiesta #1 sugli asset.

---

## Come funziona DAVVERO (dal video del creatore, transcript completo)

Fonte: tutorial "Street Fighter in 4h" del creatore stesso (canale gamemaker.academy
→ promozionale, non indipendente). Transcript in
`data/research/sorceress_streetfighter_transcript.txt`. Cosa rivela il workflow reale:

**La pipeline asset che funziona bene (da prendere):**
1. reference img → genera personaggio (con re-roll)
2. **green screen** richiesto nel prompt → poi **chroma key** (corridor key) per ritaglio pulito ("edges beautiful")
3. animazioni = **clip video di 1s** (Grok Imagine) con orientamento descritto preciso ("facing right, knees to chest")
4. Auto-Sprite estrae i frame dai video + **batch chroma key** su tutte le animazioni insieme
5. Sprite Analyzer → emette un **blob di codice** che descrive gli sprite sheet per l'agente coding

**Gli attriti reali (dove GameSmith vince):**
- Tanti passaggi MANUALI: bg dimenticato e rifatto, frame puliti a mano, auto-detect che sbaglia ("had to type that in manually"), "lock" di animazioni problematiche.
- Coding FRAGILE: *"the agent arbitrarily decided where to put a collision box"* → consiglio del creatore: *"instead of fighting the AI agent, get it to make you a file and manually tweak"*.
- **ZERO verifica**: testa a mano ("test if block mechanics are working"), nessuno smoke test / anti-break.
- **5+ tool orchestrati a mano dall'utente** (img → video Grok → Auto-Sprite → chroma → Analyzer → WizardGenie).

**Conclusione rafforzata:** anche nel SUO tutorial ottimale, il creatore litiga col tool
e fa lavoro manuale, senza verifica. Sorceress è forte sugli **asset** (la pipeline
char→video→sprite-sheet+chroma è davvero buona, vale prenderla), debole sul **fare-il-gioco**
(manuale, fragile, non verificato). GameSmith deve assorbire le capability asset dentro il
proprio flusso **automatico + verificato**, non replicare l'orchestrazione manuale.

### Conferma incrociata — 2° video (Contra, transcript `sorceress_contra_transcript.txt`)
Stesso identico workflow del primo video → **è IL workflow di Sorceress, non un caso**:
char → clip video 1s (Grok) → Auto-Sprite → chroma key → Sprite Analyzer (emette il
codice sprite-sheet) → WizardGenie ("come Cursor/VSCode"). Nuovi dettagli:
- **Chroma key è il vero forte**: cambia il colore bg per un keying migliore ("need a
  color not in this scene"); processing chroma anche su **GPU locale, gratis illimitato**.
- **Grok video a 1s** è il loro segreto per le animazioni ("other platforms don't let
  you set duration to 1s, great for game devs") — animazioni più lunghe → output a caso.
- ⚠️ **Attrito grave**: gli mancava un tool collision → **se l'è dovuto FAR COSTRUIRE
  dall'agente durante il tutorial** ("create a tool that saves a JSON of collision per
  sprite sheet"). Cioè il prodotto non copre il bisogno, lo bypassa col vibecoding.
- ⚠️ **Tileset Forge più debole del nostro**: AI tile (Nano Banana) → chroma → "detect
  tiles" → **piazzi a mano**, e ammette "some are not perfectly repeating tiles". Il
  nostro `_autotile.ts` (bitmask 47-blob da 1 tile) è superiore qui.

**Take finale:** le 2 capability asset da rubare con priorità sono (1) la **pipeline
animazione = clip video 1s → frame → chroma key batch** (genuinamente buona, risolve
"sprite coerenti" che i dati Reddit chiedono), e (2) **collision-box-from-sprite-sheet**
(JSON di hitbox per frame) — gli serviva così tanto da costruirselo live. Entrambe si
infilano nel nostro flusso verificato senza l'orchestrazione manuale.
