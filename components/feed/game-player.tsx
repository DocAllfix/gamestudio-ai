"use client";

import { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { trackUsageEvent, type FeedEventName } from "@/app/feed/actions";

// Allowed origins for postMessage from sandboxed game iframes.
// In production set NEXT_PUBLIC_GAMES_ORIGIN=https://games.yourdomain.com
const ALLOWED_ORIGINS: string[] = [
  "https://mock-r2.example.com",
  ...(process.env.NEXT_PUBLIC_GAMES_ORIGIN
    ? [process.env.NEXT_PUBLIC_GAMES_ORIGIN]
    : []),
];

interface GameSDKEvent {
  type: "game_started" | "game_completed" | "game_failed";
  project_id: string;
  metadata?: Record<string, unknown>;
}

function isGameSDKEvent(data: unknown): data is GameSDKEvent {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.type === "string" &&
    ["game_started", "game_completed", "game_failed"].includes(d.type) &&
    typeof d.project_id === "string"
  );
}

interface Props {
  iframeUrl: string;
  title: string;
  projectId: string;
  onClose: () => void;
}

export function GamePlayer({ iframeUrl, title, projectId, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      // Security: only accept messages from known game origins
      if (!ALLOWED_ORIGINS.includes(event.origin)) return;
      if (!isGameSDKEvent(event.data)) return;

      const { type, metadata } = event.data;
      await trackUsageEvent({
        project_id: projectId,
        event_name: type as FeedEventName,
        metadata,
      });
    },
    [projectId],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink"
      data-testid="game-player-overlay"
    >
      {/* Minimal toolbar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-surface-2 px-4">
        <span className="font-display text-sm font-semibold text-text truncate max-w-[70%]">
          {title}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi player"
          className="rounded-lg p-1.5 text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Sandboxed game iframe */}
      <iframe
        ref={iframeRef}
        src={iframeUrl}
        title={title}
        data-testid="game-iframe"
        data-project-id={projectId}
        // allow-scripts: required for game to run
        // allow-same-origin: required for postMessage to work from game SDK
        // Intentionally NOT allow-popups / allow-top-navigation / allow-forms
        sandbox="allow-scripts allow-same-origin"
        className="flex-1 w-full border-none"
        allow="fullscreen"
      />
    </div>
  );
}
