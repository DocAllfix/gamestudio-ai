"use client";

import { useState } from "react";
import { Sparkles, Upload, X } from "lucide-react";
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
  // In production BYOA uploads go to storage and return URLs.
  // With mocks we store data-URLs in state so the UI works end-to-end.
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
        <h2 className="text-2xl font-bold">Describe your game</h2>
        <p className="mt-1 text-sm text-white/50">
          One sentence is enough. Add moodboard images for a stronger style match.
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
                ? "border-[#7C3AED] bg-[#7C3AED]/20 text-[#A78BFA]"
                : "border-white/20 text-white/50 hover:border-white/40",
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
        placeholder="A hardcore platformer where the world flips upside-down every 10 seconds..."
        rows={4}
        className="w-full resize-none rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/30 focus:border-[#7C3AED] focus:outline-none"
      />

      {/* BYOA upload */}
      <div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-white/50 hover:text-white/70">
          <Upload size={14} />
          Add moodboard images (optional, up to 3)
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
                  className="absolute -right-1 -top-1 rounded-full bg-black/80 p-0.5"
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
        className="flex items-center gap-2 self-start rounded-lg bg-[#7C3AED] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-[#6D28D9]"
      >
        <Sparkles size={14} />
        Continue
      </button>
    </div>
  );
}
