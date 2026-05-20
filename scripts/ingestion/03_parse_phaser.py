"""Phaser 3 project parser — Fase 3.

Walks every cleaned Phaser project in data/repos_clean/phaser/, finds the
`new Phaser.Game({...})` entry point (emitting an E01 project-structure chunk
from its config), then emits one chunk per Phaser.Scene subclass with the
blueprint §2.4.3 heuristic pre-classification. Output goes to
data/chunks_raw/phaser/<repo>/chunk_NNNN.json with the exact JSON shape the
Godot parser produces.

CLI:
    python scripts/ingestion/03_parse_phaser.py
    python scripts/ingestion/03_parse_phaser.py --repo Autapomorph__dino
    python scripts/ingestion/03_parse_phaser.py --verbose --dry-run
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
from scripts.ingestion._phaser_scene import (
    classify_scene, extract_game_config, extract_scenes, read_source,
)

REPOS_CLEAN = REPO_ROOT / "data" / "repos_clean" / "phaser"
CHUNKS_RAW = REPO_ROOT / "data" / "chunks_raw" / "phaser"
STATS_PATH = REPO_ROOT / "data" / "phaser_parse_stats.json"

MAX_SCAN_FILES = 8000
SKIP_DIR_PARTS = {"node_modules", "dist", "build", ".git", "vendor",
                  "vendors", "bower_components", "coverage"}
SKIP_FILE_HINTS = (".min.js", "phaser.js", "phaser.min.js", ".bundle.js")
SRC_SUFFIXES = (".js", ".ts", ".mjs")


def iter_source_files(root: Path) -> list[Path]:
    out: list[Path] = []
    for p in root.rglob("*"):
        if len(out) >= MAX_SCAN_FILES:
            break
        if p.suffix.lower() not in SRC_SUFFIXES or not p.is_file():
            continue
        if any(part in SKIP_DIR_PARTS for part in p.parts):
            continue
        nl = p.name.lower()
        if nl.endswith(".d.ts") or any(h in nl for h in SKIP_FILE_HINTS):
            continue
        out.append(p)
    return out


class PhaserParser:
    def __init__(self, repo_dir: Path, repo_url: str, verbose: bool = False) -> None:
        self.repo_dir = repo_dir
        self.repo_url = repo_url
        self.verbose = verbose

    def _rel(self, p: Path) -> str:
        return p.relative_to(self.repo_dir.parent).as_posix()

    def chunk_project(self) -> list[dict[str, Any]]:
        chunks: list[dict[str, Any]] = []
        files = iter_source_files(self.repo_dir)
        if self.verbose:
            print(f"    {len(files)} source files")

        config_done = False
        for path in files:
            text = read_source(path)
            if not text:
                continue
            if not config_done:
                cfg = extract_game_config(text)
                if cfg:
                    chunks.append(self._config_chunk(path, cfg))
                    config_done = True

            for scene in extract_scenes(text):
                chunks.append(self._scene_chunk(path, scene))
        return chunks

    def _config_chunk(self, path: Path, cfg: str) -> dict[str, Any]:
        return make_chunk(
            repo_url=self.repo_url, engine="phaser",
            file_paths=[self._rel(path)],
            code=f"// new Phaser.Game config\n{cfg}",
            domain="E_architecture", category="E01_project_structure",
            confidence="high", chunk_kind="project_meta",
        )

    def _scene_chunk(self, path: Path, scene: dict[str, Any]) -> dict[str, Any]:
        h = classify_scene(scene)
        present = [m for m in ("preload", "create", "update") if scene.get(m)]
        context = f"Phaser.Scene {scene['name']} [{', '.join(present)}]"
        return make_chunk(
            repo_url=self.repo_url, engine="phaser",
            file_paths=[self._rel(path)],
            code=scene["code"],
            domain=h["heuristic_domain"], category=h["heuristic_category"],
            confidence=h["heuristic_confidence"],
            scene_context=context,
            class_name=scene["name"],
            functions_found=scene["methods"],
            chunk_kind="scene",
        )


def main() -> int:
    ap = argparse.ArgumentParser(description="Phaser 3 parser — Fase 3")
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
    print(f"Parsing {len(repos)} Phaser repos...\n")

    stats = ParseStats()
    for repo_dir in repos:
        if args.verbose:
            print(f"--- {repo_dir.name}")
        repo_url = reconstruct_repo_url(repo_dir.name)
        parser = PhaserParser(repo_dir, repo_url, verbose=args.verbose)
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
                print("    SKIP (no scenes / no Phaser.Game)")
            continue
        stats.record(repo_dir.name, chunks)
        if not args.dry_run:
            write_chunks(chunks, CHUNKS_RAW / safe_name(repo_dir.name))
        if args.verbose:
            print(f"    -> {len(chunks)} chunks")

    stats.print_summary("PHASER PARSE SUMMARY")
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
