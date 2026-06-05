"use client";

import { useState } from "react";
import { Zap, ChevronDown, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/dictionaries";
import type { CreatorConfig } from "./use-creator";

/**
 * Setup screen — progressive disclosure. The user's idea is the only required
 * input; engine/genre/style come pre-proposed (editable chips, Auto by default),
 * and the rest (difficulty, moodboard) lives behind a collapsible "Advanced".
 * No multi-step wizard.
 */
const ENGINES = ["godot", "phaser", "threejs", "babylon", "defold"] as const;
const DIFFICULTIES = ["chill", "balanced", "hard", "brutal"] as const;

interface Props {
  initialPrompt: string;
  loading: boolean;
  onForge: (config: CreatorConfig) => void;
}

export function StepSetup({ initialPrompt, loading, onForge }: Props) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [engine, setEngine] = useState<string | undefined>(undefined); // undefined = Auto
  const [difficulty, setDifficulty] = useState("balanced");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.slice(0, 3).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) =>
        setImageUrls((prev) => (prev.length < 3 ? [...prev, ev.target?.result as string] : prev));
      reader.readAsDataURL(file);
    });
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-7 py-10">
      <div>
        <h1 className="font-display text-2xl font-bold text-text">{t("create.heading")}</h1>
        <p className="mt-1 text-sm text-text-muted">{t("create.subheading")}</p>
      </div>

      {/* The idea */}
      <textarea
        data-testid="prompt-input"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        placeholder={t("invite.placeholder")}
        className="w-full resize-none rounded-xl border border-surface-2 bg-surface p-4 font-sans text-[15px] text-text placeholder:text-text-muted focus:border-forge focus:outline-none"
      />

      {/* Proposed engine — editable chips, Auto by default */}
      <div>
        <label className="mb-2 block font-display text-xs font-semibold uppercase tracking-wide text-text-muted">
          {t("create.engine.label")}
        </label>
        <div className="flex flex-wrap gap-2">
          <Chip active={engine === undefined} onClick={() => setEngine(undefined)}>
            {t("create.engine.auto")}
          </Chip>
          {ENGINES.map((e) => (
            <Chip key={e} active={engine === e} onClick={() => setEngine(e)}>
              {e}
            </Chip>
          ))}
        </div>
      </div>

      {/* Advanced — collapsible */}
      <div className="rounded-xl border border-surface-2">
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          aria-expanded={advancedOpen}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-text-muted transition-colors hover:text-text"
        >
          {t("create.advanced")}
          <ChevronDown size={16} className={cn("transition-transform", advancedOpen && "rotate-180")} />
        </button>
        {advancedOpen && (
          <div className="flex flex-col gap-5 border-t border-surface-2 p-4">
            <div>
              <label className="mb-2 block font-display text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t("create.difficulty.label")}
              </label>
              <div className="flex flex-wrap gap-2">
                {DIFFICULTIES.map((d) => (
                  <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>
                    {d}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted hover:text-text">
                <Upload size={14} />
                {t("create.moodboard.label")}
                <input type="file" accept="image/*" multiple className="sr-only" onChange={handleFile} />
              </label>
              {imageUrls.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {imageUrls.map((url, i) => (
                    <div key={i} className="relative h-16 w-16">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`moodboard ${i + 1}`} className="h-full w-full rounded object-cover" />
                      <button
                        type="button"
                        onClick={() => setImageUrls((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute -right-1 -top-1 rounded-full bg-ink/80 p-0.5 text-text"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        data-testid="forge-btn"
        disabled={prompt.trim().length < 3 || loading}
        onClick={() => onForge({ prompt: prompt.trim(), engine, difficulty, imageUrls })}
        className="flex items-center gap-2 self-start rounded-xl bg-forge px-6 py-3 font-display font-semibold text-ink transition-colors hover:bg-spark disabled:opacity-40"
      >
        <Zap size={16} />
        {loading ? "Forging…" : t("create.submit")}
      </button>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-1.5 font-display text-xs font-medium capitalize transition-colors",
        active ? "bg-forge text-ink" : "bg-surface text-text-muted hover:bg-surface-2 hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
