"""Post-classification chunk validators.

Placeholder per la Fase 6 (Validation & Test). Le funzioni qui verranno
implementate quando avremo dati reali in `data/chunks_classified/`; per ora
espongono la firma stabile che gli script downstream possono importare senza
romperli al boot.
"""
from __future__ import annotations

from typing import Any


def validate_chunk(chunk: dict[str, Any]) -> bool:
    """Verifica che un chunk classificato sia coerente prima dell'embed.

    Sarà implementata nella Fase 6 con i sanity check di MASTER_EXECUTION_PLAN §01.5
    (distribuzione categorie, scoperture per engine, clustering quality_score, ecc.).
    Per ora ritorna sempre True: nessuno script in Fase 0 chiama questa funzione
    su dati reali, quindi non rischiamo falsi positivi.
    """
    del chunk
    return True
