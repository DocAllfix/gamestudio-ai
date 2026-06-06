import Link from "next/link";
import type { Metadata } from "next";
import { AnvilMark } from "@/components/brand/anvil-mark";
import { getPublicGame } from "./actions";
import { ShareButton } from "./share-bar";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ id: string }>;
}): Promise<Metadata> {
    const { id } = await params;
    const game = await getPublicGame(id);
    const title = game ? `${game.title} — GameSmith` : "GameSmith";
    return {
        title,
        description: game
            ? `Play "${game.title}", forged with GameSmith.`
            : "Forge real games with GameSmith.",
        openGraph: { title, type: "website" },
    };
}

/**
 * Public, shareable play page. The page (header, brand, footer) is ours; the
 * game runs inside a sandboxed iframe served from R2's CDN. The URL people
 * share is this gamesmith.com/play/<id>, never the R2 link.
 */
export default async function PlayPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const game = await getPublicGame(id);

    return (
        <main className="flex min-h-dvh flex-col bg-ink text-text">
            {/* Brand header */}
            <header className="flex items-center justify-between gap-4 border-b border-surface-2 px-4 py-3 sm:px-6">
                <Link href="/" className="flex items-center gap-2.5" aria-label="GameSmith home">
                    <AnvilMark size={28} className="text-text" label={null} />
                    <span className="font-display text-lg font-bold tracking-tight">GameSmith</span>
                </Link>
                {game && <ShareButton title={game.title} />}
            </header>

            {game ? (
                <>
                    {/* Title strip */}
                    <div className="px-4 pt-5 sm:px-6">
                        <h1 className="font-display text-2xl font-bold tracking-tight text-balance">
                            {game.title}
                        </h1>
                        <p className="mt-1 text-sm text-text-muted">
                            {[game.engine, game.genre].filter(Boolean).join(" · ")}
                        </p>
                    </div>

                    {/* The game itself — sandboxed iframe, max width for a console feel */}
                    <div className="flex flex-1 items-center justify-center px-4 py-5 sm:px-6">
                        <div className="aspect-video w-full max-w-5xl overflow-hidden rounded-xl border border-surface-2 bg-black shadow-[0_0_60px_-15px] shadow-forge/30">
                            <iframe
                                src={game.iframe_url}
                                title={game.title}
                                // allow-scripts: the game runs; allow-same-origin: WASM/asset
                                // fetch from R2. No popups/top-navigation/forms.
                                sandbox="allow-scripts allow-same-origin"
                                allow="autoplay; fullscreen; gamepad"
                                className="h-full w-full"
                            />
                        </div>
                    </div>

                    {/* Footer CTA — brand + funnel back into the product */}
                    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-2 px-4 py-4 text-sm sm:px-6">
                        <span className="text-text-muted">Forged with GameSmith</span>
                        <Link
                            href="/create"
                            className="rounded-lg bg-forge px-4 py-2 font-semibold text-ink transition-colors hover:bg-spark"
                        >
                            Forge your own
                        </Link>
                    </footer>
                </>
            ) : (
                /* Not found / not playable yet */
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                    <AnvilMark size={56} className="text-surface-2" label={null} />
                    <div>
                        <h1 className="font-display text-xl font-bold">This game isn&apos;t playable</h1>
                        <p className="mt-1 max-w-sm text-sm text-text-muted">
                            It may still be forging, or the web build isn&apos;t ready. Try again in a moment.
                        </p>
                    </div>
                    <Link
                        href="/create"
                        className="rounded-lg bg-forge px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-spark"
                    >
                        Forge a game
                    </Link>
                </div>
            )}
        </main>
    );
}
