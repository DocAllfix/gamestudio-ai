# Coverage snapshot — 2026-05-22 (Fase 1ter post-cap)

**Total chunks**: 7503  |  **Engines covered**: 8

Per-engine totals:

| Engine | Total |
|---|---:|
| godot | 2480 |
| phaser | 971 |
| renpy | 496 |
| defold | 796 |
| monogame | 846 |
| love2d | 718 |
| threejs | 981 |
| stride | 215 |

## 1. Heatmap engine x category (chunk count)

Cells at or above 50 are well covered; 5-49 thin; 0-4 critical gap.
Cap=250 is applied to fat cells (godot.E01/E02/D01, threejs.E01,
monogame.E01, renpy.D01).

| category | godot | phaser | renpy | defold | monogame | love2d | threejs | stride |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **A01_player_controller** | 224 | 205 | 0 | 61 | 13 | 20 | 69 | 35 |
| **A02_state_machine** | 41 | 15 | 0 | 16 | 19 | 6 | 9 | 4 |
| **A03_combat** | 139 | 11 | 1 | 3 | 7 | 5 | 8 | 2 |
| **A04_enemy_ai** | 86 | 4 | 0 | 15 | 10 | 18 | 16 | 1 |
| **A05_camera** | 36 | 72 | 0 | 37 | 8 | 8 | 24 | 17 |
| **B01_level_structure** | 57 | 47 | 1 | 24 | 28 | 15 | 45 | 3 |
| **B02_procedural_gen** | 60 | 4 | 0 | 5 | 3 | 6 | 23 | 1 |
| **B03_physics_collision** | 23 | 84 | 0 | 13 | 17 | 19 | 12 | 56 |
| **B04_navigation** | 22 | 0 | 0 | 6 | 5 | 3 | 9 | 4 |
| **C01_progression** | 36 | 2 | 5 | 17 | 0 | 3 | 4 | 0 |
| **C02_inventory** | 109 | 4 | 12 | 13 | 1 | 6 | 4 | 0 |
| **C03_dialogue_narrative** | 103 | 0 | 122 | 15 | 0 | 1 | 3 | 0 |
| **C04_save_load** | 157 | 0 | 26 | 38 | 1 | 4 | 7 | 0 |
| **D01_ui** | 250 | 224 | 250 | 126 | 208 | 180 | 167 | 21 |
| **D02_audio** | 35 | 34 | 7 | 12 | 23 | 14 | 25 | 3 |
| **D03_vfx** | 104 | 175 | 0 | 58 | 47 | 13 | 116 | 11 |
| **E01_project_structure** | 250 | 32 | 49 | 118 | 250 | 188 | 250 | 34 |
| **E02_signals_events** | 250 | 15 | 0 | 86 | 50 | 26 | 61 | 4 |
| **E03_game_flow** | 131 | 43 | 2 | 34 | 45 | 82 | 28 | 12 |
| **E04_genre_specific** | 194 | 0 | 21 | 15 | 6 | 8 | 33 | 0 |
| **X01_utility** | 173 | 0 | 0 | 84 | 105 | 93 | 68 | 7 |

## 2. Zero-cells (priorita massima per Gemini Deep Research)

**22 cells at 0 chunks**:

- 
- 
- 
- 
- 
-   *(semi-expected for VN engine)*
-   *(semi-expected for VN engine)*
-   *(semi-expected for VN engine)*
-   *(semi-expected for VN engine)*
-   *(semi-expected for VN engine)*
-   *(semi-expected for VN engine)*
-   *(semi-expected for VN engine)*
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 

## 3. Thin cells (<5 chunk, priorita alta)

**26 cells thin**:

- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 

## 4. Genre coverage (how many engines back each genre with >=5 chunks)

| genre | total | engines>=5 | top engine | engines distribution |
|---|---:|---:|---|---|
| platformer | 219 | 6/8 | godot=73 | godot=73, phaser=52, love2d=36, monogame=28, defold=16, stride=12, threejs=2 |
| metroidvania | 54 | 2/8 | godot=45 | godot=45, monogame=6, defold=3 |
| roguelike | 52 | 1/8 | godot=46 | godot=46, love2d=4, defold=1, phaser=1 |
| rpg | 384 | 5/8 | godot=301 | godot=301, defold=30, love2d=20, renpy=18, phaser=11, stride=3, monogame=1 |
| jrpg | 1 | 0/8 | phaser=1 | phaser=1 |
| visual_novel | 464 | 3/8 | renpy=327 | renpy=327, godot=109, defold=27, love2d=1 |
| puzzle | 59 | 5/8 | phaser=16 | phaser=16, godot=15, defold=9, love2d=9, threejs=7, renpy=3 |
| card_game | 72 | 2/8 | godot=65 | godot=65, phaser=7 |
| horror | 8 | 1/8 | renpy=7 | renpy=7, phaser=1 |
| arcade | 174 | 7/8 | phaser=70 | phaser=70, threejs=29, love2d=21, godot=16, defold=15, monogame=12, stride=11 |
| sim | 80 | 3/8 | godot=32 | godot=32, threejs=25, defold=13, stride=4, love2d=3, phaser=2, monogame=1 |
| tower_defense | 12 | 1/8 | godot=8 | godot=8, threejs=2, defold=1, phaser=1 |
| racing | 34 | 2/8 | godot=22 | godot=22, threejs=5, defold=3, love2d=2, phaser=2 |
| rhythm | 23 | 2/8 | threejs=10 | threejs=10, godot=6, phaser=3, love2d=2, monogame=2 |
| **stealth** | 0 | 0 | (none) | empty across all 8 engines |
| bullet_hell | 26 | 3/8 | phaser=9 | phaser=9, monogame=6, godot=5, defold=4, threejs=2 |
| fighting | 12 | 1/8 | godot=8 | godot=8, monogame=2, phaser=1, threejs=1 |
| survival | 14 | 2/8 | threejs=8 | threejs=8, godot=6 |
| sandbox | 58 | 4/8 | godot=18 | godot=18, threejs=18, phaser=8, defold=5, stride=4, love2d=3, monogame=2 |
| generic | 6195 | 8/8 | godot=2082 | godot=2082, threejs=903, phaser=826, monogame=807, defold=723, love2d=638, stride=195, renpy=21 |

## 5. Key-features counts (how many chunks carry each feature)

| feature | count | status |
|---|---:|---|
| coyote_time | 22 | OK |
| wall_jump | 13 | OK |
| dash | 15 | OK |
| i_frames | 13 | OK |
| screen_shake | 69 | good |
| hit_stop | 7 | thin |
| input_buffer | 45 | good |
| combo | 14 | OK |
| patrol | 32 | good |
| chase | 25 | OK |
| boss_phase | 6 | thin |
| typewriter_text | 140 | good |
| branching_dialogue | 346 | good |
| wave_spawner | 26 | OK |
| parallax | 26 | OK |
| day_night_cycle | 26 | OK |
| save_checkpoint | 253 | good |
| inventory_grid | 96 | good |
| crafting | 13 | OK |
| skill_tree | 18 | OK |
| procedural_gen | 158 | good |
| pathfinding | 76 | good |
| steering | 61 | good |
| loot_drop | 37 | good |
| xp_leveling | 23 | OK |
| camera_follow | 296 | good |
| camera_shake | 72 | good |
| dead_zone | 86 | good |
| one_way_platform | 44 | good |
| moving_platform | 28 | OK |
| destructible | 53 | good |
| projectile | 164 | good |
| knockback | 51 | good |
| damage_number | 40 | good |
| health_bar | 170 | good |
| minimap | 25 | OK |
| audio_spatial | 88 | good |
| bgm_crossfade | 70 | good |
| footstep_system | 9 | thin |
| particle_effect | 191 | good |
| shader_custom | 347 | good |
| post_processing | 180 | good |
| squash_stretch | 26 | OK |
| none | 5447 | good |

---

Generated from code_knowledge on 2026-05-22 (post-cap, post-Fase-1ter).