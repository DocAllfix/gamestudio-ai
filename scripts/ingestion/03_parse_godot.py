"""Godot 4 project parser — Fase 3 (the most complex parser in the pipeline).

Walks every cleaned Godot project in data/repos_clean/godot/, parses
project.godot + every .tscn + every .gd, applies the 10 heuristic rules
from MASTER_EXECUTION_PLAN.md §3, then emits one or more chunk JSON
files per project in data/chunks_raw/godot/<repo_name>/chunk_NNN.json.

Each chunk records the on-disk file path(s), the scene_context line
extracted from the .tscn that references the script (when applicable),
the full source code, structural extracts (extends, exports, signals,
functions), and the heuristic pre-classification (domain, category,
confidence). The LLM stage in Fase 4 turns these into the final
constrained-JSON labels.

CLI:
    python scripts/ingestion/03_parse_godot.py
    python scripts/ingestion/03_parse_godot.py --repo Stabyourself__mari0
    python scripts/ingestion/03_parse_godot.py --verbose --dry-run
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.ingestion._godot_tscn import (
    find_scripts_in_scene, parse_tscn, resolve_res_path,
)
from scripts.ingestion._godot_gd import (
    heuristic_classify, parse_gdscript,
)

REPOS_CLEAN_GODOT = REPO_ROOT / "data" / "repos_clean" / "godot"
CHUNKS_RAW_GODOT = REPO_ROOT / "data" / "chunks_raw" / "godot"
STATS_PATH = REPO_ROOT / "data" / "godot_parse_stats.json"

CHUNK_SOFT_MAX_LOC = 800  # split big files (>800 LOC) into multi-chunk
MAX_SCAN_FILES = 8000      # safety cap per project


def find_project_root(repo_dir: Path) -> Path | None:
    """Return the directory containing project.godot, scanning shallowly.
    A repo may nest its Godot project under a subdir (e.g. `godot/`,
    `game/`, `example/`). We pick the first project.godot found at
    depth <=3."""
    for d in (0, 1, 2, 3):
        for cand in sorted(repo_dir.glob("/".join(["*"] * d + ["project.godot"]))):
            if cand.is_file():
                return cand.parent
    return None


_PG_SECTION_RE = re.compile(r"^\[(?P<name>[^\]]+)\]\s*$")
_PG_KV_RE = re.compile(r"^(?P<k>[A-Za-z0-9_/.\-]+)\s*=\s*(?P<v>.+?)\s*$")


def parse_project_godot(path: Path) -> dict[str, Any]:
    """Parse the project.godot INI-like file.

    Godot's project.godot is INI-shaped but uses Godot literal values
    (dicts, arrays, NodePath(...), Color(...), &"action_name"), which
    confuse stdlib ConfigParser. We do a tolerant line-by-line parse:
    section headers `[name]` open a new dict, every `key = value` line
    is captured verbatim into that dict. We don't interpret values —
    they remain as strings for downstream inspection.
    """
    out: dict[str, Any] = {
        "ok": False, "file_path": path.as_posix(),
        "autoloads": {}, "input_actions": [],
        "display": {}, "layer_names": {},
    }
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except OSError:
        return out
    sections: dict[str, dict[str, str]] = {}
    cur: dict[str, str] | None = None
    cur_name: str | None = None
    for line in text.splitlines():
        m = _PG_SECTION_RE.match(line)
        if m:
            cur_name = m.group("name")
            cur = sections.setdefault(cur_name, {})
            continue
        if cur is None:
            continue
        m = _PG_KV_RE.match(line)
        if m:
            cur[m.group("k")] = m.group("v")
    out["ok"] = True
    out["autoloads"] = sections.get("autoload", {})
    out["display"] = sections.get("display", {})
    out["input_actions"] = list(sections.get("input", {}).keys())
    out["layer_names"] = {
        k: v for k, v in sections.items() if k.startswith("layer_names/")
    }
    return out


def safe_name(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", s)


def make_e01_chunk(project_data: dict[str, Any], repo_name: str,
                   project_root: Path, repo_url: str) -> dict[str, Any]:
    """Synthetic chunk that summarises project.godot itself.
    Heuristic_category is fixed to E01_project_structure."""
    pg_path = project_data["file_path"]
    rel = Path(pg_path).relative_to(project_root.parent).as_posix() \
        if project_root else pg_path
    summary_lines = [
        "# project.godot summary",
        f"autoloads: {list(project_data['autoloads'].keys())}",
        f"input_actions: {project_data['input_actions'][:24]}",
        f"display: {project_data['display']}",
    ]
    code = Path(pg_path).read_text(encoding="utf-8", errors="ignore") \
        if Path(pg_path).exists() else "\n".join(summary_lines)
    return {
        "source_repo": repo_url,
        "engine": "godot",
        "file_paths": [rel],
        "scene_context": "",
        "code": code,
        "loc": sum(1 for ln in code.splitlines() if ln.strip()),
        "heuristic_domain": "E_architecture",
        "heuristic_category": "E01_project_structure",
        "heuristic_confidence": "high",
        "extends_type": None,
        "exports_found": [],
        "functions_found": [],
        "signals_defined": [],
        "signals_connected_from_scene": [],
        "chunk_kind": "project_meta",
    }


def signals_connected_from_scenes(script_abs: Path, project_root: Path,
                                  scenes: list[dict[str, Any]]) -> list[str]:
    """Collect connection lines where the connection's target node has
    `script_abs` attached. Resolves Godot `res://` script paths against
    the project root (where project.godot lives), not the scene's
    parent dir."""
    out: list[str] = []
    target_abs = script_abs.resolve().as_posix().lower()
    for sc in scenes:
        script_attached_nodes: set[str] = set()
        for n in sc["nodes"]:
            sp = n.get("script_path")
            if not sp:
                continue
            r = resolve_res_path(sp, project_root)
            if r and r.resolve().as_posix().lower() == target_abs:
                script_attached_nodes.add(n["name"])
        for c in sc["connections"]:
            if c["target"].split("/")[0] in script_attached_nodes \
                    or c["target"] == "." and script_attached_nodes:
                out.append(f"{c['signal']} → {c['method']}")
    return out


def scene_context_for_script(script_abs: Path, project_root: Path,
                             scenes: list[dict[str, Any]]) -> str:
    """If any cloned scene attaches this script to a node, return its
    scene_context line. Otherwise empty string (script may be a
    library/autoload). Resolves `res://` against project_root."""
    target_abs = script_abs.resolve().as_posix().lower()
    for sc in scenes:
        for n in sc["nodes"]:
            sp = n.get("script_path")
            if not sp:
                continue
            r = resolve_res_path(sp, project_root)
            if r and r.resolve().as_posix().lower() == target_abs:
                return sc["scene_context"]
    return ""


def split_big_file(text: str) -> list[str]:
    """Split a >800-LOC GDScript body at func boundaries so each chunk
    remains a coherent set of functions, not arbitrary line ranges."""
    func_re = re.compile(r"^(?:static\s+)?func\s+\w+", re.M)
    indices = [m.start() for m in func_re.finditer(text)]
    if len(indices) <= 1:
        return [text]
    parts: list[str] = []
    cur_lines = 0
    cur_start = 0
    for i, start in enumerate(indices):
        end = indices[i + 1] if i + 1 < len(indices) else len(text)
        block = text[start:end]
        block_lines = sum(1 for ln in block.splitlines() if ln.strip())
        if cur_lines + block_lines > CHUNK_SOFT_MAX_LOC and cur_start != start:
            parts.append(text[cur_start:start])
            cur_start = start
            cur_lines = block_lines
        else:
            cur_lines += block_lines
    parts.append(text[cur_start:])
    return parts


class GodotParser:
    """Stateful per-repo parser. Build one instance per repo to amortise
    the scenes-by-script index across all script chunks."""

    def __init__(self, project_root: Path, repo_url: str, verbose: bool = False) -> None:
        self.project_root = project_root
        self.repo_url = repo_url
        self.verbose = verbose
        self.scenes: list[dict[str, Any]] = []

    def parse_all_scenes(self) -> None:
        n = 0
        for p in self.project_root.rglob("*.tscn"):
            if n >= MAX_SCAN_FILES:
                break
            sc = parse_tscn(p)
            if sc["ok"]:
                self.scenes.append(sc)
            n += 1
        if self.verbose:
            print(f"    parsed {len(self.scenes)} scenes")

    def chunk_project(self) -> list[dict[str, Any]]:
        chunks: list[dict[str, Any]] = []
        pg_file = self.project_root / "project.godot"
        proj = parse_project_godot(pg_file)
        if proj["ok"]:
            chunks.append(make_e01_chunk(proj, self.project_root.name,
                                          self.project_root, self.repo_url))

        self.parse_all_scenes()

        gd_files: list[Path] = []
        for p in self.project_root.rglob("*.gd"):
            if len(gd_files) >= MAX_SCAN_FILES:
                break
            gd_files.append(p)
        if self.verbose:
            print(f"    found {len(gd_files)} .gd files")

        for gd_path in gd_files:
            gd = parse_gdscript(gd_path)
            if not gd["ok"] or gd["loc"] == 0:
                continue
            context = scene_context_for_script(gd_path, self.project_root, self.scenes)
            conns = signals_connected_from_scenes(gd_path, self.project_root, self.scenes)
            heuristic = heuristic_classify(gd, context)
            rel = gd_path.relative_to(self.project_root.parent).as_posix()
            text = gd["raw_text"]
            parts = split_big_file(text) if gd["loc"] > CHUNK_SOFT_MAX_LOC else [text]
            for i, body in enumerate(parts):
                chunk = {
                    "source_repo": self.repo_url,
                    "engine": "godot",
                    "file_paths": [rel],
                    "scene_context": context,
                    "code": body,
                    "loc": sum(1 for ln in body.splitlines() if ln.strip()),
                    "heuristic_domain": heuristic["heuristic_domain"],
                    "heuristic_category": heuristic["heuristic_category"],
                    "heuristic_confidence": heuristic["heuristic_confidence"],
                    "extends_type": gd["extends"],
                    "class_name": gd["class_name"],
                    "exports_found": [
                        f"{e['name']}: {e['type']} = {e['default']}".strip()
                        for e in gd["exports"]
                    ],
                    "functions_found": [f["name"] for f in gd["functions"]],
                    "signals_defined": [s["name"] for s in gd["signals"]],
                    "signals_connected_from_scene": conns,
                    "chunk_kind": "script_part" if len(parts) > 1 else "script",
                    "part_index": i if len(parts) > 1 else None,
                }
                chunks.append(chunk)
        return chunks


def write_chunks(chunks: list[dict[str, Any]], out_dir: Path) -> int:
    out_dir.mkdir(parents=True, exist_ok=True)
    for i, ch in enumerate(chunks, 1):
        with (out_dir / f"chunk_{i:04d}.json").open(
                "w", encoding="utf-8") as f:
            json.dump(ch, f, indent=2, ensure_ascii=False)
    return len(chunks)


def main() -> int:
    parser = argparse.ArgumentParser(description="Godot 4 parser — Fase 3")
    parser.add_argument("--repo", help="Only parse this repo (folder name).")
    parser.add_argument("--verbose", action="store_true")
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse and report counts but do not write chunks.")
    args = parser.parse_args()

    if not REPOS_CLEAN_GODOT.is_dir():
        print(f"ERROR: {REPOS_CLEAN_GODOT} missing. Run 02_filter first.",
              file=sys.stderr)
        return 1
    repos = sorted(d for d in REPOS_CLEAN_GODOT.iterdir() if d.is_dir())
    if args.repo:
        repos = [d for d in repos if d.name == args.repo]
        if not repos:
            print(f"ERROR: repo {args.repo} not in {REPOS_CLEAN_GODOT}",
                  file=sys.stderr)
            return 1
    print(f"Parsing {len(repos)} Godot repos...\n")

    stats = {
        "repos_parsed": 0, "repos_skipped_no_project": 0,
        "total_chunks": 0, "by_category": Counter(),
        "by_confidence": Counter(), "by_repo": {},
    }
    for repo_dir in repos:
        if args.verbose:
            print(f"--- {repo_dir.name}")
        project_root = find_project_root(repo_dir)
        if project_root is None:
            stats["repos_skipped_no_project"] += 1
            if args.verbose:
                print("    SKIP (no project.godot found)")
            continue
        # Recover the repo URL from the safe_repo_name back-decoded.
        repo_url = "https://github.com/" + repo_dir.name.replace("__", "/", 1)
        gp = GodotParser(project_root, repo_url, verbose=args.verbose)
        try:
            chunks = gp.chunk_project()
        except Exception as exc:
            print(f"    ERROR parsing {repo_dir.name}: "
                  f"{type(exc).__name__}: {exc}", file=sys.stderr)
            continue
        stats["repos_parsed"] += 1
        stats["total_chunks"] += len(chunks)
        stats["by_repo"][repo_dir.name] = len(chunks)
        for ch in chunks:
            stats["by_category"][ch["heuristic_category"]] += 1
            stats["by_confidence"][ch["heuristic_confidence"]] += 1
        if not args.dry_run:
            out_dir = CHUNKS_RAW_GODOT / safe_name(repo_dir.name)
            write_chunks(chunks, out_dir)
        if args.verbose:
            print(f"    -> {len(chunks)} chunks")

    print("\n=" * 1 + "=" * 63)
    print("GODOT PARSE SUMMARY")
    print("=" * 64)
    print(f"Parsed:           {stats['repos_parsed']} repos")
    print(f"Skipped:          {stats['repos_skipped_no_project']} (no project.godot)")
    print(f"Total chunks:     {stats['total_chunks']}")
    print("\nBy heuristic_confidence:")
    for c in ("high", "medium", "low"):
        print(f"  {c:<7} {stats['by_confidence'].get(c, 0)}")
    print("\nBy heuristic_category (top 12):")
    for cat, n in stats["by_category"].most_common(12):
        print(f"  {n:>5} {cat}")
    print("\nTop 10 repos by chunk count:")
    for name, n in sorted(stats["by_repo"].items(),
                          key=lambda x: x[1], reverse=True)[:10]:
        print(f"  {n:>5} {name}")

    if not args.dry_run:
        stats_out = {
            "repos_parsed": stats["repos_parsed"],
            "repos_skipped_no_project": stats["repos_skipped_no_project"],
            "total_chunks": stats["total_chunks"],
            "by_category": dict(stats["by_category"]),
            "by_confidence": dict(stats["by_confidence"]),
            "by_repo": stats["by_repo"],
        }
        STATS_PATH.write_text(json.dumps(stats_out, indent=2, sort_keys=True),
                              encoding="utf-8")
        print(f"\nStats:  {STATS_PATH}")
        print(f"Chunks: {CHUNKS_RAW_GODOT}/<repo>/chunk_NNNN.json")
    else:
        print("\nDRY RUN — no chunks written.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
