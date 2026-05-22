"""Shared helpers for the non-Godot Fase 3 parsers.

The Godot parser (03_parse_godot.py) is self-contained because it predates
these helpers. Phaser / Ren'Py / generic parsers share three concerns that
live here so each parser file stays under the 400-line cap:

  - URL reconstruction from a repos_clean/<engine>/<folder> name, validated
    against data/manifest.json (handles the `owner__repo` encoding and the
    `owner__repo__subdir` subdir-expansion encoding).
  - A canonical chunk dict builder so every engine emits the exact same JSON
    shape the Godot parser produces (downstream Fase 4 reads one schema).
  - Chunk writing + a CLI-friendly stats accumulator.

No engine-specific logic lives here.
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MANIFEST_PATH = REPO_ROOT / "data" / "manifest.json"

import sys as _sys
if str(REPO_ROOT) not in _sys.path:
    _sys.path.insert(0, str(REPO_ROOT))
from scripts.shared.chunk_type import determine_chunk_type

# Heuristic confidence levels mirror the Godot parser's vocabulary.
CONF_HIGH = "high"
CONF_MEDIUM = "medium"
CONF_LOW = "low"


def safe_name(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", s)


_MANIFEST_URLS: set[str] | None = None
_FOLDER_TO_URL: dict[str, str] | None = None


def _safe_repo_name(url: str) -> str:
    """Local mirror of _scrape_helpers.safe_repo_name (protocol-agnostic).

    Duplicated here to avoid a cross-module import cycle at the parser
    layer; must stay byte-identical with the scraper helper.
    """
    import re as _re
    cleaned = url.rstrip("/")
    cleaned = _re.sub(r"^https?://", "", cleaned)
    if cleaned.startswith("github.com/"):
        slug = cleaned.split("github.com/", 1)[-1].replace("/", "__")
    else:
        slug = cleaned.replace("/", "__")
    return _re.sub(r"[^A-Za-z0-9._-]+", "_", slug)


def _load_manifest() -> list[dict]:
    try:
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []


def _manifest_urls() -> set[str]:
    """Lazy-load the set of repo URLs from the manifest (cached)."""
    global _MANIFEST_URLS
    if _MANIFEST_URLS is None:
        try:
            _MANIFEST_URLS = {e["url"] for e in _load_manifest() if e.get("url")}
        except KeyError:
            _MANIFEST_URLS = set()
    return _MANIFEST_URLS


def _folder_to_url() -> dict[str, str]:
    """Lazy-load a `folder_name -> source_url` map from the manifest, so
    non-GitHub entries (gitlab.com, itch.io, ...) resolve to their real
    URL instead of being mis-rebuilt under github.com/. Cached."""
    global _FOLDER_TO_URL
    if _FOLDER_TO_URL is None:
        mapping: dict[str, str] = {}
        for entry in _load_manifest():
            url = entry.get("url")
            if not url:
                continue
            mapping[_safe_repo_name(url)] = url
            # Subdir entries: parent_url is the cloned URL but the folder
            # for the synthetic child can encode the subdir path.
            parent = entry.get("parent_url")
            subdir = entry.get("subdir_path")
            if parent and subdir:
                synth_folder = _safe_repo_name(parent) + "__" + _safe_repo_name(subdir)
                mapping.setdefault(synth_folder, parent)
        _FOLDER_TO_URL = mapping
    return _FOLDER_TO_URL


def reconstruct_repo_url(folder_name: str) -> str:
    """Map a repos_clean folder name back to its source URL.

    Strategy:
    1. Look up the folder in a `safe_repo_name(url) -> url` map built from
       the manifest. Works for any host (github, gitlab, itch, ...).
    2. Fallback to the legacy GitHub-only reconstruction for folders that
       predate the manifest map (zero behaviour change on the existing
       dataset, all entries are reachable via path 1).
    """
    mapping = _folder_to_url()
    if folder_name in mapping:
        return mapping[folder_name]

    # Legacy fallback: GitHub-only reconstruction.
    urls = _manifest_urls()
    simple = "https://github.com/" + folder_name.replace("__", "/", 1)
    if simple in urls or not urls:
        return simple
    parts = folder_name.split("__")
    for cut in range(len(parts) - 1, 1, -1):
        candidate = "https://github.com/" + "/".join(
            [parts[0], "".join(parts[1:cut])]
        )
        if candidate in urls:
            return candidate
    if len(parts) >= 2:
        return "https://github.com/" + parts[0] + "/" + "__".join(parts[1:])
    return simple


def count_loc(text: str) -> int:
    return sum(1 for ln in text.splitlines() if ln.strip())


def make_chunk(
    *,
    repo_url: str,
    engine: str,
    file_paths: list[str],
    code: str,
    domain: str,
    category: str,
    confidence: str,
    scene_context: str = "",
    extends_type: str | None = None,
    class_name: str | None = None,
    exports_found: list[str] | None = None,
    functions_found: list[str] | None = None,
    signals_defined: list[str] | None = None,
    signals_connected: list[str] | None = None,
    chunk_kind: str = "script",
    part_index: int | None = None,
) -> dict[str, Any]:
    """Build a chunk dict with the exact key set the Godot parser emits.

    `signals_connected` maps to the Godot field
    `signals_connected_from_scene` so the JSON schema stays identical across
    engines even when the concept (scene-wired signals) doesn't apply.
    """
    chunk: dict[str, Any] = {
        "source_repo": repo_url,
        "engine": engine,
        "file_paths": file_paths,
        "scene_context": scene_context,
        "code": code,
        "loc": count_loc(code),
        "heuristic_domain": domain,
        "heuristic_category": category,
        "heuristic_confidence": confidence,
        "extends_type": extends_type,
        "class_name": class_name,
        "exports_found": exports_found or [],
        "functions_found": functions_found or [],
        "signals_defined": signals_defined or [],
        "signals_connected_from_scene": signals_connected or [],
        "chunk_kind": chunk_kind,
        "part_index": part_index,
    }
    chunk["chunk_type"] = determine_chunk_type(chunk)
    return chunk


def write_chunks(chunks: list[dict[str, Any]], out_dir: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    for i, ch in enumerate(chunks, 1):
        with (out_dir / f"chunk_{i:04d}.json").open(
                "w", encoding="utf-8") as f:
            json.dump(ch, f, indent=2, ensure_ascii=False)
    return len(chunks)


class ParseStats:
    """Accumulates per-run counts and renders the summary block shared by
    all three parsers, plus serialises a stats JSON identical in shape to
    data/godot_parse_stats.json."""

    def __init__(self) -> None:
        self.repos_parsed = 0
        self.repos_skipped = 0
        self.total_chunks = 0
        self.by_category: Counter[str] = Counter()
        self.by_confidence: Counter[str] = Counter()
        self.by_repo: dict[str, int] = {}

    def record(self, repo_name: str, chunks: list[dict[str, Any]]) -> None:
        self.repos_parsed += 1
        self.total_chunks += len(chunks)
        self.by_repo[repo_name] = len(chunks)
        for ch in chunks:
            self.by_category[ch["heuristic_category"]] += 1
            self.by_confidence[ch["heuristic_confidence"]] += 1

    def skip(self) -> None:
        self.repos_skipped += 1

    def print_summary(self, title: str) -> None:
        print("\n" + "=" * 64)
        print(title)
        print("=" * 64)
        print(f"Parsed:           {self.repos_parsed} repos")
        print(f"Skipped:          {self.repos_skipped}")
        print(f"Total chunks:     {self.total_chunks}")
        print("\nBy heuristic_confidence:")
        for c in (CONF_HIGH, CONF_MEDIUM, CONF_LOW):
            print(f"  {c:<7} {self.by_confidence.get(c, 0)}")
        print("\nBy heuristic_category (top 12):")
        for cat, n in self.by_category.most_common(12):
            print(f"  {n:>5} {cat}")
        print("\nTop 10 repos by chunk count:")
        for name, n in sorted(self.by_repo.items(),
                              key=lambda x: x[1], reverse=True)[:10]:
            print(f"  {n:>5} {name}")

    def to_json(self) -> dict[str, Any]:
        return {
            "repos_parsed": self.repos_parsed,
            "repos_skipped": self.repos_skipped,
            "total_chunks": self.total_chunks,
            "by_category": dict(self.by_category),
            "by_confidence": dict(self.by_confidence),
            "by_repo": self.by_repo,
        }
