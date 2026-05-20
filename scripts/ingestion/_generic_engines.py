"""Per-engine extraction for the generic Fase 3 parser.

Covers Defold (.script Lua), MonoGame (.cs), LÖVE (.lua), Three.js (.js/.ts)
and Stride (.cs). The heuristic here is intentionally weak (mostly medium/low
confidence) — the blueprint defers the heavy lifting to the Fase 4 LLM. We
extract import/require/using statements, top-level function/class names, and
match a handful of well-known lifecycle symbols per engine to assign a domain
when it's unambiguous.

Each engine exposes:
  EXTS            : file suffixes to scan
  is_entry(text)  : does this file look like the engine's main module?
  classify(name, text) -> (domain, category, confidence)
  symbols(text)   -> {"functions": [...], "classes": [...], "imports": [...]}
"""
from __future__ import annotations

import re
from typing import Any, Callable

SRC_MAX_BYTES = 800_000

# --- shared symbol extractors -------------------------------------------------

LUA_FUNC_RE = re.compile(r"function\s+([A-Za-z_][\w.:]*)\s*\(", re.M)
LUA_REQUIRE_RE = re.compile(r"""require\s*\(?\s*['"]([^'"]+)['"]""")
CS_USING_RE = re.compile(r"^\s*using\s+([A-Za-z_][\w.]*)\s*;", re.M)
CS_CLASS_RE = re.compile(r"\bclass\s+([A-Za-z_]\w*)")
CS_METHOD_RE = re.compile(
    r"(?:public|protected|private|internal|override|virtual|static|\s)+"
    r"[A-Za-z_][\w<>\[\],. ]*\s+([A-Za-z_]\w*)\s*\([^)]*\)\s*\{")
JS_FUNC_RE = re.compile(
    r"(?:function\s+([A-Za-z_$][\w$]*)|"
    r"(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\()", re.M)
JS_CLASS_RE = re.compile(r"\bclass\s+([A-Za-z_$][\w$]*)")
JS_IMPORT_RE = re.compile(r"""(?:import[^'"]*from\s*|require\s*\(\s*)['"]([^'"]+)['"]""")


def _lua_symbols(text: str) -> dict[str, list[str]]:
    return {"functions": LUA_FUNC_RE.findall(text)[:60],
            "classes": [],
            "imports": LUA_REQUIRE_RE.findall(text)[:40]}


def _cs_symbols(text: str) -> dict[str, list[str]]:
    return {"functions": CS_METHOD_RE.findall(text)[:60],
            "classes": CS_CLASS_RE.findall(text)[:20],
            "imports": CS_USING_RE.findall(text)[:40]}


def _js_symbols(text: str) -> dict[str, list[str]]:
    funcs = [a or b for a, b in JS_FUNC_RE.findall(text)]
    return {"functions": funcs[:60],
            "classes": JS_CLASS_RE.findall(text)[:20],
            "imports": JS_IMPORT_RE.findall(text)[:40]}


def _hit(domain: str, category: str, conf: str) -> tuple[str, str, str]:
    return (domain, category, conf)


def _uncertain() -> tuple[str, str, str]:
    return ("X_uncertain", "X00_uncertain", "low")


# --- Defold (.script Lua) -----------------------------------------------------

def _defold_classify(name: str, text: str) -> tuple[str, str, str]:
    t = text.lower()
    if "on_input" in t and ("action_id" in t or "input" in t):
        return _hit("A_core_gameplay", "A01_player_controller", "medium")
    if "on_message" in t and "message_id" in t:
        return _hit("E_architecture", "E02_signals_events", "medium")
    if "factory.create" in t or "collectionfactory" in t:
        return _hit("B_world_level", "B01_level_structure", "low")
    if name.lower() in ("init.script", "main.script"):
        return _hit("E_architecture", "E03_game_flow", "medium")
    return _uncertain()


def _defold_entry(text: str) -> bool:
    return "function init(" in text or "function update(" in text


# --- MonoGame (.cs) -----------------------------------------------------------

def _monogame_classify(name: str, text: str) -> tuple[str, str, str]:
    if "Initialize(" in text and "LoadContent(" in text \
            and "protected override void Draw" in text:
        return _hit("E_architecture", "E03_game_flow", "high")
    t = text.lower()
    if "keyboard.getstate" in t or "gamepad.getstate" in t \
            or "mouse.getstate" in t:
        return _hit("A_core_gameplay", "A01_player_controller", "medium")
    if "spritebatch" in t and "draw(" in t:
        return _hit("D_presentation", "D03_vfx", "low")
    return _uncertain()


def _monogame_entry(text: str) -> bool:
    return "Microsoft.Xna.Framework" in text and "class Game" in text


# --- LÖVE (.lua) --------------------------------------------------------------

def _love_classify(name: str, text: str) -> tuple[str, str, str]:
    t = text.lower()
    has_load = "function love.load" in t
    has_update = "function love.update" in t
    has_draw = "function love.draw" in t
    if has_load and has_update and has_draw:
        return _hit("E_architecture", "E03_game_flow", "high")
    if "function love.keypressed" in t or "love.keyboard.isdown" in t:
        return _hit("A_core_gameplay", "A01_player_controller", "medium")
    if "function love.draw" in t:
        return _hit("D_presentation", "D03_vfx", "low")
    return _uncertain()


def _love_entry(text: str) -> bool:
    return "function love.load" in text or "function love.update" in text


# --- Three.js (.js/.ts) -------------------------------------------------------

def _threejs_classify(name: str, text: str) -> tuple[str, str, str]:
    if "THREE." not in text and "three" not in text.lower():
        return _uncertain()
    has_scene = "new THREE.Scene" in text
    has_cam = "Camera(" in text
    has_renderer = "Renderer(" in text
    if has_scene and has_cam and has_renderer:
        return _hit("E_architecture", "E01_project_structure", "high")
    t = text.lower()
    if "requestanimationframe" in t and ("animate" in t or "render(" in t):
        return _hit("E_architecture", "E03_game_flow", "medium")
    if "raycaster" in t or "addeventlistener" in t:
        return _hit("A_core_gameplay", "A01_player_controller", "low")
    if has_scene or has_cam:
        return _hit("E_architecture", "E01_project_structure", "medium")
    return _uncertain()


def _threejs_entry(text: str) -> bool:
    return "new THREE.Scene" in text or "new THREE.WebGLRenderer" in text


# --- Stride (.cs) -------------------------------------------------------------

def _stride_classify(name: str, text: str) -> tuple[str, str, str]:
    t = text.lower()
    if "syncscript" in t or "asyncscript" in t or "startupscript" in t:
        if "public override void update" in t or "public override async task execute" in t:
            return _hit("E_architecture", "E03_game_flow", "medium")
    if "input.iskeydown" in t or "input.keyevents" in t:
        return _hit("A_core_gameplay", "A01_player_controller", "medium")
    if "stride.engine" in t or "stride.core" in t:
        return _hit("E_architecture", "E01_project_structure", "low")
    return _uncertain()


def _stride_entry(text: str) -> bool:
    tl = text.lower()
    return "stride.engine" in tl and ("syncscript" in tl or "asyncscript" in tl)


# --- registry -----------------------------------------------------------------

EngineSpec = dict[str, Any]

ENGINES: dict[str, EngineSpec] = {
    "defold": {
        "exts": (".script", ".lua", ".gui_script", ".render_script"),
        "symbols": _lua_symbols, "classify": _defold_classify,
        "is_entry": _defold_entry,
    },
    "monogame": {
        "exts": (".cs",),
        "symbols": _cs_symbols, "classify": _monogame_classify,
        "is_entry": _monogame_entry,
    },
    "love2d": {
        "exts": (".lua",),
        "symbols": _lua_symbols, "classify": _love_classify,
        "is_entry": _love_entry,
    },
    "threejs": {
        "exts": (".js", ".ts", ".mjs"),
        "symbols": _js_symbols, "classify": _threejs_classify,
        "is_entry": _threejs_entry,
    },
    "stride": {
        "exts": (".cs",),
        "symbols": _cs_symbols, "classify": _stride_classify,
        "is_entry": _stride_entry,
    },
}


def get_symbols(engine: str, text: str) -> dict[str, list[str]]:
    fn: Callable[[str], dict[str, list[str]]] = ENGINES[engine]["symbols"]
    return fn(text)


def classify(engine: str, name: str, text: str) -> tuple[str, str, str]:
    return ENGINES[engine]["classify"](name, text)


def is_entry(engine: str, text: str) -> bool:
    return ENGINES[engine]["is_entry"](text)
