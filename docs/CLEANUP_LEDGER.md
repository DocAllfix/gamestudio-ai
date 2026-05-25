# Cleanup ledger — data/repos_raw/ trim

_Generated 20260525T134213Z by `scripts/ingestion/_snapshot_repos_raw.py`._

## Context

Free local disk was at 3 GB on 2026-05-25. `data/repos_raw/`
held 16.6 GB of cloned repos — most either already in Supabase or
rejected zombies from the phase-1ter filter hardening. We snapshot
every URL + metadata to `data/cleanup_snapshot_repos_raw_*.json`
(gitignored, large) and then wipe the directory except for two
FASE-3 clones still in progress.

## Counts

- **Ingested in Supabase:** 275 repos (safe to delete — chunks already in DB)
- **Zombie / rejected / unprocessed:** 298 repos (safe to delete — never produced an `ingestion_log` row)
- **Unknown / no manifest record:** 0 repos
- **Kept on disk for in-progress FASE 3:** jsfehler__entroponaut, shawna-p__mysterious-messenger

## Per-engine breakdown

| Engine | Ingested | Zombie |
|---|---|---|
| `defold` | 54 | 8 |
| `godot` | 106 | 142 |
| `love2d` | 38 | 36 |
| `monogame` | 33 | 28 |
| `phaser` | 21 | 58 |
| `renpy` | 8 | 12 |
| `threejs` | 15 | 14 |

## How to restore

Two snapshot files exist (use either):

- **`docs/CLEANUP_LEDGER_URLS.json`** — slim, committed, survives a `data/` wipe (573 URLs, engine + license only).
- **`data/cleanup_snapshot_repos_raw_20260525T134213Z.json`** — full, gitignored, includes stars / topics / pushed_at / role.

From either file:

- **Ingested repos:** the chunks are already in `code_knowledge` /
  `code_knowledge_quarantine`. The Reasoning Engine reads Supabase,
  not the disk — no restore needed for normal use. If an offline
  copy is wanted: `git clone <ingested_in_supabase[i].url>`.
- **Zombie repos:** re-add the URL to
  `scripts/ingestion/_sources.py` `CURATED_REPOS` and re-run the
  pipeline. Most will fail the same filter again unless rules in
  `scripts/ingestion/_filter_rules.py` have changed.
- **Unknown repos:** no restore path; discard.

## Why repos were zombied (root cause)

Commit `8cd9449 feat(phase-1ter): harden quality filter` tightened
the structural gate (`MIN_LOC=300`, `MIN_COMMENT_RATIO=0.03`, LOC
bypass list) AFTER the initial broad `phase-1` harvest had already
cloned ~700 repos. The harden run reprocessed only a subset, leaving
the rest (298 of them) cloned but never logged. Subsequent
harvest commits (`phase-1bis`, `phase-1ter`, `phase-1quater`) added
a few hand-picked repos each but never came back to re-evaluate the
early bulk.
