# BRAND.md — Brand system di GameSmith (work in progress)

> **Stato**: bozza attiva. **Nome di lavoro = GameSmith** (vedi §3 — trademark
> libero, dominio da finalizzare al lancio). `Game Studio AI` resta solo il nome
> della cartella/repo. Questo file è la fonte (palette/font/voce/token) che W4
> carica a ogni sessione UI ([1-W4]/[2-W4]) — il rimedio "design system in
> markdown" contro l'AI slop. Vedi anche `docs/UI_DESIGN_BRIEF.md` (da scrivere)
> per stack e regole di esecuzione.

---

## 1. Posizionamento (da `COMPETITIVE_LANDSCAPE_2026.md` §5 — NON reinventare)

**La frase guida**:
> *"Gli altri generano da un prompt isolato e ti lasciano un giochino bloccato
> sulla loro piattaforma. Noi partiamo dal TUO contesto (immagini, musica,
> storyboard), generiamo su più dipartimenti, VERIFICHIAMO che il gioco giri e
> sia bilanciato, e te lo consegniamo come progetto VERO — su 5 motori, browser
> e mobile, che possiedi e spedisci. È la differenza tra un generatore e uno
> studio."*

- **Categoria mentale**: uno **STUDIO**, non un "generatore". Possiedi e spedisci.
- **Moat n°1 = VERIFICA anti-slop** (D.3 no soft-lock + D.6 smoke test): siamo
  "l'anti-slop *dimostrato*", in linea col sentiment GDC 2026 (52% anti-slop).
  → **Implicazione di brand**: anche il NOSTRO design dev'essere anti-slop. Il
  prodotto pratica ciò che predica.
- **Contro chi**: Rosebud (giochino bloccato, no asset tuoi), Astrocade
  (prompt-only, locked-in, 2D casual).
- **Narrazione**: contesto multimodale (BYOA) → generazione multi-dipartimento →
  **verifica** → export posseduto.

## 2. Personalità (decisa dall'utente, 2026-06-03)

Nota dominante: **pro look + anima accessibile/giocosa**. La tensione è
intenzionale e È il brand:

- **Scuro** (estetica dark di base).
- **Super accessibile** (chiunque si sente capace, zero gergo tecnico).
- **Grintoso** + **divertente** (energia, non freddo).
- **MA con la professionalità di Higgsfield** (serio, potente, desiderabile).

In una riga: *"Sembra serio e potente come Higgsfield, ma chiunque si sente a
casa e si diverte."*

- **NON deve sembrare**: infantile né corporate-freddo. (slop estetico = vietato.)
- **Target #1**: creatore con gusto ma senza skill di programmazione (vuole fare
  un gioco VERO, non un giocattolo bloccato).

## 3. Nome — GameSmith (working name, 2026-06-04)

**Deciso come nome di lavoro**: **GameSmith**. Concetto "smith" = artigiano/fabbro
→ comunica il moat "studio non generatore" (forgi giochi veri, non li generi),
multi-genere, pro + accessibile insieme. NON è "quest" (RPG) né "pixel" (2D).

**Verifiche fatte (2026-06-04)**:
- **Trademark — TMview (mondiale)**: **GameSmith LIBERO** in Classe 9 (software) e
  41 (gaming) — nessun marchio live bloccante visto in EU/IT. ✓ (Il trademark è
  il vincolo che non si aggira; averlo libero è l'asset chiave.)
- **Domini**: `.com / .ai / .studio / .dev / .io` tutti **PRESI**. Da finalizzare
  al lancio scegliendo tra le estensioni libere (es. `.gg`, `.games`, o pattern
  `usegamesmith.com` / `gamesmithhq.com`). NON bloccante ora.

**Stato**: working name — sufficiente per costruire. Decisione definitiva +
registrazione: al lancio, col prodotto vivo. Storico ricerca nomi scartati in §7.

---

## 4. Palette — "Forgia su fondo scuro"

Struttura ereditata da Higgsfield (scuro dominante + 1 accento netto + nero +
bianco), ma con accento **caldo-forgia** nostro (Higgsfield usa lime `#d1fe17`;
noi NON copiamo, usiamo l'arancio incandescente del metallo nella fucina → on-brand
col nome, distinto dal riferimento).

| Token | Hex | Ruolo |
|---|---|---|
| `ink` | `#0E0F12` | fondo principale (nero-carbone, la fucina) |
| `surface` | `#1A1C20` | card / pannelli |
| `surface-2` | `#26282E` | pannelli elevati / bordi |
| `forge` (accent) | `#F5582B` | **arancio incandescente** (= colore del logo) — CTA, highlight, "✓ gira" |
| `spark` (accent-2) | `#FFB020` | ambra calda — hover, dettagli, glow |
| `text` | `#F5F3F0` | testo primario (bianco-caldo, non freddo) |
| `text-muted` | `#9A968E` | testo secondario (grigio-caldo) |
| `success` | `#3DD68C` | verde verifica ("il gioco gira / bilanciato") |
| `danger` | `#FF4D4D` | errori / soft-lock |

**Regole anti-slop** (da rispettare in W4):
- UN solo accento forte (`forge`), usato con parsimonia sui momenti chiave (CTA,
  badge "verificato", numeri). MAI gradiente viola, MAI palette timida/equidistribuita.
- Fondo scuro dominante = serietà/pro (Higgsfield). Arancio caldo = grinta/calore
  (non corporate-freddo). Questa è la tensione del §2 resa in colore.
- ⚠️ Verificare i contrasti AA (testo su `forge` → usare `ink` come foreground).

> **Verifica live consigliata**: incollare gli hex in https://realtimecolors.com/
> per vederli su una UI reale prima di congelarli.

## 5. Tipografia (NO Inter / Roboto / Arial / Space Grotesk — bando anti-slop)

Battiamo il punto debole di Higgsfield (che usa proprio Inter + Space Grotesk, i
font-slop per eccellenza). Tutti Google Fonts / open, caricabili in Next.js.

| Ruolo | Font | Note |
|---|---|---|
| **Display / Titoli / CTA** | **Chakra Petch** | squadrato, sci-fi/gaming, "da videogioco" — dà grinta + identità |
| **Corpo / UI / form** | **Geist** | pulito, moderno, leggibile (NON è Inter — è il font di Vercel) |
| **Mono (opzionale)** | **Geist Mono** | per numeri/costi/codice, coerente con Geist |

- Scala tipografica: definire in W4 (display generoso per gli hero, corpo 16px+).
- Higgsfield voice-lesson: i titoli sono dichiarazioni corte e forti → la
  tipografia display deve reggere frasi brevi a grande corpo.

## 6. Voce / Tono (adattata da Higgsfield "Renegade Cinematographer" → "Renegade Studio")

Rubiamo il META di Higgsfield (corto, seconda persona, claim coi numeri,
anti-corporate) e lo pieghiamo al NOSTRO posizionamento (studio/ownership/verifica),
mantenendo l'**accessibilità** (Higgsfield è solo "pro"; noi pro + alla portata).

**DO**:
- Guida col RISULTATO, non col processo: "Un gioco vero, che gira. In 10 minuti."
  non "il nostro motore di reasoning multi-agente...".
- Seconda persona, presente: "Carichi la tua idea. Ti consegniamo il gioco — tuo,
  esportabile, che gira."
- Ancora ogni claim a un fatto concreto: "Verificato: 0 soft-lock, smoke test
  passato" batte "qualità superiore".
- Accessibile + grintoso: incoraggiante senza essere infantile. "Non sai
  programmare? Non serve."

**AVOID**:
- Linguaggio corporate/AI-slop: "leveraging cutting-edge models", "robust
  generative solutions". Uccide l'energia.
- Hedging molle: "può aiutarti a", "potrebbe". Noi facciamo, non "aiutiamo a fare".
- Guidare con lo stack tecnico prima del risultato.
- Tono infantile / "giocattoloso" (≠ accessibile).

## 7. Token Tailwind (per W4 — da copiare in tailwind.config / CSS vars)

```js
// tailwind.config.ts — theme.extend.colors (GameSmith)
colors: {
  ink:        '#0E0F12',
  surface:    '#1A1C20',
  'surface-2':'#26282E',
  forge:      '#F5582B', // accent primario (CTA, highlight) = colore del logo
  spark:      '#FFB020', // accent-2 (hover, glow)
  text:       '#F5F3F0',
  'text-muted':'#9A968E',
  success:    '#3DD68C',
  danger:     '#FF4D4D',
}
// fontFamily
fontFamily: {
  display: ['"Chakra Petch"', 'sans-serif'], // titoli / CTA
  sans:    ['Geist', 'system-ui', 'sans-serif'], // corpo / UI
  mono:    ['"Geist Mono"', 'monospace'], // numeri / codice
}
```

> W4: caricare Chakra Petch + Geist + Geist Mono via `next/font/google`
> (o self-host). NON aggiungere font a `package.json`/config durante il
> parallelismo senza coordinare (file cross-cutting) — questi token entrano
> quando W4 costruisce la UI ([1-W4]/[2-W4]).

## 8. Identità visiva — fusione "Pixel-forge su scuro" (Higgsfield × Tesana)

Riferimenti studiati (brand DNA estratto con Ad Legends, 2026-06-04):
- **Higgsfield** (higgsfield.ai): scuro cinematografico + accento netto (lime
  `#d1fe17`) + voce "renegade" (corta, 2ª persona, claim coi numeri). Punto
  debole: font Inter/Space Grotesk (slop).
- **Tesana** (tesana.ai): **competitor diretto** (vedi §11). Da loro rubiamo il
  **pixel-art come firma** (loro logo = piccone pixel) + lezione "nome corto/
  sonoro". Punto debole: font Inter (slop), e pixel solo nel logo poi sparisce.

**La fusione GameSmith** = scuro-pro (Higgsfield) + pixel-gaming (Tesana) sotto
il nostro concetto **forgia**, con un sistema più coerente di entrambi:

| Ingrediente | Fonte | Uso GameSmith |
|---|---|---|
| Fondo scuro + 1 accento netto | Higgsfield | carbone `#0E0F12` + `forge` incandescente |
| **Pixel-art come FIRMA** | Tesana | logo + accenti pixel (icone, bordi, micro-anim). NON tema pervasivo |
| Voce renegade + output-first | entrambi | §6 |
| Nome corto/sonoro | lezione Tesana | GameSmith (il pixel-logo lo rende ricordabile) |
| Tipografia distintiva | nessuno dei due | Chakra Petch (squadrato → **sposa il pixel**) |

> **Dose pixel (deciso)**: pixel-art SOLO nel logo + piccoli accenti UI (icone,
> bordi, micro-animazioni). Resto UI pulito/moderno (Chakra Petch + Geist). Il
> pixel è la nostra FIRMA riconoscibile (come il lime per Higgsfield), non un
> tema retro-8bit. Tiene l'equilibrio pro/cinematografico + gaming.

### Concept di logo (da generare su Recraft/Brandmark — alimentati da §4-§6)
Tutti pixel-art, alto contrasto, leggibili a 16px (favicon) e grandi:
1. **Incudine + scintilla** ⭐ — incudine pixel + 2-3 pixel-scintilla nell'accento
   incandescente. Forgia + gaming, elegante.
2. **G forgiata** — "G" in pixel-bitmap, angolo che "cola" in pixel-scintilla
   (metallo fuso). Monogramma brandabile, scala come favicon.
3. **Martello a impatto** — martello da fabbro pixel 45° + riga pixel-accento
   (impatto). Diretto, energico.
4. **GS legato** — monogramma G+S fusi in pixel. Astratto, max brandabilità.

Tool: **Brandmark.io** (penalizza somiglianza = anti-slop), **Recraft** (SVG
vettoriali veri), **Felo/ImagineArt** (brand kit da descrizione, free tier).

### Logo SCELTO (2026-06-04)
**Concept 1 — incudine pixel + getto di scintille** (generato in Recraft).
File: `docs/brand/logo/gamesmith-anvil-ORIGINAL.svg`. Working logo, usabile.
- Pixel-art (firma stile Tesana), incudine + corno alato staccato a sx + scintille.
- TODO rifinitura (non bloccante, a basso rischio): (1) allineare i colori ai
  token brand — attuale sfondo `#111116`→`ink #0E0F12`, incudine `#D6D5D5`→
  `text #F5F3F0`, scintille `#F5582B`→`forge` (rosso o arancio da decidere §4);
  (2) opz. pareggiare il lato destro del corpo (dettaglio invisibile a piccole
  dimensioni). Da fare con designer o editor visuale al lancio — NON urgente.

---

## 9. Storico ricerca nome (scartati — per non ripetere)

- **GameQuest / gamequest.ai**: trademark CONTESO (Cina cl.9 attivo, Corea, Cile;
  USA terminati); `.ai` libero, `.com` preso. "quest"→RPG, non comunica il moat.
  Scartato a favore di GameSmith.
- **Playsmith / Worldsmith**: domini quasi tutti presi.
- **Coniati (Voxa/Ludari/Forja/ecc.)**: domini risultati presi.
- **Lezione**: i nomi "parola comune + gaming" e i .com a parola singola sono
  saturi. GameSmith vince perché ha il **trademark libero** (asset raro).

## 10. Pipeline naming (in pausa — pronta se si rivaluta il nome al lancio)

1. **Genera**: Namelix (namelix.com) — stile *Brandable*, keyword tipo
   `studio forge craft` / `world build realm` (NO "pixel"/"quest"). Slider
   randomness medio-alto, lunghezza corto.
2. **Trademark mondiale**: TMview (tmdn.org/tmview) — check USA+UE+IT+WIPO in un
   colpo. Guardare "Registered/Filed" in **Classe 9** (software) + **41** (gaming).
3. **Domini bulk**: Instant Domain Search — guardare il contatore "Available",
   non solo i primi TLD. `.gg`/`.games` spesso liberi.
4. **Conferma finale**: EUIPO eSearch plus per il marchio UE del vincitore.

## 11. Competitor diretto — Tesana (tesana.ai)

Scoperto 2026-06-04 (NON in `COMPETITIVE_LANDSCAPE_2026.md` — da aggiungere lì).

- **Cosa fa**: "#1 AI Game Maker", giochi giocabili da prompt, no-code, modello
  proprietario **Muranyi-3**, gira in cloud, code editor integrato, export web/
  mobile/desktop (Steam/itch.io). Usa Claude sotto. **10k utenti paganti nelle
  prime settimane.** Visione "100M nuovi creatori".
- **Pitch quasi identico al nostro** (chiunque, no-code, democratizzazione).
- **Il loro tallone d'Achille = il nostro moat**: generi DENTRO il loro motore
  proprietario → quello che "esporti" è un build Muranyi-3, **NON un progetto su
  engine vero**. Non apri in Godot/Unity, non porti via, dipendi da loro per
  sempre. **Tetto di vetro**: limitato a ciò che il loro modello sa fare. (Hanno
  un code-editor, ma è codice del LORO motore, non engine standard.)
- **Il nostro attacco** (frase brand): *"Loro ti danno un gioco nel loro motore.
  Noi ti diamo un gioco TUO, in un motore vero — Godot, Phaser, Three.js — che
  apri, modifichi e porti dove vuoi. Generatore chiuso vs studio aperto."*
- **Brand DNA Tesana**: palette verde `#22c55e` + arancio `#ff733a` + ink scuro;
  font **Inter** (slop). ⚠️ Il loro arancio è vicino al nostro `forge #FF6A1A`
  → valutare se virare il nostro accento verso rosso-forgia per distinguerci.
