"use client";

import { useState } from "react";
import { Zap, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

const GENRE_PRESETS = [
  "Platformer 2D",
  "Roguelike",
  "Browser Arcade",
  "3D Showcase",
  "Mobile Puzzle",
];

interface Props {
  onNext: (prompt: string, imageUrls: string[]) => void;
}

export function StepWelcome({ onNext }: Props) {
  const [prompt, setPrompt] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  function handleChip(preset: string) {
    setSelected(preset);
    setPrompt((p) =>
      p ? p : `A ${preset.toLowerCase()} game with unique mechanics`,
    );
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.slice(0, 3).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImageUrls((prev) =>
          prev.length < 3 ? [...prev, ev.target?.result as string] : prev,
        );
      };
      reader.readAsDataURL(file);
    });
  }

  return (
    <div className="flex flex-col gap-6" data-testid="step-welcome">
      <div>
        <h2 className="font-display text-2xl font-bold text-text">
          Descrivi il tuo gioco
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Una frase basta. Aggiungi immagini moodboard per uno stile più preciso.
        </p>
      </div>

      {/* Genre chips */}
      <div className="flex flex-wrap gap-2">
        {GENRE_PRESETS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => handleChip(g)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              selected === g
                ? "border-forge bg-forge/10 text-forge"
                : "border-surface-2 text-text-muted hover:border-text-muted hover:text-text",
            )}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Prompt textarea */}
      <textarea
        data-testid="prompt-input"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Un platformer hardcore dove il mondo si capovolge ogni 10 secondi..."
        rows={4}
        className="w-full resize-none rounded-lg border border-surface-2 bg-surface p-3 text-sm text-text placeholder:text-text-muted focus:border-forge focus:outline-none"
      />

      {/* BYOA upload */}
      <div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted hover:text-text">
          <Upload size={14} />
          Aggiungi immagini moodboard (opzionale, max 3)
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            data-testid="byoa-upload"
            onChange={handleFile}
          />
        </label>
        {imageUrls.length > 0 && (
          <div className="mt-2 flex gap-2">
            {imageUrls.map((url, i) => (
              <div key={i} className="relative h-16 w-16">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`moodboard ${i + 1}`}
                  className="h-full w-full rounded object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setImageUrls((prev) => prev.filter((_, j) => j !== i))
                  }
                  className="absolute -right-1 -top-1 rounded-full bg-ink/80 p-0.5"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        data-testid="next-step-1"
        disabled={prompt.trim().length < 3}
        onClick={() => onNext(prompt.trim(), imageUrls)}
        className="flex items-center gap-2 self-start rounded-lg bg-forge px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-40 hover:bg-spark transition-colors"
      >
        <Zap size={14} />
        Forgia il gioco
      </button>
    </div>
  );
}
