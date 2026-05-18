"""Heuristic domain triage (Step 1 della classificazione 2-step).

Difesa #2 del RAG Defense Mechanism (MASTER_EXECUTION_PLAN §01.3): assegna
un dominio a un chunk basandosi su keyword di superficie, *prima* che l'LLM
veda il codice. Se l'heuristic ha confidence "high", l'LLM riceve il dominio
come vincolo e sceglie solo dentro 4-5 categorie invece che 22.

Per ora keyword-based con vocabolario Godot-centrico (il primo engine target).
Sarà esteso nella Fase 3 con regole engine-specific.
"""
from __future__ import annotations

from typing import Final, Literal


ConfidenceLevel = Literal["high", "medium", "low"]

# Vocabolario Godot — i parser per Phaser/Ren'Py/etc. estenderanno questo dict
# nella Fase 3. Le keyword sono cercate case-sensitive: `CharacterBody2D` non
# matcha `characterbody2d`, perché in Godot i type sono CamelCase by spec.
DOMAIN_HEURISTICS: Final[dict[str, list[str]]] = {
    "A_core_gameplay": [
        "CharacterBody2D", "CharacterBody3D", "velocity", "move_and_slide",
        "input.is_action", "hitbox", "hurtbox", "damage", "health", "hp",
        "enemy", "patrol", "chase", "camera", "Camera2D", "Camera3D",
    ],
    "B_world_level": [
        "TileMap", "TileSet", "tilemap", "NavigationRegion", "NavigationAgent",
        "spawn", "level", "parallax", "collision_layer", "collision_mask",
        "RayCast", "Area2D", "trigger", "one_way",
    ],
    "C_meta_game": [
        "inventory", "item", "quest", "dialogue", "ink_story",
        "save", "load", "FileAccess", "ConfigFile", "xp", "level_up",
        "skill_tree", "crafting", "loot", "drop",
    ],
    "D_presentation": [
        "Control", "CanvasLayer", "Label", "TextureRect", "Button",
        "menu", "hud", "AudioStreamPlayer", "AudioServer", "AudioBus",
        "Particles", "GPUParticles", "shader", "CanvasItemMaterial",
        "ShaderMaterial", "post_process", "PointLight2D",
    ],
    "E_architecture": [
        "autoload", "singleton", "signal", "emit_signal", "EventBus",
        "GameManager", "SceneTree", "change_scene", "export_presets",
        "project.godot",
    ],
}

HIGH_CONFIDENCE_MIN_HITS: Final[int] = 3
MEDIUM_CONFIDENCE_MIN_HITS: Final[int] = 2


def heuristic_domain_triage(code: str, engine: str) -> tuple[str, ConfidenceLevel]:
    """Ritorna (domain, confidence_level) per un chunk di codice.

    - 3+ keyword di un dominio: ("A_core_gameplay", "high"), dominio fissato.
    - 2 keyword: medium, dominio probabile ma l'LLM può rivedere.
    - <2 keyword (o engine non Godot in questa versione): ("X_uncertain", "low").

    Quando più domini matchano con confidence pari, vince quello con più hit
    assoluti; in caso di parità totale vince l'ordine canonico in DOMAIN_HEURISTICS.

    `engine` è accettato per estensioni future (Phase 3 aggiungerà vocabolari
    per Phaser/Ren'Py/etc.); per ora solo `godot` ha keyword.
    """
    if engine != "godot":
        return ("X_uncertain", "low")

    hits_by_domain: dict[str, int] = {}
    for domain, keywords in DOMAIN_HEURISTICS.items():
        hits = sum(1 for kw in keywords if kw in code)
        if hits > 0:
            hits_by_domain[domain] = hits

    if not hits_by_domain:
        return ("X_uncertain", "low")

    best_domain = max(hits_by_domain, key=lambda d: hits_by_domain[d])
    best_hits = hits_by_domain[best_domain]

    if best_hits >= HIGH_CONFIDENCE_MIN_HITS:
        return (best_domain, "high")
    if best_hits >= MEDIUM_CONFIDENCE_MIN_HITS:
        return (best_domain, "medium")
    return ("X_uncertain", "low")
