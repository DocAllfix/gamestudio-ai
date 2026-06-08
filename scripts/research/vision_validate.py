"""
Vision-classification validation (problem 11, sprite perspective).

Classifies ~36 character sprites with OpenAI gpt-4o-mini (detail:low, strict
JSON schema with enum) → measures REAL cost from the API usage and builds a
labelled montage so a human (Claude) can score accuracy against the model's
predictions. This is the cheap (~$0.02) de-risk before any full backfill.

Key from env: OPENAI_API_KEY (passed inline at the call site; never written to a
file). Run:  OPENAI_API_KEY=sk-... python scripts/research/vision_validate.py
"""
from __future__ import annotations

import base64
import io
import json
import os
import sys
import urllib.request

sys.path.insert(0, "scripts")
try:
    sys.stdout.reconfigure(encoding="utf-8")  # Windows cp1252 chokes on → etc.
except Exception:  # noqa: BLE001
    pass
from shared.db import get_connection  # noqa: E402

from PIL import Image, ImageDraw, ImageFont  # noqa: E402

N = 36
MODEL = "gpt-4o-mini"
PRICE_IN = 0.15 / 1e6   # $/token
PRICE_OUT = 0.60 / 1e6

SYSTEM = (
    "You classify ONE catalog image of a 2D game asset. Return JSON only.\n\n"
    "FIRST decide kind — what the image actually IS:\n"
    "  single         = one sprite/subject, usable as-is\n"
    "  animation_sheet= ONE subject in multiple frames/poses (a strip or grid of the SAME character/object)\n"
    "  object_pack    = MANY DIFFERENT objects packed in one image (an asset pack, a tileset of varied items, a 'creatures' collage)\n"
    "  non_asset      = NOT a usable sprite (a game screenshot, a UI mockup, a palette/reference, plain text)\n\n"
    "perspective = the angle the SUBJECT is drawn for — how the character/object FACES, NOT how frames are arranged:\n"
    "  side     = seen from the side / in profile (facing left or right)\n"
    "  top_down = seen from straight above (RPG/roguelike map)\n"
    "  front    = facing the viewer head-on (you see its face/front)\n"
    "  isometric= 3/4 angled view\n"
    "  unknown  = no inherent perspective (item, effect, ui, tile, abstract), or kind is object_pack/non_asset\n"
    "IMPORTANT: a horizontal STRIP of frames is NOT automatically 'side'. Judge how the subject FACES — "
    "front-facing frames laid out in a row are still 'front'.\n\n"
    "depicts = character | enemy | npc | prop | item | tile | effect | ui | vehicle | other\n"
    "is_directional = true only if it is a sheet with multiple FACING DIRECTIONS (not just animation frames)\n"
    "subject = 1-4 words. confidence = 0-100 for the perspective."
)

SCHEMA = {
    "name": "sprite_class",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "kind": {"type": "string", "enum": ["single", "animation_sheet", "object_pack", "non_asset"]},
            "perspective": {"type": "string", "enum": ["side", "top_down", "front", "isometric", "unknown"]},
            "depicts": {"type": "string", "enum": ["character", "enemy", "npc", "prop", "item", "tile", "effect", "ui", "vehicle", "other"]},
            "is_directional": {"type": "boolean"},
            "subject": {"type": "string"},
            "confidence": {"type": "integer"},
        },
        "required": ["kind", "perspective", "depicts", "is_directional", "subject", "confidence"],
    },
}


def fetch_image(url: str) -> bytes | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "gamesmith-validate/1.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read()
    except Exception as e:  # noqa: BLE001
        print(f"  fetch fail {url.split('/')[-1]}: {str(e)[:50]}")
        return None


def classify(api_key: str, img_bytes: bytes) -> tuple[dict, int, int]:
    data_url = "data:image/png;base64," + base64.b64encode(img_bytes).decode()
    body = json.dumps({
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": [
                {"type": "text", "text": "Classify this game sprite."},
                {"type": "image_url", "image_url": {"url": data_url, "detail": "low"}},
            ]},
        ],
        "response_format": {"type": "json_schema", "json_schema": SCHEMA},
        "max_tokens": 200,
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions", data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        resp = json.loads(r.read())
    out = json.loads(resp["choices"][0]["message"]["content"])
    u = resp["usage"]
    return out, u["prompt_tokens"], u["completion_tokens"]


def load_key() -> str | None:
    """OPENAI_API_KEY from env, else the single line out of .env (no other
    secrets pulled in)."""
    k = os.environ.get("OPENAI_API_KEY")
    if k:
        return k
    try:
        for line in open(".env", encoding="utf-8"):
            if line.startswith("OPENAI_API_KEY="):
                return line.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    return None


def main() -> None:
    api_key = load_key()
    if not api_key:
        print("OPENAI_API_KEY not set"); sys.exit(1)

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(f"""
            select download_url, image_width, image_height
            from public.asset_library_index
            where asset_type='sprite' and download_url is not null
              and (use_case_tags && array['character','enemy','npc','player','monster','creature']
                   or semantic_description ilike '%character%')
              and coalesce(image_width,9999) <= 1200
            order by random() limit {N}
        """)
        rows = cur.fetchall()

    results = []
    tin = tout = 0
    for i, (url, w, h) in enumerate(rows):
        img = fetch_image(url)
        if not img:
            continue
        try:
            pred, pin, pout = classify(api_key, img)
        except Exception as e:  # noqa: BLE001
            print(f"  classify fail {url.split('/')[-1]}: {str(e)[:80]}")
            continue
        tin += pin; tout += pout
        results.append({"url": url, "w": w, "h": h, "img": img, **pred})
        print(f"[{i+1:2}/{len(rows)}] {pred['kind']:15} {pred['perspective']:9} {pred['depicts']:8} dir={int(pred['is_directional'])} c={pred['confidence']:3}  {pred['subject'][:20]:20}  {url.split('/')[-1][:24]}")

    cost = tin * PRICE_IN + tout * PRICE_OUT
    n = len(results)
    print(f"\n=== {n} classified ===")
    print(f"tokens: in={tin} out={tout}  cost=${cost:.4f}  → extrapolated 953 chars: ${cost/max(n,1)*953:.2f}")
    from collections import Counter
    print("perspective:", dict(Counter(r["perspective"] for r in results)))
    print("avg confidence:", round(sum(r["confidence"] for r in results) / max(n, 1), 1))

    # Labelled montage so a human can score the predictions.
    cols = 6
    cell, pad, labelh = 110, 6, 40
    rows_n = (n + cols - 1) // cols
    W = cols * (cell + pad) + pad
    Hh = rows_n * (cell + labelh + pad) + pad
    canvas = Image.new("RGB", (W, Hh), (32, 34, 40))
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype("arial.ttf", 12)
    except Exception:  # noqa: BLE001
        font = ImageFont.load_default()
    for idx, r in enumerate(results):
        cx = pad + (idx % cols) * (cell + pad)
        cy = pad + (idx // cols) * (cell + labelh + pad)
        try:
            sp = Image.open(io.BytesIO(r["img"])).convert("RGBA")
            sp.thumbnail((cell, cell), Image.NEAREST)
            bg = Image.new("RGBA", (cell, cell), (60, 62, 70, 255))
            bg.paste(sp, ((cell - sp.width) // 2, (cell - sp.height) // 2), sp)
            canvas.paste(bg.convert("RGB"), (cx, cy))
        except Exception:  # noqa: BLE001
            pass
        pcol = {"side": (120, 220, 120), "top_down": (120, 170, 240), "front": (240, 180, 120),
                "isometric": (210, 140, 240), "unknown": (150, 150, 150)}.get(r["perspective"], (200, 200, 200))
        kcol = {"single": (235, 235, 235), "animation_sheet": (110, 210, 230), "object_pack": (240, 170, 90),
                "non_asset": (230, 100, 100)}.get(r["kind"], (200, 200, 200))
        kshort = {"single": "single", "animation_sheet": "anim-sheet", "object_pack": "PACK", "non_asset": "JUNK"}.get(r["kind"], r["kind"])
        draw.text((cx + 2, cy + cell + 1), f"{idx+1} {kshort}", fill=kcol, font=font)
        draw.text((cx + 2, cy + cell + 13), f"{r['perspective']} {r['confidence']}", fill=pcol, font=font)
        draw.text((cx + 2, cy + cell + 25), f"{r['depicts']}{'*' if r['is_directional'] else ''}", fill=(190, 190, 190), font=font)
    canvas.save("vision_montage.png")
    print("saved vision_montage.png")
    # Drop the raw bytes before dumping JSON.
    for r in results:
        del r["img"]
    with open("vision_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=1)


if __name__ == "__main__":
    main()
