-- ============================================================
-- GAME STUDIO AI — Migration 006: add 'fork' to usage_events.event_name
-- Supabase PostgreSQL
--
-- Additive change (FASE 0 contract proposal G.0). The flywheel / viral
-- loop (EXECUTION_PLAN_PROMPTS_v2.md [5-W1] / [5-W4]) treats a third-party
-- "fork" of a published game as a first-class validation signal feeding
-- success_score (WOW_CONTRACT.md §5). The original CHECK constraint on
-- usage_events.event_name (migration 005) did not include 'fork'.
--
-- Idempotent: drops the existing CHECK if present, re-adds it with the
-- original 10 values + 'fork'. Mirrors UsageEventSchema in
-- lib/contracts/billing.contract.ts (kept in sync in the same proposal).
--
-- Committed BEFORE apply per CLAUDE.md migration sync protocol. Apply via
-- scripts/apply_migrations.py.
-- ============================================================

alter table public.usage_events
    drop constraint if exists usage_events_event_name_check;

alter table public.usage_events
    add constraint usage_events_event_name_check
    check (event_name in (
        'game_started', 'game_completed', 'game_failed',
        'tool_executed', 'plan_refined', 'asset_uploaded',
        'game_exported_itch', 'game_exported_steam',
        'upgrade_clicked', 'downgrade_clicked',
        'fork'
    ));
