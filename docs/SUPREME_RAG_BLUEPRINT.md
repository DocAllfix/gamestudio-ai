# SUPREME KNOWLEDGE BASE & RAG INGESTION BLUEPRINT
## Pre-Alpha Data Engineering — Game Studio AI

**Versione**: 1.0  
**Data**: 18 maggio 2026  
**Scopo**: Costruire il database vettoriale di conoscenza videoludica prima di scrivere una riga di prodotto  
**Vincolo operativo**: 1 sviluppatore, Claude Code, Supabase pgvector, DeepSeek Flash per classificazione  
**Orizzonte**: 3 settimane → knowledge base production-ready per 2 engine di lancio + 6 engine secondari  

---

# ═══════════════════════════════════════════════════════
# §01 — LA TASSONOMIA DEL DATASET
# ═══════════════════════════════════════════════════════

## 1.1 Principio fondamentale

Un videogioco è composto da sistemi interconnessi. Ogni sistema ha una funzione precisa, è implementato con pattern riconoscibili, e ha parametri numerici che determinano il "feel" del gioco. La tassonomia deve catturare tutti e tre i livelli: il **sistema** (cosa fa), il **pattern** (come è implementato), e i **parametri** (con quali valori).

Non esiste un gioco senza almeno 7 di queste categorie. Un gioco eccellente ne implementa 12-14 con maestria.

## 1.2 Le 27 categorie tassonomiche

La tassonomia è organizzata in 5 domini, 27 categorie, e 140+ sotto-categorie. Ogni categoria corrisponde a un tipo di chunk nella knowledge base.

---

### DOMINIO A — CORE GAMEPLAY SYSTEMS

Questi sono i sistemi che il giocatore tocca direttamente. Se uno di questi è rotto, il gioco è rotto.

---

#### A01 — PLAYER CONTROLLER

Il sistema che traduce l'input del giocatore in movimento del personaggio. È il singolo pezzo di codice più importante in qualsiasi action game.

**Sotto-categorie:**

| ID | Sotto-categoria | Cosa cattura | Perché conta |
|---|---|---|---|
| A01.01 | `horizontal_movement` | Accelerazione, decelerazione, velocità massima, friction a terra vs in aria | Un movimento con acceleration curve si "sente" professionale; uno con velocità istantanea si sente amatoriale |
| A01.02 | `jump_system` | Forza salto, gravità variabile (jump cut), coyote time, jump buffering, multi-jump | Il salto è l'interazione più frequente in un platformer. Coyote time e buffer separano i giochi amatoriali dai professionali |
| A01.03 | `dash_mechanic` | Velocità dash, durata, cooldown, i-frames durante il dash, direzione (8-dir, 4-dir, horizontal only) | Presente in metroidvania, action, roguelike. Meccanica di skill expression |
| A01.04 | `wall_mechanics` | Wall slide (velocità di scivolamento), wall jump (forza, direzione, buffer), wall cling (durata) | Meccanica definitoria dei metroidvania. Implementazione complessa con molti edge case |
| A01.05 | `climb_swim_fly` | Arrampicata su superfici, nuoto (gravità ridotta, ossigeno), volo (fuel/stamina) | Movimento alternativo che cambia il level design |
| A01.06 | `crouch_slide` | Abbassarsi, scivolare (velocity decay, hitbox ridotta), prone | Cambio di hitbox del player durante il gameplay |
| A01.07 | `input_handling` | Mappatura input, dead zone analogico, input buffering globale, remapping | Come il gioco legge i controlli. Critico per il feel |
| A01.08 | `animation_binding` | Sincronizzazione stato → animazione, blend tree, animation events che triggerano gameplay | Il collante tra logica e visuale. Se l'animazione non è sincronizzata, il gioco si sente "disconnesso" |

**Parametri numerici da estrarre (tabella `game_parameters`):**

```json
{
  "parameter_group": "player_physics",
  "parameters": {
    "gravity": "float (pixels/s² o unità engine)",
    "max_fall_speed": "float",
    "jump_force": "float (negativo in Y-down)",
    "jump_cut_multiplier": "float (0.0-1.0, quanto si riduce il salto al rilascio)",
    "variable_jump_gravity_multiplier": "float (gravità extra in discesa)",
    "run_speed": "float",
    "acceleration_ground": "float",
    "deceleration_ground": "float",
    "acceleration_air": "float",
    "deceleration_air": "float",
    "coyote_time_frames": "int (o millisecondi)",
    "jump_buffer_frames": "int (o millisecondi)",
    "dash_speed": "float",
    "dash_duration_ms": "int",
    "dash_cooldown_ms": "int",
    "wall_slide_speed": "float",
    "wall_jump_force_x": "float",
    "wall_jump_force_y": "float"
  }
}
```

---

#### A02 — CHARACTER STATE MACHINE

Il sistema che gestisce gli stati del personaggio e le transizioni tra essi.

**Sotto-categorie:**

| ID | Sotto-categoria | Cosa cattura |
|---|---|---|
| A02.01 | `state_enum` | Definizione di tutti gli stati possibili (idle, run, jump, fall, dash, attack, hurt, die, climb, swim, wall_slide, crouch...) |
| A02.02 | `transition_matrix` | Quale stato può andare a quale. Da `hurt` non puoi `attack`. Da `dash` sei in `i-frames`. Da `die` non puoi fare nulla |
| A02.03 | `state_enter_exit` | Logica eseguita quando entri/esci da uno stato (es: entra in `dash` → disabilita gravità, esci → riabilita) |
| A02.04 | `state_timers` | Durata massima di ogni stato temporaneo (invulnerabilità, dash, stun, knockback) |
| A02.05 | `hierarchical_states` | Stati con sotto-stati (es: `combat` ha sotto-stati `attack_1`, `attack_2`, `combo_finisher`) |
| A02.06 | `animation_state_sync` | Come lo stato della logica si sincronizza con l'AnimationPlayer/AnimationTree |

---

#### A03 — COMBAT SYSTEM

Tutto ciò che riguarda fare e ricevere danno.

**Sotto-categorie:**

| ID | Sotto-categoria | Cosa cattura |
|---|---|---|
| A03.01 | `hitbox_hurtbox` | Separazione tra area che colpisce (hitbox) e area che viene colpita (hurtbox). Dimensioni, offset, durata attiva per frame |
| A03.02 | `damage_calculation` | Formula: base_damage × multiplier ± variance. Tipi di danno (fisico, elementale, percentuale). Resistenze/debolezze |
| A03.03 | `knockback_system` | Direzione, forza, durata del knockback. Curve di decadimento. Knockback resistance |
| A03.04 | `invincibility_frames` | Durata i-frames dopo danno. Visualizzazione (flash opacity, shader blink). i-frames durante dash/dodge |
| A03.05 | `combo_system` | Catene di attacchi con timing window. Input sequenziali. Cancellazioni (animation cancel, dash cancel) |
| A03.06 | `projectile_system` | Spawn, velocità, lifetime, piercing, homing, pattern (spread, burst, sine wave) |
| A03.07 | `health_management` | HP correnti/massimi, regen, shield/armor layer separati, overkill handling, death trigger |
| A03.08 | `damage_feedback` | Screen shake, hit stop (freeze frame), flash colorato, particle burst, suono d'impatto. Il "juice" |
| A03.09 | `melee_weapons` | Tipi di armi (spada, lancia, martello), swing arc, range, speed, damage per tipo |
| A03.10 | `ranged_weapons` | Armi a distanza, munizioni, reload, spread, recoil |

**Parametri numerici:**

```json
{
  "parameter_group": "combat_stats",
  "parameters": {
    "player_base_hp": "int",
    "player_base_damage": "int",
    "i_frames_duration_ms": "int",
    "knockback_force": "float",
    "knockback_duration_ms": "int",
    "hit_stop_duration_frames": "int (tipicamente 2-5)",
    "screen_shake_intensity": "float",
    "screen_shake_duration_ms": "int",
    "combo_window_ms": "int",
    "attack_startup_frames": "int",
    "attack_active_frames": "int",
    "attack_recovery_frames": "int"
  }
}
```

---

#### A04 — ENEMY AI

Come i nemici si comportano.

**Sotto-categorie:**

| ID | Sotto-categoria | Cosa cattura |
|---|---|---|
| A04.01 | `patrol_behaviour` | Cammina tra waypoint (A→B→A), random wander, idle con timer |
| A04.02 | `detection_system` | Raycast, Area2D cone/circle, line-of-sight con occlusione, aggro range, de-aggro range |
| A04.03 | `chase_behaviour` | Inseguimento diretto, pathfinding (A*), prediction (anticipa la posizione del player) |
| A04.04 | `attack_patterns` | Melee lunge, ranged projectile, AoE, charge attack con telegraph, grab |
| A04.05 | `telegraph_system` | Come il nemico comunica l'attacco imminente: animazione di windup, flash colorato, suono, particelle, linea di mira |
| A04.06 | `flee_behaviour` | Fuga a vita bassa, kiting (attacco a distanza + fuga se player si avvicina) |
| A04.07 | `enemy_state_machine` | Stati del nemico (idle, patrol, alert, chase, attack, hurt, die) con transizioni |
| A04.08 | `boss_multi_phase` | Boss con fasi (HP threshold → cambio pattern). Nuovi attacchi per fase, enrage, adds spawn |
| A04.09 | `boss_telegraph` | Telegraph specifici dei boss: ground indicator, laser sight, charging animation, screen-wide warning |
| A04.10 | `group_behaviour` | Nemici che coordinano: flanking, one-attacks-while-others-wait, pack behaviour |
| A04.11 | `spawner_system` | Wave spawning, spawn point selection, difficulty scaling (più nemici / nemici più forti nel tempo) |

**Parametri numerici:**

```json
{
  "parameter_group": "enemy_stats",
  "parameters": {
    "enemy_type": "string",
    "hp": "int",
    "damage": "int",
    "move_speed": "float",
    "detection_range": "float",
    "deaggro_range": "float",
    "attack_range": "float",
    "attack_cooldown_ms": "int",
    "telegraph_duration_ms": "int",
    "patrol_wait_time_ms": "int",
    "xp_reward": "int",
    "drop_table": "json"
  }
}
```

---

#### A05 — CAMERA SYSTEM

**Sotto-categorie:**

| ID | Sotto-categoria | Cosa cattura |
|---|---|---|
| A05.01 | `follow_smoothing` | Lerp/smoothing del follow (parametro di smoothness). Snap vs smooth |
| A05.02 | `dead_zone` | Area in cui il player si muove senza che la camera lo segua |
| A05.03 | `look_ahead` | Camera leggermente avanti nella direzione del movimento |
| A05.04 | `camera_limits` | Bordi del livello oltre i quali la camera non va |
| A05.05 | `screen_shake` | Funzione shake: intensità, durata, decadimento (linear, exponential), trauma system |
| A05.06 | `zoom_dynamic` | Zoom in durante dialoghi/boss, zoom out durante esplorazione |
| A05.07 | `camera_trigger_zones` | Zone che cambiano il comportamento della camera (lock orizzontale, zoom, pan verso punto di interesse) |
| A05.08 | `split_screen` | Camera per multiplayer locale (split dinamico, zoom out per contenere tutti) |

---

### DOMINIO B — WORLD & LEVEL SYSTEMS

Questi sistemi definiscono lo spazio in cui il gioco avviene.

---

#### B01 — LEVEL STRUCTURE

| ID | Sotto-categoria | Cosa cattura |
|---|---|---|
| B01.01 | `tilemap_setup` | Layer di tilemap (ground, walls, platforms, decorations, foreground), tile size, collision shapes per tile |
| B01.02 | `scene_hierarchy` | Come è organizzata la scena del livello: nodi root, gruppi funzionali (Terrain, Enemies, Pickups, Triggers) |
| B01.03 | `spawn_points` | Posizionamento di: player start, enemy spawns, item spawns, checkpoint positions |
| B01.04 | `level_transitions` | Come il giocatore passa tra livelli/zone: door, portal, edge-of-screen, loading screen |
| B01.05 | `parallax_background` | Layer di background con velocità diverse per effetto di profondità |
| B01.06 | `secret_areas` | Zone nascoste: muri falsi, percorsi fuori schermo, reward rooms |
| B01.07 | `environmental_hazards` | Spikes, lava, acqua che fa danno, zone di veleno, piattaforme che cadono, piattaforme che si muovono |
| B01.08 | `destructible_environment` | Muri distruttibili, casse, oggetti rompibili con loot |

---

#### B02 — PROCEDURAL GENERATION

| ID | Sotto-categoria | Cosa cattura |
|---|---|---|
| B02.01 | `wfc_tilemap` | Wave Function Collapse per generazione tilemap coerente |
| B02.02 | `bsp_dungeon` | Binary Space Partition per dungeon con stanze e corridoi |
| B02.03 | `cellular_automata` | Automi cellulari per caverne organiche |
| B02.04 | `random_walker` | Drunkard's walk per percorsi labirintici |
| B02.05 | `noise_terrain` | Perlin/Simplex noise per heightmap e biomi |
| B02.06 | `room_templates` | Stanze pre-disegnate assemblate proceduralmente |
| B02.07 | `entity_placement_rules` | Regole per posizionamento nemici/item su mappa generata (min distance, cluster, difficulty gradient) |

---

#### B03 — PHYSICS & COLLISION SETUP

| ID | Sotto-categoria | Cosa cattura |
|---|---|---|
| B03.01 | `collision_layers_matrix` | Mappatura layer/mask: chi collide con chi. Player layer, enemy layer, projectile_player, projectile_enemy, environment, trigger, pickup |
| B03.02 | `physics_materials` | Bounce, friction, density per tipo di superficie |
| B03.03 | `one_way_platforms` | Piattaforme attraversabili dal basso |
| B03.04 | `moving_platforms` | Piattaforme che si muovono (path follow, ping-pong, rotanti) con gestione del player attachment |
| B03.05 | `trigger_areas` | Zone che attivano eventi: cutscene, spawn, dialogue, ambush, checkpoint |
| B03.06 | `raycasting_usage` | Raycast per ground detection, wall detection, ledge detection, line of sight |

---

#### B04 — NAVIGATION & PATHFINDING

| ID | Sotto-categoria | Cosa cattura |
|---|---|---|
| B04.01 | `navigation_mesh` | Setup NavigationRegion2D/3D, agent radius, avoidance |
| B04.02 | `astar_grid` | A* su griglia per giochi tile-based |
| B04.03 | `waypoint_system` | Punti di navigazione pre-posizionati per patrol routes |
| B04.04 | `steering_behaviours` | Seek, flee, arrive, wander, separation, alignment, cohesion |

---

### DOMINIO C — META-GAME SYSTEMS

Sistemi che operano al di sopra del gameplay momento-per-momento.

---

#### C01 — PROGRESSION & ECONOMY

| ID | Sotto-categoria | Cosa cattura |
|---|---|---|
| C01.01 | `xp_leveling` | Formula XP per livello (lineare, esponenziale, custom curve). Stat gains per livello |
| C01.02 | `skill_tree` | Albero/grafo delle abilità. Nodi, connessioni, costi, prerequisiti |
| C01.03 | `currency_system` | Monete, materiali, token premium. Come si guadagnano e spendono |
| C01.04 | `loot_drop_tables` | Tabelle di drop: item, probabilità, rarità, drop condizionali |
| C01.05 | `crafting_system` | Ricette: input items → output item. Categorie, discovery, upgrade |
| C01.06 | `achievement_system` | Condizioni, tracking progressi, ricompense, display |
| C01.07 | `difficulty_scaling` | Come la difficoltà scala: enemy HP/DMG multiplier per zona/livello, adaptive difficulty |
| C01.08 | `unlock_gating` | Aree/feature bloccate finché non si ottiene X (ability, item, quest completion) |

**Parametri numerici:**

```json
{
  "parameter_group": "progression_economy",
  "parameters": {
    "xp_formula": "string (es: 100 * level^1.5)",
    "base_xp_per_kill": "int",
    "gold_per_kill_range": "[min, max]",
    "hp_per_level": "int",
    "damage_per_level": "float",
    "shop_price_multiplier_per_zone": "float",
    "rare_drop_chance": "float (0.0-1.0)",
    "boss_drop_guaranteed": "boolean"
  }
}
```

---

#### C02 — INVENTORY & ITEMS

| ID | Sotto-categoria | Cosa cattura |
|---|---|---|
| C02.01 | `item_data_structure` | Schema item: id, name, type, rarity, stats, description, icon_path, stackable, max_stack |
| C02.02 | `inventory_container` | Array/grid inventory. Slot limit. Weight system vs slot system |
| C02.03 | `equipment_system` | Slot equipaggiamento (weapon, armor, accessory). Stat modification on equip/unequip |
| C02.04 | `consumable_system` | Pozioni, cibo, buff temporanei. Cooldown, stack, effetto nel tempo |
| C02.05 | `item_pickup` | Come il player raccoglie item: walk-over, press-to-pickup, magnet range |
| C02.06 | `item_tooltips` | Display info on hover/select: nome, descrizione, stat comparison |

---

#### C03 — DIALOGUE & NARRATIVE

| ID | Sotto-categoria | Cosa cattura |
|---|---|---|
| C03.01 | `dialogue_format` | ink, Yarn, JSON custom, Dialogic resource. Struttura dati del dialogo |
| C03.02 | `dialogue_ui` | Textbox, typewriter effect, portrait, nome NPC, indicatore "continua" |
| C03.03 | `branching_choices` | Menu di scelta, come le scelte modificano variabili di stato |
| C03.04 | `conditional_dialogue` | Dialoghi che cambiano in base a flag/variabili (quest completata, item posseduto, relazione) |
| C03.05 | `cutscene_system` | Sequenze scriptate: camera movement, character animation, dialogue sequenziale, fade in/out |
| C03.06 | `quest_system` | Quest log: obiettivi, tracking, stati (available, active, completed, failed), ricompense |
| C03.07 | `lore_collectibles` | Note, diari, terminali che sbloccano lore. Database consultabile |

---

#### C04 — SAVE/LOAD SYSTEM

| ID | Sotto-categoria | Cosa cattura |
|---|---|---|
| C04.01 | `save_data_structure` | Cosa viene salvato: posizione, HP, inventario, quest state, flags, settings |
| C04.02 | `serialization` | Come i dati vengono serializzati: JSON, ConfigFile (Godot), binary |
| C04.03 | `save_trigger` | Quando si salva: checkpoint, manual, auto-save con intervallo |
| C04.04 | `multiple_slots` | Gestione slot multipli con preview (playtime, location, screenshot) |
| C04.05 | `version_migration` | Come gestire save da versione precedente del gioco |

---

### DOMINIO D — PRESENTATION SYSTEMS

Sistemi che il giocatore vede e sente.

---

#### D01 — UI/UX PATTERNS

| ID | Sotto-categoria | Cosa cattura |
|---|---|---|
| D01.01 | `main_menu` | Layout: New Game, Continue, Settings, Quit. Transizioni, background animato |
| D01.02 | `hud_display` | Vita, mana, minimap, score, ammo, quest indicator. Layout e aggiornamento real-time |
| D01.03 | `pause_menu` | Overlay, resume/settings/quit. Freeze del gameplay |
| D01.04 | `game_over_screen` | Death screen: retry, return to menu, stats della run |
| D01.05 | `settings_menu` | Volume (master, bgm, sfx), risoluzione, fullscreen, keybinding, accessibilità |
| D01.06 | `inventory_ui` | Grid/list display, drag&drop, tooltip, equipment comparison |
| D01.07 | `dialogue_ui_integration` | Come la dialogue box si integra col gameplay (pause o no, positioning) |
| D01.08 | `notification_toast` | Messaggi temporanei: "Achievement Unlocked", "New Quest", "Item Acquired" |
| D01.09 | `screen_transitions` | Fade, wipe, dissolve, iris tra scene/livelli |
| D01.10 | `damage_numbers` | Numeri flottanti sopra i nemici quando colpiti. Colore per tipo, size per crit |
| D01.11 | `health_bar_enemy` | Barra HP sopra i nemici. Appear on hit, fade after delay |
| D01.12 | `minimap` | Minimap: player dot, explored/unexplored, enemy dots, poi markers |

---

#### D02 — AUDIO INTEGRATION

| ID | Sotto-categoria | Cosa cattura |
|---|---|---|
| D02.01 | `audio_manager_singleton` | Singleton che gestisce tutti gli stream audio. Play, stop, fade, crossfade |
| D02.02 | `bgm_management` | Come la BGM cambia tra zone, come fa crossfade, layer musicali (calm → combat) |
| D02.03 | `sfx_trigger_system` | Mapping azione → suono. Come gli SFX si triggerano dalle animazioni (animation method call) |
| D02.04 | `spatial_audio` | AudioStreamPlayer2D/3D per suoni posizionali. Attenuazione per distanza |
| D02.05 | `audio_bus_setup` | Bus separati: Master, BGM, SFX, Voice, Ambient. Effetti per bus (reverb, low-pass) |
| D02.06 | `footstep_system` | Suoni di passo diversi per superficie (erba, pietra, legno, metallo) basati su tile o physics material |

---

#### D03 — VISUAL EFFECTS (VFX)

| ID | Sotto-categoria | Cosa cattura |
|---|---|---|
| D03.01 | `particle_systems` | Configurazioni particellari: esplosioni, fuoco, pioggia, polvere al salto, trail di dash |
| D03.02 | `shader_effects` | Shader custom: dissolve (morte), outline (selezione), flash (danno), water reflection, CRT/retro |
| D03.03 | `post_processing` | Color grading, vignette, bloom, chromatic aberration, film grain |
| D03.04 | `lighting_2d` | PointLight2D, shadows, ambient light, day/night cycle |
| D03.05 | `animation_juice` | Squash & stretch, anticipation, overshoot. I 12 principi dell'animazione applicati al gameplay |
| D03.06 | `hit_effects` | Combinazione di: screen shake + hit stop + flash + particles + sfx che rende il combattimento "impactful" |

---

### DOMINIO E — ARCHITECTURE & INFRASTRUCTURE

Come il progetto è organizzato.

---

#### E01 — PROJECT STRUCTURE

| ID | Sotto-categoria | Cosa cattura |
|---|---|---|
| E01.01 | `folder_hierarchy` | Come sono organizzate le cartelle: scenes/, scripts/, assets/, audio/, ui/, autoloads/ |
| E01.02 | `autoloads_singletons` | Singleton globali: GameManager, AudioManager, SaveManager, EventBus |
| E01.03 | `scene_composition` | Come le scene sono composte: inheritance vs composition, scene instancing, packed scenes |
| E01.04 | `resource_management` | Uso di Resource custom per dati (WeaponData, EnemyData, ItemData) |
| E01.05 | `export_configuration` | export_presets.cfg, come è configurato il web export, il desktop export |

---

#### E02 — EVENT & SIGNAL ARCHITECTURE

| ID | Sotto-categoria | Cosa cattura |
|---|---|---|
| E02.01 | `signal_bus` | EventBus/SignalBus globale per comunicazione decoupled tra sistemi |
| E02.02 | `signal_connections` | Come scene/nodi comunicano: segnali diretti, gruppi, call_group |
| E02.03 | `observer_pattern` | Implementazioni del pattern Observer per game events |

---

#### E03 — SCENE & GAME FLOW

| ID | Sotto-categoria | Cosa cattura |
|---|---|---|
| E03.01 | `game_state_manager` | Gestione stati globali: MENU, PLAYING, PAUSED, CUTSCENE, GAME_OVER |
| E03.02 | `scene_transitions` | Come avviene il cambio scena: change_scene_to_packed, con transition animation |
| E03.03 | `loading_screen` | Caricamento asincrono con progress bar per scene pesanti |
| E03.04 | `restart_logic` | Come il gioco gestisce il restart: reset di tutti gli stati, reload della scena |

---

#### E04 — GENRE-SPECIFIC SYSTEMS

Sistemi che esistono solo in certi generi. Non universali ma critici quando servono.

| ID | Sotto-categoria | Generi | Cosa cattura |
|---|---|---|---|
| E04.01 | `card_system` | Card game, deckbuilder | Deck, hand, draw, discard, play, card effects, mana cost |
| E04.02 | `turn_based_combat` | JRPG, tactical | Turni, ordine iniziativa, azioni per turno, targeting |
| E04.03 | `grid_movement` | Tactical RPG, puzzle | Movimento su griglia, range display, path highlight |
| E04.04 | `farming_system` | Farm sim, life sim | Tilling, planting, watering, growth stages, harvest, seasons |
| E04.05 | `building_system` | City builder, survival | Grid placement, resource cost, snap-to-grid, preview ghost |
| E04.06 | `vehicle_physics` | Racing, arcade | Acceleration, steering, drift, speed boost |
| E04.07 | `rhythm_system` | Rhythm game | Beat sync, timing window (perfect/great/good/miss), score multiplier |
| E04.08 | `stealth_system` | Stealth, immersive sim | Visibility meter, noise level, detection states (unaware/suspicious/alert) |
| E04.09 | `tower_defense` | TD | Path, tower placement zones, tower types, upgrade tiers, wave config |
| E04.10 | `visual_novel_core` | VN, dating sim | Text display, character sprites, backgrounds, choices, route flags |

---

## 1.3 Matrice Genere → Categorie obbligatorie

Questa matrice dice al parser e al retrieval system quali categorie sono OBBLIGATORIE per ogni genere del routing di Game Studio AI.

| Genere | Categorie obbligatorie (ID) |
|---|---|
| **Platformer / Metroidvania** | A01, A02, A03, A04, A05, B01, B03, C01.08, C04, D01, D02, D03.06 |
| **RPG top-down / JRPG** | A01 (top-down), A04, C01, C02, C03, C04, D01, D02, E04.02 |
| **Roguelike / Roguelite** | A01, A02, A03, A04, B02, C01.04, C02, D01, D03 |
| **Visual Novel** | C03, D01, D02, C04, E04.10 |
| **Mobile Casual / Puzzle** | A01 (touch), A05, D01, D02, C01.06 |
| **Card game / Deckbuilder** | E04.01, C01, D01, D02, C04 |
| **Action 2D / Beat'em up** | A01, A02, A03, A04, A05, B01, D01, D02, D03.06 |
| **Bullet Hell / Arcade** | A01, A03.06, A04.11, A05, D01, D03.01, D02 |
| **Tower Defense** | E04.09, A04.11, C01, D01, D02 |
| **Social Sim / Farm Sim** | A01, C02, C03, C01, C04, D01, D02, E04.04 |
| **Horror** | A01, A04, C03, D02 (critico), D03.04, C04 |
| **3D Browser** | A01 (3D), A05, B01, D01, D03.03 |
| **Platformer hardcore** | A01 (tutti i sub), A02, A05, B01, B03, D01, D03.06 |

---

## 1.4 Matrice Engine → Formati file da parsare

| Engine | File di progetto | File di scena | File di codice | File di risorse | File di configurazione |
|---|---|---|---|---|---|
| **Godot 4** | `project.godot` | `.tscn`, `.scn` | `.gd` (GDScript) | `.tres`, `.res` (Resource) | `export_presets.cfg` |
| **Phaser 3** | `package.json` | — (JS files) | `.js`, `.ts` | — (asset references in code) | `webpack.config.js` / `vite.config.js` |
| **Ren'Py** | — | — | `.rpy` (script) | `images/`, `audio/` dirs | `options.rpy`, `gui.rpy` |
| **Defold** | `game.project` | `.collection` | `.script` (Lua) | `.atlas`, `.tilesource` | `input_binding` |
| **MonoGame** | `.csproj` | — | `.cs` (C#) | `Content/` pipeline | `Content.mgcb` |
| **LÖVE** | `conf.lua` | — | `.lua` | — (Lua references) | `conf.lua` |
| **Three.js** | `package.json` | — | `.js`, `.ts` | `.gltf`, `.glb` refs | `vite.config.js` |
| **Stride** | `.csproj`, `.sdpkg` | `.sdscene` | `.cs` | `.sdtex`, `.sdmat` | — |

---

# ═══════════════════════════════════════════════════════
# §02 — INGESTION PIPELINE ARCHITECTURE
# ═══════════════════════════════════════════════════════

## 2.1 Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        INGESTION PIPELINE                               │
│                                                                         │
│  FASE 1          FASE 2           FASE 3          FASE 4        FASE 5  │
│  ┌──────┐       ┌──────┐        ┌──────┐       ┌──────┐      ┌──────┐  │
│  │SCRAPE│──────▶│FILTER│───────▶│PARSE │──────▶│CLASS │─────▶│EMBED │  │
│  │GitHub│       │Quality│       │Engine│       │LLM   │      │Store │  │
│  │itch  │       │Check │       │Specif│       │Label │      │pgvec │  │
│  │Awesm │       │      │       │      │       │      │      │      │  │
│  └──────┘       └──────┘        └──────┘       └──────┘      └──────┘  │
│                                                                         │
│  Output:         Output:         Output:        Output:       Output:   │
│  repos/          repos_clean/    chunks_raw/    chunks_meta/  Supabase  │
│  ~800 repos      ~170 repos     ~6000 chunks   ~6000 tagged  pgvector  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2.2 FASE 1 — Scraping (Script: `01_scrape.py`)

Lo script interroga 4 fonti per ogni engine.

### Fonte 1: GitHub API Search

```python
# Query per engine × genere
SEARCH_QUERIES = {
    "godot": [
        "godot 4 platformer", "godot metroidvania", "godot roguelike",
        "godot rpg", "godot action", "godot puzzle", "godot horror",
        "godot game jam", "godot demo project",
        # Topic-based
        "topic:godot-4 topic:game", "topic:godot topic:platformer",
        "topic:godot topic:roguelike"
    ],
    "phaser": [
        "phaser 3 game", "phaser platformer", "phaser puzzle",
        "phaser arcade", "phaser game jam",
        "topic:phaser3 topic:game", "topic:phaser topic:html5-game"
    ],
    "renpy": [
        "renpy visual novel", "renpy game", "renpy jam",
        "topic:renpy topic:visual-novel"
    ],
    "defold": [
        "defold game", "defold mobile", "defold puzzle",
        "topic:defold topic:game"
    ],
    "monogame": [
        "monogame game", "monogame platformer", "monogame xna",
        "topic:monogame topic:game", "FNA game"
    ],
    "love2d": [
        "love2d game", "love game lua", "löve game",
        "topic:love2d topic:game"
    ],
    "threejs": [
        "three.js game", "threejs game 3d browser",
        "topic:threejs topic:game", "topic:three-js topic:game"
    ],
    "stride": [
        "stride engine game", "stride3d game",
        "topic:stride3d"
    ]
}

# Filtri GitHub API
FILTERS = {
    "stars": ">=20",
    "pushed": ">=2025-01-01",
    "size": "<=100000",  # KB → max 100MB
    "language": {
        "godot": "GDScript",
        "phaser": "JavaScript",
        "renpy": "Python",
        "defold": "Lua",
        "monogame": "C#",
        "love2d": "Lua",
        "threejs": "JavaScript",
        "stride": "C#"
    }
}
```

### Fonte 2: Awesome Lists (scrape README)

```python
AWESOME_LISTS = {
    "godot": "https://github.com/godotengine/awesome-godot",
    "phaser": "https://github.com/photonstorm/phaser3-examples",
    "monogame": "https://github.com/aloisdeniel/awesome-monogame",
    "love2d": "https://github.com/love2d-community/awesome-love2d",
    "threejs": "https://github.com/mrdoob/three.js/tree/dev/examples",
    "defold": "https://defold.com/assets/"
}
```

### Fonte 3: Repo ufficiali con demo/samples

```python
OFFICIAL_SAMPLES = {
    "godot": [
        "https://github.com/godotengine/godot-demo-projects",
        "https://github.com/GDQuest/godot-2d-platformer",
        "https://github.com/GDQuest/learn-gdscript"
    ],
    "phaser": [
        "https://github.com/photonstorm/phaser3-examples",
        "https://github.com/phaserjs/template-vite"
    ],
    "renpy": [
        # Ren'Py SDK contiene tutorial project
        "https://github.com/renpy/renpy/tree/master/tutorial"
    ],
    "defold": [
        "https://github.com/defold/defold-examples"
    ]
}
```

### Fonte 4: Game Jam results (itch.io)

```python
JAM_SOURCES = {
    "godot": [
        "https://itch.io/jam/godot-wild-jam-NNN/results",  # mensile
        "https://itch.io/jam/go-godot-jam-4/results"
    ],
    "phaser": [
        "https://itch.io/jam/js13kgames-2025/results"      # JS game jam
    ],
    "love2d": [
        "https://itch.io/jam/love-jam-2025/results"
    ],
    "general": [
        "https://ldjam.com/events/ludum-dare/56/results"    # Ludum Dare
    ]
}
# Per le jam: scrape la pagina risultati, prendi i top 30 per rating,
# cerca "source code" link nella pagina del gioco
```

### Output Fase 1

```
data/
├── repos_raw/
│   ├── godot/
│   │   ├── repo_001_platformer-adventure/
│   │   ├── repo_002_metroidvania-demo/
│   │   └── ... (~100 repos)
│   ├── phaser/
│   │   └── ... (~60 repos)
│   ├── renpy/
│   │   └── ... (~40 repos)
│   ├── defold/
│   │   └── ... (~40 repos)
│   ├── monogame/
│   │   └── ... (~40 repos)
│   ├── love2d/
│   │   └── ... (~30 repos)
│   ├── threejs/
│   │   └── ... (~50 repos)
│   └── stride/
│       └── ... (~20 repos)
├── manifest.json  (lista completa con metadati: URL, stelle, licenza, ultimo commit)
└── scrape_log.txt
```

---

## 2.3 FASE 2 — Quality Filter (Script: `02_filter.py`)

Per ogni repo scaricato, applica 5 check automatici (zero LLM, puro codice).

### Check 1: Struttura minima dell'engine

```python
STRUCTURE_CHECKS = {
    "godot": {
        "required": ["project.godot"],
        "has_any": [".gd", ".tscn"],
        "min_code_files": 3
    },
    "phaser": {
        "required": [],
        "has_any": [".js", ".ts"],
        "content_check": "new Phaser.Game"  # almeno un file contiene questo
    },
    "renpy": {
        "required": [],
        "has_any": [".rpy"],
        "content_check": "label start"
    },
    "defold": {
        "required": ["game.project"],
        "has_any": [".script", ".collection"]
    },
    "monogame": {
        "required": [],
        "has_any": [".csproj"],
        "content_check": "MonoGame"  # nel .csproj
    },
    "love2d": {
        "required": ["main.lua"],
        "has_any": [".lua"],
        "content_check": "love."  # usa le API LÖVE
    },
    "threejs": {
        "required": [],
        "has_any": [".js", ".ts"],
        "content_check": "THREE."
    },
    "stride": {
        "required": [],
        "has_any": [".cs", ".sdpkg"]
    }
}
```

### Check 2: Dimensione del codebase

```python
# Conta le Lines of Code (LOC) dei file di codice dell'engine
MIN_LOC = 300    # Sotto è troppo banale
MAX_LOC = 30000  # Sopra è troppo complesso per chunkare utilmente
```

### Check 3: Rapporto commenti/codice

```python
MIN_COMMENT_RATIO = 0.03  # almeno 3% di righe sono commenti
# Indica che l'autore ha documentato minimamente il codice
```

### Check 4: No dipendenze esotiche (Godot-specific)

```python
# Legge project.godot → conta i plugin in [autoload] e addons/
MAX_PLUGINS = 5  # Più di 5 plugin = troppo specifico, non generalizzabile
```

### Check 5: Licenza compatibile

```python
ALLOWED_LICENSES = ["MIT", "CC0-1.0", "Apache-2.0", "BSD-2-Clause",
                     "BSD-3-Clause", "Unlicense", "ISC", "Zlib"]
# Se nessuna LICENSE trovata → flag per review manuale
```

### Output Fase 2

Da ~800 repo iniziali → ~170 repo puliti, con un file `quality_report.json`:

```json
{
  "repo": "godot/repo_001_platformer-adventure",
  "source_url": "https://github.com/...",
  "engine": "godot",
  "stars": 87,
  "license": "MIT",
  "loc": 2340,
  "comment_ratio": 0.08,
  "plugin_count": 2,
  "has_export_presets": true,
  "last_commit": "2025-11-14",
  "quality_score_structural": 4,
  "pass": true
}
```

---

## 2.4 FASE 3 — Engine-Specific Parsing (Script: `03_parse_godot.py`, `03_parse_phaser.py`, ...)

Qui il parsing è specifico per ogni engine. Il parser più complesso è quello di Godot perché i file `.tscn` hanno una struttura unica. Gli altri sono variazioni più semplici.

### 2.4.1 Godot Parser — Anatomia dei file

**`project.godot`** — File INI che contiene:
- `[autoload]`: singleton globali (GameManager, AudioManager, SignalBus)
- `[display]`: risoluzione, stretch mode
- `[input]`: azioni input mappate (ui_accept, move_left, jump, attack, dash...)
- `[layer_names]`: nomi dei collision layer
- `[physics]`: gravità default, physics ticks

**`.tscn`** — Scene file (testo leggibile). Struttura:

```
[gd_scene load_steps=N format=3]              ← header
[ext_resource type="Script" path="player.gd"] ← risorse esterne
[ext_resource type="Texture2D" path="..."]
[sub_resource type="RectangleShape2D"]        ← risorse inline
[node name="Player" type="CharacterBody2D"]   ← nodi della scena
script = ExtResource("1")
[node name="Sprite" type="AnimatedSprite2D" parent="."]
[node name="CollisionShape" type="CollisionShape2D" parent="."]
[node name="Hitbox" type="Area2D" parent="."]
[connection signal="body_entered" from="Hitbox" to="." method="_on_hit"]
```

**`.gd`** — GDScript (Python-like). Parsabile con:
- Regex per `extends`, `class_name`, `func`, `signal`, `@export`, `@onready`
- AST non necessario (il formato è semplice)

### 2.4.2 Algoritmo di parsing Godot

```
Per ogni progetto Godot che ha passato il quality filter:

1. LEGGI project.godot
   → Estrai: autoloads, input_map, display settings, collision layer names
   → Salva come chunk E01.01 + E01.02 (project structure)

2. PER OGNI FILE .tscn:
   a) Parsa la lista dei nodi con tipo e parent
   b) Costruisci l'albero della scena
   c) Identifica il nodo root:
      - Root è CharacterBody2D/3D → probabile player O enemy
      - Root è Control/CanvasLayer → probabile UI
      - Root è Node2D con TileMap child → probabile livello
      - Root è Area2D → probabile trigger/pickup/projectile
   d) Per ogni nodo con script attaccato:
      → Leggi il file .gd collegato
      → Crea una coppia (scene_context, script_code)
      
3. PER OGNI FILE .gd (includendo quelli già trovati nei .tscn):
   a) Estrai: extends, class_name, signals definiti, export vars, funzioni
   b) HEURISTIC PRE-CLASSIFICATION (deterministica, zero LLM):
   
      SE extends CharacterBody2D E ha func _physics_process E ha "velocity":
         → CANDIDATO: player_controller O enemy
         SE ha input.is_action: → player_controller
         SE ha "patrol" O "chase" O "detection": → enemy_ai
      
      SE extends Control O extends CanvasLayer:
         → CANDIDATO: ui_system
         SE ha "menu" nel nome: → D01.01 o D01.03
         SE ha "hud" o "health" nel nome: → D01.02
         SE ha "inventory" nel nome: → D01.06
      
      SE extends Resource E ha @export:
         → CANDIDATO: data_resource (E01.04)
         SE ha "weapon" o "damage": → item data
         SE ha "enemy" o "hp": → enemy data
      
      SE ha "AudioStreamPlayer" O "AudioServer":
         → CANDIDATO: audio system (D02)
      
      SE ha "save" O "load" O "ConfigFile" O "FileAccess":
         → CANDIDATO: save/load system (C04)
      
      SE ha "NavigationAgent" O "astar" O "find_path":
         → CANDIDATO: navigation (B04)
      
      SE ha "RayCast" E "is_colliding" nel contesto di movement:
         → CANDIDATO: physics helper per player/enemy

4. RAGGRUPPAMENTO
   - Se un player_controller è spezzato in 3 file (movement, combat, animation),
     concatenali in un singolo chunk con separatori:
     ```
     # === FILE: player_movement.gd ===
     [codice]
     # === FILE: player_combat.gd ===
     [codice]
     # === FILE: player_animation.gd ===
     [codice]
     ```
   - Se un file contiene sia player movement che inventory management (codice misto),
     NON dividerlo → va al LLM per classificazione fine nella Fase 4
```

### 2.4.3 Phaser Parser

Phaser non ha file di scena separati. Tutto è in JavaScript/TypeScript.

```
Per ogni progetto Phaser:

1. IDENTIFICA IL FILE MAIN
   → Cerca "new Phaser.Game(" → quello è l'entry point
   → Estrai: width, height, physics config, scene list

2. PER OGNI SCENE CLASS (extends Phaser.Scene):
   a) Analizza preload() → quali asset carica
   b) Analizza create() → quali oggetti crea (sprite, tilemap, groups)
   c) Analizza update() → logica di gameplay
   d) HEURISTIC:
      SE create() ha "this.player" E update() ha "this.cursors":
         → player_controller
      SE il nome contiene "Menu" O "Title":
         → ui_system
      SE create() ha "this.tilemap" O "this.map":
         → level_structure
      SE create() ha "this.enemies" O "this.physics.add.group":
         → enemy system

3. CHUNK PER SCENA
   → Ogni Phaser.Scene diventa un chunk singolo (tipicamente autocontenuta)
```

### 2.4.4 Ren'Py Parser

```
Per ogni progetto Ren'Py:

1. LEGGI TUTTI I .rpy
   → Identifica: label (scene), menu (scelte), define/default (variabili),
     image (dichiarazioni sprite), transform (animazioni), screen (UI custom)

2. CHUNK PER CONCETTO:
   → Tutti i label di un "route" → chunk C03.03 (branching)
   → Definizioni di character() → chunk E04.10 (VN core)
   → Screen custom → chunk D01 (UI)
   → Le variabili condition → chunk C03.04 (conditional dialogue)
   → gui.rpy → chunk D01 (UI theming)
   → options.rpy → chunk E01 (project config)
```

### 2.4.5 Output Fase 3

```
data/
├── chunks_raw/
│   ├── godot/
│   │   ├── repo_001/
│   │   │   ├── chunk_001.json
│   │   │   │   {
│   │   │   │     "source_repo": "...",
│   │   │   │     "engine": "godot",
│   │   │   │     "file_paths": ["scripts/player/player_controller.gd"],
│   │   │   │     "scene_context": "CharacterBody2D root with AnimatedSprite2D, CollisionShape2D, Hitbox Area2D",
│   │   │   │     "code": "extends CharacterBody2D\n\nconst SPEED = 120.0\n...",
│   │   │   │     "loc": 187,
│   │   │   │     "heuristic_category": "player_controller",
│   │   │   │     "heuristic_confidence": "high",
│   │   │   │     "signals_defined": ["hit", "died"],
│   │   │   │     "signals_connected": ["body_entered"],
│   │   │   │     "extends": "CharacterBody2D",
│   │   │   │     "exports": ["speed: float", "jump_force: float"],
│   │   │   │     "functions": ["_physics_process", "_on_hit", "jump", "dash"]
│   │   │   │   }
│   │   │   ├── chunk_002.json
│   │   │   └── ...
│   │   └── ...
│   ├── phaser/
│   └── ...
```

---

## 2.5 FASE 4 — LLM Classification (Script: `04_classify.py`)

Per ogni chunk raw, chiamata a DeepSeek V4 Flash per classificazione semantica fine.

### Il prompt di classificazione

```
Sei un esperto di game development. Analizza questo codice {engine} da un gioco.

Contesto scena: {scene_context}
Euristica precedente: {heuristic_category} (confidenza: {heuristic_confidence})

CODICE:
```
{code}
```

Rispondi ESCLUSIVAMENTE con JSON valido, senza commenti, senza markdown:
{
  "primary_category": "uno tra: A01_player_controller | A02_state_machine | A03_combat | A04_enemy_ai | A05_camera | B01_level_structure | B02_procedural_gen | B03_physics_collision | B04_navigation | C01_progression | C02_inventory | C03_dialogue_narrative | C04_save_load | D01_ui | D02_audio | D03_vfx | E01_project_structure | E02_signals_events | E03_game_flow | E04_genre_specific",
  "subcategories": ["lista di sotto-ID dalla tassonomia, es: A01.01, A01.02, A01.03"],
  "genre_tags": ["platformer", "metroidvania", "roguelike", "rpg", "visual_novel", "puzzle", "card_game", "horror", "arcade", "sim"],
  "complexity": "basic | intermediate | advanced",
  "design_patterns": ["state_machine", "observer", "singleton", "component", "strategy", "command", "factory", "object_pool"],
  "key_features": ["coyote_time", "wall_jump", "dash", "i_frames", "screen_shake", "hit_stop", "input_buffer", "combo", "patrol", "chase", "boss_phase", "typewriter_text", "branching_dialogue", "wave_spawner", "parallax", "day_night_cycle"],
  "quality_score": 1-5,
  "reusability_score": 1-5,
  "one_line_summary": "descrizione in 15 parole max di cosa fa questo codice",
  "extracted_parameters": {
    "parametro_nome": "valore_numerico_se_presente"
  }
}
```

**Il campo `extracted_parameters` è cruciale.** Il LLM legge il codice e estrae i valori numerici che trova. Se nel codice c'è `const GRAVITY = 980.0`, il LLM restituisce `{"gravity": 980.0}`. Se c'è `var coyote_time = 0.08`, restituisce `{"coyote_time_seconds": 0.08}`. Questi valori finiscono nella tabella `game_parameters` per il retrieval numerico.

### Costi stimati Fase 4

- Chunk medio: ~1200 token di input (codice) + ~200 token prompt + ~300 token output
- Costo per chunk con DeepSeek V4 Flash: ~$0.0003
- 6000 chunk totali: **~$1.80**
- Tempo: ~3 ore con rate limiting conservativo

---

## 2.6 FASE 5 — Embedding & Storage (Script: `05_embed_store.py`)

### Cosa viene embedded

Non si fa embedding del codice grezzo. Si fa embedding di una **stringa di ricerca semantica** composta da:

```python
searchable_text = f"""
{one_line_summary}
Engine: {engine}
Category: {primary_category}
Subcategories: {', '.join(subcategories)}
Genres: {', '.join(genre_tags)}
Features: {', '.join(key_features)}
Patterns: {', '.join(design_patterns)}
Complexity: {complexity}
"""
```

Questo testo viene embedded perché cattura il **significato** del chunk. Quando il tool `code_gen_gdscript` cerca "player controller con wall jump per metroidvania godot", la query matcha semanticamente con questo testo, non con il codice GDScript (che ha una distribuzione di token completamente diversa da una query in linguaggio naturale).

### Modello di embedding

**`text-embedding-3-small`** (OpenAI): 1536 dimensioni, $0.02/MTok.
- 6000 chunk × ~150 token ciascuno = ~900K token = **$0.018**
- Alternativa gratuita: `nomic-embed-text` via Ollama locale (0 costo, 768 dimensioni)

### Batch insert in Supabase

```python
# Usa la Supabase Python client con batch insert
# Ogni chunk → 1 riga in code_knowledge + 0-1 righe in game_parameters

for chunk in classified_chunks:
    # 1. Genera embedding
    embedding = openai.embeddings.create(
        model="text-embedding-3-small",
        input=chunk.searchable_text
    ).data[0].embedding
    
    # 2. Insert nel DB
    supabase.table("code_knowledge").insert({
        "engine": chunk.engine,
        "primary_category": chunk.primary_category,
        "subcategories": chunk.subcategories,
        "chunk_type": determine_chunk_type(chunk),  # full_recipe | single_mechanic | structural_pattern
        "genre_tags": chunk.genre_tags,
        "complexity": chunk.complexity,
        "design_patterns": chunk.design_patterns,
        "key_features": chunk.key_features,
        "quality_score": chunk.quality_score,
        "reusability_score": chunk.reusability_score,
        "summary": chunk.one_line_summary,
        "code": chunk.code,
        "language": engine_to_language(chunk.engine),
        "source_repo": chunk.source_repo,
        "source_license": chunk.license,
        "loc": chunk.loc,
        "embedding": embedding
    }).execute()
    
    # 3. Se ci sono parametri numerici, insert separato
    if chunk.extracted_parameters:
        supabase.table("game_parameters").insert({
            "source_repo": chunk.source_repo,
            "engine": chunk.engine,
            "genre": chunk.genre_tags[0],  # genere primario
            "parameter_group": map_category_to_param_group(chunk.primary_category),
            "parameters": chunk.extracted_parameters,
            "context": chunk.one_line_summary,
            "quality_score": chunk.quality_score
        }).execute()
```

---

# ═══════════════════════════════════════════════════════
# §03 — SUPABASE VECTOR SCHEMA
# ═══════════════════════════════════════════════════════

## 3.1 Schema SQL completo

```sql
-- ============================================================
-- GAME STUDIO AI — Knowledge Base Schema
-- Supabase PostgreSQL + pgvector
-- ============================================================

-- Abilita l'estensione pgvector
create extension if not exists vector;

-- ============================================================
-- TABELLA 1: code_knowledge
-- Il cuore della Knowledge Base. Ogni riga è un chunk di codice
-- da un progetto open-source, classificato e vettorizzato.
-- ============================================================

create table public.code_knowledge (
    id uuid primary key default gen_random_uuid(),

    -- === IDENTITÀ ===
    engine text not null,
    -- ENUM logico: godot | phaser | renpy | defold | monogame | love2d | threejs | stride
    
    language text not null,
    -- ENUM logico: gdscript | javascript | typescript | python | lua | csharp | glsl
    
    -- === CLASSIFICAZIONE TASSONOMICA ===
    primary_category text not null,
    -- ENUM logico: A01_player_controller | A02_state_machine | A03_combat |
    -- A04_enemy_ai | A05_camera | B01_level_structure | B02_procedural_gen |
    -- B03_physics_collision | B04_navigation | C01_progression | C02_inventory |
    -- C03_dialogue_narrative | C04_save_load | D01_ui | D02_audio | D03_vfx |
    -- E01_project_structure | E02_signals_events | E03_game_flow | E04_genre_specific
    
    subcategories text[] not null default '{}',
    -- Array di sotto-ID: {A01.01, A01.02, A01.07}
    
    chunk_type text not null,
    -- ENUM logico: full_recipe | single_mechanic | structural_pattern
    -- full_recipe: sistema completo (intero player controller)
    -- single_mechanic: singola meccanica estratta (solo il wall jump)
    -- structural_pattern: struttura progetto / architettura
    
    -- === METADATI DI RICERCA ===
    genre_tags text[] not null default '{}',
    -- {platformer, metroidvania, roguelike, rpg, visual_novel, puzzle, 
    --  card_game, horror, arcade, sim, td, racing, rhythm, stealth}
    
    complexity text not null default 'intermediate',
    -- ENUM logico: basic | intermediate | advanced
    
    design_patterns text[] not null default '{}',
    -- {state_machine, observer, singleton, component, strategy, 
    --  command, factory, object_pool, behavior_tree}
    
    key_features text[] not null default '{}',
    -- {coyote_time, wall_jump, dash, i_frames, screen_shake, hit_stop,
    --  input_buffer, combo, patrol, chase, boss_phase, typewriter_text,
    --  branching_dialogue, wave_spawner, parallax, day_night_cycle,
    --  save_checkpoint, inventory_grid, crafting, skill_tree, ...}
    
    -- === QUALITY ===
    quality_score smallint not null check (quality_score between 1 and 5),
    reusability_score smallint not null check (reusability_score between 1 and 5),
    
    -- === CONTENUTO ===
    summary text not null,
    -- Descrizione in ~15 parole di cosa fa il chunk
    
    code text not null,
    -- Il codice sorgente completo del chunk
    
    loc int not null default 0,
    -- Lines of Code del chunk
    
    -- === PROVENIENZA ===
    source_repo text,
    source_license text,
    -- MIT | CC0 | Apache-2.0 | BSD | Unlicense | Zlib
    
    source_file_paths text[] not null default '{}',
    -- File originali da cui è estratto: {scripts/player.gd, scenes/player.tscn}
    
    scene_context text,
    -- Contesto della scena (nodi, tipi, gerarchia) se applicabile
    
    -- === VECTOR ===
    embedding vector(1536),
    -- Embedding del searchable_text (NON del codice grezzo)
    
    -- === TIMESTAMPS ===
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    
    -- === USER FEEDBACK (post-lancio) ===
    times_retrieved int not null default 0,
    -- Quante volte questo chunk è stato usato come riferimento
    
    positive_feedback int not null default 0,
    negative_feedback int not null default 0
    -- Feedback dagli utenti sui giochi generati con questo riferimento
);

-- ============================================================
-- TABELLA 2: game_parameters
-- Valori numerici estratti da giochi reali. Il "DNA del game feel".
-- ============================================================

create table public.game_parameters (
    id uuid primary key default gen_random_uuid(),
    
    source_repo text,
    engine text not null,
    genre text not null,
    
    parameter_group text not null,
    -- ENUM logico: player_physics | combat_stats | enemy_stats |
    -- progression_economy | camera_settings | audio_config |
    -- spawn_config | difficulty_curve
    
    parameters jsonb not null,
    -- I valori numerici effettivi. Schema varia per parameter_group.
    -- Esempio player_physics:
    -- {"gravity": 980, "jump_force": -350, "coyote_time_ms": 80, ...}
    
    context text,
    -- Breve spiegazione del contesto (genere, tipo di gioco)
    
    quality_score smallint not null check (quality_score between 1 and 5),
    
    created_at timestamptz not null default now()
);

-- ============================================================
-- TABELLA 3: ingestion_log
-- Log di ogni repo processato, per tracciabilità e idempotenza.
-- ============================================================

create table public.ingestion_log (
    id uuid primary key default gen_random_uuid(),
    
    source_url text not null unique,
    engine text not null,
    
    status text not null default 'pending',
    -- ENUM logico: pending | scraped | filtered_out | parsed | classified | embedded | error
    
    stars int,
    license text,
    loc int,
    comment_ratio real,
    quality_score_structural smallint,
    
    chunks_produced int default 0,
    error_message text,
    
    scraped_at timestamptz,
    parsed_at timestamptz,
    classified_at timestamptz,
    embedded_at timestamptz,
    
    created_at timestamptz not null default now()
);

-- ============================================================
-- INDICI — Ottimizzati per i pattern di query di getReferences()
-- ============================================================

-- Indici B-tree per filtri esatti (usati PRIMA del vector search)
create index idx_ck_engine on public.code_knowledge (engine);
create index idx_ck_category on public.code_knowledge (primary_category);
create index idx_ck_chunk_type on public.code_knowledge (chunk_type);
create index idx_ck_complexity on public.code_knowledge (complexity);
create index idx_ck_quality on public.code_knowledge (quality_score desc);
create index idx_ck_reusability on public.code_knowledge (reusability_score desc);

-- Indici GIN per filtri su array (genre_tags, key_features, subcategories)
create index idx_ck_genres on public.code_knowledge using gin (genre_tags);
create index idx_ck_features on public.code_knowledge using gin (key_features);
create index idx_ck_subcategories on public.code_knowledge using gin (subcategories);
create index idx_ck_patterns on public.code_knowledge using gin (design_patterns);

-- Indice HNSW per ricerca vettoriale (più veloce di IVFFlat per dataset < 1M righe)
-- HNSW: no training needed, aggiornamento incrementale, ottime performance su < 100K righe
create index idx_ck_embedding on public.code_knowledge
    using hnsw (embedding vector_cosine_ops)
    with (m = 16, ef_construction = 64);

-- Indici per game_parameters
create index idx_gp_engine_genre on public.game_parameters (engine, genre);
create index idx_gp_group on public.game_parameters (parameter_group);

-- Indice per ingestion_log
create index idx_il_status on public.ingestion_log (status);
create index idx_il_engine on public.ingestion_log (engine);

-- ============================================================
-- FUNZIONE RPC: Ricerca ibrida (filtro + vector similarity)
-- Chiamata dal backend TypeScript via supabase.rpc()
-- ============================================================

create or replace function search_code_knowledge(
    p_engine text,
    p_category text default null,
    p_genres text[] default null,
    p_features text[] default null,
    p_complexity text default null,
    p_chunk_type text default null,
    p_min_quality int default 3,
    p_query_embedding vector(1536) default null,
    p_limit int default 5
)
returns table (
    id uuid,
    engine text,
    primary_category text,
    subcategories text[],
    chunk_type text,
    genre_tags text[],
    key_features text[],
    complexity text,
    quality_score smallint,
    reusability_score smallint,
    summary text,
    code text,
    source_repo text,
    source_license text,
    similarity float
)
language plpgsql
as $$
begin
    return query
    select
        ck.id,
        ck.engine,
        ck.primary_category,
        ck.subcategories,
        ck.chunk_type,
        ck.genre_tags,
        ck.key_features,
        ck.complexity,
        ck.quality_score,
        ck.reusability_score,
        ck.summary,
        ck.code,
        ck.source_repo,
        ck.source_license,
        case 
            when p_query_embedding is not null 
            then 1 - (ck.embedding <=> p_query_embedding)
            else 1.0
        end as similarity
    from public.code_knowledge ck
    where
        ck.engine = p_engine
        and (p_category is null or ck.primary_category = p_category)
        and (p_genres is null or ck.genre_tags && p_genres)
        and (p_features is null or ck.key_features && p_features)
        and (p_complexity is null or ck.complexity = p_complexity)
        and (p_chunk_type is null or ck.chunk_type = p_chunk_type)
        and ck.quality_score >= p_min_quality
    order by
        case
            when p_query_embedding is not null
            then ck.embedding <=> p_query_embedding
            else 0
        end asc,
        ck.quality_score desc,
        ck.reusability_score desc
    limit p_limit;
end;
$$;

-- ============================================================
-- FUNZIONE RPC: Ricerca parametri numerici
-- ============================================================

create or replace function get_reference_parameters(
    p_engine text,
    p_genre text,
    p_parameter_group text,
    p_min_quality int default 3,
    p_limit int default 5
)
returns table (
    id uuid,
    source_repo text,
    parameters jsonb,
    context text,
    quality_score smallint
)
language plpgsql
as $$
begin
    return query
    select
        gp.id,
        gp.source_repo,
        gp.parameters,
        gp.context,
        gp.quality_score
    from public.game_parameters gp
    where
        gp.engine = p_engine
        and gp.genre = p_genre
        and gp.parameter_group = p_parameter_group
        and gp.quality_score >= p_min_quality
    order by gp.quality_score desc
    limit p_limit;
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY (disabilitato per service_role, attivo per anon)
-- ============================================================

alter table public.code_knowledge enable row level security;
alter table public.game_parameters enable row level security;
alter table public.ingestion_log enable row level security;

-- Policies: solo lettura per il backend (service_role bypassa RLS)
create policy "code_knowledge_read" on public.code_knowledge
    for select using (true);

create policy "game_parameters_read" on public.game_parameters
    for select using (true);

-- Ingestion log: solo service_role (nessuna policy per anon)
```

---

## 3.2 Numeri attesi nel database

| Metrica | Stima |
|---|---|
| Progetti ingestiti | ~170 |
| Chunk `code_knowledge` | ~5000-7000 |
| Righe `game_parameters` | ~800-1200 |
| Dimensione DB (dati + embedding) | ~150-250 MB |
| Dimensione embedding totale | ~45 MB (6000 × 1536 × 4 bytes) |
| Tempo medio query `search_code_knowledge` | < 50ms (HNSW + filtri B-tree/GIN pre-applicati) |

Il free tier di Supabase ha 500MB di DB. La knowledge base ci sta comodamente.

---

# ═══════════════════════════════════════════════════════
# §04 — INTEGRAZIONE IN HERMES AGENT
# ═══════════════════════════════════════════════════════

## 4.1 Posizione nel flusso dell'orchestratore

```
┌─────────────────────────────────────────────────────────────────┐
│                    HERMES AGENT FLOW                             │
│                                                                  │
│  1. Brief utente                                                 │
│     ↓                                                            │
│  2. Game Reasoning Engine → Game Plan (JSON strutturato)         │
│     ↓                                                            │
│  3. Execution Orchestrator → lista ordinata di tool calls        │
│     ↓                                                            │
│  4. PER OGNI TOOL CALL:                                          │
│     ┌────────────────────────────────────────────────────────┐   │
│     │ a) Tool riceve: task + Game Plan context                │   │
│     │ b) ▶▶▶ getReferences() ◀◀◀ ← KNOWLEDGE BASE QUERY    │   │
│     │ c) ▶▶▶ getReferenceParameters() ◀◀◀ (se applicabile)  │   │
│     │ d) Costruisce prompt arricchito con riferimenti         │   │
│     │ e) Chiama LLM (DeepSeek / Claude)                      │   │
│     │ f) Valida output                                        │   │
│     │ g) Salva in Short-Term Memory                           │   │
│     └────────────────────────────────────────────────────────┘   │
│     ↓                                                            │
│  5. Assembler → compone progetto engine                          │
│     ↓                                                            │
│  6. QA pipeline → validate / smoke test                          │
│     ↓                                                            │
│  7. Output → .zip su R2                                          │
└─────────────────────────────────────────────────────────────────┘
```

Il punto di innesto è **4b-4c**: tra la ricezione del task e la costruzione del prompt. Ogni tool chiama la Knowledge Base come primo passo.

## 4.2 `lib/knowledge.ts` — Implementazione completa

```typescript
// lib/knowledge.ts
// Knowledge Base client per Game Studio AI
// Chiamato da ogni tool prima di generare codice

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─────────────────────────────────────────────
// TIPI
// ─────────────────────────────────────────────

export interface CodeReference {
  id: string;
  engine: string;
  primary_category: string;
  subcategories: string[];
  chunk_type: string;
  genre_tags: string[];
  key_features: string[];
  complexity: string;
  quality_score: number;
  reusability_score: number;
  summary: string;
  code: string;
  source_repo: string | null;
  source_license: string | null;
  similarity: number;
}

export interface ParameterReference {
  id: string;
  source_repo: string | null;
  parameters: Record<string, number | string | boolean>;
  context: string | null;
  quality_score: number;
}

export interface ReferenceQuery {
  engine: string;
  category?: string;
  genres?: string[];
  features?: string[];
  complexity?: string;
  chunkType?: 'full_recipe' | 'single_mechanic' | 'structural_pattern';
  minQuality?: number;
  semanticQuery?: string;   // Testo libero per ricerca semantica
  maxResults?: number;
}

export interface ParameterQuery {
  engine: string;
  genre: string;
  parameterGroup: string;
  minQuality?: number;
  maxResults?: number;
}

// ─────────────────────────────────────────────
// FUNZIONE PRINCIPALE: getReferences
// Chiamata da ogni tool prima della generazione
// ─────────────────────────────────────────────

export async function getReferences(query: ReferenceQuery): Promise<CodeReference[]> {
  
  // Step 1: Genera embedding della query semantica (se fornita)
  let queryEmbedding: number[] | null = null;
  if (query.semanticQuery) {
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query.semanticQuery
    });
    queryEmbedding = embeddingResponse.data[0].embedding;
  }
  
  // Step 2: Chiama la RPC function in Supabase (filtro + vector search)
  const { data, error } = await supabase.rpc('search_code_knowledge', {
    p_engine: query.engine,
    p_category: query.category ?? null,
    p_genres: query.genres ?? null,
    p_features: query.features ?? null,
    p_complexity: query.complexity ?? null,
    p_chunk_type: query.chunkType ?? null,
    p_min_quality: query.minQuality ?? 3,
    p_query_embedding: queryEmbedding ? `[${queryEmbedding.join(',')}]` : null,
    p_limit: query.maxResults ?? 5
  });
  
  if (error) {
    console.error('Knowledge Base query failed:', error);
    return [];  // Graceful degradation: il tool funziona anche senza KB
  }
  
  // Step 3: Incrementa il contatore di retrieval (async, non blocca)
  if (data && data.length > 0) {
    const ids = data.map((r: CodeReference) => r.id);
    supabase
      .rpc('increment_retrieval_count', { p_ids: ids })
      .then(() => {})
      .catch(() => {});  // fire-and-forget
  }
  
  return data ?? [];
}

// ─────────────────────────────────────────────
// FUNZIONE PARAMETRI: getReferenceParameters
// Per valori numerici di game feel/bilanciamento
// ─────────────────────────────────────────────

export async function getReferenceParameters(
  query: ParameterQuery
): Promise<ParameterReference[]> {
  
  const { data, error } = await supabase.rpc('get_reference_parameters', {
    p_engine: query.engine,
    p_genre: query.genre,
    p_parameter_group: query.parameterGroup,
    p_min_quality: query.minQuality ?? 3,
    p_limit: query.maxResults ?? 5
  });
  
  if (error) {
    console.error('Parameter query failed:', error);
    return [];
  }
  
  return data ?? [];
}

// ─────────────────────────────────────────────
// HELPER: Costruisce il blocco di contesto
// da iniettare nel prompt di ogni tool
// ─────────────────────────────────────────────

export function buildReferenceContext(
  codeRefs: CodeReference[],
  paramRefs: ParameterReference[]
): string {
  
  let context = '';
  
  if (codeRefs.length > 0) {
    context += '=== REFERENCE CODE FROM REAL GAMES ===\n\n';
    for (const ref of codeRefs) {
      context += `--- Reference: ${ref.summary} ---\n`;
      context += `Source: ${ref.source_repo ?? 'unknown'} | `;
      context += `Quality: ${ref.quality_score}/5 | `;
      context += `Features: ${ref.key_features.join(', ')}\n`;
      context += `\`\`\`\n${ref.code}\n\`\`\`\n\n`;
    }
  }
  
  if (paramRefs.length > 0) {
    context += '=== REFERENCE PARAMETERS FROM REAL GAMES ===\n\n';
    context += 'These numerical values come from published, well-received games.\n';
    context += 'Use them as a starting point, not as absolute constraints.\n\n';
    for (const ref of paramRefs) {
      context += `Source: ${ref.source_repo ?? 'unknown'} | Quality: ${ref.quality_score}/5\n`;
      context += `Parameters: ${JSON.stringify(ref.parameters, null, 2)}\n\n`;
    }
  }
  
  return context;
}
```

## 4.3 Esempio di integrazione in un tool

```typescript
// lib/tools/code-gen-gdscript.ts
// Tool #2: Genera script GDScript per Godot 4

import { getReferences, getReferenceParameters, buildReferenceContext } from '../knowledge';
import { callLLM } from '../openrouter';
import type { GamePlan, ToolInput, ToolOutput } from '../types';

export async function codeGenGDScript(input: ToolInput): Promise<ToolOutput> {
  const { task, gamePlan } = input;
  // task es: "Genera un player controller con movement, jump, wall_jump, dash"
  // gamePlan contiene: engine, genre, mechanics, aesthetics, rules...
  
  // ▶▶▶ STEP 1: QUERY KNOWLEDGE BASE ◀◀◀
  
  // 1a) Riferimenti codice completi (full_recipe)
  const fullRecipes = await getReferences({
    engine: 'godot',
    category: detectCategory(task),  // "A01_player_controller"
    genres: gamePlan.meta.genre_tags,
    features: extractFeatures(task),  // ["wall_jump", "dash"]
    chunkType: 'full_recipe',
    minQuality: 4,
    semanticQuery: task,
    maxResults: 2
  });
  
  // 1b) Singole meccaniche specifiche richieste
  const mechanics = await getReferences({
    engine: 'godot',
    category: detectCategory(task),
    features: extractFeatures(task),
    chunkType: 'single_mechanic',
    minQuality: 3,
    semanticQuery: task,
    maxResults: 3
  });
  
  // 1c) Parametri numerici di game feel
  const params = await getReferenceParameters({
    engine: 'godot',
    genre: gamePlan.meta.genre,
    parameterGroup: 'player_physics'
  });
  
  // ▶▶▶ STEP 2: COSTRUISCI PROMPT ARRICCHITO ◀◀◀
  
  const referenceContext = buildReferenceContext(
    [...fullRecipes, ...mechanics],
    params
  );
  
  const prompt = `You are an expert Godot 4 GDScript developer.
Generate production-quality GDScript for the following task.

TASK: ${task}

GAME PLAN CONTEXT:
- Genre: ${gamePlan.meta.genre}
- Art style: ${gamePlan.aesthetics.art_style}
- Difficulty: ${gamePlan.meta.difficulty}
- Target mechanics: ${gamePlan.core_loop.primary_actions.join(', ')}

${referenceContext}

RULES:
- Use the reference code as inspiration, not as copy-paste source
- Adapt numerical parameters from the reference data
- Follow Godot 4 best practices (typed variables, @export, @onready)
- Include comments explaining non-obvious logic
- Use signals for decoupled communication
- Return ONLY the GDScript code, no explanations

Generate the code:`;

  // ▶▶▶ STEP 3: CHIAMA LLM ◀◀◀
  
  const result = await callLLM({
    model: 'deepseek/deepseek-v4-pro',  // Code tier
    prompt,
    maxTokens: 4000
  });
  
  return {
    type: 'gdscript',
    content: result.text,
    filename: generateFilename(task),  // es: "player_controller.gd"
    metadata: {
      references_used: fullRecipes.map(r => r.source_repo),
      parameters_used: params.length > 0
    }
  };
}
```

## 4.4 Mapping Tool → Query Knowledge Base

Ogni tool del catalogo ha una configurazione di retrieval predefinita.

| Tool | primary_category | chunk_type preferito | parameter_group |
|---|---|---|---|
| `code_gen_gdscript` (player) | A01_player_controller | full_recipe + single_mechanic | player_physics |
| `code_gen_gdscript` (enemy) | A04_enemy_ai | full_recipe | enemy_stats |
| `code_gen_gdscript` (UI) | D01_ui | full_recipe | — |
| `behaviour_tree_gen` | A04_enemy_ai | full_recipe | enemy_stats |
| `boss_design` | A04.08 (subcategory) | full_recipe | combat_stats + enemy_stats |
| `difficulty_balancer` | C01_progression | single_mechanic | progression_economy + enemy_stats |
| `level_layout_2d` | B01_level_structure | structural_pattern | — |
| `tilemap_populate` | B02_procedural_gen | full_recipe | — |
| `dialogue_gen` | C03_dialogue_narrative | full_recipe | — |
| `shader_gen` | D03_vfx | single_mechanic | — |
| `particle_gen` | D03.01 (subcategory) | single_mechanic | — |
| `godot_assembler` | E01_project_structure | structural_pattern | — |
| `code_validator` | — (no KB) | — | — |
| `smoke_test` | — (no KB) | — | — |
| `audio_manager setup` | D02_audio | full_recipe | audio_config |
| `camera setup` | A05_camera | full_recipe | camera_settings |
| `save_system setup` | C04_save_load | full_recipe | — |
| `progression_design` | C01_progression | full_recipe | progression_economy |

---

# ═══════════════════════════════════════════════════════
# §05 — CLAUDE CODE EXECUTION PLAN (FASE PRE-ALPHA)
# ═══════════════════════════════════════════════════════

## 5.1 Overview delle 3 settimane

```
SETTIMANA 1: Infrastruttura + Scraping + Filtering
├── Giorno 1-2: Setup DB + Script scraping
├── Giorno 3-4: Esegui scraping su tutti gli engine
├── Giorno 5-6: Script di quality filter
└── Giorno 7: Verifica manuale campione, fix edge case

SETTIMANA 2: Parsing + Classificazione LLM
├── Giorno 8-9: Parser Godot (il più complesso)
├── Giorno 10: Parser Phaser + Ren'Py
├── Giorno 11: Parser Defold + MonoGame + LÖVE + Three.js + Stride
├── Giorno 12-13: Script classificazione LLM (DeepSeek Flash)
└── Giorno 14: Review classificazioni, correzioni batch

SETTIMANA 3: Embedding + Storage + Test + Integrazione
├── Giorno 15-16: Embedding generation + batch insert Supabase
├── Giorno 17-18: Script getReferences() + test queries
├── Giorno 19-20: Integrazione con primo tool (code_gen_gdscript)
└── Giorno 21: Test end-to-end: brief → KB query → codice generato vs senza KB
```

---

## 5.2 Giorno 1-2: Setup Database

**Prompt per Claude Code #1:**

```
Crea il file supabase/migrations/001_knowledge_base.sql con lo schema completo 
per la Knowledge Base di Game Studio AI. Include:

1. Tabella code_knowledge con:
   - Campi: id uuid PK, engine text, language text, primary_category text, 
     subcategories text[], chunk_type text, genre_tags text[], complexity text,
     design_patterns text[], key_features text[], quality_score smallint (1-5),
     reusability_score smallint (1-5), summary text, code text, loc int,
     source_repo text, source_license text, source_file_paths text[],
     scene_context text, embedding vector(1536), created_at, updated_at,
     times_retrieved int default 0, positive_feedback int default 0,
     negative_feedback int default 0
   - Check constraints su quality_score e reusability_score (1-5)

2. Tabella game_parameters con:
   - Campi: id uuid PK, source_repo text, engine text, genre text,
     parameter_group text, parameters jsonb, context text, quality_score smallint

3. Tabella ingestion_log con:
   - Campi: id uuid PK, source_url text unique, engine text, status text,
     stars int, license text, loc int, chunks_produced int, error_message text,
     timestamps per ogni fase

4. Tutti gli indici: B-tree su engine/category/quality, GIN su array fields,
   HNSW su embedding con m=16 ef_construction=64

5. Le due RPC functions: search_code_knowledge e get_reference_parameters

6. RLS policies: lettura pubblica su code_knowledge e game_parameters

Abilita pgvector extension all'inizio del file.
```

**Prompt per Claude Code #2:**

```
Crea il file lib/knowledge.ts con il client TypeScript per la Knowledge Base.

Include:
- Tipi: CodeReference, ParameterReference, ReferenceQuery, ParameterQuery
- Funzione getReferences(query: ReferenceQuery): Promise<CodeReference[]>
  che chiama supabase.rpc('search_code_knowledge', ...) con i parametri mappati
- Funzione getReferenceParameters(query: ParameterQuery): Promise<ParameterReference[]>
  che chiama supabase.rpc('get_reference_parameters', ...)
- Funzione buildReferenceContext(codeRefs, paramRefs): string
  che formatta i risultati come blocco di testo da inserire nel prompt LLM
- Gestione errori: se la query fallisce, ritorna array vuoto (graceful degradation)
- Increment fire-and-forget del contatore times_retrieved

Usa @supabase/supabase-js e openai per gli embedding.
Il modello di embedding è text-embedding-3-small (1536 dimensioni).
```

---

## 5.3 Giorno 3-6: Scraping e Filtering

**Prompt per Claude Code #3:**

```
Crea lo script Python scripts/ingestion/01_scrape.py che:

1. Usa l'API GitHub (requests + token da env var GITHUB_TOKEN) per cercare repos.
   Queries organizzate per engine (godot, phaser, renpy, defold, monogame, love2d, 
   threejs, stride) × genere. Per ogni engine almeno 8-10 query diverse.
   Filtri: stars >= 20, pushed >= 2025-01-01, size <= 100000 KB.

2. Per ogni repo trovato:
   a) Salva i metadati in data/manifest.json (url, stars, license, language, topics)
   b) git clone --depth 1 in data/repos_raw/{engine}/{repo_name}/
   c) Rate limiting: max 30 richieste/minuto all'API GitHub
   d) Deduplica: se un repo appare in più query, non scaricarlo due volte

3. Dopo le API search, scarica anche le awesome-list per ogni engine:
   - Fetch il README.md, estrai i link GitHub con regex, aggiungi alla lista

4. Scarica i repo ufficiali di demo/samples per ogni engine (lista hardcoded).

5. Logga tutto in data/scrape_log.txt e aggiorna data/manifest.json.

Output atteso: ~400-800 repos clonati in data/repos_raw/
```

**Prompt per Claude Code #4:**

```
Crea lo script Python scripts/ingestion/02_filter.py che:

1. Legge data/manifest.json
2. Per ogni repo in data/repos_raw/:
   a) Verifica struttura minima engine-specifica:
      - Godot: project.godot esiste + almeno 3 file .gd
      - Phaser: almeno 1 file .js con "new Phaser.Game" o "Phaser.Scene"
      - Ren'Py: almeno 1 file .rpy con "label start"
      - Defold: game.project esiste
      - MonoGame: .csproj con riferimento MonoGame
      - LÖVE: main.lua con "love."
      - Three.js: almeno 1 file .js con "THREE."
      - Stride: .csproj o .sdpkg
   b) Conta LOC dei file di codice. Range: 300-30000.
   c) Calcola rapporto commenti/codice. Minimo: 3%.
   d) Verifica licenza (LICENSE, LICENSE.md, COPYING). Lista whitelist.
   e) Per Godot: conta plugin/addons. Max: 5.

3. Genera data/quality_report.json con risultati per ogni repo.
4. Sposta i repo che passano in data/repos_clean/{engine}/
5. Logga i repo scartati con motivo di esclusione.

Output atteso: ~170 repos in repos_clean/
```

---

## 5.4 Giorno 8-11: Parsing Engine-Specific

**Prompt per Claude Code #5 (il più lungo e importante):**

```
Crea lo script Python scripts/ingestion/03_parse_godot.py che parsa 
i progetti Godot in chunks semantici. Questo è lo script più critico.

Per ogni progetto in data/repos_clean/godot/:

STEP A — Leggi project.godot:
  - Estrai [autoload] (singletons), [input] (azioni), [display] (risoluzione),
    [layer_names] (collision layers)
  - Genera un chunk di tipo "structural_pattern" con category E01_project_structure

STEP B — Per ogni file .tscn:
  - Parsa il formato tscn (è testuale, NON binario):
    - Estrai tutti i [node] con: name, type, parent, script reference
    - Estrai tutte le [connection] (segnali connessi)
    - Estrai le [ext_resource] (script e asset collegati)
  - Costruisci l'albero dei nodi come dict Python
  - Identifica il tipo di scena dal nodo root:
    - CharacterBody2D/3D → probabile personaggio
    - Control/CanvasLayer → probabile UI
    - Node2D con TileMap → probabile livello
    - Area2D → trigger/pickup/projectile

STEP C — Per ogni file .gd:
  - Estrai con regex: extends, class_name, tutte le func, tutti i signal,
    tutte le @export var, tutte le @onready var
  - Heuristic classification (SENZA LLM):
    - extends CharacterBody2D + input.is_action → player_controller
    - extends CharacterBody2D + "patrol"/"chase"/"detection" → enemy_ai
    - extends Control / extends CanvasLayer → ui_system
    - extends Resource + @export → data_resource
    - "AudioStreamPlayer" / "AudioServer" → audio_system
    - "save" / "load" / "FileAccess" → save_load_system
    - "NavigationAgent" / "astar" → navigation
    - "TileMap" / "tilemap" → level_structure
  - Assegna confidence: high / medium / low

STEP D — Raggruppamento:
  - Se un player è composto da player.tscn + player_movement.gd + player_combat.gd:
    → Concatena in un singolo chunk con separatori "# === FILE: xxx.gd ==="
  - Il scene_context (dalla .tscn) viene incluso come metadato del chunk

STEP E — Output:
  - Salva ogni chunk come JSON in data/chunks_raw/godot/repo_name/chunk_NNN.json
  - Campi: source_repo, engine, file_paths[], scene_context, code, loc,
    heuristic_category, heuristic_confidence, extends, exports[], 
    functions[], signals_defined[], signals_connected[]

Scrivi il parser come una classe GodotParser con metodi modulari 
riutilizzabili. Include logging dettagliato.
```

**Prompt per Claude Code #6:**

```
Usando la stessa struttura di 03_parse_godot.py, crea:

scripts/ingestion/03_parse_phaser.py — Parser per progetti Phaser 3:
  - Identifica entry point (file con "new Phaser.Game")
  - Estrai config (width, height, physics, scene list)
  - Per ogni classe che estende Phaser.Scene:
    → Analizza preload(), create(), update()
    → Heuristic: player (this.player + this.cursors), level (this.tilemap),
      UI (nome contiene "Menu"/"HUD"), enemies (this.enemies)
  - Output: un chunk per scene, con scene config come contesto

scripts/ingestion/03_parse_renpy.py — Parser per progetti Ren'Py:
  - Leggi tutti i .rpy, estrai: label, menu, define/default, image, 
    transform, screen
  - Chunk per route narrativo (label connessi), chunk per screen custom,
    chunk per configurazione (gui.rpy, options.rpy)

scripts/ingestion/03_parse_generic.py — Parser generico per:
  - Defold (.script Lua + .collection)
  - MonoGame (.cs + .csproj)
  - LÖVE (.lua, partendo da main.lua)
  - Three.js (.js/.ts con THREE.)
  - Stride (.cs + .sdscene)
  Approccio: analisi basata su import/require/using + nomi di classi/funzioni
  + heuristic per categorie principali. Meno preciso di Godot/Phaser parser
  ma sufficiente per la classificazione LLM successiva.
```

---

## 5.5 Giorno 12-14: Classificazione LLM

**Prompt per Claude Code #7:**

```
Crea lo script Python scripts/ingestion/04_classify.py che:

1. Legge tutti i chunk JSON da data/chunks_raw/
2. Per ogni chunk, chiama DeepSeek V4 Flash via API (endpoint DeepSeek diretto 
   O via OpenRouter) con il prompt di classificazione.
   
   Il prompt è (ESATTAMENTE questo, non modificare):
   
   "Sei un esperto di game development. Analizza questo codice {engine}.
   
   Contesto scena: {scene_context}
   Euristica precedente: {heuristic_category} (confidenza: {heuristic_confidence})
   
   CODICE:
   ```
   {code}  (max 3000 token, tronca se necessario)
   ```
   
   Rispondi ESCLUSIVAMENTE con JSON valido, senza commenti, senza markdown:
   {
     "primary_category": "...",
     "subcategories": [...],
     "genre_tags": [...],
     "complexity": "...",
     "design_patterns": [...],
     "key_features": [...],
     "quality_score": N,
     "reusability_score": N,
     "one_line_summary": "...",
     "extracted_parameters": {...}
   }"

3. Rate limiting: max 60 richieste/minuto (DeepSeek)
4. Retry con exponential backoff su errori 429/500
5. Se il JSON non parsa, retry 1 volta con prompt che enfatizza "JSON VALIDO ONLY"
6. Se dopo 2 tentativi non parsa, logga errore e skippa il chunk
7. Salva output in data/chunks_classified/engine/repo/chunk_NNN.json
   (merge dei dati del chunk raw + classificazione LLM)
8. Progress bar con tqdm. Logga costo totale stimato alla fine.
9. Se l'heuristic confidence è "high" e il LLM classifica diversamente,
   logga la discrepanza per review.

Costo stimato: ~6000 chunks × ~$0.0003 = ~$1.80 totali.
```

---

## 5.6 Giorno 15-18: Embedding e Storage

**Prompt per Claude Code #8:**

```
Crea lo script Python scripts/ingestion/05_embed_store.py che:

1. Legge tutti i chunk classificati da data/chunks_classified/

2. Per ogni chunk:
   a) Costruisce il searchable_text:
      f"{summary}\nEngine: {engine}\nCategory: {primary_category}\n
       Subcategories: {subcategories}\nGenres: {genres}\n
       Features: {features}\nPatterns: {patterns}\nComplexity: {complexity}"
   
   b) Genera embedding con OpenAI text-embedding-3-small
      - Batch: 100 testi per chiamata (l'API supporta batch)
      - Costo: ~$0.02 per tutti i chunk
   
   c) Insert in Supabase tabella code_knowledge con tutti i campi
   
   d) Se extracted_parameters non è vuoto:
      - Insert in Supabase tabella game_parameters
      - parameter_group derivato da primary_category:
        A01 → player_physics, A03 → combat_stats, A04 → enemy_stats,
        A05 → camera_settings, C01 → progression_economy, D02 → audio_config
   
   e) Update ingestion_log con status 'embedded'

3. Batch insert: usa supabase-py insert con chunks di 50 righe alla volta
4. Progress bar + log finale con statistiche:
   - Totale chunk inseriti per engine
   - Totale chunk per category
   - Totale parametri inseriti
   - Costo embedding totale
```

---

## 5.7 Giorno 19-21: Test e Integrazione

**Prompt per Claude Code #9:**

```
Crea lo script scripts/ingestion/06_test_queries.ts (TypeScript) che:

1. Importa getReferences e getReferenceParameters da lib/knowledge.ts
2. Esegue una batteria di 20 query di test che verificano la KB:

TEST SUITE:
- "Player controller per platformer Godot" → deve trovare chunk A01 con coyote_time
- "Enemy AI boss multi-fase Godot" → deve trovare chunk A04.08
- "UI main menu Phaser" → deve trovare chunk D01.01 per Phaser
- "Dialogue branching Ren'Py" → deve trovare chunk C03 per Ren'Py
- "Camera con screen shake Godot" → deve trovare chunk A05
- "Save/load system Godot" → deve trovare chunk C04
- "Tilemap con parallax Godot" → deve trovare chunk B01
- "Audio manager singleton Godot" → deve trovare chunk D02
- "Inventory grid system Godot" → deve trovare chunk C02
- "Parametri player_physics per platformer Godot" → deve trovare game_parameters
... (altre 10 query che coprano edge case)

3. Per ogni query:
   - Esegui la query
   - Verifica che almeno 1 risultato abbia la category attesa
   - Stampa: query, n risultati, top result summary, similarity score
   - Flag: PASS / FAIL

4. Output: report con percentuale test passati. Target: > 80%.
```

**Prompt per Claude Code #10 (test end-to-end):**

```
Crea lo script scripts/ingestion/07_comparison_test.ts che dimostra 
il "boost" della Knowledge Base.

1. Definisci un task: "Genera un player controller GDScript per un 
   platformer metroidvania con: movement, jump con coyote time, 
   wall slide, wall jump, dash con i-frames"

2. GENERAZIONE A — SENZA Knowledge Base:
   Chiama DeepSeek V4 Pro con solo il task come prompt.
   Salva output in test_output/without_kb.gd

3. GENERAZIONE B — CON Knowledge Base:
   a) Chiama getReferences() per full_recipe player controller platformer Godot
   b) Chiama getReferences() per single_mechanic wall_jump, dash
   c) Chiama getReferenceParameters() per player_physics platformer
   d) Costruisci prompt arricchito con buildReferenceContext()
   e) Chiama DeepSeek V4 Pro con prompt arricchito
   f) Salva output in test_output/with_kb.gd

4. Stampa entrambi gli output affiancati.
5. Chiama un LLM (Claude Sonnet) per valutare entrambi su 5 criteri:
   - Ha coyote time? (sì/no)
   - Ha input buffering? (sì/no)
   - Ha variable jump height? (sì/no)
   - Usa acceleration/deceleration per il movement? (sì/no)
   - I valori numerici sono in range realistico? (sì/no)
   Punteggio: /5 per ciascuno.

Questo test dimostra concretamente il valore della KB.
```

---

## 5.8 Riepilogo costi totali della Pre-Alpha

| Fase | Risorsa | Costo |
|---|---|---|
| Scraping | GitHub API (free con token) | $0.00 |
| Scraping | Bandwidth git clone (~5GB) | $0.00 |
| Filtering | Solo CPU locale | $0.00 |
| Parsing | Solo CPU locale | $0.00 |
| Classificazione LLM | DeepSeek V4 Flash × 6000 chunk | ~$1.80 |
| Embedding | text-embedding-3-small × 6000 | ~$0.02 |
| Storage | Supabase free tier (< 500MB) | $0.00 |
| Test comparison | 2 chiamate DeepSeek Pro + 1 Claude Sonnet | ~$0.50 |
| **TOTALE** | | **~$2.32** |

Tre settimane di lavoro. Meno di $3 di API. Una Knowledge Base con ~6000 chunk di codice reale da ~170 giochi open-source su 8 engine, classificati, vettorizzati, e interrogabili in <50ms.

Il primo gioco generato dalla piattaforma avrà coyote time, input buffering, screen shake, e valori numerici da giochi veri. Nessun competitor avrà questo vantaggio al lancio.

---

*Questo è il Supreme Knowledge Base & RAG Ingestion Blueprint. Il prossimo passo è aprire il terminale, lanciare Claude Code, e dare in pasto il Prompt #1.*

*La knowledge base si costruisce PRIMA del prodotto. È la fondazione invisibile che rende tutto il resto possibile.*
