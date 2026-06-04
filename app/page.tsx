"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

import { AnvilMark } from "@/components/brand/anvil-mark";

export default function LandingPage() {
  const reduce = useReducedMotion();
  const rise = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const }, // ease-out-expo
  });

  return (
    <main className="relative min-h-dvh overflow-hidden bg-ink text-text">
      {/* CRT scanline overlay — the retro-futurism signature, very subtle */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 3px)",
        }}
      />
      {/* Forge glow, off-center (asymmetry, not a centered hero) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 z-0 h-[520px] w-[520px] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(245,88,43,0.18), transparent 70%)" }}
      />

      {/* Top bar */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          <AnvilMark size={28} className="text-text" label={null} />
          Game<span className="text-forge">Smith</span>
        </span>
        <Link
          href="/sign-in"
          className="font-sans text-sm text-text-muted transition-colors hover:text-text"
        >
          Accedi
        </Link>
      </header>

      {/* Hero — asymmetric: copy left-weighted, mark bleeding right */}
      <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-6 pb-24 pt-12 md:grid-cols-[1.5fr_1fr] md:items-center md:pt-20">
        <div>
          <motion.h1
            {...rise(0)}
            className="font-display text-[clamp(2.75rem,7vw,5.5rem)] font-bold leading-[0.95] tracking-[-0.04em] text-balance"
          >
            Forgia un gioco{" "}
            <span className="text-forge">vero</span>.
            <br />
            Non un giochino.
          </motion.h1>

          <motion.p
            {...rise(0.12)}
            className="mt-6 max-w-[55ch] font-sans text-lg leading-relaxed text-text-muted"
          >
            Gli altri ti danno un gioco bloccato nel loro motore. GameSmith parte
            dalla tua idea, costruisce su 5 motori reali, verifica che giri
            davvero, e te lo consegna: tuo, esportabile, giocabile.
          </motion.p>

          <motion.div {...rise(0.24)} className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/sign-up"
              className="group inline-flex items-center gap-2 rounded-lg bg-forge px-7 py-3.5 font-display font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forge"
            >
              Forgia il tuo gioco
            </Link>
            <Link
              href="#come"
              className="font-sans text-sm text-text-muted underline-offset-4 transition-colors hover:text-text hover:underline"
            >
              Come funziona
            </Link>
          </motion.div>
        </div>

        {/* The mark as a large signature element, off-center */}
        <motion.div
          aria-hidden
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, rotate: -6 }}
          animate={{ opacity: 1, scale: 1, rotate: -6 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] as const }}
          className="hidden justify-self-center text-surface-2 md:block"
        >
          <AnvilMark size={260} className="text-surface-2 drop-shadow-[0_0_40px_rgba(245,88,43,0.15)]" label={null} />
        </motion.div>
      </section>

      {/* The difference — NOT three identical cards. A claim + three asymmetric proof rows. */}
      <section id="come" className="relative z-10 mx-auto max-w-6xl px-6 pb-28">
        <motion.h2
          {...rise(0)}
          className="max-w-[20ch] font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold leading-tight tracking-[-0.03em] text-balance"
        >
          La differenza tra un generatore e uno{" "}
          <span className="text-forge">studio</span>.
        </motion.h2>

        <div className="mt-12 flex flex-col divide-y divide-surface-2 border-y border-surface-2">
          {DIFFERENCES.map((d, i) => (
            <motion.div
              key={d.title}
              // Content is visible by default; the reveal only ENHANCES it.
              // (Never gate visibility on whileInView — it never fires in
              // headless renders / hidden tabs and the section ships blank.)
              initial={false}
              whileInView={reduce ? undefined : { x: [-16, 0], opacity: [0.6, 1] }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] as const }}
              className="grid gap-2 py-7 md:grid-cols-[auto_1fr] md:items-baseline md:gap-10"
            >
              <span className="font-mono text-sm text-forge">{d.kicker}</span>
              <div>
                <h3 className="font-display text-xl font-semibold">{d.title}</h3>
                <p className="mt-1.5 max-w-[60ch] font-sans text-text-muted">{d.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-32">
        <motion.div
          {...rise(0)}
          className="flex flex-col items-start gap-6 rounded-2xl border border-surface-2 bg-surface px-8 py-12 md:px-14"
        >
          <AnvilMark size={48} className="text-text" label={null} />
          <h2 className="max-w-[18ch] font-display text-[clamp(1.75rem,4vw,3rem)] font-bold leading-tight tracking-[-0.03em] text-balance">
            Hai l&apos;idea da anni. Ora ci vogliono 10 minuti.
          </h2>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-lg bg-forge px-7 py-3.5 font-display font-semibold text-ink transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forge"
          >
            Inizia gratis
          </Link>
        </motion.div>
      </section>
    </main>
  );
}

const DIFFERENCES = [
  {
    kicker: "TUO",
    title: "Lo possiedi davvero",
    body: "Un progetto su motore vero (Godot, Phaser, Three.js e altri due) che apri, modifichi e porti dove vuoi. Non un build bloccato in un motore chiuso.",
  },
  {
    kicker: "GIRA",
    title: "Verificato, non sperato",
    body: "Prima di consegnartelo controlliamo che sia attraversabile e senza blocchi: 0 soft-lock, smoke test superato. Nessun altro lo fa.",
  },
  {
    kicker: "TUA IDEA",
    title: "Parte dal tuo contesto",
    body: "Carichi immagini, musica, riferimenti. GameSmith genera codice, asset, livelli e audio attorno alla tua visione, non a un prompt isolato.",
  },
] as const;
