"""Seed the 5 catalog tables (Gap 8) — Phase 2.

Reads structured data from blueprint v2 + STYLE_PACK_REFERENCES.md +
AUDIO_MOOD_LIBRARY.md + LORA_LIBRARY_EXPANDED.md + REFERENCE_GAMES_VISUAL.md
and upserts into:
  - style_packs        (30 rows)
  - genre_templates    (14 rows)
  - audio_mood_library (12 rows)
  - lora_library       (~40 rows, no embedding yet — backfilled later)
  - reference_games    (80 rows, moodboard fields filled by 07_vision_moodboard)

Idempotent: ON CONFLICT (id/source_url) DO UPDATE so re-runs after
catalog edits are safe.

CLI:
    python scripts/ingestion_assets/06_seed_catalogs.py --dry-run
    python scripts/ingestion_assets/06_seed_catalogs.py
    python scripts/ingestion_assets/06_seed_catalogs.py --table style_packs
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.shared.db import get_connection
from scripts.ingestion_assets._seed_data import (
    STYLE_PACKS_DATA, GENRE_TEMPLATES_DATA, AUDIO_MOODS_DATA,
    LORA_LIBRARY_DATA, REFERENCE_GAMES_DATA,
)


def seed_style_packs(cur) -> int:
    sql = """
    INSERT INTO public.style_packs (
        id, display_name, description, group_label,
        palette_hex, prompt_modifiers, negative_prompt,
        font_family_ui, font_family_dialog,
        music_mood_id, sfx_style,
        reference_game_ids, compatible_genres, compatible_engines
    ) VALUES (
        %s, %s, %s, %s,
        %s, %s, %s,
        %s, %s,
        %s, %s,
        %s, %s, %s
    )
    ON CONFLICT (id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        group_label = EXCLUDED.group_label,
        palette_hex = EXCLUDED.palette_hex,
        prompt_modifiers = EXCLUDED.prompt_modifiers,
        negative_prompt = EXCLUDED.negative_prompt,
        font_family_ui = EXCLUDED.font_family_ui,
        font_family_dialog = EXCLUDED.font_family_dialog,
        music_mood_id = EXCLUDED.music_mood_id,
        sfx_style = EXCLUDED.sfx_style,
        reference_game_ids = EXCLUDED.reference_game_ids,
        compatible_genres = EXCLUDED.compatible_genres,
        compatible_engines = EXCLUDED.compatible_engines
    """
    n = 0
    for p in STYLE_PACKS_DATA:
        cur.execute(sql, (
            p["id"], p["display_name"], p["description"], p["group_label"],
            p["palette_hex"], p.get("prompt_modifiers"),
            p.get("negative_prompt"),
            p.get("font_family_ui"), p.get("font_family_dialog"),
            p.get("music_mood_id"), p.get("sfx_style"),
            p.get("reference_game_ids", []),
            p.get("compatible_genres", []),
            p.get("compatible_engines", []),
        ))
        n += 1
    return n


def seed_genre_templates(cur) -> int:
    sql = """
    INSERT INTO public.genre_templates (
        id, display_name, description, tier,
        genre, sub_genre, target_engine, alt_engines,
        baseline_world_graph, baseline_pacing_curve, baseline_rules,
        baseline_invariants,
        recommended_style_pack_ids, recommended_audio_mood_ids,
        reference_game_ids, code_template_repos, engine_specific_hints
    ) VALUES (
        %s, %s, %s, %s,
        %s, %s, %s, %s,
        %s::jsonb, %s, %s::jsonb,
        %s,
        %s, %s,
        %s, %s, %s::jsonb
    )
    ON CONFLICT (id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        tier = EXCLUDED.tier,
        baseline_world_graph = EXCLUDED.baseline_world_graph,
        baseline_pacing_curve = EXCLUDED.baseline_pacing_curve,
        baseline_rules = EXCLUDED.baseline_rules,
        recommended_style_pack_ids = EXCLUDED.recommended_style_pack_ids,
        recommended_audio_mood_ids = EXCLUDED.recommended_audio_mood_ids,
        reference_game_ids = EXCLUDED.reference_game_ids,
        code_template_repos = EXCLUDED.code_template_repos,
        engine_specific_hints = EXCLUDED.engine_specific_hints
    """
    n = 0
    for t in GENRE_TEMPLATES_DATA:
        cur.execute(sql, (
            t["id"], t["display_name"], t["description"], t["tier"],
            t["genre"], t.get("sub_genre"),
            t["target_engine"], t.get("alt_engines", []),
            json.dumps(t["baseline_world_graph"]),
            t["baseline_pacing_curve"],
            json.dumps(t["baseline_rules"]),
            t.get("baseline_invariants", []),
            t.get("recommended_style_pack_ids", []),
            t.get("recommended_audio_mood_ids", []),
            t.get("reference_game_ids", []),
            t.get("code_template_repos", []),
            json.dumps(t.get("engine_specific_hints", {})),
        ))
        n += 1
    return n


def seed_audio_moods(cur) -> int:
    sql = """
    INSERT INTO public.audio_mood_library (
        id, display_name, description,
        bpm_min, bpm_max, key_musical, instruments,
        suno_prompts, layering_pattern,
        sfx_freesound_queries, sfx_kenney_packs,
        template_ids, style_pack_ids
    ) VALUES (
        %s, %s, %s,
        %s, %s, %s, %s,
        %s, %s::jsonb,
        %s, %s,
        %s, %s
    )
    ON CONFLICT (id) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        bpm_min = EXCLUDED.bpm_min,
        bpm_max = EXCLUDED.bpm_max,
        key_musical = EXCLUDED.key_musical,
        instruments = EXCLUDED.instruments,
        suno_prompts = EXCLUDED.suno_prompts,
        layering_pattern = EXCLUDED.layering_pattern,
        sfx_freesound_queries = EXCLUDED.sfx_freesound_queries,
        sfx_kenney_packs = EXCLUDED.sfx_kenney_packs,
        template_ids = EXCLUDED.template_ids,
        style_pack_ids = EXCLUDED.style_pack_ids
    """
    n = 0
    for m in AUDIO_MOODS_DATA:
        cur.execute(sql, (
            m["id"], m["display_name"], m["description"],
            m["bpm_min"], m["bpm_max"],
            m.get("key_musical"),
            m.get("instruments", []),
            m.get("suno_prompts", []),
            json.dumps(m.get("layering_pattern", {})),
            m.get("sfx_freesound_queries", []),
            m.get("sfx_kenney_packs", []),
            m.get("template_ids", []),
            m.get("style_pack_ids", []),
        ))
        n += 1
    return n


def seed_lora_library(cur) -> int:
    sql = """
    INSERT INTO public.lora_library (
        hf_repo, display_name, license, base_model,
        trigger_words, recommended_weight, negative_prompt,
        style_pack_ids, asset_types, genre_affinity, tool_affinity,
        semantic_description, quality_score, huggingface_downloads
    ) VALUES (
        %s, %s, %s, %s,
        %s, %s, %s,
        %s, %s, %s, %s,
        %s, %s, %s
    )
    ON CONFLICT (hf_repo) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        license = EXCLUDED.license,
        base_model = EXCLUDED.base_model,
        trigger_words = EXCLUDED.trigger_words,
        recommended_weight = EXCLUDED.recommended_weight,
        negative_prompt = EXCLUDED.negative_prompt,
        style_pack_ids = EXCLUDED.style_pack_ids,
        asset_types = EXCLUDED.asset_types,
        genre_affinity = EXCLUDED.genre_affinity,
        tool_affinity = EXCLUDED.tool_affinity,
        semantic_description = EXCLUDED.semantic_description,
        quality_score = EXCLUDED.quality_score,
        huggingface_downloads = EXCLUDED.huggingface_downloads
    """
    n = 0
    for L in LORA_LIBRARY_DATA:
        cur.execute(sql, (
            L["hf_repo"], L["display_name"], L["license"], L["base_model"],
            L.get("trigger_words", []),
            L.get("recommended_weight", 0.8),
            L.get("negative_prompt"),
            L.get("style_pack_ids", []),
            L.get("asset_types", []),
            L.get("genre_affinity", []),
            L.get("tool_affinity", []),
            L["semantic_description"],
            L.get("quality_score", 3),
            L.get("huggingface_downloads"),
        ))
        n += 1
    return n


def seed_reference_games(cur) -> int:
    sql = """
    INSERT INTO public.reference_games (
        title, store_url, cover_url, developer, release_year,
        style_pack_tags, genre_tags, engine_compat,
        notable_features
    ) VALUES (
        %s, %s, %s, %s, %s,
        %s, %s, %s,
        %s
    )
    ON CONFLICT (store_url) DO UPDATE SET
        title = EXCLUDED.title,
        cover_url = EXCLUDED.cover_url,
        developer = EXCLUDED.developer,
        release_year = EXCLUDED.release_year,
        style_pack_tags = EXCLUDED.style_pack_tags,
        genre_tags = EXCLUDED.genre_tags,
        engine_compat = EXCLUDED.engine_compat,
        notable_features = EXCLUDED.notable_features
    """
    n = 0
    for g in REFERENCE_GAMES_DATA:
        cur.execute(sql, (
            g["title"], g["store_url"],
            g.get("cover_url"), g.get("developer"), g.get("release_year"),
            g.get("style_pack_tags", []),
            g.get("genre_tags", []),
            g.get("engine_compat", []),
            g.get("notable_features", []),
        ))
        n += 1
    return n


TABLES = {
    "style_packs": seed_style_packs,
    "genre_templates": seed_genre_templates,
    "audio_mood_library": seed_audio_moods,
    "lora_library": seed_lora_library,
    "reference_games": seed_reference_games,
}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--table", choices=list(TABLES.keys()),
                    help="Seed only this table.")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    targets = [args.table] if args.table else list(TABLES.keys())

    print(f"Seeding {len(targets)} table(s): {', '.join(targets)}")

    with get_connection() as conn:
        cur = conn.cursor()
        for table in targets:
            fn = TABLES[table]
            try:
                n = fn(cur)
            except Exception as exc:
                conn.rollback()
                print(f"\nERROR seeding {table}: {exc}")
                return 2
            if args.dry_run:
                conn.rollback()
                print(f"  [DRY-RUN] {table}: {n} rows would be upserted")
            else:
                conn.commit()
                print(f"  [OK] {table}: {n} rows upserted")

        # Verify counts
        if not args.dry_run:
            print("\nVerification (counts on DB):")
            for table in targets:
                cur.execute(f"SELECT count(*) FROM public.{table}")
                print(f"  {table:22} {cur.fetchone()[0]} rows")

    return 0


if __name__ == "__main__":
    sys.exit(main())
