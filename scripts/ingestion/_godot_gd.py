"""GDScript regex parser + deterministic heuristic classifier.

GDScript is Python-like; we don't need a full AST. Regex covers:
  extends, class_name, signal, @export, @onready, func, preload/load.

heuristic_classify() applies the 10 rules from
MASTER_EXECUTION_PLAN.md §3 (Godot Parser), priority order. Returns
domain + category + confidence. Falls back to X00_uncertain when
nothing matches.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

GD_MAX_BYTES = 1_500_000  # safety net: hand-written GDScript never exceeds

EXTENDS_RE     = re.compile(r"^extends\s+([A-Za-z_][\w.]*)", re.M)
CLASS_NAME_RE  = re.compile(r"^class_name\s+([A-Za-z_]\w*)", re.M)
SIGNAL_RE      = re.compile(r"^signal\s+([A-Za-z_]\w*)\s*(\([^)]*\))?", re.M)
EXPORT_RE      = re.compile(
    r"^@export(?:\([^)]*\))?\s+var\s+([A-Za-z_]\w*)\s*"
    r"(?::\s*([A-Za-z_][\w.\[\] ,]*))?\s*(?:=\s*(.+?))?\s*$", re.M,
)
ONREADY_RE     = re.compile(
    r"^@onready\s+var\s+([A-Za-z_]\w*)\s*"
    r"(?::\s*([A-Za-z_][\w.\[\] ,]*))?\s*(?:=\s*(.+?))?\s*$", re.M,
)
FUNC_RE        = re.compile(
    r"^(?:static\s+)?func\s+([A-Za-z_]\w*)\s*\(([^)]*)\)", re.M,
)
PRELOAD_RE     = re.compile(r"""(?:preload|load)\(\s*['"]([^'"]+)['"]\s*\)""")


def _read_gd(path: Path) -> str:
    try:
        if path.stat().st_size > GD_MAX_BYTES:
            return ""
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def parse_gdscript(path: Path) -> dict[str, Any]:
    """Parse a single .gd file with regex (no AST). Empty / oversized
    files return a record with empty lists but ok=True if the path
    existed; downstream consumers can branch on `loc` or `extends`."""
    text = _read_gd(path)
    if not text:
        return {
            "ok": False, "file_path": path.as_posix(),
            "extends": None, "class_name": None,
            "signals": [], "exports": [], "onready_vars": [],
            "functions": [], "preloads": [],
            "loc": 0, "raw_text": "",
        }

    extends_m = EXTENDS_RE.search(text)
    class_name_m = CLASS_NAME_RE.search(text)

    signals = [
        {"name": m.group(1),
         "params": (m.group(2) or "()").strip()}
        for m in SIGNAL_RE.finditer(text)
    ]
    exports = [
        {"name": m.group(1),
         "type": (m.group(2) or "").strip(),
         "default": (m.group(3) or "").strip()}
        for m in EXPORT_RE.finditer(text)
    ]
    onready_vars = [
        {"name": m.group(1),
         "type": (m.group(2) or "").strip(),
         "default": (m.group(3) or "").strip()}
        for m in ONREADY_RE.finditer(text)
    ]
    functions = [
        {"name": m.group(1), "params": m.group(2).strip()}
        for m in FUNC_RE.finditer(text)
    ]
    preloads = [m.group(1) for m in PRELOAD_RE.finditer(text)]

    loc = sum(1 for ln in text.splitlines() if ln.strip())

    return {
        "ok": True, "file_path": path.as_posix(),
        "extends": extends_m.group(1) if extends_m else None,
        "class_name": class_name_m.group(1) if class_name_m else None,
        "signals": signals, "exports": exports,
        "onready_vars": onready_vars,
        "functions": functions, "preloads": preloads,
        "loc": loc, "raw_text": text,
    }


# 10 ordered rules from MASTER_EXECUTION_PLAN §3 (Godot parser).
# Each rule returns (domain, category, confidence) or None.
def _rule_player_controller(code: str, ext: str | None) -> tuple[str, str, str] | None:
    if "input.is_action" in code.lower() or "Input.get_axis" in code:
        return ("A_core_gameplay", "A01_player_controller", "high")
    return None


def _rule_enemy_ai(code: str, ext: str | None) -> tuple[str, str, str] | None:
    cl = code.lower()
    if any(k in cl for k in ("patrol", "chase", "detection_area", "aggro")):
        return ("A_core_gameplay", "A04_enemy_ai", "high")
    return None


def _rule_combat(code: str, ext: str | None) -> tuple[str, str, str] | None:
    cl = code.lower()
    if "hitbox" in cl and "damage" in cl and "hurtbox" in cl:
        return ("A_core_gameplay", "A03_combat", "high")
    return None


def _rule_camera(code: str, ext: str | None) -> tuple[str, str, str] | None:
    if ext in ("Camera2D", "Camera3D"):
        return ("A_core_gameplay", "A05_camera", "high")
    return None


def _rule_ui(code: str, ext: str | None) -> tuple[str, str, str] | None:
    if ext in ("Control", "CanvasLayer"):
        return ("D_presentation", "D01_ui", "medium")
    return None


def _rule_audio(code: str, ext: str | None) -> tuple[str, str, str] | None:
    if "AudioStreamPlayer" in code or "AudioServer" in code:
        return ("D_presentation", "D02_audio", "medium")
    return None


def _rule_save_load(code: str, ext: str | None) -> tuple[str, str, str] | None:
    cl = code.lower()
    if "fileaccess" in cl or "configfile" in cl:
        return ("C_meta_game", "C04_save_load", "medium")
    if "save" in cl and "load" in cl:
        return ("C_meta_game", "C04_save_load", "medium")
    return None


def _rule_navigation(code: str, ext: str | None) -> tuple[str, str, str] | None:
    if "NavigationAgent" in code:
        return ("B_world_level", "B04_navigation", "high")
    return None


def _rule_level(code: str, ext: str | None) -> tuple[str, str, str] | None:
    if "TileMap" in code:
        return ("B_world_level", "B01_level_structure", "medium")
    return None


# Stage 1 — preclassification for 5 categories previously zero in the dataset.
# Medium confidence: the keyword evidence is suggestive, the Fase 4 LLM has
# final say. Order in HEURISTIC_RULES puts them *after* the 9 high-confidence
# rules above so a player_controller signal still wins over a generic
# "current_state" mention.

_STATE_RE = re.compile(
    r"\b(statemachine|state_machine|current_state|enum\s+state)\b", re.I)


def _rule_state_machine(code: str, ext: str | None) -> tuple[str, str, str] | None:
    cl = code.lower()
    if _STATE_RE.search(code) or "transition_to(" in cl or "change_state(" in cl:
        return ("A_core_gameplay", "A02_state_machine", "medium")
    return None


_PROC_KEYWORDS = ("wfc", "wave_function_collapse", "bsp",
                  "cellular_automata", "perlin", "simplex_noise",
                  "fastnoise", "drunkard")


def _rule_procedural(code: str, ext: str | None) -> tuple[str, str, str] | None:
    cl = code.lower()
    if any(k in cl for k in _PROC_KEYWORDS):
        return ("B_world_level", "B02_procedural_gen", "medium")
    return None


_COLLISION_RE = re.compile(
    r"\b(collision_layer|collision_mask|set_collision_layer|"
    r"physics_layer|one_way_collision)\b")


def _rule_collision(code: str, ext: str | None) -> tuple[str, str, str] | None:
    if _COLLISION_RE.search(code):
        return ("B_world_level", "B03_physics_collision", "medium")
    return None


_PROG_RE = re.compile(
    r"\b(xp|experience|level_up|skill_tree|"
    r"quest_state|loot_table|drop_table|gain_xp|add_xp)\b", re.I)


def _rule_progression(code: str, ext: str | None) -> tuple[str, str, str] | None:
    if _PROG_RE.search(code) \
            and ("var " in code or "func " in code or "const " in code):
        return ("C_meta_game", "C01_progression", "medium")
    return None


_INV_KEYWORDS = ("inventory", "item_slot", "add_item",
                 "remove_item", "equipment_slot")


def _rule_inventory(code: str, ext: str | None) -> tuple[str, str, str] | None:
    cl = code.lower()
    if any(k in cl for k in _INV_KEYWORDS) and "func " in cl:
        return ("C_meta_game", "C02_inventory", "medium")
    return None


HEURISTIC_RULES = (
    _rule_player_controller, _rule_enemy_ai, _rule_combat,
    _rule_camera, _rule_navigation,
    _rule_ui, _rule_audio, _rule_save_load, _rule_level,
    _rule_state_machine, _rule_procedural, _rule_collision,
    _rule_progression, _rule_inventory,
)


def heuristic_classify(gd: dict[str, Any],
                       scene_context: str = "") -> dict[str, str]:
    """Apply the 10 ordered heuristic rules to a parsed GDScript record.

    Rule 11 (fallback) returns X00_uncertain with low confidence — fed to
    the LLM later for fine classification.
    Falls back to (X_uncertain, X00_uncertain, low) when nothing fires.
    """
    code = gd.get("raw_text", "")
    ext = gd.get("extends")
    composite = f"{code}\n{scene_context}"
    for rule in HEURISTIC_RULES:
        hit = rule(composite, ext)
        if hit:
            return {
                "heuristic_domain": hit[0],
                "heuristic_category": hit[1],
                "heuristic_confidence": hit[2],
            }
    return {
        "heuristic_domain": "X_uncertain",
        "heuristic_category": "X00_uncertain",
        "heuristic_confidence": "low",
    }
