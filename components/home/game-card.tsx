"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { FeedBuild } from "@/lib/runtime/runtime-client";
import { AnvilMark } from "@/components/brand/anvil-mark";

/**
 * GameCard — a forged game in the home gallery.
 *
 * Preview behaviour (per the ui-ux-pro-max performance rule: no eager
 * autoplay of many videos): the muted, playsInline, preload="none" clip only
 * plays when the card is actually in the viewport (IntersectionObserver) and
 * pauses when it scrolls off. So games look "alive" on entry like Higgsfield,
 * without 30 videos hammering the network. Falls back to the static cover when
 * there's no clip. Click opens the real game (sandboxed iframe) via onPlay.
 */
interface GameCardProps {
    game: FeedBuild;
    /** Visual span for the masonry rhythm (varied sizes = anti-slop). */
    span?: "tall" | "wide" | "normal";
    onPlay: (game: FeedBuild) => void;
    index: number;
}

export function GameCard({ game, span = "normal", onPlay, index }: GameCardProps) {
    const reduce = useReducedMotion();
    const ref = useRef<HTMLButtonElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el || !game.preview_clip_url) return;
        const obs = new IntersectionObserver(
            ([entry]) => setInView(entry?.isIntersecting ?? false),
            { rootMargin: "100px", threshold: 0.25 },
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [game.preview_clip_url]);

    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        if (inView && !reduce) {
            void v.play().catch(() => {});
        } else {
            v.pause();
        }
    }, [inView, reduce]);

    const spanClass =
        span === "tall" ? "row-span-2" : span === "wide" ? "sm:col-span-2" : "";

    return (
        <motion.button
            ref={ref}
            type="button"
            onClick={() => onPlay(game)}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: Math.min(index * 0.04, 0.4), ease: [0.16, 1, 0.3, 1] }}
            className={`group relative overflow-hidden rounded-xl border border-surface-2 bg-surface text-left transition-colors hover:border-forge focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forge ${spanClass}`}
        >
            {/* Media: cover by default, clip layered on top when in view */}
            <div className="relative aspect-video w-full overflow-hidden bg-ink">
                {game.cover_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                        src={game.cover_url}
                        alt={game.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                )}
                {game.preview_clip_url && (
                    <video
                        ref={videoRef}
                        src={game.preview_clip_url}
                        muted
                        loop
                        playsInline
                        preload="none"
                        poster={game.cover_url}
                        className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100 data-[playing=true]:opacity-100"
                        data-playing={inView}
                    />
                )}
                {!game.cover_url && !game.preview_clip_url && (
                    /* CSS cover fallback (no real cover yet): branded gradient +
                       mark + title, so empty cards still read as a game tile. */
                    <div
                        className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center"
                        style={{
                            background:
                                "radial-gradient(120% 120% at 70% 0%, rgba(245,88,43,0.22), transparent 55%), #14161b",
                        }}
                    >
                        <AnvilMark size={36} className="text-surface-2" label={null} />
                        <span className="font-display text-base font-semibold text-text">{game.title}</span>
                    </div>
                )}
                {/* Play affordance on hover */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded-full bg-forge px-4 py-2 font-display text-sm font-semibold text-ink">
                        Play
                    </span>
                </div>
            </div>

            {/* Meta */}
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                    <h3 className="truncate font-display text-sm font-semibold text-text">{game.title}</h3>
                    {game.author && (
                        <p className="truncate text-xs text-text-muted">by {game.author}</p>
                    )}
                </div>
                <span className="shrink-0 rounded bg-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase text-text-muted">
                    {game.engine}
                </span>
            </div>
        </motion.button>
    );
}
