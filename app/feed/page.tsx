"use client";

import { useState } from "react";
import { getMockFeedBuilds, type FeedBuild } from "@/lib/runtime/runtime-client";
import { FeedCard } from "@/components/feed/feed-card";
import { GamePlayer } from "@/components/feed/game-player";

export default function FeedPage() {
  const builds = getMockFeedBuilds();
  const [activeBuild, setActiveBuild] = useState<FeedBuild | null>(null);

  return (
    <>
      {activeBuild && (
        <GamePlayer
          iframeUrl={activeBuild.iframe_url}
          title={activeBuild.title}
          projectId={activeBuild.project_id}
          onClose={() => setActiveBuild(null)}
        />
      )}

      <main className="min-h-screen bg-ink px-4 pb-16 pt-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-text">
            Feed
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Giochi forgiati dalla community — tap per giocare subito.
          </p>
        </div>

        {/* Scrollable grid — 1 col mobile, 2 col sm, 3 col lg */}
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="feed-list"
        >
          {builds.map((build) => (
            <FeedCard
              key={build.project_id}
              build={build}
              onPlay={setActiveBuild}
            />
          ))}
        </div>
      </main>
    </>
  );
}
