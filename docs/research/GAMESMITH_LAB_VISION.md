# GameSmith — Visione "Laboratorio del Gioco"

> Documento di **visione/comprensione**, non piano d'implementazione. Cattura la
> direzione concordata dopo la ricerca su r/aigamedev (pain point) e Sorceress
> (30 tool, UX, mapping). Il piano d'implementazione verrà scritto a parte, su richiesta.

## La frase guida
**"Il game studio da un miliardo, a un click."** Facile e potente per l'utente medio
(prompt → gioco vero), profondo e di valore inestimabile per l'esperto (asset curati,
modifica granulare, codice, test). Lo stesso prodotto, **due profondità**.

## Principio centrale (la correzione chiave dell'utente)
Library e Gioco sono **due entità di pari dignità**, entrambe valide da sole, che
**comunicano nei due sensi** e **migliorano nel tempo**. Non "la library serve il
gioco". È un **ciclo**: genero → estraggo → miglioro → rigenero meglio → la library
accumula coerenza e qualità.

```
   ┌─────────────┐   estrai asset dal gioco → migliora coi tool    ┌──────────────┐
   │   GIOCO      │ ───────────────────────────────────────────►   │ ASSET LIBRARY │
   │ (generato)   │                                                 │ (posseduta,   │
   │  verificato  │ ◄───────────────────────────────────────────   │  coerente)    │
   └─────────────┘   usa asset curati come input della generazione  └──────────────┘
        ▲  valido da solo (prompt → gioco)        valido da solo (patrimonio asset) ▲
```

## I 6 sottosistemi (un solo motore, più punti d'accesso)

1. **Generazione** — diretta (prompt) o con asset/library. Resta potente e per tutti.
   Esce un gioco **verificato** su uno dei 5 motori reali.

2. **Asset Library** (entità autonoma) — il patrimonio dell'utente, **organizzato per
   ruolo nel gioco** (tiles, sprite 2D, modelli 3D, animazioni, audio, materiali) e
   taggato con **style_pack** per la coerenza. Posseduta ed **esportabile**. Si riempie
   in due modi: curando asset nello Studio, o **estraendo** asset da un gioco generato.

3. **Studio** — le capability dei 30 tool Sorceress (mappate in `SORCERESS_30_TOOLS.md`)
   dietro le **porte esagonali già esistenti** (`ImageGenPort`/`Model3DPort`/`AudioGenPort`).
   Crea / migliora / rifinisce asset, e li **prova sui NOSTRI motori e sulle NOSTRE
   mappe** (map-gen 2D/3D) — non nel vuoto come Sorceress. Doppio binario per ogni
   capability: **CC0-first gratis** + generativo AI a paywall.

4. **Verifica / Playtester** — il banco di prova, **utile in modo diverso per contesto**:
   - gioco solo-prompt → "gira ed è giocabile?"
   - gioco + library/asset → "gli asset funzionano *nel* gioco?"
   - asset in preparazione → "testo l'animazione/tile *prima* di metterci mano io"
   Oggi: smoke test + D.3 (0 soft-lock) + D.6. Domani: **Playtester LLM** (AI che gioca
   via **stato strutturato, non pixel** — LAP 79% / TITAN dimostrano fattibile; VLM-su-pixel
   falliscono 0.48%). Vantaggio: generiamo noi il codice → esponiamo uno "stato di test".

5. **Modifica granulare** ("Higgsfield dei videogiochi") — il cuore profondo:
   - **mentre giochi**, dai prompt/richieste per aggiustare cose specifiche
   - **per area / livello** (divisione per zone di mappa o livelli)
   - **doppio canale**: input diretto utente **+** richiesta all'agente
   - **fino al codice**: opzione di editare il codice (come fanno molti tool)
   - granularità dal "cambia questo nemico in questa stanza" al "riscrivi questa meccanica"

6. **Export / Ownership** — attraversa tutto, **non negoziabile**: ogni asset e ogni
   gioco è posseduto ed esportabile. L'opposto di Tesana/Sorceress (lock-in).

## I due moat (ribaditi dall'utente)
1. **Esportabilità + ownership** — possiedi library E giochi, su motori veri.
2. **Dati su giochi creati e apprezzati dalla community** — il feed/flywheel: più gente
   crea cose di valore → più dati → il sistema migliora nel tempo. La library+laboratorio
   alimentano questo loop.

## Ancoraggio ai pain point reali (da `AIGAMEDEV_INSIGHTS.md`)
| Pain point Reddit | Come il laboratorio lo risolve |
|---|---|
| "asset incoerenti / sembra slop" | Library con style_pack + tool di rifinitura + anti-slop |
| "quale tool/modello uso?" | tutto in un posto, multi-model dietro le porte, un flusso |
| "non finisco un gioco completo" | generazione + verifica + modifica granulare |
| "il testing è il collo di bottiglia" | smoke/D.3/D.6 + Playtester |
| "voglio possedere, no lock-in" | export/ownership ovunque (moat 1) |
| "come trovo giocatori" | feed/community (moat 2) |

## Le due profondità (sempre entrambe)
- **Utente medio**: prompt → gioco. Zero lavoro preliminare. Facile.
- **Esperto/navigato**: library curata, modifica granulare per area/livello, edit del
  codice, test mirati. Valore "inestimabile" per chi ha i pain point veri.

## Stato dei due punti che erano sospesi (per la pianificazione futura)
- **Audio**: codice ESISTE (`lib/tools/audio/` → `SunoElevenAudioPort` bgm/sfx/voice,
  paywall) ma NON nel registry. + 2.488 SFX CC0 + 12 mood inutilizzati nel DB. Nel
  laboratorio = tipo di asset della Library, doppio binario (CC0 gratis + gen paywall).
- **Testing/Playtester**: smoke+D.3+D.6 esistono; Playtester LLM no (`playtest-runner/`
  = solo README). Fattibile via stato strutturato. Nel laboratorio = sottosistema #4.

## Vincoli onesti (da tenere nel piano)
- **Architettura pronta a metà**: porte esagonali + adattatori esistono → si riempiono,
  non si riscrivono. Ma Studio UI + Library (tabella `project_assets` + tagging) +
  aggancio al GamePlan (asset_resolver legge prima dalla library) + modifica granulare
  sono lavoro vero, da fare **incrementale**.
- **Timing**: validare il **loop base (primo gioco reale)** resta il prerequisito —
  costruire il laboratorio su un motore non ancora provato end-to-end è rischioso.
- **Rischio "wrapper"**: la community disprezza i wrapper costosi di modelli. Il valore
  non è "aggregare generatori" (commodity) ma library posseduta + gioco verificato +
  modifica granulare + community. Il generativo AI è il *premium* (paywall), non il cuore.

## Artefatti di ricerca collegati
- `AIGAMEDEV_INSIGHTS.md` — pain point community (3k post + 43k commenti)
- `SORCERESS_30_TOOLS.md` — i 30 tool → mapping codice + precisione di ricreazione
- `SORCERESS_STUDIO_PLAN.md`, `SORCERESS_MAPPING.md` — UX e workflow Sorceress
- `data/research/*_clean.txt` — 20 transcript dei video-tool
