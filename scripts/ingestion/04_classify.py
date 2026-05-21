"""Fase 4 — LLM classifier (blindato).

Reads every Fase-3 chunk under data/chunks_raw/, asks DeepSeek V4 Flash to
classify it under the constrained CLASSIFICATION_SCHEMA, applies the
confidence gate (>=85 accept / 60-84 quarantine / <60 reject), and writes
the merged raw+classification record to
data/chunks_classified/<engine>/<repo>/chunk_NNNN.json.

Resumable: skips chunks whose output file already contains a non-empty
classification (so a crash / interrupted run can be continued without
re-paying for already-classified work).

CLI:
    python scripts/ingestion/04_classify.py --sample 10 --engine godot --verbose
    python scripts/ingestion/04_classify.py --engine godot
    python scripts/ingestion/04_classify.py            # full run, all engines

The full run is ~$3-5 (cf. preflight estimate). Use --dry-run to inspect
the prompt + chunk for the first candidate before paying.
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from tqdm import tqdm

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
load_dotenv(REPO_ROOT / ".env")

from scripts.ingestion._classify_llm import (  # noqa: E402
    DeepSeekClassifier, UsageTracker, build_prompt,
)
from scripts.shared.confidence_gate import gate_classification  # noqa: E402
from scripts.shared.taxonomy import ENGINES  # noqa: E402

CHUNKS_RAW = REPO_ROOT / "data" / "chunks_raw"
CHUNKS_CLASSIFIED = REPO_ROOT / "data" / "chunks_classified"
REPORT_PATH = REPO_ROOT / "data" / "classification_report.json"

# With N concurrent workers, the per-worker sleep is N * 1.2s / N = 1.2s
# anyway, so we don't add extra throttling — the OpenAI client + the
# DeepSeekClassifier's 429-aware backoff handles bursts naturally. With 8
# workers and ~4s latency per call the steady-state rate is ~2 req/s which
# DeepSeek tolerates without rate-limiting on the standard tier.
DEFAULT_WORKERS = 8


def collect_input_chunks(engine_filter: str | None) -> list[Path]:
    """List every chunk file under data/chunks_raw/, deterministically ordered
    so --sample N is reproducible across runs (random.sample with fixed seed
    later applies to this list)."""
    if engine_filter:
        roots = [CHUNKS_RAW / engine_filter]
    else:
        roots = [d for d in CHUNKS_RAW.iterdir() if d.is_dir()]
    out: list[Path] = []
    for root in sorted(roots):
        out.extend(sorted(root.glob("*/chunk_*.json")))
    return out


def output_path_for(src: Path) -> Path:
    """Map data/chunks_raw/<engine>/<repo>/chunk_NNNN.json to its
    classified twin under data/chunks_classified/."""
    rel = src.relative_to(CHUNKS_RAW)
    return CHUNKS_CLASSIFIED / rel


def is_already_classified(dst: Path, retry_errors: bool = False) -> bool:
    """Resume guard: a previous run wrote a classified file iff it has a
    non-null `classification` block AND a `classification_status`.

    When `retry_errors` is True, files written with status=='error' (LLM
    schema-validation or transport failure) are treated as not-yet-classified
    and will be retried; the accepted/quarantined/rejected ones are kept.
    """
    if not dst.is_file():
        return False
    try:
        existing = json.loads(dst.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    status = existing.get("classification_status")
    if retry_errors and status == "error":
        return False
    return (existing.get("classification") is not None
            and status in ("accepted", "quarantined", "rejected"))


def write_classified(dst: Path, raw_chunk: dict[str, Any],
                     classification: dict[str, Any] | None,
                     status: str, error: str | None) -> None:
    """Merged record: every raw field + a `classification` sub-dict + a
    `classification_status` flag the embed stage filters on."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    merged: dict[str, Any] = dict(raw_chunk)
    merged["classification"] = classification
    merged["classification_status"] = status
    if error:
        merged["classification_error"] = error
    dst.write_text(json.dumps(merged, indent=2, ensure_ascii=False),
                   encoding="utf-8")


def dry_run_preview(chunks: list[Path]) -> int:
    """Print the prompt that would be sent for the first chunk + a recap of
    expected fields, then exit without an API call."""
    if not chunks:
        print("No chunks to preview.")
        return 0
    src = chunks[0]
    raw = json.loads(src.read_text(encoding="utf-8"))
    prompt = build_prompt(raw)
    print(f"DRY RUN — would classify: {src}")
    print(f"  engine={raw['engine']}, kind={raw.get('chunk_kind')}, "
          f"category={raw['heuristic_category']}, "
          f"confidence={raw['heuristic_confidence']}, "
          f"loc={raw['loc']}")
    print(f"  candidates total: {len(chunks)}")
    print()
    print("=" * 64)
    print("PROMPT")
    print("=" * 64)
    print(prompt[:2000])
    if len(prompt) > 2000:
        print(f"... [+{len(prompt)-2000} chars]")
    return 0


def render_summary(usage: UsageTracker, started_at: float) -> None:
    elapsed = time.time() - started_at
    print("\n" + "=" * 64)
    print("CLASSIFICATION SUMMARY")
    print("=" * 64)
    print(f"Processed:        {usage.chunks_processed}")
    print(f"  succeeded:      {usage.chunks_succeeded}")
    print(f"  failed:         {usage.chunks_failed}")
    print(f"  skipped (resume): {usage.chunks_skipped_resume}")
    print(f"Tokens:           {usage.prompt_tokens} in + "
          f"{usage.completion_tokens} out")
    print(f"Cost USD:         ${usage.cost_usd:.4f}")
    print(f"Elapsed:          {elapsed/60:.1f} min")
    print()
    if usage.by_status:
        print("By status:")
        for k in ("accepted", "quarantined", "rejected"):
            v = usage.by_status.get(k, 0)
            pct = (100 * v / usage.chunks_succeeded
                   if usage.chunks_succeeded else 0)
            print(f"  {k:<14} {v:>6}  ({pct:5.1f}%)")
    if usage.by_category:
        print("\nTop 10 categories:")
        for cat, n in sorted(usage.by_category.items(),
                             key=lambda x: -x[1])[:10]:
            print(f"  {n:>5} {cat}")


def write_report(usage: UsageTracker, started_at: float,
                 engine_filter: str | None, sample_n: int | None) -> None:
    REPORT_PATH.write_text(json.dumps({
        "elapsed_seconds": round(time.time() - started_at, 1),
        "engine_filter": engine_filter,
        "sample_n": sample_n,
        "chunks_processed": usage.chunks_processed,
        "chunks_succeeded": usage.chunks_succeeded,
        "chunks_failed": usage.chunks_failed,
        "chunks_skipped_resume": usage.chunks_skipped_resume,
        "tokens_prompt": usage.prompt_tokens,
        "tokens_completion": usage.completion_tokens,
        "cost_usd": round(usage.cost_usd, 4),
        "by_status": usage.by_status,
        "by_category": usage.by_category,
    }, indent=2), encoding="utf-8")
    print(f"\nReport: {REPORT_PATH}")


def run(args: argparse.Namespace) -> int:
    chunks = collect_input_chunks(args.engine)
    if args.sample:
        random.seed(args.seed)
        chunks = random.sample(chunks, min(args.sample, len(chunks)))
    print(f"Candidates: {len(chunks)}"
          + (f" (engine={args.engine})" if args.engine else "")
          + (f" (sampled {args.sample})" if args.sample else ""))

    if args.dry_run:
        return dry_run_preview(chunks)

    classifier = DeepSeekClassifier(
        api_key=os.getenv("DEEPSEEK_API_KEY", ""),
        verbose=args.verbose,
    )
    usage = UsageTracker()
    started_at = time.time()

    todo: list[Path] = []
    for src in chunks:
        dst = output_path_for(src)
        if not args.force and is_already_classified(dst, args.retry_errors):
            usage.chunks_skipped_resume += 1
        else:
            todo.append(src)
    if usage.chunks_skipped_resume:
        print(f"Resume: skipping {usage.chunks_skipped_resume} chunks already done.")

    cost_cap_hit = threading.Event()
    usage_lock = threading.Lock()

    def process_one(src: Path) -> None:
        if cost_cap_hit.is_set():
            return
        dst = output_path_for(src)
        try:
            raw = json.loads(src.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            print(f"  SKIP unreadable {src}: {exc}", file=sys.stderr)
            return
        result = classifier.classify_chunk(raw)
        if result.ok and result.classification is not None:
            status = gate_classification(result.classification)
            cat = result.classification.get("primary_category")
            write_classified(dst, raw, result.classification, status, None)
            with usage_lock:
                usage.record(result, status, cat)
            if args.verbose:
                conf = result.classification.get("confidence_score")
                print(f"  OK   {src.parent.name}/{src.name}: "
                      f"{cat} conf={conf} -> {status} "
                      f"(${result.cost_usd:.4f})")
        else:
            write_classified(dst, raw, None, "error", result.error)
            with usage_lock:
                usage.record(result, None, None)
            if args.verbose:
                print(f"  FAIL {src.parent.name}/{src.name}: {result.error}")
        with usage_lock:
            if usage.cost_usd >= args.cost_cap_usd:
                cost_cap_hit.set()

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(process_one, src): src for src in todo}
        bar = tqdm(as_completed(futures), total=len(futures),
                   desc="classify", unit="chunk", disable=args.verbose)
        for _ in bar:
            if not args.verbose:
                bar.set_postfix({
                    "$": f"{usage.cost_usd:.2f}",
                    "ok": usage.chunks_succeeded,
                    "err": usage.chunks_failed,
                })
            if cost_cap_hit.is_set():
                # Cancel still-pending futures, let in-flight ones finish.
                for f, _src in futures.items():
                    f.cancel()
                print(f"\nCost cap ${args.cost_cap_usd:.2f} reached "
                      f"(actual ${usage.cost_usd:.4f}). Stopping cleanly.")
                break

    render_summary(usage, started_at)
    write_report(usage, started_at, args.engine, args.sample)
    return 0 if usage.chunks_failed < max(1, usage.chunks_processed // 20) else 1


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Fase 4 LLM classifier (DeepSeek V4 Flash)")
    ap.add_argument("--engine", choices=ENGINES,
                    help="Classify only chunks for this engine.")
    ap.add_argument("--sample", type=int,
                    help="Classify only N random chunks (smoke / pilot test).")
    ap.add_argument("--seed", type=int, default=42,
                    help="Random seed for --sample reproducibility.")
    ap.add_argument("--dry-run", action="store_true",
                    help="Print the prompt for the first candidate and exit.")
    ap.add_argument("--verbose", action="store_true",
                    help="Per-chunk log; disables tqdm bar.")
    ap.add_argument("--force", action="store_true",
                    help="Re-classify even if a classified file exists.")
    ap.add_argument("--retry-errors", action="store_true",
                    help="Re-classify only the chunks whose previous status "
                         "is 'error'; leave accepted/quarantined/rejected alone.")
    ap.add_argument("--cost-cap-usd", type=float, default=10.0,
                    help="Abort the run if running cost crosses this USD "
                         "ceiling (default 10.0; blueprint budget is 5.0).")
    ap.add_argument("--workers", type=int, default=DEFAULT_WORKERS,
                    help=f"Concurrent classification workers "
                         f"(default {DEFAULT_WORKERS}).")
    return run(ap.parse_args())


if __name__ == "__main__":
    sys.exit(main())
