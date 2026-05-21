"""Ren'Py project parser — Fase 3.

Walks every cleaned Ren'Py project in data/repos_clean/renpy/, reads all .rpy
files, and emits chunks per the blueprint §2.4.4 concepts:

  - narrative route   : per-.rpy cluster of label blocks (C03_dialogue_narrative;
                        high confidence when a menu choice is present, else medium)
  - custom screen     : each `screen <name>:` block (D01_ui)
  - VN core           : Character()/define declarations of a file (E04_genre_specific)
  - project config    : options.rpy / gui.rpy (E01_project_structure)

Output: data/chunks_raw/renpy/<repo>/chunk_NNNN.json, same JSON shape as Godot.

CLI:
    python scripts/ingestion/03_parse_renpy.py
    python scripts/ingestion/03_parse_renpy.py --repo RuolinZheng08__renpy-chess
    python scripts/ingestion/03_parse_renpy.py --verbose --dry-run
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
    ParseStats, make_chunk, reconstruct_repo_url, safe_name, write_chunks,
)
from scripts.ingestion._renpy_rpy import (
    detect_inventory_signal, is_config_file, label_has_menu, parse_rpy_file,
)

REPOS_CLEAN = REPO_ROOT / "data" / "repos_clean" / "renpy"
CHUNKS_RAW = REPO_ROOT / "data" / "chunks_raw" / "renpy"
STATS_PATH = REPO_ROOT / "data" / "renpy_parse_stats.json"

MAX_SCAN_FILES = 4000
SKIP_DIR_PARTS = {".git", "renpy", "lib", "cache"}  # renpy SDK runtime dirs


def iter_rpy_files(root: Path) -> list[Path]:
    out: list[Path] = []
    for p in root.rglob("*.rpy"):
        if len(out) >= MAX_SCAN_FILES:
            break
        if not p.is_file():
            continue
        # Skip generated compiled scripts and SDK runtime.
        if p.name.endswith(".rpyc") or any(
                part in SKIP_DIR_PARTS for part in p.relative_to(root).parts[:-1]):
            continue
        out.append(p)
    return out


class RenPyParser:
    def __init__(self, repo_dir: Path, repo_url: str, verbose: bool = False) -> None:
        self.repo_dir = repo_dir
        self.repo_url = repo_url
        self.verbose = verbose

    def _rel(self, p: Path) -> str:
        return p.relative_to(self.repo_dir.parent).as_posix()

    def chunk_project(self) -> list[dict[str, Any]]:
        chunks: list[dict[str, Any]] = []
        files = iter_rpy_files(self.repo_dir)
        if self.verbose:
            print(f"    {len(files)} .rpy files")

        for path in files:
            parsed = parse_rpy_file(path)
            if not parsed["ok"]:
                continue
            rel = self._rel(path)

            if is_config_file(path):
                chunks.append(self._config_chunk(rel, parsed))
                continue

            route = self._route_chunk(rel, parsed)
            if route:
                chunks.append(route)
            for name, block in parsed["screens"]:
                chunks.append(self._screen_chunk(rel, name, block))
            vn = self._vn_chunk(rel, parsed)
            if vn:
                chunks.append(vn)
            inv = self._inventory_chunk(rel, parsed)
            if inv:
                chunks.append(inv)
        return chunks

    def _inventory_chunk(self, rel: str,
                         parsed: dict[str, Any]) -> dict[str, Any] | None:
        score = detect_inventory_signal(parsed)
        if score < 3:
            return None
        items = [d for d in parsed["defines"]
                 if isinstance(d, str) and d.startswith("item_")]
        ctx = f"Ren'Py inventory: {len(items)} item defines (score={score})"
        body = parsed["raw"]
        return make_chunk(
            repo_url=self.repo_url, engine="renpy", file_paths=[rel],
            code=body, domain="C_meta_game", category="C02_inventory",
            confidence="medium", scene_context=ctx,
            functions_found=items[:40], chunk_kind="inventory",
        )

    def _route_chunk(self, rel: str, parsed: dict[str, Any]) -> dict[str, Any] | None:
        labels = parsed["labels"]
        if not labels:
            return None
        code = "\n\n".join(block for _, block in labels)
        any_menu = parsed["has_menu"] or any(
            label_has_menu(b) for _, b in labels)
        conf = "high" if any_menu else "medium"
        names = [n for n, _ in labels]
        ctx = f"Ren'Py route: {len(labels)} labels" \
              f"{' + menu choices' if any_menu else ''}"
        return make_chunk(
            repo_url=self.repo_url, engine="renpy", file_paths=[rel],
            code=code, domain="C_meta_game",
            category="C03_dialogue_narrative", confidence=conf,
            scene_context=ctx, functions_found=names,
            chunk_kind="narrative_route",
        )

    def _screen_chunk(self, rel: str, name: str, block: str) -> dict[str, Any]:
        return make_chunk(
            repo_url=self.repo_url, engine="renpy", file_paths=[rel],
            code=block, domain="D_presentation", category="D01_ui",
            confidence="high", scene_context=f"Ren'Py screen {name}",
            class_name=name, chunk_kind="screen",
        )

    def _vn_chunk(self, rel: str, parsed: dict[str, Any]) -> dict[str, Any] | None:
        chars = parsed["characters"]
        defines = parsed["defines"]
        if not chars and len(defines) < 3:
            return None
        lines = [f"# characters: {chars}",
                 f"# defines/defaults: {defines[:40]}",
                 f"# images: {parsed['images'][:40]}"]
        conf = "high" if chars else "medium"
        return make_chunk(
            repo_url=self.repo_url, engine="renpy", file_paths=[rel],
            code="\n".join(lines), domain="E_architecture",
            category="E04_genre_specific", confidence=conf,
            scene_context=f"Ren'Py VN core: {len(chars)} characters",
            functions_found=chars, chunk_kind="vn_core",
        )

    def _config_chunk(self, rel: str, parsed: dict[str, Any]) -> dict[str, Any]:
        return make_chunk(
            repo_url=self.repo_url, engine="renpy", file_paths=[rel],
            code=parsed["raw"], domain="E_architecture",
            category="E01_project_structure", confidence="high",
            scene_context=f"Ren'Py config {Path(rel).name}",
            chunk_kind="project_meta",
        )


def main() -> int:
    ap = argparse.ArgumentParser(description="Ren'Py parser — Fase 3")
    ap.add_argument("--repo", help="Only parse this repo (folder name).")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--dry-run", action="store_true",
                    help="Parse and report counts but do not write chunks.")
    args = ap.parse_args()

    if not REPOS_CLEAN.is_dir():
        print(f"ERROR: {REPOS_CLEAN} missing. Run 02_filter first.",
              file=sys.stderr)
        return 1
    repos = sorted(d for d in REPOS_CLEAN.iterdir() if d.is_dir())
    if args.repo:
        repos = [d for d in repos if d.name == args.repo]
        if not repos:
            print(f"ERROR: repo {args.repo} not found.", file=sys.stderr)
            return 1
    print(f"Parsing {len(repos)} Ren'Py repos...\n")

    stats = ParseStats()
    for repo_dir in repos:
        if args.verbose:
            print(f"--- {repo_dir.name}")
        repo_url = reconstruct_repo_url(repo_dir.name)
        parser = RenPyParser(repo_dir, repo_url, verbose=args.verbose)
        try:
            chunks = parser.chunk_project()
        except Exception as exc:
            print(f"    ERROR parsing {repo_dir.name}: "
                  f"{type(exc).__name__}: {exc}", file=sys.stderr)
            stats.skip()
            continue
        if not chunks:
            stats.skip()
            if args.verbose:
                print("    SKIP (no .rpy content)")
            continue
        stats.record(repo_dir.name, chunks)
        if not args.dry_run:
            write_chunks(chunks, CHUNKS_RAW / safe_name(repo_dir.name))
        if args.verbose:
            print(f"    -> {len(chunks)} chunks")

    stats.print_summary("RENPY PARSE SUMMARY")
    if not args.dry_run:
        STATS_PATH.write_text(
            json.dumps(stats.to_json(), indent=2, sort_keys=True),
            encoding="utf-8")
        print(f"\nStats:  {STATS_PATH}")
        print(f"Chunks: {CHUNKS_RAW}/<repo>/chunk_NNNN.json")
    else:
        print("\nDRY RUN — no chunks written.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
