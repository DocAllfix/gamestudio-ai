/**
 * Lightweight i18n for GameSmith. English is the primary language.
 *
 * Zero-dependency: a typed dictionary keyed by locale. The `t()` helper reads
 * the active locale (default "en"). To add a language later, add a locale key
 * to `dictionaries` with the same shape — TypeScript enforces completeness.
 *
 * This is intentionally minimal (no next-intl/i18next) so it ships now without
 * a routing/middleware change; a fuller i18n routing layer can replace it later.
 */

export const LOCALES = ["en", "it"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** The string keys the UI uses. One flat namespace keeps lookups simple. */
export interface Dictionary {
    "nav.forge": string;
    "nav.signIn": string;
    "nav.filter.all": string;
    "home.hero.title": string;
    "home.hero.subtitle": string;
    "home.cta.start": string;
    "home.empty.title": string;
    "home.empty.body": string;
    "home.empty.cta": string;
    "home.grid.heading": string;
    "card.play": string;
    "card.fork": string;
    "invite.title": string;
    "invite.placeholder": string;
    "invite.cta": string;
    "invite.hint": string;
    "create.heading": string;
    "create.subheading": string;
    "create.engine.label": string;
    "create.engine.auto": string;
    "create.genre.label": string;
    "create.style.label": string;
    "create.advanced": string;
    "create.difficulty.label": string;
    "create.moodboard.label": string;
    "create.submit": string;
    "create.back": string;
}

const en: Dictionary = {
    "nav.forge": "Forge yours",
    "nav.signIn": "Sign in",
    "nav.filter.all": "All",
    "home.hero.title": "Real games, forged by you.",
    "home.hero.subtitle":
        "Describe an idea. GameSmith builds it on a real engine, checks it actually runs, and hands it over: yours, playable, exportable.",
    "home.cta.start": "Forge your game",
    "home.empty.title": "No games forged yet.",
    "home.empty.body": "Be the first. Turn an idea into a real, playable game in minutes.",
    "home.empty.cta": "Forge the first one",
    "home.grid.heading": "Forged by the community",
    "card.play": "Play",
    "card.fork": "Fork",
    "invite.title": "What game have you always wanted to make?",
    "invite.placeholder": "A hardcore platformer where the world flips every 10 seconds…",
    "invite.cta": "Forge it",
    "invite.hint": "One sentence. We pick the engine, build it, and check it actually runs.",
    "create.heading": "Forge your game",
    "create.subheading": "We proposed the setup from your idea. Change anything, then forge.",
    "create.engine.label": "Engine",
    "create.engine.auto": "Auto (recommended)",
    "create.genre.label": "Genre",
    "create.style.label": "Style",
    "create.advanced": "Advanced controls",
    "create.difficulty.label": "Difficulty",
    "create.moodboard.label": "Moodboard images (optional, max 3)",
    "create.submit": "Forge the game",
    "create.back": "Back to home",
};

// Italian kept for parity / future language switch (not primary).
const it: Dictionary = {
    "nav.forge": "Forgia il tuo",
    "nav.signIn": "Accedi",
    "nav.filter.all": "Tutti",
    "home.hero.title": "Giochi veri, forgiati da te.",
    "home.hero.subtitle":
        "Descrivi un'idea. GameSmith la costruisce su un motore vero, verifica che giri davvero, e te la consegna: tua, giocabile, esportabile.",
    "home.cta.start": "Forgia il tuo gioco",
    "home.empty.title": "Ancora nessun gioco forgiato.",
    "home.empty.body": "Sii il primo. Trasforma un'idea in un gioco vero e giocabile in minuti.",
    "home.empty.cta": "Forgia il primo",
    "home.grid.heading": "Forgiati dalla community",
    "card.play": "Gioca",
    "card.fork": "Fork",
    "invite.title": "Che gioco hai sempre voluto creare?",
    "invite.placeholder": "Un platformer hardcore dove il mondo si capovolge ogni 10 secondi…",
    "invite.cta": "Forgialo",
    "invite.hint": "Una frase. Scegliamo noi il motore, lo costruiamo e verifichiamo che giri davvero.",
    "create.heading": "Forgia il tuo gioco",
    "create.subheading": "Abbiamo proposto la configurazione dalla tua idea. Cambia ciò che vuoi, poi forgia.",
    "create.engine.label": "Motore",
    "create.engine.auto": "Auto (consigliato)",
    "create.genre.label": "Genere",
    "create.style.label": "Stile",
    "create.advanced": "Controlli avanzati",
    "create.difficulty.label": "Difficoltà",
    "create.moodboard.label": "Immagini moodboard (opzionale, max 3)",
    "create.submit": "Forgia il gioco",
    "create.back": "Torna alla home",
};

export const dictionaries: Record<Locale, Dictionary> = { en, it };

/** Translate a key for the given locale (default: English). */
export function t(key: keyof Dictionary, locale: Locale = DEFAULT_LOCALE): string {
    return dictionaries[locale][key] ?? dictionaries[DEFAULT_LOCALE][key];
}
