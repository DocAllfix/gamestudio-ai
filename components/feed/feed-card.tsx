"use client";

import type { FeedBuild } from "@/lib/runtime/runtime-client";
import { Play } from "lucide-react";

const ENGINE_LABEL: Record<string, string> = {
  godot: "Godot",
  phaser: "Phaser",
  threejs: "Three.js",
  babylon: "Babylon.js",
  defold: "Defold",
  renpy: "Ren'Py",
  monogame: "MonoGame",
  love2d: "LÖVE",
};

interface Props {
  build: FeedBuild;
  onPlay: (build: FeedBuild) => void;
}

export function FeedCard({ build, onPlay }: Props) {
  const engineLabel = ENGINE_LABEL[build.engine] ?? build.engine;
  const sizeMb = (build.bundle_size_bytes / (1024 * 1024)).toFixed(1);

  return (
    <article
      className="group relative overflow-hidden rounded-xl border border-surface-2 bg-surface transition-colors hover:border-forge/40"
      data-testid={`feed-card-${build.project_id}`}
    >
      {/* Thumbnail placeholder — will be a real screenshot once W3 ships */}
      <div className="aspect-video w-full bg-surface-2 flex items-center justify-center">
        <span className="font-display text-4xl text-forge opacity-30">▶</span>
      </div>

      <div className="p-4">
        <h3 className="font-display font-semibold text-text truncate">{build.title}</h3>
        <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
          <span className="rounded bg-surface-2 px-1.5 py-0.5">{engineLabel}</span>
          <span>{build.genre.replace(/_/g, " ")}</span>
          <span className="ml-auto">{sizeMb} MB</span>
          {build.target === "pwa" && (
            <span className="rounded bg-forge/10 px-1.5 py-0.5 text-forge text-[10px] font-semibold">
              PWA
            </span>
          )}
        </div>
      </div>

      {/* Play overlay on tap/hover */}
      <button
        type="button"
        onClick={() => onPlay(build)}
        data-testid={`play-btn-${build.project_id}`}
        aria-label={`Gioca a ${build.title}`}
        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity bg-ink/60"
      >
        <span className="flex items-center gap-2 rounded-full bg-forge px-5 py-2.5 font-display font-semibold text-ink text-sm shadow-lg">
          <Play size={14} fill="currentColor" />
          Gioca
        </span>
      </button>
    </article>
  );
}
