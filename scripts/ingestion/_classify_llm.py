"""LLM-side primitives for the Fase 4 classifier.

Wraps DeepSeek V4 Flash (OpenAI-compatible API at api.deepseek.com) with:
  - prompt assembly per MASTER_EXECUTION_PLAN §02.5
  - response_format=json_object (DeepSeek does NOT yet accept strict
    json_schema — verified empirically with our CLASSIFICATION_SCHEMA;
    the post-hoc jsonschema.validate() is the binding validator)
  - exponential backoff on 429 / transient errors
  - hard 1-retry on validation failure with a strengthened prompt
  - per-call usage accounting (prompt tokens / completion tokens / USD cost)

The orchestrator (04_classify.py) instantiates one DeepSeekClassifier and
calls classify_chunk(...) once per Fase 3 chunk. No state is shared between
calls — retries handle their own state.
"""
from __future__ import annotations

import json
import os
import random
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import jsonschema
from openai import APIStatusError, OpenAI, RateLimitError

from scripts.shared.classification_schema import CLASSIFICATION_SCHEMA


# DeepSeek V4 Flash pricing (May 2026) — cache-miss tier so the running cost
# estimate is an upper bound, not optimistic.
DEEPSEEK_INPUT_USD_PER_M = 0.27
DEEPSEEK_OUTPUT_USD_PER_M = 1.10

# Hard caps per blueprint §02.5 and the LLM call config block in §4 spec.
CODE_MAX_TOKENS = 3000
CHARS_PER_TOKEN = 4  # safe upper bound for code (real ratio is ~3.5)
MAX_RETRIES = 3
INITIAL_BACKOFF_S = 2.0

# Blueprint §4.7: "max 50 requests/minuto. Sleep 1.2 secondi tra ogni call."
# With N concurrent workers we enforce this as a global token bucket so the
# aggregate rate across all workers stays at ~50/min, independent of N.
DEFAULT_MAX_REQ_PER_MIN = 50

PROMPT_TEMPLATE = """You are a game development expert. Classify this {engine} code.

DOMAIN CONSTRAINT: {domain_hint}
Scene context: {scene_context}
Heuristic pre-classification: {heuristic_category} (confidence: {heuristic_confidence})
Structural signals: extends={extends_type}, class_name={class_name}, functions={functions}, signals={signals}

CODE:
```
{code}
```

Classify this code. Be precise. If you're not sure, use X00_uncertain category
and set confidence_score below 60. It's better to be uncertain than wrong.
Quality: 1=buggy/messy, 3=functional, 5=exemplary/production-grade.
Reusability: 1=project-specific, 3=adaptable, 5=drop-in reusable.

Respond with VALID JSON matching this schema (no extra keys, no comments).
subcategories MUST match regex ^[A-E][0-9]{{2}}\\.[0-9]{{2}}$ (e.g. "A01.01"), NOT primary_category values.
{schema}"""

VALIDATION_RETRY_PROMPT_SUFFIX = (
    "\n\nCRITICAL: your previous response was not valid JSON for the schema. "
    "Respond ONLY with a single JSON object matching the schema. "
    "Every required field must be present. Every enum field must use one of "
    "the allowed values literally."
)


def truncate_code(code: str) -> str:
    """Truncate `code` to fit CODE_MAX_TOKENS, appending a marker if cut."""
    max_chars = CODE_MAX_TOKENS * CHARS_PER_TOKEN
    if len(code) <= max_chars:
        return code
    return code[:max_chars] + "\n... [TRUNCATED]"


def build_prompt(chunk: dict[str, Any]) -> str:
    """Compose the Fase 4 prompt for one chunk.

    The domain constraint is supplied ONLY when heuristic_confidence is 'high'
    — medium/low go to the LLM with `Determine yourself`, per §1.3 step 1.
    """
    heuristic_conf = chunk.get("heuristic_confidence", "low")
    if heuristic_conf == "high":
        domain_hint = chunk["heuristic_domain"]
    else:
        domain_hint = "Determine the domain yourself"

    funcs = chunk.get("functions_found") or []
    sigs = chunk.get("signals_defined") or []
    return PROMPT_TEMPLATE.format(
        engine=chunk["engine"],
        domain_hint=domain_hint,
        scene_context=(chunk.get("scene_context") or "(none)")[:300],
        heuristic_category=chunk.get("heuristic_category", "?"),
        heuristic_confidence=heuristic_conf,
        extends_type=chunk.get("extends_type") or "(none)",
        class_name=chunk.get("class_name") or "(none)",
        functions=", ".join(funcs[:8]) or "(none)",
        signals=", ".join(sigs[:8]) or "(none)",
        code=truncate_code(chunk.get("code", "")),
        schema=json.dumps(CLASSIFICATION_SCHEMA),
    )


@dataclass
class ClassifyResult:
    """Outcome of one classify_chunk call."""
    ok: bool
    classification: dict[str, Any] | None
    error: str | None
    prompt_tokens: int
    completion_tokens: int
    cost_usd: float
    attempts: int


@dataclass
class UsageTracker:
    """Running totals across the whole classification job."""
    chunks_processed: int = 0
    chunks_succeeded: int = 0
    chunks_failed: int = 0
    chunks_skipped_resume: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cost_usd: float = 0.0
    by_status: dict[str, int] = field(default_factory=dict)
    by_category: dict[str, int] = field(default_factory=dict)

    def record(self, result: ClassifyResult, status: str | None,
               category: str | None) -> None:
        self.chunks_processed += 1
        self.prompt_tokens += result.prompt_tokens
        self.completion_tokens += result.completion_tokens
        self.cost_usd += result.cost_usd
        if result.ok:
            self.chunks_succeeded += 1
        else:
            self.chunks_failed += 1
        if status:
            self.by_status[status] = self.by_status.get(status, 0) + 1
        if category:
            self.by_category[category] = self.by_category.get(category, 0) + 1


def _calc_cost(usage: Any) -> float:
    """Compute USD cost from a CompletionUsage object."""
    pt = getattr(usage, "prompt_tokens", 0) or 0
    ct = getattr(usage, "completion_tokens", 0) or 0
    return (pt * DEEPSEEK_INPUT_USD_PER_M
            + ct * DEEPSEEK_OUTPUT_USD_PER_M) / 1_000_000


class _RateLimiter:
    """Thread-safe global rate limiter — enforces the blueprint §4.7 cap of
    50 req/min regardless of concurrent worker count. The first call goes
    through immediately; subsequent calls block until min_interval has
    elapsed since the previous one."""

    def __init__(self, max_per_min: int) -> None:
        self.min_interval = 60.0 / max_per_min if max_per_min > 0 else 0.0
        self._lock = threading.Lock()
        self._last_release_at = 0.0

    def acquire(self) -> None:
        if self.min_interval <= 0:
            return
        with self._lock:
            now = time.monotonic()
            wait = self._last_release_at + self.min_interval - now
            if wait > 0:
                time.sleep(wait)
                now = time.monotonic()
            self._last_release_at = now


class DeepSeekClassifier:
    """OpenAI-compatible client for DeepSeek V4 Flash classification."""

    def __init__(self, api_key: str, model: str = "deepseek-chat",
                 base_url: str = "https://api.deepseek.com/v1",
                 verbose: bool = False,
                 max_req_per_min: int = DEFAULT_MAX_REQ_PER_MIN) -> None:
        if not api_key:
            raise RuntimeError("DEEPSEEK_API_KEY missing in environment.")
        self.client = OpenAI(api_key=api_key, base_url=base_url)
        self.model = model
        self.verbose = verbose
        self.rate_limiter = _RateLimiter(max_req_per_min)

    def _one_call(self, prompt: str) -> tuple[dict[str, Any], Any]:
        """Single round-trip. Raises on transport errors so the caller can
        retry. Returns (parsed_json, usage) on a successful round-trip even
        if the JSON fails schema validation — the caller validates."""
        self.rate_limiter.acquire()
        resp = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=500,
        )
        raw = resp.choices[0].message.content or ""
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"non-JSON response: {exc}; head={raw[:120]!r}")
        return data, resp.usage

    def classify_chunk(self, chunk: dict[str, Any]) -> ClassifyResult:
        """Classify one chunk. Up to 3 transport retries with exponential
        backoff, plus 1 schema-validation retry with a strengthened prompt.
        """
        prompt = build_prompt(chunk)
        last_error: str | None = None
        attempts = 0
        pt_acc = 0
        ct_acc = 0
        cost_acc = 0.0

        for transport_attempt in range(MAX_RETRIES):
            attempts += 1
            try:
                data, usage = self._one_call(prompt)
                pt_acc += getattr(usage, "prompt_tokens", 0) or 0
                ct_acc += getattr(usage, "completion_tokens", 0) or 0
                cost_acc += _calc_cost(usage)

                try:
                    jsonschema.validate(data, CLASSIFICATION_SCHEMA)
                    return ClassifyResult(
                        ok=True, classification=data, error=None,
                        prompt_tokens=pt_acc, completion_tokens=ct_acc,
                        cost_usd=cost_acc, attempts=attempts,
                    )
                except jsonschema.ValidationError as ve:
                    last_error = f"schema_invalid: {ve.message[:200]}"
                    attempts += 1
                    data2, usage2 = self._one_call(
                        prompt + VALIDATION_RETRY_PROMPT_SUFFIX)
                    pt_acc += getattr(usage2, "prompt_tokens", 0) or 0
                    ct_acc += getattr(usage2, "completion_tokens", 0) or 0
                    cost_acc += _calc_cost(usage2)
                    try:
                        jsonschema.validate(data2, CLASSIFICATION_SCHEMA)
                        return ClassifyResult(
                            ok=True, classification=data2, error=None,
                            prompt_tokens=pt_acc, completion_tokens=ct_acc,
                            cost_usd=cost_acc, attempts=attempts,
                        )
                    except jsonschema.ValidationError as ve2:
                        last_error = f"schema_invalid_after_retry: {ve2.message[:200]}"
                        # fall through to transport-retry loop
            except RateLimitError as exc:
                backoff = INITIAL_BACKOFF_S * (2 ** transport_attempt) \
                    + random.uniform(0, 0.5)
                if self.verbose:
                    print(f"    429, backoff {backoff:.1f}s")
                time.sleep(backoff)
                last_error = f"rate_limited: {exc}"
            except APIStatusError as exc:
                backoff = INITIAL_BACKOFF_S * (2 ** transport_attempt)
                if self.verbose:
                    print(f"    APIStatusError {exc.status_code}, "
                          f"backoff {backoff:.1f}s")
                time.sleep(backoff)
                last_error = f"api_status_{exc.status_code}"
            except (ValueError, Exception) as exc:
                last_error = f"{type(exc).__name__}: {str(exc)[:160]}"
                if self.verbose:
                    print(f"    error: {last_error}")
                if transport_attempt < MAX_RETRIES - 1:
                    time.sleep(INITIAL_BACKOFF_S * (2 ** transport_attempt))

        return ClassifyResult(
            ok=False, classification=None, error=last_error or "unknown",
            prompt_tokens=pt_acc, completion_tokens=ct_acc,
            cost_usd=cost_acc, attempts=attempts,
        )
