"""
Ingest the official Godot 4 API docs into public.engine_api_docs, one row per
symbol (class + each method/constant/member/signal), so the code_gen self-heal
loop can fetch the exact doc for a symbol named in a compiler error.

Source: godotengine/godot @ 4.3, doc/classes/*.xml (official, per-class XML).

Usage:
    python scripts/ingestion_docs/ingest_godot_api.py --dry-run   # parse only, no DB/embeddings
    python scripts/ingestion_docs/ingest_godot_api.py             # parse + embed + upsert
    python scripts/ingestion_docs/ingest_godot_api.py --limit 20  # first N classes (testing)
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

ENGINE = "godot"
VERSION = "4.3"
# GitHub API to list the class XML files, then raw fetch each.
LIST_URL = f"https://api.github.com/repos/godotengine/godot/contents/doc/classes?ref={VERSION}-stable"
RAW_BASE = f"https://raw.githubusercontent.com/godotengine/godot/{VERSION}-stable/doc/classes"
EMBED_MODEL = "text-embedding-3-small"


def load_env() -> None:
    env = Path(__file__).resolve().parents[2] / ".env"
    if env.exists():
        for line in env.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip().strip('"'))


def clean(text: str | None) -> str:
    """Strip Godot BBCode-ish markup ([member x], [code]...[/code]) to plain text."""
    if not text:
        return ""
    t = re.sub(r"\[/?[a-zA-Z][^\]]*\]", "", text)  # [code], [member X], [/code]...
    return re.sub(r"\s+", " ", t).strip()


def list_classes(limit: int | None) -> list[str]:
    r = requests.get(LIST_URL, timeout=30)
    r.raise_for_status()
    names = [item["name"] for item in r.json() if item["name"].endswith(".xml")]
    names.sort()
    return names[:limit] if limit else names


def parse_class(xml_text: str) -> list[dict]:
    """One row for the class + one per method/constant/member/signal."""
    root = ET.fromstring(xml_text)
    cls = root.get("name", "")
    rows: list[dict] = []

    brief = clean(root.findtext("brief_description"))
    desc = clean(root.findtext("description"))
    rows.append({
        "class_name": cls, "symbol": cls, "kind": "class",
        "signature": cls,
        "content": f"{cls}: {brief}\n{desc}".strip(),
    })

    for m in root.findall("./methods/method"):
        name = m.get("name", "")
        ret = (m.find("return").get("type") if m.find("return") is not None else "void")
        params = ", ".join(
            f'{p.get("name")}: {p.get("type")}' for p in m.findall("param")
        )
        sig = f"{name}({params}) -> {ret}"
        rows.append({
            "class_name": cls, "symbol": name, "kind": "method",
            "signature": sig, "content": f"{cls}.{sig}: {clean(m.findtext('description'))}".strip(),
        })

    for c in root.findall("./constants/constant"):
        name = c.get("name", "")
        rows.append({
            "class_name": cls, "symbol": name, "kind": "constant",
            "signature": f"{cls}.{name} = {c.get('value','')}",
            "content": f"{cls}.{name}: {clean(c.text)}".strip(),
        })

    for mem in root.findall("./members/member"):
        name = mem.get("name", "")
        rows.append({
            "class_name": cls, "symbol": name, "kind": "member",
            "signature": f"{name}: {mem.get('type','')}",
            "content": f"{cls}.{name} ({mem.get('type','')}): {clean(mem.text)}".strip(),
        })

    for sig_el in root.findall("./signals/signal"):
        name = sig_el.get("name", "")
        rows.append({
            "class_name": cls, "symbol": name, "kind": "signal",
            "signature": f"signal {name}",
            "content": f"{cls} signal {name}: {clean(sig_el.findtext('description'))}".strip(),
        })

    return rows


def embed_batch(texts: list[str]) -> list[list[float]]:
    from openai import OpenAI
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    out: list[list[float]] = []
    for i in range(0, len(texts), 100):
        batch = [t[:8000] for t in texts[i : i + 100]]
        resp = client.embeddings.create(model=EMBED_MODEL, input=batch)
        out.extend(d.embedding for d in resp.data)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=None)
    # The self-heal lookup matches symbols exactly (no embedding); embeddings
    # only power the optional fuzzy search. --no-embed skips them for a fast,
    # reliable load.
    ap.add_argument("--no-embed", action="store_true")
    args = ap.parse_args()
    load_env()

    print(f"Listing Godot {VERSION} doc classes...")
    classes = list_classes(args.limit)
    print(f"  {len(classes)} classes")

    def fetch_one(fname: str) -> list[dict]:
        try:
            xml = requests.get(f"{RAW_BASE}/{fname}", timeout=30).text
            return parse_class(xml)
        except Exception as e:  # noqa: BLE001
            print(f"  ! {fname}: {e}", file=sys.stderr)
            return []

    all_rows: list[dict] = []
    # Parallel download (the slow part) — ~16 concurrent fetches.
    with ThreadPoolExecutor(max_workers=16) as pool:
        for i, rows in enumerate(pool.map(fetch_one, classes)):
            all_rows.extend(rows)
            if (i + 1) % 100 == 0:
                print(f"  fetched {i+1}/{len(classes)} classes, {len(all_rows)} symbols")

    print(f"Total symbols parsed: {len(all_rows)}")
    if args.dry_run:
        for r in all_rows[:8]:
            print(f"  [{r['kind']}] {r['class_name']}.{r['symbol']} :: {r['signature']}")
        print("DRY RUN — nothing written.")
        return

    if args.no_embed:
        print("Skipping embeddings (--no-embed); exact-symbol lookup doesn't need them.")
        embeddings = [None] * len(all_rows)
    else:
        print("Embedding...")
        embeddings = embed_batch([r["content"] for r in all_rows])

    import psycopg2
    from psycopg2.extras import execute_values
    conn = psycopg2.connect(
        host=os.environ["SUPABASE_DB_HOST"], port=os.environ.get("SUPABASE_DB_PORT", "5432"),
        user=os.environ["SUPABASE_DB_USER"], password=os.environ["SUPABASE_DB_PASSWORD"],
        dbname=os.environ.get("SUPABASE_DB_NAME", "postgres"),
    )
    cur = conn.cursor()
    rows = [
        (ENGINE, VERSION, r["class_name"], r["symbol"], r["kind"], r["signature"],
         r["content"][:8000], ("[" + ",".join(map(str, emb)) + "]") if emb is not None else None)
        for r, emb in zip(all_rows, embeddings)
    ]
    execute_values(
        cur,
        """insert into public.engine_api_docs
           (engine, version, class_name, symbol, kind, signature, content, embedding)
           values %s
           on conflict (engine, version, class_name, symbol, kind) do nothing""",
        rows, template="(%s,%s,%s,%s,%s,%s,%s,%s::vector)",
    )
    conn.commit()
    cur.execute("select count(*) from public.engine_api_docs")
    print(f"Inserted. engine_api_docs now has {cur.fetchone()[0]} rows.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
