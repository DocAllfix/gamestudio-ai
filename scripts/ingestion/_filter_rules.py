"""Quality-filter rules for 02_filter.py (Fase 2 structural gate).

Canonical reference data + pure scoring logic. Split out of 02_filter.py
to respect the 400-line/file cap in CLAUDE.md. Mirrors
docs/SUPREME_RAG_BLUEPRINT.md §2.3.
"""
from __future__ import annotations

from typing import Any

# Check 1 — minimal engine structure. `required` files must exist (anywhere
# in the tree), `has_any` extensions must appear at least once, and
# `content_check` (if set) must appear in at least one file of `has_any` type.
STRUCTURE_CHECKS: dict[str, dict[str, Any]] = {
    "godot": {
        "required": ["project.godot"],
        "has_any": [".gd", ".tscn"],
        "min_code_files": 3,
        "godot4_marker": "config_version=5",   # config_version=4 => Godot 3, reject
    },
    "phaser": {
        "required": [],
        "has_any": [".js", ".ts"],
        "content_check": ["new Phaser.Game", "Phaser.Game", "Phaser.Scene"],
    },
    "renpy": {
        "required": [],
        "has_any": [".rpy"],
        "content_check": ["label start"],
    },
    "defold": {
        "required": ["game.project"],
        "has_any": [".script", ".collection", ".gui_script", ".lua"],
    },
    "monogame": {
        "required": [],
        "has_any": [".csproj"],
        "content_check": ["MonoGame"],
    },
    "love2d": {
        "required": ["main.lua"],
        "has_any": [".lua"],
        "content_check": ["love."],
    },
    "threejs": {
        "required": [],
        "has_any": [".js", ".ts"],
        "content_check": ["THREE.", "three"],
    },
    "stride": {
        "required": [],
        "has_any": [".cs", ".sdpkg", ".csproj"],
    },
}

# Code extensions counted for LOC / comment ratio, per engine.
ENGINE_CODE_EXTS: dict[str, set[str]] = {
    "godot":    {".gd", ".gdshader"},
    "phaser":   {".js", ".ts", ".jsx", ".tsx"},
    "renpy":    {".rpy", ".py"},
    "defold":   {".lua", ".script", ".gui_script", ".render_script"},
    "monogame": {".cs"},
    "love2d":   {".lua"},
    "threejs":  {".js", ".ts", ".jsx", ".tsx"},
    "stride":   {".cs", ".sdsl", ".sdfx"},
}

# Comment-line prefixes by extension family.
COMMENT_PREFIXES: dict[str, tuple[str, ...]] = {
    ".gd": ("#",), ".gdshader": ("//",),
    ".py": ("#",), ".rpy": ("#",),
    ".js": ("//", "*", "/*"), ".ts": ("//", "*", "/*"),
    ".jsx": ("//", "*", "/*"), ".tsx": ("//", "*", "/*"),
    ".lua": ("--",), ".script": ("--",), ".gui_script": ("--",),
    ".render_script": ("--",),
    ".cs": ("//", "*", "/*"), ".sdsl": ("//",), ".sdfx": ("//",),
}

MIN_LOC = 300
MAX_LOC = 30_000
MIN_COMMENT_RATIO = 0.03
MAX_PLUGINS = 5          # addons/ subfolders (Godot)
MAX_AUTOLOADS = 10       # [autoload] entries in project.godot (Godot)

ALLOWED_LICENSES = [
    "MIT", "CC0-1.0", "CC0", "Apache-2.0", "Apache 2.0", "BSD-2-Clause",
    "BSD-3-Clause", "Unlicense", "ISC", "Zlib", "zlib",
]

# Substrings that identify a license inside a LICENSE/COPYING file body.
LICENSE_BODY_MARKERS: dict[str, list[str]] = {
    "MIT": ["mit license", "permission is hereby granted, free of charge"],
    "Apache-2.0": ["apache license", "version 2.0"],
    "BSD-3-Clause": ["redistribution and use in source and binary forms",
                     "neither the name of"],
    "BSD-2-Clause": ["redistribution and use in source and binary forms"],
    "CC0-1.0": ["cc0 1.0", "no copyright", "public domain dedication"],
    "Unlicense": ["this is free and unencumbered software released into the"
                  " public domain"],
    "ISC": ["isc license", "permission to use, copy, modify"],
    "Zlib": ["zlib license", "altered source versions must be plainly marked"],
}

LICENSE_FILENAMES = (
    "license", "license.md", "license.txt", "licence", "licence.md",
    "copying", "copying.txt", "unlicense", "license-mit",
)


def score_repo(checks: dict[str, Any]) -> tuple[int, bool, str]:
    """Return (quality_score 1-5, pass, reason_if_failed).

    Scoring (BLUEPRINT §2.3 / MASTER prompt):
      5: all checks pass, LOC 1000-10000, comments > 8%
      4: all pass, LOC in [300, 30000], comments > 5%
      3: all pass but marginal (LOC near limits or comments 3-5%)
      2: one NON-critical check failed (e.g. comment ratio just under 3%)
      1: a CRITICAL check failed -> discard
    Repos with score >= 3 are copied to data/repos_clean/.
    """
    structure = checks["structure"]
    loc = checks["loc"]
    loc_ok = checks["loc_ok"]
    cr = checks["comment_ratio"]
    plugins_ok = checks["plugins_ok"]

    # Critical failures -> score 1, discard.
    if not structure["ok"]:
        return 1, False, f"structure_failed:{structure['reason']}"
    if loc == 0:
        return 1, False, "no_engine_code"
    if not loc_ok:
        if loc < MIN_LOC:
            return 1, False, f"loc_too_small({loc}<{MIN_LOC})"
        return 1, False, f"loc_too_large({loc}>{MAX_LOC})"
    if not plugins_ok:
        return 1, False, checks["plugins_reason"]

    # All structural/critical checks pass. Grade by comments + LOC band.
    comment_ok = cr >= MIN_COMMENT_RATIO
    in_sweet_loc = 1000 <= loc <= 10000

    if comment_ok and cr > 0.08 and in_sweet_loc:
        return 5, True, ""
    if comment_ok and cr > 0.05:
        return 4, True, ""
    if comment_ok:
        return 3, True, ""
    # Comment ratio below 3% is the only failure -> non-critical, score 2.
    return 2, False, f"low_comment_ratio({cr:.3f}<{MIN_COMMENT_RATIO})"
