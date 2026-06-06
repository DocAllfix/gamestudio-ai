# WOW Action Plan — Sonnet + i nostri tool per un gioco vero, bello, fedele al prompt

**Data:** 2026-06-06. **Principio:** Sonnet è il *cervello/regista* (capisce, progetta, scrive,
gioca, giudica); i tool/risorse sono le *mani affidabili* (asset, livelli garantiti, validazione).
Il WOW nasce dalla **combinazione**, non da un pezzo. Tutto guidato dai dati (run_traces).

## I 3 livelli del WOW (obiettivo)
1. **"Funziona"** — premi e esce un gioco GIOCABILE (non grigio/rotto). *Quasi fatto.*
2. **"È MIO"** — il gioco riflette il prompt specifico ("monete che drenano HP" si vede) + asset coerenti.
3. **"Lo modifico mentre gioco"** — Fetta 4 play+edit (il differenziante "Higgsfield dei giochi").

## Stato accertato oggi (col dato)
- ✅ Game Designer → design ricco (mechanics/loop/win/lose). Modello: gpt-4.1-mini (Azure).
- ✅ Design ricco ARRIVA al code_gen (`codeContext` nel DAG).
- ✅ code_gen Godot = Claude Sonnet (via OpenRouter) → platformer vero, valido al 1° colpo (screenshot).
- ✅ Playtester universale (getState + guard + LLM judge) cablato nel gate.
- ✅ Osservabilità totale (run_traces + codice + log).
- ⚠️ Asset (sprite/audio): canale verso code_gen pronto (describeLevel) ma i PROVIDER generativi
  non sono cablati → oggi degradano a placeholder.
- ⚠️ Reference games (80, visual_analysis) NON usati dal Game Designer al primo passo.
- ⚠️ Anello di RIGENERAZIONE: il Playtester dice "non giocabile" ma il reason non torna ancora a
  rigenerare.
- ❌ Fetta 4 (play+edit) non iniziata.

---

## PIANO D'AZIONE (ordine = valore/rischio)

### FASE A — "Funziona sempre" (chiudere il loop di garanzia)
Obiettivo: ogni generazione produce un gioco giocabile, o si rigenera finché lo è.
- **A1. Anello di rigenerazione.** Playtester `playable=false` → D.6 emette `refinement_request` col
  `reason` → Hermes lo rimanda a code_gen che RIGENERA col feedback (max N). Stesso pattern del
  self-heal, ma sulla giocabilità. *(Il reason è già nel gate; manca il giro a D.2/code_gen.)*
- **A2. Consolidare Claude su tutti i code_gen 2D** (phaser/threejs come Godot) + verificare il
  giro completo E2E (Hermes full) con screenshot+playtest verde.
- **A3. Deploy:** OPENROUTER_API_KEY sul worker (per Claude) + redeploy → primo gioco vero dalla webapp.

### FASE B — "È MIO" (il prompt reso incredibile)
Obiettivo: il gioco riflette visibilmente il prompt specifico + asset coerenti.
- **B1. Reference games nel Game Designer.** Al primo passo, recuperare reference_games per genere
  e ancorare il design alla loro visual_analysis (mood/palette/feel) → design fondato, non generico.
  *(Modulo reference-games.ts già scritto; agganciarlo in intent.ts.)*
- **B2. Asset provider reali** (Replicate FLUX sprite, Suno/ElevenLabs audio) cablati ai tool, così
  il gioco ha sprite/musica VERI (non quadrati). Gli URL già fluiscono a code_gen via describeLevel.
- **B3. Le meccaniche specifiche del prompt nel code_gen.** Il design (`mechanics`) arriva già; far sì
  che il code_gen le IMPLEMENTI verificabilmente (la Playtester controlla che la meccanica esista
  nello stato — es. "hp cala raccogliendo monete" → state.player_hp scende).

### FASE C — Sonnet come ORCHESTRATORE più forte (la potenza piena)
Obiettivo: Sonnet non solo scrive, ma dirige la pipeline e cura la qualità.
- **C1. Design → parametri tool.** Il design ricco guida ANCHE i tool spaziali (theme/density/size dal
  Game Designer, non solo genere+difficoltà) → livelli/asset coerenti col prompt.
- **C2. Self-improvement loop.** I run_traces (prompt → codice validato che gira) alimentano il
  fine-tuning (Azure) → modello GameSmith-Godot che migliora col volume = moat-dati.
- **C3. Valutazione qualità (oltre "gira").** Il Playtester LLM giudica anche "è DIVERTENTE/fedele al
  prompt?" (completabilità, ritmo) → rigenera per qualità, non solo per non-crash.

### FASE D — Il WOW differenziante
- **D1. Fetta 4: play+edit.** Modifica granulare a voce mentre giochi (RFC6902 patch → rebuild del
  nodo) + Smithy + animazione forgia. È "l'Higgsfield dei giochi".

---

## Cosa NON facciamo (deciso col dato)
- Template fissi per gioco (ucciderebbero "qualsiasi gioco da un prompt").
- Assembler per-motore (il nostro scaffold li ha superati).
- Costruire i 32 tool mancanti ora (asset extra/community = dopo).
- Adottare GDevelop ora (opzione strategica forte ma da validare headless — vedi memoria).

## Verifica trasversale (ogni fase)
Run reale tracciato → leggere run_traces (tool usati, codice, playtest) + SCREENSHOT (vedere, non
dedurre) + il gioco gira/è giocabile. Mai dichiarare "fatto" senza la prova visiva.
