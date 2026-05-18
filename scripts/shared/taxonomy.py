"""Tassonomia del dataset — Game Studio AI.

Fonte di verità unica per domini, categorie, generi, feature, engine,
filtri data, licenze e mapping verso game_parameters.

Ogni script di ingestion importa da qui. Mai duplicare questi valori altrove:
se manca un enum, aggiungilo qui — non in uno script downstream.
"""
from __future__ import annotations

from typing import Final


DOMAINS: Final[list[str]] = [
    "A_core_gameplay",
    "B_world_level",
    "C_meta_game",
    "D_presentation",
    "E_architecture",
    "X_uncertain",
]

PRIMARY_CATEGORIES: Final[list[str]] = [
    "A01_player_controller", "A02_state_machine", "A03_combat",
    "A04_enemy_ai", "A05_camera",
    "B01_level_structure", "B02_procedural_gen", "B03_physics_collision", "B04_navigation",
    "C01_progression", "C02_inventory", "C03_dialogue_narrative", "C04_save_load",
    "D01_ui", "D02_audio", "D03_vfx",
    "E01_project_structure", "E02_signals_events", "E03_game_flow", "E04_genre_specific",
    "X00_uncertain", "X01_utility", "X02_trash",
]

GENRE_TAGS: Final[list[str]] = [
    "platformer", "metroidvania", "roguelike", "rpg", "jrpg",
    "visual_novel", "puzzle", "card_game", "horror", "arcade",
    "sim", "tower_defense", "racing", "rhythm", "stealth",
    "bullet_hell", "fighting", "survival", "sandbox", "generic",
]

KEY_FEATURES: Final[list[str]] = [
    "coyote_time", "wall_jump", "dash", "i_frames", "screen_shake",
    "hit_stop", "input_buffer", "combo", "patrol", "chase",
    "boss_phase", "typewriter_text", "branching_dialogue", "wave_spawner",
    "parallax", "day_night_cycle", "save_checkpoint", "inventory_grid",
    "crafting", "skill_tree", "procedural_gen", "pathfinding",
    "steering", "loot_drop", "xp_leveling", "camera_follow",
    "camera_shake", "dead_zone", "one_way_platform", "moving_platform",
    "destructible", "projectile", "knockback", "damage_number",
    "health_bar", "minimap", "audio_spatial", "bgm_crossfade",
    "footstep_system", "particle_effect", "shader_custom",
    "post_processing", "squash_stretch", "none",
]

DESIGN_PATTERNS: Final[list[str]] = [
    "state_machine", "observer", "singleton", "component",
    "strategy", "command", "factory", "object_pool",
    "behavior_tree", "pub_sub", "mediator", "decorator", "none",
]

COMPLEXITY_LEVELS: Final[list[str]] = ["basic", "intermediate", "advanced"]

ENGINES: Final[list[str]] = [
    "godot", "phaser", "renpy", "defold", "monogame", "love2d", "threejs", "stride",
]

# `pushed:>=` filter per engine — il 2025-01-01 del Blueprint originale escludeva
# il 70% dei progetti Godot 4 (rilasciato marzo 2023). La protezione contro
# Godot 3 NON è la data ma il check `config_version=5` in 02_filter.py.
PUSHED_FILTERS: Final[dict[str, str]] = {
    "godot":    "2022-06-01",
    "phaser":   "2021-01-01",
    "renpy":    "2021-01-01",
    "defold":   "2021-01-01",
    "monogame": "2021-01-01",
    "love2d":   "2021-01-01",
    "threejs":  "2022-01-01",
    "stride":   "2021-01-01",
}

ALLOWED_LICENSES: Final[list[str]] = [
    "MIT", "CC0-1.0", "Apache-2.0", "BSD-2-Clause",
    "BSD-3-Clause", "Unlicense", "ISC", "Zlib",
]

CATEGORY_TO_PARAM_GROUP: Final[dict[str, str]] = {
    "A01_player_controller": "player_physics",
    "A02_state_machine": "player_physics",
    "A03_combat": "combat_stats",
    "A04_enemy_ai": "enemy_stats",
    "A05_camera": "camera_settings",
    "C01_progression": "progression_economy",
    "D02_audio": "audio_config",
}
