"""TSCN parser for Godot 4 scenes.

The `.tscn` format is a Godot-specific text format (NOT INI). Sections
start with `[<kind> key=value ...]` headers; the body of each section
contains `key = value` assignments until the next header.

We extract:
  - ext_resources:  id -> {type, path}      (scripts, textures, tres)
  - sub_resources:  id -> {type, ...}       (inline shapes, materials)
  - nodes:          [{name, type, parent_path, script_path, properties}]
  - connections:    [{signal, source, target, method}]

The output `scene_context` string is a one-liner the LLM gets later,
e.g. "CharacterBody2D > AnimatedSprite2D, CollisionShape2D, Hitbox(Area2D)".
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

# `[gd_scene load_steps=N format=3]` / `[ext_resource ...]` / `[node ...]` etc.
SECTION_HEADER_RE = re.compile(r"^\[(?P<kind>\w+)(?P<attrs>[^\]]*)\]\s*$")
ATTR_RE = re.compile(r'(\w+)\s*=\s*"([^"]*)"|(\w+)\s*=\s*([\w./-]+)')
EXTRES_REF_RE = re.compile(r'ExtResource\(\s*"?(?P<id>[^")\s]+)"?\s*\)')
TSCN_MAX_BYTES = 2_000_000  # safety net against an oversized scene


def _parse_attrs(attrs: str) -> dict[str, str]:
    """`type="X" path="res://..." id="1"` -> {"type":"X", "path":..., "id":"1"}.
    """
    out: dict[str, str] = {}
    for m in ATTR_RE.finditer(attrs):
        if m.group(1):
            out[m.group(1)] = m.group(2)
        else:
            out[m.group(3)] = m.group(4)
    return out


def _read_tscn(path: Path) -> str | None:
    try:
        if path.stat().st_size > TSCN_MAX_BYTES:
            return None
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return None


def _walk_sections(text: str) -> list[tuple[str, dict[str, str], str]]:
    """Yield (kind, header_attrs, body) for every section in the file."""
    sections: list[tuple[str, dict[str, str], str]] = []
    lines = text.splitlines()
    cur_kind: str | None = None
    cur_attrs: dict[str, str] = {}
    cur_body: list[str] = []
    for line in lines:
        m = SECTION_HEADER_RE.match(line)
        if m:
            if cur_kind is not None:
                sections.append((cur_kind, cur_attrs, "\n".join(cur_body)))
            cur_kind = m.group("kind")
            cur_attrs = _parse_attrs(m.group("attrs"))
            cur_body = []
        else:
            if cur_kind is not None:
                cur_body.append(line)
    if cur_kind is not None:
        sections.append((cur_kind, cur_attrs, "\n".join(cur_body)))
    return sections


def _resolve_node_parent_path(name: str, parent_attr: str | None,
                              by_name: dict[str, str]) -> str:
    """Godot encodes node parent as a relative path: '.' = root,
    'Container' = sibling-of-root, 'Container/Inner' = nested. We compose
    a slash-joined absolute path from the root."""
    if not parent_attr or parent_attr in (".",):
        return name
    return f"{parent_attr}/{name}"


def _body_value(body: str, key: str) -> str | None:
    """Find a top-level `key = value` line in the section body."""
    m = re.search(rf"^\s*{re.escape(key)}\s*=\s*(.+?)\s*$", body, re.M)
    return m.group(1) if m else None


def parse_tscn(path: Path) -> dict[str, Any]:
    """Parse a single .tscn file and return a structured dict.

    Returns dict with keys: ext_resources, sub_resources, nodes,
    connections, root_type, scene_context, file_path. On failure
    (oversized / unreadable / wrong header) returns the same shape
    but with empty containers and 'ok': False.
    """
    empty: dict[str, Any] = {
        "ok": False, "file_path": path.as_posix(),
        "ext_resources": {}, "sub_resources": {}, "nodes": [],
        "connections": [], "root_type": None, "scene_context": "",
    }
    text = _read_tscn(path)
    if text is None or not text.lstrip().startswith("[gd_scene"):
        return empty

    sections = _walk_sections(text)
    ext_resources: dict[str, dict[str, str]] = {}
    sub_resources: dict[str, dict[str, str]] = {}
    nodes: list[dict[str, Any]] = []
    connections: list[dict[str, str]] = []

    for kind, attrs, body in sections:
        if kind == "ext_resource":
            rid = attrs.get("id") or attrs.get("uid") or ""
            ext_resources[rid] = {
                "type": attrs.get("type", ""),
                "path": attrs.get("path", ""),
            }
        elif kind == "sub_resource":
            rid = attrs.get("id") or ""
            sub_resources[rid] = {"type": attrs.get("type", "")}
        elif kind == "node":
            name = attrs.get("name", "?")
            node_type = attrs.get("type", "")
            parent_attr = attrs.get("parent")
            script_path: str | None = None
            script_line = _body_value(body, "script")
            if script_line:
                ref = EXTRES_REF_RE.search(script_line)
                if ref:
                    res = ext_resources.get(ref.group("id"), {})
                    if res.get("type") == "Script":
                        script_path = res.get("path")
            nodes.append({
                "name": name,
                "type": node_type,
                "parent_path": parent_attr,
                "abs_path": _resolve_node_parent_path(name, parent_attr, {}),
                "script_path": script_path,
            })
        elif kind == "connection":
            connections.append({
                "signal": attrs.get("signal", ""),
                "source": attrs.get("from", ""),
                "target": attrs.get("to", ""),
                "method": attrs.get("method", ""),
            })

    root_type = nodes[0]["type"] if nodes else None
    scene_context = build_scene_context(nodes)

    return {
        "ok": True,
        "file_path": path.as_posix(),
        "ext_resources": ext_resources,
        "sub_resources": sub_resources,
        "nodes": nodes,
        "connections": connections,
        "root_type": root_type,
        "scene_context": scene_context,
    }


def build_scene_context(nodes: list[dict[str, Any]]) -> str:
    """One-line summary of the scene shape, used as RAG grounding.

    Example output:
      "CharacterBody2D > AnimatedSprite2D, CollisionShape2D, Hitbox(Area2D)"
    Root node first, then immediate children (with the child's own
    children parenthesised one level deep). Beyond depth-2 we elide
    with '...' so a 50-node tree stays in a single readable line.
    """
    if not nodes:
        return ""
    root = nodes[0]
    children_by_parent: dict[str, list[dict[str, Any]]] = {}
    for n in nodes[1:]:
        parent = n.get("parent_path") or "."
        children_by_parent.setdefault(parent, []).append(n)

    def fmt_child(n: dict[str, Any]) -> str:
        # Children one level below this node (grandchildren of root).
        gc_parent = n.get("name") if (n.get("parent_path") in (".", None)) \
            else f"{n['parent_path']}/{n['name']}"
        gcs = children_by_parent.get(gc_parent, [])
        if not gcs:
            return f"{n['name']}({n['type']})"
        gc_types = [g["type"] for g in gcs[:3]]
        more = "..." if len(gcs) > 3 else ""
        return f"{n['name']}({n['type']} > {', '.join(gc_types)}{more})"

    root_children = children_by_parent.get(".", []) + \
        children_by_parent.get(root.get("name", ""), [])
    if not root_children:
        return root.get("type") or ""
    head = root.get("type") or "?"
    body = ", ".join(fmt_child(c) for c in root_children[:8])
    if len(root_children) > 8:
        body += ", ..."
    return f"{head} > {body}"


def find_scripts_in_scene(scene: dict[str, Any]) -> list[str]:
    """Return resource paths of all scripts attached to nodes in this scene.
    Paths use Godot's `res://` prefix; the caller resolves them against the
    project root."""
    return [n["script_path"] for n in scene["nodes"] if n.get("script_path")]


def resolve_res_path(res_path: str, project_root: Path) -> Path | None:
    """Map a Godot `res://path/to/file.gd` to the on-disk path.

    `project_root` is the directory containing project.godot. Returns
    None when the path falls outside the project root (defensive).
    """
    if not res_path:
        return None
    cleaned = res_path.replace("res://", "").lstrip("/")
    candidate = (project_root / cleaned).resolve()
    try:
        candidate.relative_to(project_root.resolve())
    except ValueError:
        return None
    return candidate
