"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Zap } from "lucide-react";

import { AnvilMark } from "@/components/brand/anvil-mark";
import { t } from "@/lib/i18n/dictionaries";

/**
 * The entry invitation — Higgsfield-style "breath": deep ink, a soft forge glow,
 * one evocative line, one elegant input. Typing an idea routes to /create with
 * the prompt; the generator there proposes engine/genre/style (no rigid wizard).
 * Sits above the gallery on the home page.
 */
export function Invite() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [prompt, setPrompt] = useState("");

  function forge() {
    const idea = prompt.trim();
    if (idea.length < 3) return;
    router.push(`/create?prompt=${encodeURIComponent(idea)}`);
  }

  return (
    <section className="relative overflow-hidden px-6 pt-16 pb-12 md:pt-24 md:pb-16">
      {/* Off-center forge glow — the cinematic light source, not decoration */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[460px] w-[820px] max-w-[120vw] -translate-x-1/2 blur-[130px]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(245,88,43,0.20), rgba(245,88,43,0.05) 55%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <AnvilMark size={44} label={null} className="mb-7 text-text drop-shadow-[0_0_24px_rgba(245,88,43,0.25)]" />

        <motion.h1
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-balance font-display text-[clamp(2rem,5vw,3.25rem)] font-bold leading-[1.02] tracking-[-0.04em] text-text"
        >
          {t("invite.title")}
        </motion.h1>

        {/* Input bar — single elegant affordance */}
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 w-full"
        >
          <div className="flex items-end gap-2 rounded-2xl border border-surface-2 bg-surface/80 p-2 shadow-2xl shadow-ink/60 backdrop-blur transition-colors focus-within:border-forge">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  forge();
                }
              }}
              rows={2}
              placeholder={t("invite.placeholder")}
              aria-label={t("invite.title")}
              className="max-h-40 min-h-[3rem] flex-1 resize-none bg-transparent px-3 py-2 font-sans text-[15px] text-text placeholder:text-text-muted focus:outline-none"
            />
            <button
              type="button"
              onClick={forge}
              disabled={prompt.trim().length < 3}
              className="flex shrink-0 items-center gap-2 self-stretch rounded-xl bg-forge px-5 font-display text-sm font-semibold text-ink transition-all hover:bg-spark disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Zap size={15} />
              {t("invite.cta")}
            </button>
          </div>
          <p className="mt-3 text-sm text-text-muted">{t("invite.hint")}</p>
        </motion.div>
      </div>
    </section>
  );
}
