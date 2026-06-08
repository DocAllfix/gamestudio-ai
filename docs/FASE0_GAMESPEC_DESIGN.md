# FASE 0 — GameSpec + EngineComposer (su carta)

> Deliverable di FASE 0 del piano `docs/IMPLEMENTATION_PLAN.md`. Zero rendering.
> Tre artefatti: (1) il **GameSpec** (DATI, discriminated union per archetipo),
> (2) la porta **EngineComposer** (~10 primitive), (3) lo **schema asset⟷GameSpec**
> co-disegnato. Più il **filtro anti-leak**: per ogni primitiva lo pseudo-codice
> Godot E Phaser. Se una primitiva non si scrive in entrambi senza torcere il
> GameSpec → lo schema è sbagliato, si aggiusta qui sul foglio (gratis), non in FASE 2.
>
> Contratti reali: `lib/contracts/game-spec.contract.ts`,
> `lib/contracts/engine-composer.contract.ts`. Questo doc è la loro motivazione +
> la tabella di verifica (ogni campo → costrutto Godot + costrutto Phaser).

---

## 0. I due strati (perché N×P+K e non N×M)

- **Strato A — Archetipo di scena** (engine-agnostic, finito): una *ricetta* su
  primitive. Ogni archetipo è uno **schema GameSpec** tipizzato. 6 archetipi → 14 generi.
- **Strato B — EngineComposer (porta)**: ~10 primitive che **ogni motore implementa
  una volta**. Il driver `composeScene(spec, composer)` dispaccia per `archetype` e
  chiama le primitive in ordine. Costo: N motori × P primitive + K archetipi.

Il GameSpec **non è codice**: è il dato che il compositore deterministico consuma.
La varianza LLM è confinata a D.1/D.2 (intent+design) e all'opzionale
`mechanics_delta_gen`; la **messa in scena** è meccanica.

**Decisione architetturale chiave:** il composer emette **scena dichiarativa**, non
codice che costruisce nodi a runtime. Godot → `.tscn` (+ un controller "gold"
minimale per la fisica, identico a `_platformer-physics.ts`); Phaser → `scene.js`
derivato meccanicamente dal GameSpec. Questo è l'opposto del `_godot-fallback.ts`
attuale (nodi creati in `_ready()` ogni run) — ed è il senso della svolta
"l'LLM produce dati, non rendering".

---

## 1. Mapping generi → archetipi (deterministico, in `game-spec.contract.ts`)

| Archetipo | Generi (GenreEnum) | Primitive 2D condivise | Stato FASE 0 |
|---|---|---|---|
| `side_scroller_platform` | `hardcore_platformer`, `metroidvania` | tutte | **schema completo** |
| `top_down_grid` | `jrpg`, `roguelike`, `retro_8bit`, `social_sim` | tile/camera/player/entity/hud | scheletro |
| `arena_2d` | `bullet_hell`, `browser_arcade`, `multiplayer_arena` | camera/player/entity/hud | scheletro |
| `puzzle_grid` | `mobile_puzzle` | tile/hud (no fisica) | scheletro |
| `scene_3d` | `threejs_showcase`, `stride_action` | tronco separato (3D) | scheletro |
| `non_spatial_ui` | `visual_novel`, `card_game` | tronco separato (UI, LLM-led) | scheletro |

I primi 4 condividono le primitive 2D. `scene_3d` e `non_spatial_ui` sono tronchi
separati (dopo). `design.ts` (FASE 2) vieta combo assurde (es. platformer+threejs).
**FASE 0 + FASE 2 iniziale lavorano solo su `side_scroller_platform`** su Godot+Phaser.

---

## 2. GameSpec `side_scroller_platform` — i blocchi

Ogni blocco mappa 1:1 su una primitiva. (Forma esatta in `game-spec.contract.ts`.)

| Blocco GameSpec | Campi (sintesi) | Primitiva che lo consuma |
|---|---|---|
| `meta` | `project_id, plan_version, engine, style_pack_id` | `beginScene` |
| `world` | `width_tiles, height_tiles, tile_px, tmj_path, tileset_slot` | `addTileMap` |
| `physics` | `gravity, jump_velocity, move_speed` (= `PhysicsProfile`) | `addPlayer` |
| `player` | `spawn_tile{x,y}, asset_slot, hitbox_px{w,h}, facing` | `addPlayer` |
| `entities[]` | `id, kind, tile{x,y}, asset_slot, patrol_tiles?` | `addEntity` |
| `camera` | `zoom, deadzone_px{x,y}, follow, clamp_to_world` | `addCamera` |
| `parallax[]` | `asset_slot, scroll_scale{x,y}, z` | `addParallax` |
| `background` | `asset_slot?, fill_mode` | `addBackground` |
| `hud` | `elements[]: {type, binds_to?}` | `addHud` |
| `goal` | `type, exit_tile?, target_count?, seconds?` | `addGoal` |
| `mechanics` | `flags[], delta_script_path?` | `addPlayer` (+ delta) |
| `asset_slots[]` | tabella slot→asset arricchito (§4) | tutte (via `resolveSlot`) |

Le coordinate nel GameSpec sono in **tile** (`{x,y}` cella); il composer moltiplica
per `tile_px` per ottenere px/world-unit. Entrambi i motori sono Y-down, px →
nessuna conversione di sistema. `hitbox_px`/`deadzone_px` sono già in px.

---

## 3. Le ~10 primitive — filtro anti-leak (Godot `.tscn` ‖ Phaser `scene.js`)

Pseudo-codice, non implementazione. Serve a provare che **ogni campo ha una
traduzione concreta in entrambi i motori**. `resolveSlot(id)` legge `asset_slots`.

### P1 — `beginScene(spec)`
Root scene + config globale (gravità, dimensione viewport, filtro pixel-art).
```
GODOT  project.godot: run/main_scene="res://main.tscn"; window {600,360}; stretch=canvas_items
       main.tscn: [gd_scene format=3]  [node name="Main" type="Node2D"]
       (gravità NON globale: il controller player usa physics.gravity)
PHASER new Phaser.Game({ type: AUTO, width, height, pixelArt: slot.pixel_art,
         physics:{ default:'arcade', arcade:{ gravity:{ y: spec.physics.gravity } } },
         scene: MainScene })
```

### P2 — `addBackground(background)`
Sfondo schermo-fisso. Mai il "void" scuro: se manca l'asset → gradiente.
```
GODOT  CanvasLayer(layer=-100) > Sprite2D(texture=resolveSlot(bg) | GradientTexture2D)
       centered=false; scale = viewport / tex_size   (fill_mode=stretch_cover)
PHASER fill_mode=stretch: this.add.image(0,0,'bg').setOrigin(0).setScrollFactor(0).setDisplaySize(w,h)
       fill_mode=tile:    this.add.tileSprite(0,0,w,h,'bg').setScrollFactor(0)
       gradient_fallback: this.add.graphics().fillGradientStyle(...).fillRect(0,0,w,h)
```

### P3 — `addParallax(layers[])`
Strati che scrollano a frazione della camera. (`scroll_scale.x<1` = sfondo lontano.)
```
GODOT  ParallaxBackground > per layer: ParallaxLayer(motion_scale=scroll_scale) > Sprite2D(resolveSlot)
       (auto-scrolla con la Camera2D — dichiarativo)
PHASER per layer: const t=this.add.tileSprite(0,0,w,h,slot).setScrollFactor(0)
       update(): t.tilePositionX = cam.scrollX * layer.scroll_scale.x   (imperativo, ma stesso dato)
```
> Leak noto (non di schema): Godot fa parallax dichiarativo, Phaser imperativo in
> `update()`. Il campo `scroll_scale` traduce in entrambi → schema OK.

### P4 — `addTileMap(world)`
Il `.tmj` (engine-agnostic) diventa il TileMap nativo. Tileset da `tileset_slot`.
```
GODOT  build-time: vnen YATI (MIT) importa world.tmj_path → TileSet .tres + TileMapLayer
       main.tscn: [node type="TileMapLayer"] tile_map_data=<da .tmj data[]>; tile_set=ExtResource
PHASER preload: this.load.tilemapTiledJSON('map', world.tmj_path); this.load.image(tileset_slot,...)
       create:  const m=this.make.tilemap({key:'map'}); const ts=m.addTilesetImage(name, tileset_slot)
                const ground=m.createLayer('ground', ts); ground.setCollisionByExclusion([0])
```
> Leak noto: Godot richiede uno **step di import build-time** (YATI) del `.tmj`;
> Phaser lo carica nativo. Entrambi consumano lo STESSO `.tmj` → schema OK. Da
> ricordare in FASE 2 (la pipeline build Godot deve eseguire YATI).

### P5 — `addPlayer(player, physics)`
CharacterBody/sprite con fisica = `PhysicsProfile`. Il controller "gold" è UNICO,
identico ai numeri di `_platformer-physics.ts` (il livello assume ciò che il
codice fa).
```
GODOT  CharacterBody2D{position=spawn_tile*tile_px}
         > CollisionShape2D(RectangleShape2D=hitbox_px)
         > AnimatedSprite2D(SpriteFrames da slot.frame: hframes/vframes, fps)
         > Camera2D (vedi P7)
       controller.gd (gold): velocity.y += physics.gravity*dt; on jump& is_on_floor: velocity.y=-jump_velocity
                             velocity.x = input * physics.move_speed; move_and_slide()
PHASER const p=this.physics.add.sprite(x,y,slot).setSize(hitbox.w,hitbox.h)
       this.physics.add.collider(p, ground)
       update(): p.setVelocityX(input*move_speed); if(cursors.up && p.body.blocked.down) p.setVelocityY(-jump_velocity)
       anims da slot.frame: this.anims.create({key, frames: generateFrameNames(...), frameRate: frame.fps, repeat:-1})
```

### P6 — `addEntity(entity)` (loop su `entities[]`, dispaccia per `kind`)
```
GODOT  enemy:  CharacterBody2D + patrol.gd (patrol_tiles) ; Area2D.body_entered(player)->hit
       pickup: Area2D + CollisionShape2D ; body_entered(player)-> grant + queue_free()
       hazard: Area2D ; body_entered(player)-> damage
       npc:    Area2D + prompt (interazione)
PHASER enemy:  this.physics.add.sprite in group 'enemies'; this.physics.add.overlap(player,enemies,onHit)
       pickup: this.physics.add.overlap(player, pickup, ()=> { grant(); pickup.destroy() })
       hazard: this.physics.add.overlap(player, hazard, onDamage)
       npc:    zone + key 'E' prompt
```

### P7 — `addCamera(camera, world)`
```
GODOT  Camera2D (figlia del player): zoom=Vector2(camera.zoom); drag_*_margin=deadzone (enabled)
       limit_left/top=0; limit_right=world.width*tile_px; limit_bottom=world.height*tile_px; make_current()
PHASER const c=this.cameras.main; c.startFollow(player, true, lerp, lerp); c.setZoom(camera.zoom)
       c.setDeadzone(deadzone.x, deadzone.y); if(clamp_to_world) c.setBounds(0,0,world.width*tile_px, world.height*tile_px)
```

### P8 — `addHud(hud)`
```
GODOT  CanvasLayer > per element: Label/TextureRect ; uno script aggiorna il testo dal valore (binds_to)
PHASER per element: const t=this.add.text(x,y,'',style).setScrollFactor(0); aggiornato negli handler (binds_to)
```

### P9 — `addGoal(goal)` (dispaccia per `goal.type`)
```
GODOT  reach_exit:   Area2D@exit_tile.body_entered(player)-> win()
       collect_all:  on grant: if(count==target_count) win()
       survive_time: Timer(seconds) timeout-> win()
       defeat_all:   on enemy_free: if(enemies.is_empty()) win()
PHASER reach_exit:   const z=this.add.zone(...); this.physics.add.overlap(player,z, win)
       collect_all:  if(++count===target_count) win()
       survive_time: this.time.delayedCall(seconds*1000, win)
       defeat_all:   if(enemies.countActive()===0) win()
```

### P10 — `finalize() → ComposedScene`
Serializza l'accumulatore nei file nativi del motore.
```
GODOT  files: project.godot, main.tscn, controller.gd, *.tres ; entry_scene="res://main.tscn"
PHASER files: index.html, main.js (boot), scene.js (preload/create/update) ; entry_scene="index.html"
```

> **`resolveSlot(id)`** non è una primitiva di scena: è l'helper trasversale che le
> primitive usano per ottenere texture/atlas + metadati arricchiti (§4). Lo tiene
> il composer (caricato in `beginScene`), così le altre 9 prendono solo il frammento.

---

## 4. Schema asset ⟷ GameSpec (co-disegnato)

Il composer **non può** mettere in scena asset coerenti senza metadati arricchiti.
Questi campi sono il contratto tra lo **Studio** (FASE 1, li PRODUCE) e il **composer**
(li CONSUMA). Vivono su `AssetSlot` dentro il GameSpec (superficie del contratto):

| Campo enriched | Tipo | Chi lo produce (FASE 1) | Chi lo consuma | Godot ‖ Phaser |
|---|---|---|---|---|
| `tile_size` | `int\|null` | tile-size detector (divisori+autocorr) | `addTileMap` | `tilewidth`/`tileheight` ‖ `addTilesetImage(tw,th)` |
| `frame` `{w,h,count,fps,anchor}` | obj\|null | frame analyzer (connected-comp) | `addPlayer`/`addEntity` | `SpriteFrames`/hframes ‖ `anims.create({frameRate})` |
| `palette_hex` | `string[]` | palette extractor (k-means) | recolor/coerenza | LUT recolor ‖ tint/coerenza |
| `pixel_art` | `bool` | detector | `beginScene`/texture | `texture_filter=NEAREST` ‖ `pixelArt:true` |
| `tile_roles` | `record\|null` | (FASE 4: gid→role) | collisioni/semantica | collision polygons ‖ `setCollisionByProperty` |

**Dove atterrano fuori dal GameSpec (follow-up, NON FASE 0):**
- estendere `MatchedAsset` (`lib/tools/asset-resolver/index.ts`) con questi campi —
  oggi ha solo `id/url/license/asset_type/quality/similarity`. *(FASE 1)*
- colonne enriched su `asset_library_index` (nuova migration `006`, claim col numero) —
  popolate a ingestione dai detector. *(FASE 1)*

In FASE 0 il `binding` di uno slot riusa `AssetBindingSchema` già esistente in
`game-plan.contract.ts` (`catalog | generative | user_prepared`); `binding=null`
significa **placeholder** (lo slot rende un segnaposto coerente, mai un buco).

---

## 5. Tabella di verifica FASE 0 (il gate: ogni campo → 2 motori)

Se una riga non si compila in entrambe le colonne, lo schema è sbagliato.

| Campo GameSpec | Godot | Phaser |
|---|---|---|
| `physics.gravity/jump_velocity/move_speed` | controller.gd (px/s, px/s²) | `arcade.gravity.y` + `setVelocity` |
| `world.tile_px`, `tmj_path` | YATI import → TileMapLayer | `load.tilemapTiledJSON` |
| `player.spawn_tile` | `position = tile*tile_px` | `physics.add.sprite(tile*tile_px)` |
| `player.hitbox_px` | `RectangleShape2D.size` | `body.setSize` |
| `camera.zoom` | `Camera2D.zoom` | `cameras.main.setZoom` |
| `camera.deadzone_px` | `drag_*_margin` | `setDeadzone` |
| `camera.clamp_to_world` | `limit_*` | `setBounds` |
| `parallax[].scroll_scale` | `ParallaxLayer.motion_scale` | `tilePositionX = scrollX*scale` |
| `background.fill_mode` | Sprite2D scale / GradientTexture2D | `setDisplaySize`/`tileSprite`/graphics gradient |
| `entities[].kind` | CharacterBody2D / Area2D | physics group / overlap |
| `entities[].patrol_tiles` | patrol.gd | tween/velocity flip |
| `hud.elements[]` | CanvasLayer + Label | `add.text().setScrollFactor(0)` |
| `goal.type` | Area2D / Timer / counter | zone overlap / delayedCall / counter |
| `asset_slots[].frame` | SpriteFrames | `anims.create` |
| `asset_slots[].tile_size` | TileSet tile size | `addTilesetImage` |
| `mechanics.flags[]` | controller flags | update() flags |

**Esito:** tutti i campi del GameSpec `side_scroller_platform` hanno una traduzione
concreta in Godot E Phaser. Due leak **non di schema** (parallax imperativo in Phaser;
import YATI build-time in Godot) annotati — sono dettagli di FASE 2, non difetti del
contratto. → **Gate FASE 0 superato sul foglio.**

---

## 6. Cosa NON è in FASE 0 (per disciplina)

- Nessun rendering, nessun adapter implementato (è FASE 2).
- `top_down_grid`/`arena_2d`/`puzzle_grid` solo come **scheletro** (discriminatore +
  `meta`); si completano quando si espande orizzontale in FASE 2.
- `scene_3d`/`non_spatial_ui` = tronchi separati, scheletro minimo.
- Estensione `MatchedAsset` + migration `006` enriched = **FASE 1** (Studio).
- Il nodo `compose_gamespec` nel DAG + spegnimento `code_gen` spaziale = **FASE 3**.
