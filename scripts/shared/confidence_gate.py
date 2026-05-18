"""Confidence Gate — smista i chunk classificati in accept / quarantine / reject.

Difesa #3 del RAG Defense Mechanism (MASTER_EXECUTION_PLAN §01.4).
Usato da 04_classify.py (per loggare l'esito) e 05_embed_store.py (per filtrare
quali chunk finiscono in `code_knowledge` vs `code_knowledge_quarantine`).
"""
from __future__ import annotations

from typing import Any, Final, Literal


GateOutcome = Literal["accepted", "quarantined", "rejected"]

ACCEPT_THRESHOLD: Final[int] = 85
QUARANTINE_THRESHOLD: Final[int] = 60


def gate_classification(classification: dict[str, Any]) -> GateOutcome:
    """Smista una classificazione LLM in accepted / quarantined / rejected.

    Regole (ordine di priorità):
    1. `primary_category == "X02_trash"` → rejected (sempre).
    2. `rejection_reason` non null → rejected (sempre).
    3. `confidence_score >= 85` → accepted.
    4. `60 <= confidence_score < 85` → quarantined.
    5. `confidence_score < 60` → rejected.
    """
    if classification.get("primary_category") == "X02_trash":
        return "rejected"
    if classification.get("rejection_reason") is not None:
        return "rejected"

    confidence = classification.get("confidence_score", 0)
    if not isinstance(confidence, int):
        return "rejected"

    if confidence >= ACCEPT_THRESHOLD:
        return "accepted"
    if confidence >= QUARANTINE_THRESHOLD:
        return "quarantined"
    return "rejected"
