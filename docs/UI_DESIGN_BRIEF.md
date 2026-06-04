# UI_DESIGN_BRIEF.md — Brief operativo di design per W4 (GameSmith)

> **Compagno di `BRAND.md`.** `BRAND.md` = COSA (nome, palette, font, voce, logo).
> Questo file = COME (skill da usare, riferimenti da clonare, stack, regole
> anti-slop, pattern di layout). W4 carica ENTRAMBI a ogni sessione UI
> ([1-W4]/[2-W4]+) — è il "design system in markdown" che impedisce l'AI slop.
> Logo: `docs/brand/logo/gamesmith-anvil-ORIGINAL.svg`.

---

## 0. Regola d'oro

**Tutto ciò che generi (skill, librerie, componenti) va RI-BRANDIZZATO coi token
di `BRAND.md`.** Le skill e le librerie producono "slop di alta qualità" se usate
di default — bello ma identico a mille altri prodotti AI. Ciò che ci rende NOI è
il brand (palette `#F5582B` su scuro + Chakra Petch + voce + pixel-firma), non la
skill. Applica sempre i nostri token SOPRA qualsiasi output generato.

## 1. Skill anti-slop da usare (installare in W4, NON nella sessione main)

Le skill di design servono SOLO nell'ambiente che costruisce la UI (= W4). Si
installano per-progetto e si caricano insieme a BRAND.md + questo file.

| Skill | Ruolo | Quando |
|---|---|---|
| **Frontend Design** (Anthropic, ufficiale) | Motore di generazione. Framework 4-domande (scopo/tono/vincoli/differenziazione) prima del CSS. Bandisce Inter/Roboto/Arial/Space Grotesk. | Sempre, da [1-W4] in poi |
| **Impeccable** (pbakaus, github.com/pbakaus/impeccable) | Gate/rifinitura. 23 comandi (`audit`/`critique`/`polish`/`bolder`) + detector di 24 issue slop (gradienti viola, glow scuri, easing a rimbalzo, touch target piccoli). | Dopo aver generato una schermata, per rifinire |

**Come usarle insieme:** Frontend Design *genera* deliberatamente → Impeccable
*audita e rifinisce*. Una crea, l'altra verifica prima di consegnare.
**NON installare 6 skill** (rumore/contraddizioni — vale Simplicity First). Queste
due bastano. Cataloghi se servono altre: claude-plugins.dev, claudemarketplaces.com.

Installazione tipica (verificare nomi esatti al momento via `/plugin` Discover —
anti-hallucination, non fidarsi della memoria):
`/plugin marketplace add <source>` → `/plugin install <name>@<marketplace> --scope project` → `/reload-plugins`.

## 2. Riferimenti — doppio: Higgsfield × Tesana (cosa rubare, cosa NO)

Brand DNA estratti con Ad Legends (adlegends.ai), 2026-06-04. Dettagli in BRAND.md
§8 e §11.

### Higgsfield (higgsfield.ai) — il "pro/cinematografico"
- ✅ **RUBA**: struttura palette (scuro dominante + 1 accento netto); voce
  "renegade" (corta, 2ª persona, claim coi numeri); tono serio/desiderabile.
- ❌ **NON rubare**: font **Inter + Space Grotesk** (sono font-slop — noi usiamo
  Chakra Petch + Geist); il loro lime `#d1fe17` (noi arancio `#F5582B`).

### Tesana (tesana.ai) — il competitor diretto + il "gaming/pixel"
- ✅ **RUBA**: il **pixel-art come firma** (loro logo = piccone pixel → noi
  incudine pixel + accenti pixel nella UI); voce output-first ("Describe it.
  Play it.", nomina i generi esplicitamente — FPS/roguelike/racing).
- ❌ **NON rubare**: font **Inter** (slop); il loro verde `#22c55e` + arancio
  `#ff733a` (vicino al nostro — distinguersi); e soprattutto il loro MODELLO
  (motore proprietario chiuso).
- ⚔️ **ATTACCO nel copy** (il nostro moat vs Tesana): *"Loro ti danno un gioco nel
  loro motore. Noi ti diamo un gioco TUO, in un motore vero — Godot, Phaser,
  Three.js — che apri, modifichi e porti dove vuoi. Generatore chiuso vs studio
  aperto."*

### La fusione GameSmith
Scuro-pro (Higgsfield) + pixel-gaming (Tesana) sotto "forgia" (GameSmith). Il
pixel è la FIRMA (logo + accenti UI), NON un tema retro-8bit pervasivo. Chakra
Petch (squadrato) sposa naturalmente il pixel → coerenza che nessuno dei due ha.

## 3. Stack tecnico (verificato 2026, gratis, sopra Next.js 16 + Tailwind + shadcn)

| Strumento | Ruolo | Note |
|---|---|---|
| **Motion** (ex Framer Motion) | Animazioni React, transizioni pagina, micro-interazioni | engine 120fps GPU; lo standard |
| **GSAP** (ora 100% free) | Timeline cinematografiche, scroll, hero | per i "momenti" stile Higgsfield |
| **tailwindcss-motion** | Micro-animazioni zero-JS via classi | il 90% leggero |
| **shadcn/ui** | Base componenti (già nel piano) | source-of-truth |
| **Aceternity UI / Magic UI** | Polish animato (spotlight, marquee, 3D card) | RI-BRANDIZZARE coi token; usare con parsimonia (rischiano nuovo slop) |

Pattern 2026: shadcn base → Magic UI per polish → Aceternity quando una sezione
deve "stupire". Regola motion: pochi momenti orchestrati bene > mille micro-anim
sparse (più memorabile E più veloce).

## 4. Regole anti-slop (checklist — cosa MAI / cosa SEMPRE)

**MAI** (= AI slop riconoscibile, da evitare):
- Font Inter/Roboto/Arial/Space Grotesk
- Gradiente viola su bianco, hero centrato generico, 3 card uguali con bordi tondi
- Palette timida/equidistribuita; glow scuri; easing a rimbalzo
- Copy corporate ("leveraging cutting-edge", "robust solutions"), hedging
  ("può aiutarti")

**SEMPRE** (= il nostro anti-slop):
- Chakra Petch (display) + Geist (corpo); fondo scuro `#0E0F12`
- UN accento forte `#F5582B`, usato con parsimonia (CTA, badge "✓ verificato", numeri)
- Composizione con personalità: asimmetria/overlap dove serve, negative space
- Pixel-art come firma (icone, accenti, micro-dettagli)
- Voce: output-first, 2ª persona, claim coi numeri, accessibile-non-infantile
- Caricare BRAND.md + questo file come contesto a ogni sessione (anti-slop #1)

## 5. Pattern di layout (da decidere col prodotto vivo — appunti)

- **Home/entry**: l'utente aveva in mente un "menu in alto stile Higgsfield home"
  per scegliere (2D/3D? motore? modalità?). Funzione NON ancora decisa — decidere
  coi riferimenti reali al momento di [1-W4]/[2-W4]. Il piano attuale ha "layout
  shell con sidebar"; valutare menu-in-alto vs sidebar.
- **Creator Mode** ([2-W4]): wizard 5-step (WOW_CONTRACT §10). L'engine-picker
  (step 2) È il "menu scelta motore".
- Mobile-first dove possibile (feed = consumo mobile).
