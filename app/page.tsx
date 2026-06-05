"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { AnvilMark } from "@/components/brand/anvil-mark";
import { GameCard } from "@/components/home/game-card";
import { Invite } from "@/components/home/invite";
import { getMockFeedBuilds, type FeedBuild } from "@/lib/runtime/runtime-client";
import { t } from "@/lib/i18n/dictionaries";

// Gallery source. Empty for now (DB has no real games yet); when the feed query
// lands, this becomes the live list. Set to [] to preview the empty-state.
const GAMES: FeedBuild[] = getMockFeedBuilds();

const FILTERS = ["All", "Platformer", "Roguelike", "Arcade", "3D", "Puzzle"] as const;

// Vary card spans for a masonry rhythm (anti-slop: not identical cards).
const SPANS: Array<"tall" | "wide" | "normal"> = ["wide", "normal", "tall", "normal", "normal", "wide"];

export default function HomePage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const games = useMemo(() => {
    if (filter === "All") return GAMES;
    const key = filter.toLowerCase();
    return GAMES.filter(
      (g) =>
        g.genre.toLowerCase().includes(key) ||
        (key === "3d" && (g.engine === "threejs" || g.engine === "babylon")),
    );
  }, [filter]);

  function openGame(game: FeedBuild) {
    // For now route to the feed player; wire to a dedicated /play/[id] later.
    window.location.href = `/feed?play=${game.project_id}`;
  }

  return (
    <main className="min-h-dvh bg-ink text-text">
      {/* Top nav */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-surface-2 bg-ink/85 px-6 py-3 backdrop-blur">
        <Link href="/" className="flex items-center gap-2">
          <AnvilMark size={26} className="text-text" label={null} />
          <span className="font-display text-lg font-bold tracking-tight">
            Game<span className="text-forge">Smith</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/create"
            className="rounded-lg bg-forge px-4 py-2 font-display text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5"
          >
            {t("nav.forge")}
          </Link>
          <Link href="/sign-in" className="text-sm text-text-muted transition-colors hover:text-text">
            {t("nav.signIn")}
          </Link>
        </div>
      </header>

      {/* Entry invitation — Higgsfield-style breath, routes to the generator */}
      <Invite />

      {/* Filters */}
      <div className="sticky top-[57px] z-10 border-b border-surface-2 bg-ink/85 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 font-display text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-forge text-ink"
                  : "bg-surface text-text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              {f === "All" ? t("nav.filter.all") : f}
            </button>
          ))}
        </div>
      </div>

      {/* Gallery / empty-state */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        {games.length > 0 ? (
          <>
            <h2 className="mb-5 font-display text-sm font-semibold uppercase tracking-wide text-text-muted">
              {t("home.grid.heading")}
            </h2>
            <div className="grid auto-rows-[180px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {games.map((game, i) => (
                <GameCard key={game.project_id} game={game} span={SPANS[i % SPANS.length]} onPlay={openGame} index={i} />
              ))}
            </div>
          </>
        ) : (
          <EmptyState />
        )}
      </section>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-surface-2 px-6 py-20 text-center">
      <AnvilMark size={64} className="text-text" label={null} />
      <h2 className="font-display text-2xl font-bold">{t("home.empty.title")}</h2>
      <p className="max-w-[44ch] text-text-muted">{t("home.empty.body")}</p>
      <Link
        href="/create"
        className="rounded-lg bg-forge px-6 py-3 font-display font-semibold text-ink transition-transform hover:-translate-y-0.5"
      >
        {t("home.empty.cta")}
      </Link>
    </div>
  );
}
