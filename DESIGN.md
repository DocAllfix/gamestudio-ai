# Design

Visual system for GameSmith. Source of truth for colors, typography, motion,
layout. Tokens live in `app/globals.css` (@theme). Register: brand (landing) +
product (app UI).

## Color

Strategy: **Committed dark** — ink dominates the surface, ONE saturated accent
(forge) used sparingly for action/emphasis. Not "dark because tools look cool":
the scene is a forge — dark workshop, glowing metal. Verified contrast (WCAG AA):

| Token | Hex | Role | Contrast |
|---|---|---|---|
| `ink` | #0E0F12 | body background (the cold forge) | — |
| `surface` | #1A1C20 | cards / panels | — |
| `surface-2` | #26282E | elevated / borders / dividers | — |
| `forge` | #F5582B | accent: CTA, emphasis, the mark's sparks (SPARINGLY) | 5.76:1 on ink ✓ |
| `spark` | #FFB020 | secondary warm accent: hover/glow | — |
| `text` | #F5F3F0 | primary text (warm white) | 17.3:1 on ink ✓ |
| `text-muted` | #9A968E | secondary text (warm gray) | 6.5:1 on ink ✓ |
| `success` | #3DD68C | verified / "it runs" | — |
| `danger` | #FF4D4D | errors / soft-lock | — |

Rules: forge ≤10% of any surface. NO purple (#7C3AED banned). NO gradient text.
Button text = ink on forge (5.76:1). Glow allowed (forge radial blur) as the
"forge heat" material, off-center, never as decoration on cards.

## Typography

Three families, contrast-paired (display geometric + body humanist + mono):
- **Display** (`--font-display`): **Chakra Petch** — squared, sci-fi/gaming;
  headlines, CTA labels, the logo. Marries the pixel-art mark.
- **Body** (`--font-sans`): **Geist** — clean, modern, readable. NOT Inter.
- **Mono** (`--font-mono`): **Geist Mono** — numbers, the difference-row kickers
  (TUO / GIRA / TUA IDEA), code.

Rules: headline clamp max ≤5.5rem, letter-spacing -0.04em on display,
`text-wrap: balance` on h1–h3, body line-length ≤65ch. NO all-caps body. NO
per-section uppercase eyebrows (use the mono kicker only on the difference rows,
deliberately).

## Motion

Library: **motion** (ex Framer Motion). Easing: ease-out-expo `[0.16,1,0.3,1]`,
no bounce/elastic. Hero = staggered rise (0 / 0.12 / 0.24s). Difference rows =
slide-in on scroll, stagger 0.08s, `whileInView once`. The mark = scale+rotate
settle. `prefers-reduced-motion` → opacity-only crossfade on every animation
(via `useReducedMotion`). Reveals enhance already-visible content (no
visibility-gating).

## The Mark (signature)

Pixel-art anvil + forge sparks (`components/brand/anvil-mark.tsx`). Anvil body =
`currentColor` (adapts), sparks = forge. `shapeRendering: crispEdges` keeps the
pixels sharp. Used: header (28px), hero (260px, rotated -6deg, faint glow),
closing CTA (48px). This is the Tesana-pixel × Higgsfield-cinematic fusion.

## Layout

Asymmetric, NOT centered-generic. Hero = 1.5fr/1fr grid (copy left, mark bleeding
right). Difference = divided rows (border-y + divide-y), NOT identical cards.
max-w-6xl container. CRT scanline overlay at 4% opacity (retro-futurism, very
subtle). Off-center forge glow. Generous negative space. min-h-dvh (not 100vh).

## Effects (retro-futurism, restrained)

CRT scanlines (repeating-linear-gradient, 4% opacity, fixed overlay), forge
radial glow (blur-120px, off-center). NO glassmorphism. NO side-stripe borders.
NO decorative blur on cards.
