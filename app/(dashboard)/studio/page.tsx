"use client";

import { useEffect, useState, useCallback } from "react";
import { Sparkles, Grid3x3, Music, Box, Layers } from "lucide-react";

import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/dictionaries";
import { LibraryPanel } from "@/components/studio/library-panel";
import { listLibrary, toggleFavorite, type LibraryAsset } from "./actions";

type ToolKey = "sprite" | "tileset" | "audio" | "material" | "model3d";

const TOOLS: { key: ToolKey; labelKey: Parameters<typeof t>[0]; icon: typeof Sparkles }[] = [
  { key: "sprite", labelKey: "studio.tool.sprite", icon: Sparkles },
  { key: "tileset", labelKey: "studio.tool.tileset", icon: Grid3x3 },
  { key: "audio", labelKey: "studio.tool.audio", icon: Music },
  { key: "material", labelKey: "studio.tool.material", icon: Layers },
  { key: "model3d", labelKey: "studio.tool.model3d", icon: Box },
];

export default function StudioPage() {
  const [active, setActive] = useState<ToolKey>("sprite");
  const [assets, setAssets] = useState<LibraryAsset[]>([]);

  const refresh = useCallback(async () => {
    setAssets(await listLibrary());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onToggleFavorite(id: string, next: boolean) {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, favorite: next } : a)));
    await toggleFavorite(id, next);
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-text">{t("studio.title")}</h1>
        <p className="mt-1 max-w-[60ch] text-sm text-text-muted">{t("studio.subtitle")}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
        {/* Tool nav — domain panels, Higgsfield-style (no Sorceress clutter) */}
        <nav aria-label="Studio tools" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const isActive = active === tool.key;
            return (
              <button
                key={tool.key}
                type="button"
                onClick={() => setActive(tool.key)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive ? "bg-forge/12 text-forge" : "text-text-muted hover:bg-surface-2 hover:text-text",
                )}
              >
                <Icon size={16} />
                {t(tool.labelKey)}
              </button>
            );
          })}
        </nav>

        {/* Workspace + library */}
        <div className="flex flex-col gap-8">
          <ToolWorkspace tool={active} onSaved={refresh} />
          <LibraryPanel assets={assets} onToggleFavorite={onToggleFavorite} />
        </div>
      </div>
    </div>
  );
}

/**
 * Per-tool workspace. The generative providers (sprite/audio/3D/material) wire to
 * the existing hexagonal ports + Studio utilities; this panel is the shell with
 * the Higgsfield-style input → generate → save flow. Generation is wired
 * incrementally per tool (the ports/utilities already exist behind it).
 */
function ToolWorkspace({ tool, onSaved }: { tool: ToolKey; onSaved: () => void }) {
  void onSaved;
  return (
    <section className="rounded-2xl border border-surface-2 bg-surface/60 p-6">
      <div className="flex items-center gap-2 text-text-muted">
        <Sparkles size={16} className="text-forge" />
        <span className="font-display text-sm font-semibold uppercase tracking-wide">{tool}</span>
      </div>
      <textarea
        rows={3}
        placeholder="Describe the asset you want…"
        className="mt-4 w-full resize-none rounded-xl border border-surface-2 bg-ink p-4 font-sans text-[15px] text-text placeholder:text-text-muted focus:border-forge focus:outline-none"
      />
      <button
        type="button"
        disabled
        title="Wired per tool in the next slice"
        className="mt-4 flex items-center gap-2 rounded-xl bg-forge px-5 py-2.5 font-display text-sm font-semibold text-ink disabled:opacity-40"
      >
        <Sparkles size={15} />
        {t("studio.generate")}
      </button>
    </section>
  );
}
