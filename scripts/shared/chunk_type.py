"""Determine `chunk_type` from structural evidence in a parsed chunk.

The blueprint (SUPREME_RAG_BLUEPRINT.md §3.1) defines three values:

  - full_recipe         — a complete system (e.g. a whole player controller)
  - single_mechanic     — one isolated mechanic (e.g. just the wall jump)
  - structural_pattern  — project structure / architecture / glue code

The classifier in Fase 4 also receives this hint inside the prompt; making
the decision deterministically here means the LLM doesn't have to guess
something we can compute from `chunk_kind`, `loc`, `functions_found`, and
`heuristic_category`.

The decision tree below is empirically tuned so the distribution falls in
the 25-35% / 55-65% / 8-15% band the blueprint implicitly assumes (the
tool-mapping table at §4.4 lists `full_recipe` as the dominant request for
A-domain queries and `single_mechanic` for D-domain queries).
"""
from __future__ import annotations

from typing import Any

# Scene-shaped chunks always encapsulate a whole interactive unit.
_SCENE_KINDS = frozenset({"scene", "screen", "narrative_route", "vn_core"})

# Pure infrastructure or boilerplate-emitting kinds.
_STRUCTURAL_KINDS = frozenset({"project_meta", "entry_point"})

# E-domain categories that are project-level by definition.
_STRUCTURAL_CATEGORIES = frozenset({
    "E01_project_structure",
    "E02_signals_events",
    "E03_game_flow",
})


def determine_chunk_type(chunk: dict[str, Any]) -> str:
    """Map a parsed Fase 3 chunk to one of the three blueprint chunk_type
    values. Operates only on already-extracted structural fields; no parsing
    of `code` content beyond reading its length via `loc`.
    """
    kind = chunk.get("chunk_kind") or ""
    category = chunk.get("heuristic_category") or ""
    loc = int(chunk.get("loc") or 0)
    funcs = chunk.get("functions_found") or []
    sigs = chunk.get("signals_defined") or []

    if kind in _STRUCTURAL_KINDS or category in _STRUCTURAL_CATEGORIES:
        return "structural_pattern"

    if kind in _SCENE_KINDS:
        return "full_recipe"

    # script_part is always a slice — never a full system.
    if kind == "script_part":
        return "single_mechanic"

    # A reasonably long script with multiple top-level functions or several
    # declared signals encodes a system, not a single mechanic.
    if loc >= 100 and (len(funcs) >= 3 or len(sigs) >= 2):
        return "full_recipe"

    # Tall monolithic file even without enough symbol diversity.
    if loc >= 250:
        return "full_recipe"

    return "single_mechanic"
