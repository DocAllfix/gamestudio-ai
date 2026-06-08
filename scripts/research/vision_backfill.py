"""
Vision classification backfill (problem 11) — classifies every character-like
sprite with gpt-4o-mini (strict JSON schema) and writes sprite_kind / perspective
/ vision_meta. Reuses the validated prompt+schema from vision_validate.

Resumable: only rows with perspective IS NULL are processed, so a re-run picks up
where a crash/timeout left off. Key from .env (OPENAI_API_KEY). Run:
  python scripts/research/vision_backfill.py
"""
from __future__ import annotations

import json
import sys
import time

sys.path.insert(0, "scripts")
sys.path.insert(0, "scripts/research")
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

from shared.db import get_connection  # noqa: E402

import vision_validate as vv  # noqa: E402

SELECT = """
  select id, download_url
  from public.asset_library_index
  where asset_type='sprite' and download_url is not null and perspective is null
    and (use_case_tags && array['character','enemy','npc','player','monster','creature']
         or semantic_description ilike '%character%')
    and coalesce(image_width,9999) <= 1200
  order by id
"""


def main() -> None:
    key = vv.load_key()
    if not key:
        print("OPENAI_API_KEY not set"); sys.exit(1)

    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute(SELECT)
        rows = cur.fetchall()
    print(f"{len(rows)} character sprites to classify (resumable: perspective IS NULL)", flush=True)

    tin = tout = done = fail = 0
    with get_connection() as conn:
        cur = conn.cursor()
        for aid, url in rows:
            img = vv.fetch_image(url)
            if not img:
                fail += 1
                continue
            pred = pin = pout = None
            for attempt in range(2):
                try:
                    pred, pin, pout = vv.classify(key, img)
                    break
                except Exception as e:  # noqa: BLE001
                    if attempt == 0:
                        time.sleep(2.0)
                    else:
                        print(f"  classify fail {aid}: {str(e)[:60]}", flush=True)
            if not pred:
                fail += 1
                continue
            tin += pin; tout += pout
            meta = {
                "depicts": pred["depicts"], "is_directional": pred["is_directional"],
                "subject": pred["subject"], "confidence": pred["confidence"], "model": vv.MODEL,
            }
            cur.execute(
                "update public.asset_library_index set sprite_kind=%s, perspective=%s, vision_meta=%s where id=%s",
                (pred["kind"], pred["perspective"], json.dumps(meta), aid),
            )
            conn.commit()
            done += 1
            if done % 25 == 0:
                cost = tin * vv.PRICE_IN + tout * vv.PRICE_OUT
                print(f"  {done}/{len(rows)} ok, {fail} fail, ${cost:.3f}", flush=True)
            time.sleep(0.15)  # gentle on OpenGameArt + OpenAI

    cost = tin * vv.PRICE_IN + tout * vv.PRICE_OUT
    print(f"DONE: {done} classified, {fail} failed, cost=${cost:.4f}", flush=True)
    with get_connection() as conn:
        cur = conn.cursor()
        cur.execute("select sprite_kind, count(*) from public.asset_library_index where vision_meta is not null group by 1 order by 2 desc")
        print("sprite_kind:", cur.fetchall())
        cur.execute("select perspective, count(*) from public.asset_library_index where vision_meta is not null group by 1 order by 2 desc")
        print("perspective:", cur.fetchall())


if __name__ == "__main__":
    main()
