"""Ren'Py .rpy extraction (regex + indentation blocks).

Ren'Py script is Python-flavoured but its top-level constructs are
statement keywords introducing indentation blocks: label, menu, screen,
transform, image, define, default, character. We don't need a full parser —
we slice top-level blocks by their header line and following indentation.

The parser groups results into the chunk concepts from blueprint §2.4.4:
  - a "narrative route" = a cluster of label blocks (often with menu choices)
  - each custom screen block = a UI chunk
  - config files (gui.rpy / options.rpy) = a project-structure chunk
  - character/define declarations = genre-specific (VN) chunk
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

RPY_MAX_BYTES = 1_500_000

LABEL_RE = re.compile(r"^label\s+([A-Za-z_]\w*)", re.M)
SCREEN_RE = re.compile(r"^screen\s+([A-Za-z_]\w*)", re.M)
TRANSFORM_RE = re.compile(r"^transform\s+([A-Za-z_]\w*)", re.M)
IMAGE_RE = re.compile(r"^image\s+([A-Za-z_][\w ]*)", re.M)
DEFINE_RE = re.compile(r"^(?:define|default)\s+([A-Za-z_][\w.]*)", re.M)
CHARACTER_RE = re.compile(
    r"^(?:define\s+)?([A-Za-z_]\w*)\s*=\s*Character\s*\(", re.M)
MENU_RE = re.compile(r"^\s*menu\s*:", re.M)


def read_rpy(path: Path) -> str:
    try:
        if path.stat().st_size > RPY_MAX_BYTES:
            return ""
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def _block_at(lines: list[str], start: int) -> tuple[str, int]:
    """Return (block_text, next_index) for a top-level statement whose header
    is at lines[start]. The block runs until the next line at column 0 that
    is non-blank (a new top-level statement)."""
    body = [lines[start]]
    i = start + 1
    while i < len(lines):
        ln = lines[i]
        if ln.strip() and not ln[0].isspace():
            break
        body.append(ln)
        i += 1
    return "\n".join(body), i


def _collect_blocks(text: str, keyword: str) -> list[tuple[str, str]]:
    """Return [(name, block_text)] for every top-level `keyword <name>:` in
    the file, using indentation to bound each block."""
    lines = text.splitlines()
    out: list[tuple[str, str]] = []
    header_re = re.compile(rf"^{keyword}\s+([A-Za-z_][\w ]*)")
    i = 0
    while i < len(lines):
        m = header_re.match(lines[i])
        if m:
            block, nxt = _block_at(lines, i)
            out.append((m.group(1).strip(), block))
            i = nxt
        else:
            i += 1
    return out


def parse_rpy_file(path: Path) -> dict[str, Any]:
    """Parse one .rpy file into structured pieces. `ok` is False for empty /
    oversized files."""
    text = read_rpy(path)
    if not text:
        return {"ok": False, "path": path, "labels": [], "screens": [],
                "characters": [], "defines": [], "images": [],
                "transforms": [], "has_menu": False, "raw": ""}
    return {
        "ok": True,
        "path": path,
        "raw": text,
        "labels": _collect_blocks(text, "label"),
        "screens": _collect_blocks(text, "screen"),
        "transforms": _collect_blocks(text, "transform"),
        "characters": CHARACTER_RE.findall(text),
        "defines": DEFINE_RE.findall(text),
        "images": [s.strip() for s in IMAGE_RE.findall(text)],
        "has_menu": bool(MENU_RE.search(text)),
    }


def is_config_file(path: Path) -> bool:
    return path.name.lower() in ("options.rpy", "gui.rpy")


def label_has_menu(block_text: str) -> bool:
    return bool(MENU_RE.search(block_text))
