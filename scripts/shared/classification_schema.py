"""JSON Schema per la classificazione LLM dei chunk di codice.

Usato come `response_format` constraint con DeepSeek V4 Flash (Structured Output)
e validato con `jsonschema.validate()` post-call come seconda barriera.

Enum importati da `taxonomy.py`: la sorgente di verità è una sola.
"""
from __future__ import annotations

from typing import Any, Final

from .taxonomy import (
    COMPLEXITY_LEVELS,
    DESIGN_PATTERNS,
    DOMAINS,
    GENRE_TAGS,
    KEY_FEATURES,
    PRIMARY_CATEGORIES,
)


CLASSIFICATION_SCHEMA: Final[dict[str, Any]] = {
    "type": "object",
    "required": [
        "domain",
        "primary_category",
        "subcategories",
        "genre_tags",
        "complexity",
        "design_patterns",
        "key_features",
        "quality_score",
        "reusability_score",
        "confidence_score",
        "one_line_summary",
        "extracted_parameters",
        "rejection_reason",
    ],
    "properties": {
        "domain": {"type": "string", "enum": DOMAINS},
        "primary_category": {"type": "string", "enum": PRIMARY_CATEGORIES},
        "subcategories": {
            "type": "array",
            "items": {"type": "string", "pattern": r"^[A-E][0-9]{2}\.[0-9]{2}$"},
            "maxItems": 8,
        },
        "genre_tags": {
            "type": "array",
            "items": {"type": "string", "enum": GENRE_TAGS},
        },
        "complexity": {"type": "string", "enum": COMPLEXITY_LEVELS},
        "design_patterns": {
            "type": "array",
            "items": {"type": "string", "enum": DESIGN_PATTERNS},
        },
        "key_features": {
            "type": "array",
            "items": {"type": "string", "enum": KEY_FEATURES},
        },
        "quality_score": {"type": "integer", "minimum": 1, "maximum": 5},
        "reusability_score": {"type": "integer", "minimum": 1, "maximum": 5},
        "confidence_score": {"type": "integer", "minimum": 0, "maximum": 100},
        "one_line_summary": {"type": "string", "maxLength": 120},
        "extracted_parameters": {"type": "object"},
        "rejection_reason": {"type": ["string", "null"]},
    },
    "additionalProperties": False,
}
