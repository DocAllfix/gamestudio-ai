"""Phaser 3 source extraction (regex, no JS AST).

Phaser projects are plain JS/TS — there are no scene files. A "scene" is a
class extending Phaser.Scene with the lifecycle methods preload/create/update.
The game entry point is a `new Phaser.Game({...})` call carrying the canvas
size, physics system and scene list.

We extract just enough structure for heuristic pre-classification and to give
the Fase 4 LLM grounding: per-scene method bodies, the symbols referenced
inside them (this.player, this.cursors, this.tilemap, ...), and the game
config object literal as a raw string.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

JS_MAX_BYTES = 800_000  # skip minified/bundled vendor blobs

GAME_CFG_RE = re.compile(r"new\s+Phaser\.Game\s*\(\s*(\{)", re.S)
# class Foo extends Phaser.Scene  /  class Foo extends Scene
SCENE_CLASS_RE = re.compile(
    r"class\s+([A-Za-z_$][\w$]*)\s+extends\s+"
    r"(?:Phaser\.Scene|Scene)\b",
)
LIFECYCLE = ("preload", "create", "update")


def read_source(path: Path) -> str:
    try:
        if path.stat().st_size > JS_MAX_BYTES:
            return ""
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def _match_balanced(text: str, open_idx: int) -> int:
    """Given the index of an opening brace/paren, return the index just past
    its matching close, scanning while ignoring braces inside strings and
    line/block comments. Returns len(text) if unbalanced (truncated file)."""
    open_ch = text[open_idx]
    close_ch = {"{": "}", "(": ")"}[open_ch]
    depth = 0
    i = open_idx
    n = len(text)
    in_str: str | None = None
    while i < n:
        c = text[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == in_str:
                in_str = None
        elif c in "\"'`":
            in_str = c
        elif c == "/" and i + 1 < n and text[i + 1] == "/":
            j = text.find("\n", i)
            i = n if j == -1 else j
            continue
        elif c == "/" and i + 1 < n and text[i + 1] == "*":
            j = text.find("*/", i + 2)
            i = n if j == -1 else j + 2
            continue
        elif c == open_ch:
            depth += 1
        elif c == close_ch:
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return n


def extract_game_config(text: str) -> str | None:
    """Return the `new Phaser.Game({...})` config object as a raw string,
    or None if this file is not an entry point."""
    m = GAME_CFG_RE.search(text)
    if not m:
        return None
    brace = m.start(1)
    end = _match_balanced(text, brace)
    return text[brace:end]


def _extract_method(class_body: str, name: str) -> str | None:
    """Find a method `name(...) { ... }` inside a class body and return its
    full text (signature + balanced body)."""
    pat = re.compile(rf"(?:^|\n)\s*(?:async\s+)?{re.escape(name)}\s*\([^)]*\)\s*\{{")
    m = pat.search(class_body)
    if not m:
        return None
    brace = class_body.index("{", m.start())
    end = _match_balanced(class_body, brace)
    return class_body[m.start():end].strip()


def extract_scenes(text: str) -> list[dict[str, Any]]:
    """Return one record per Phaser.Scene subclass in this file.

    Each record: {name, code (full class), preload, create, update,
    symbols (set of this.<x> referenced), methods (all method names)}.
    """
    scenes: list[dict[str, Any]] = []
    for m in SCENE_CLASS_RE.finditer(text):
        name = m.group(1)
        brace = text.index("{", m.end() - 1) if "{" in text[m.end() - 1:] \
            else text.find("{", m.end())
        if brace == -1:
            continue
        end = _match_balanced(text, brace)
        body = text[brace:end]
        class_code = text[m.start():end]
        methods = re.findall(r"(?:^|\n)\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{", body)
        symbols = set(re.findall(r"this\.([A-Za-z_$][\w$]*)", body))
        scenes.append({
            "name": name,
            "code": class_code,
            "preload": _extract_method(body, "preload"),
            "create": _extract_method(body, "create"),
            "update": _extract_method(body, "update"),
            "symbols": symbols,
            "methods": methods,
        })
    return scenes


def classify_scene(scene: dict[str, Any]) -> dict[str, str]:
    """Heuristic from blueprint §2.4.3. Priority order matters: a player
    controller signal (cursors + player) outranks the generic UI/level
    checks. Falls back to X00_uncertain at low confidence for the LLM."""
    name = scene["name"].lower()
    symbols = {s.lower() for s in scene["symbols"]}
    create = (scene.get("create") or "").lower()
    update = (scene.get("update") or "").lower()
    blob = f"{create}\n{update}"

    has_player = "player" in symbols or "this.player" in blob
    has_cursors = "cursors" in symbols or "createcursorkeys" in blob \
        or "this.input.keyboard" in blob
    if has_player and has_cursors:
        return _hit("A_core_gameplay", "A01_player_controller", "high")
    if any(k in name for k in ("menu", "title", "hud", "ui", "pause")):
        return _hit("D_presentation", "D01_ui", "high")
    if "tilemap" in symbols or "this.make.tilemap" in blob \
            or "this.add.tilemap" in blob or "map" in symbols:
        return _hit("B_world_level", "B01_level_structure", "medium")
    if "enemies" in symbols or "this.physics.add.group" in blob \
            or "enemy" in symbols:
        return _hit("A_core_gameplay", "A04_enemy_ai", "medium")
    if "boot" in name or "preloader" in name or "load" in name:
        return _hit("E_architecture", "E01_project_structure", "medium")
    if has_player:
        return _hit("A_core_gameplay", "A01_player_controller", "medium")
    return _hit("X_uncertain", "X00_uncertain", "low")


def _hit(domain: str, category: str, conf: str) -> dict[str, str]:
    return {"heuristic_domain": domain,
            "heuristic_category": category,
            "heuristic_confidence": conf}
