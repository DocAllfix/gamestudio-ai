"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

/** Copy-the-share-link button. The link is this /play page on our domain —
 * the R2 URL stays hidden inside the iframe, so what gets shared is branded. */
export function ShareButton({ title }: { title: string }) {
    const [copied, setCopied] = useState(false);

    async function copy() {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error("share copy failed", { error });
        }
    }

    return (
        <button
            type="button"
            onClick={copy}
            aria-label={`Copy share link for ${title}`}
            className="flex items-center gap-2 rounded-lg border border-surface-2 bg-surface px-3.5 py-2 text-sm font-medium text-text transition-colors hover:border-text-muted"
        >
            {copied ? <Check size={15} className="text-success" /> : <Link2 size={15} />}
            {copied ? "Link copied" : "Share"}
        </button>
    );
}
