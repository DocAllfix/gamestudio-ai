"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/dictionaries";
import type { LibraryAsset } from "@/app/(dashboard)/studio/actions";

/**
 * Library panel — the user's curated assets, grouped visually by type. This is
 * the persistent "patrimonio" of the lab: assets here feed generation first
 * (asset_resolver → user_library). Audio shows a player, visuals a thumbnail.
 */
interface Props {
  assets: LibraryAsset[];
  onToggleFavorite: (id: string, next: boolean) => void;
}

const VISUAL = new Set(["sprite", "tileset", "model_3d", "material", "image", "font"]);

export function LibraryPanel({ assets, onToggleFavorite }: Props) {
  return (
    <section aria-label={t("studio.library")} className="flex flex-col gap-3">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-text-muted">
        {t("studio.library")}
      </h2>

      {assets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-surface-2 px-4 py-10 text-center text-sm text-text-muted">
          {t("studio.library.empty")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {assets.map((a) => (
            <div key={a.id} className="group relative overflow-hidden rounded-lg border border-surface-2 bg-surface">
              <div className="relative aspect-square w-full bg-ink">
                {VISUAL.has(a.asset_type) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={a.url} alt={a.asset_type} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-2">
                    <audio controls preload="none" src={a.url} className="w-full" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onToggleFavorite(a.id, !a.favorite)}
                  aria-label={a.favorite ? "Unfavorite" : "Favorite"}
                  className="absolute right-1.5 top-1.5 rounded-full bg-ink/70 p-1.5 transition-colors hover:bg-ink"
                >
                  <Star size={13} className={cn(a.favorite ? "fill-spark text-spark" : "text-text-muted")} />
                </button>
              </div>
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="font-mono text-[10px] uppercase text-text-muted">{a.asset_type}</span>
                {a.style_pack_id && (
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] text-text-muted">
                    {a.style_pack_id}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
