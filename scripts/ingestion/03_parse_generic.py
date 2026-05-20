"""Generic engine parser — Fase 3 (Defold, MonoGame, LÖVE, Three.js, Stride).

These five engines have no scene-graph format we can exploit cheaply, so this
parser takes the import/require/using + function/class-name approach from
blueprint §2.4 and §02.4.5: one chunk per source file, with a weak heuristic
(mostly medium/low confidence). The Fase 4 LLM does the heavy classification.

Per-engine extraction lives in _generic_engines.py; this file is the
orchestrator and CLI. It selects engines from data/repos_clean/<engine>/,
walks each repo's source files, and writes
data/chunks_raw/<engine>/<repo>/chunk_NNNN.json with the shared JSON shape.

CLI:
    python scripts/ingestion/03_parse_generic.py
    python scripts/ingestion/03_parse_generic.py --engine love2d
    python scripts/ingestion/03_parse_generic.py --engine threejs --repo 1j01__pipes
    python scripts/ingestion/03_parse_generic.py --verbose --dry-run
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.ingestion._parse_common import (
    ParseStats, count_loc, make_chunk, reconstruct_repo_url,
    safe_name, write_chunks,
)
from scripts.ingestion._generic_engines import (
    ENGINES, SRC_MAX_BYTES, classify, get_symbols, is_entry,
)

REPOS_CLEAN_BASE = REPO_ROOT / "data" / "repos_clean"
CHUNKS_RAW_BASE = REPO_ROOT / "data" / "chunks_raw"

GENERIC_ENGINES = ("defold", "monogame", "love2d", "threejs", "stride")
MAX_SCAN_FILES = 8000
MIN_LOC = 8  # skip near-empty stubs; the LLM gets nothing from them
SKIP_DIR_PARTS = {"node_modules", "dist", "build", ".git", "vendor",
                  "vendors", "bin", "obj", "packages", "Library",
                  "coverage", ".vs"}
SKIP_FILE_HINTS = (".min.js", ".bundle.js", "assemblyinfo.cs",
                   ".designer.cs", ".g.cs")


def _stats_path(engine: str) -> Path:
    return REPO_ROOT / "data" / f"{engine}_parse_stats.json"


def read_source(path: Path) -> str:
    try:
        if path.stat().st_size > SRC_MAX_BYTES:
            return ""
        return path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return ""


def iter_source_files(root: Path, exts: tuple[str, ...]) -> list[Path]:
    out: list[Path] = []
    exts_l = tuple(e.lower() for e in exts)
    for p in root.rglob("*"):
        if len(out) >= MAX_SCAN_FILES:
            break
        if not p.is_file() or p.suffix.lower() not in exts_l:
            continue
        if any(part in SKIP_DIR_PARTS for part in p.parts):
            continue
        nl = p.name.lower()
        if nl.endswith(".d.ts") or any(h in nl for h in SKIP_FILE_HINTS):
            continue
        out.append(p)
    return out


class GenericParser:
    def __init__(self, engine: str, repo_dir: Path, repo_url: str,
                 verbose: bool = False) -> None:
        self.engine = engine
        self.repo_dir = repo_dir
        self.repo_url = repo_url
        self.verbose = verbose

    def _rel(self, p: Path) -> str:
        return p.relative_to(self.repo_dir.parent).as_posix()

    def chunk_project(self) -> list[dict[str, Any]]:
        chunks: list[dict[str, Any]] = []
        exts = ENGINES[self.engine]["exts"]
        files = iter_source_files(self.repo_dir, exts)
        if self.verbose:
            print(f"    {len(files)} source files")

        for path in files:
            text = read_source(path)
            if not text or count_loc(text) < MIN_LOC:
                continue
            domain, category, conf = classify(self.engine, path.name, text)
            syms = get_symbols(self.engine, text)
            entry = is_entry(self.engine, text)
            kind = "entry_point" if entry else "module"
            imports = syms["imports"]
            ctx = f"{self.engine} {kind}"
            if imports:
                ctx += f" | imports: {', '.join(imports[:6])}"
            chunks.append(make_chunk(
                repo_url=self.repo_url, engine=self.engine,
                file_paths=[self._rel(path)], code=text,
                domain=domain, category=category, confidence=conf,
                scene_context=ctx,
                class_name=syms["classes"][0] if syms["classes"] else None,
                functions_found=syms["functions"],
                chunk_kind=kind,
            ))
        return chunks


def parse_engine(engine: str, only_repo: str | None,
                 dry_run: bool, verbose: bool) -> ParseStats:
    clean_dir = REPOS_CLEAN_BASE / engine
    stats = ParseStats()
    if not clean_dir.is_dir():
        print(f"  (no repos_clean/{engine}, skipping)")
        return stats
    repos = sorted(d for d in clean_dir.iterdir() if d.is_dir())
    if only_repo:
        repos = [d for d in repos if d.name == only_repo]
    print(f"\n=== {engine}: {len(repos)} repos ===")
    for repo_dir in repos:
        if verbose:
            print(f"--- {repo_dir.name}")
        repo_url = reconstruct_repo_url(repo_dir.name)
        parser = GenericParser(engine, repo_dir, repo_url, verbose=verbose)
        try:
            chunks = parser.chunk_project()
        except Exception as exc:
            print(f"    ERROR parsing {repo_dir.name}: "
                  f"{type(exc).__name__}: {exc}", file=sys.stderr)
            stats.skip()
            continue
        if not chunks:
            stats.skip()
            if verbose:
                print("    SKIP (no source)")
            continue
        stats.record(repo_dir.name, chunks)
        if not dry_run:
            write_chunks(chunks,
                         CHUNKS_RAW_BASE / engine / safe_name(repo_dir.name))
        if verbose:
            print(f"    -> {len(chunks)} chunks")
    return stats


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Generic parser (Defold/MonoGame/LÖVE/Three.js/Stride)")
    ap.add_argument("--engine", choices=GENERIC_ENGINES,
                    help="Only parse this engine (default: all five).")
    ap.add_argument("--repo", help="Only parse this repo (folder name).")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--dry-run", action="store_true",
                    help="Parse and report counts but do not write chunks.")
    args = ap.parse_args()

    engines = [args.engine] if args.engine else list(GENERIC_ENGINES)
    grand_total = 0
    for engine in engines:
        stats = parse_engine(engine, args.repo, args.dry_run, args.verbose)
        stats.print_summary(f"{engine.upper()} PARSE SUMMARY")
        grand_total += stats.total_chunks
        if not args.dry_run:
            _stats_path(engine).write_text(
                json.dumps(stats.to_json(), indent=2, sort_keys=True),
                encoding="utf-8")

    print("\n" + "#" * 64)
    print(f"GENERIC GRAND TOTAL: {grand_total} chunks "
          f"across {len(engines)} engine(s)")
    print("#" * 64)
    if args.dry_run:
        print("DRY RUN — no chunks written.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
