# FINDING — Il Dataset Boost è proporzionale alla densità di copertura

**Data**: 2026-05-21
**Fase**: 7 (Integration & Comparison Test)
**Stato**: finding strategico — deve direzionare i prossimi passi
**Autore evidenza**: `scripts/ingestion/08_comparison_test.ts` (A/B test
empirico, generator `gpt-4o` @ temp 0.2, judge `claude-sonnet-4-6`)

---

## TL;DR

La Knowledge Base **non migliora uniformemente** la generazione di codice.
Il suo valore è **direttamente proporzionale a quanti chunk di qualità
copriamo per la nicchia specifica richiesta dall'utente**. Due test A/B reali
lo dimostrano:

| Task | Copertura KB della nicchia | Risultato (no-KB vs KB) | Boost |
|---|---|---|---|
| Godot metroidvania player controller | **alta** (224 chunk A01) | 10-10, 9-8, 8-8 (3 run) | ~zero |
| Ren'Py inventory system | **quasi nulla** (1 chunk C02, in quarantine) | 7 vs 6 | negativo |

In entrambi i casi il boost atteso non si è materializzato, **ma per ragioni
opposte** — ed è questa la lezione che conta.

---

## Perché succede

### Caso A — nicchia ben coperta MA modello base già competente

Per "Godot player controller con coyote time / wall jump / dash" la KB ha
224 chunk A01_player_controller di alta qualità. Eppure il boost è ~zero.

Motivo: coyote time, input buffering, variable jump, acceleration curves
sono **Game Programming Patterns canonici**. Ogni LLM generalista moderno
(GPT-4o, DeepSeek V4, Claude) li ha visti migliaia di volte nei dati di
training. La KB conferma quello che il modello già sa — non aggiunge
informazione marginale.

> Conclusione: per i pattern "da manuale", la KB è ridondante rispetto
> alla conoscenza parametrica dell'LLM.

### Caso B — nicchia rara dove il modello base È debole, MA la KB è vuota

Per "Ren'Py inventory system" il modello base È meno competente (Ren'Py è
un engine di nicchia, poco rappresentato nel training). Qui la KB
*dovrebbe* brillare. Invece il grounding iniettato erano 3 screen Ren'Py
generici (character-info menu, stat display) — **nessun vero inventory
system**, perché ne abbiamo **un solo chunk e per giunta finito in
quarantine** (confidence < 85).

> Conclusione: dove il modello base è debole — cioè dove la KB
> servirebbe davvero — il nostro dataset è troppo rado per aiutare.

---

## L'evidenza quantitativa: la copertura è squilibratissima

`code_knowledge` per engine (8 517 chunk totali):

| Engine | Chunk | Categorie distinte / 22 |
|---|---:|---:|
| godot | 3 357 | 21 |
| threejs | 1 270 | 21 |
| monogame | 1 090 | 19 |
| phaser | 968 | 16 |
| defold | 796 | 21 |
| love2d | 718 | 21 |
| stride | 215 | 16 |
| **renpy** | **103** | **4** |

Ren'Py ha **103 chunk su 4 categorie** (D01_ui 83, E01 9, C03 7, E04 4).
Le categorie meta-gioco tipiche dei visual novel/dating sim —
**C02_inventory, C01_progression, C04_save_load** — sono a **zero** in
`code_knowledge` per Ren'Py. Eppure sono esattamente ciò che un utente
"costruisco un dating sim" chiederebbe.

`game_parameters` (1 862 set numerici) è dominato da `general` (1 177) —
i gruppi ad alto valore di game-feel sono sottili:
`progression_economy` solo 16, `audio_config` solo 42.

---

## Implicazioni per i prossimi passi (Fase 2 — prodotto)

Questo finding **riorienta le priorità**. In ordine di leva:

### 1. La KB deve essere interrogata SELETTIVAMENTE, non sempre

Iniettare grounding per ogni richiesta degrada la qualità quando i chunk
recuperati sono poco pertinenti (caso B). Il layer prodotto (`lib/tools/`)
dovrebbe:
- misurare la **similarity media** dei top-K chunk recuperati;
- iniettare il contesto KB **solo se** la similarity supera una soglia
  (es. ≥0.55) e la `quality_score` è alta;
- altrimenti generare senza KB (fallback già implementato in
  `lib/knowledge.ts`, che ritorna `[]` su miss).

### 2. La copertura va riequilibrata PRIMA del lancio

Il dataset attuale è Godot-centrico. Per un prodotto multi-engine servono
campagne di harvest mirate dove siamo deboli:
- **Ren'Py**: da 8 repo a ~40-50, mirando a inventory / progression /
  route-flag / save systems (le meccaniche meta-gioco mancanti).
- **Stride / Defold**: engine poco nel training LLM → ogni chunk vale di
  più. Aumentare densità qui dà il ROI più alto sul boost reale.
- **game_parameters**: la "DNA del game feel" è il vero asset
  differenziante (un LLM non inventa valori da giochi pubblicati). Mirare
  l'estrazione parametri su progression_economy e combat_stats.

### 3. Il valore della KB si misura su task dove il modello base FALLISCE

Il test del blueprint (Godot player controller) è un **cattivo benchmark**
del boost perché il modello base è già esperto. Un benchmark onesto deve
includere:
- engine di nicchia (Defold game-state, Stride ECS);
- parametri numerici specifici per genere (bullet-hell enemy waves, RPG
  damage formula) dove i valori reali battono i numeri inventati;
- pattern compositi rari che richiedono più chunk insieme.

### 4. La quarantine non è scartabile

Il singolo chunk Ren'Py inventory esiste — ma in quarantine (conf 60-84),
quindi `search_code_knowledge` (default `p_min_confidence=85`) non lo vede.
Per engine a bassa copertura conviene **abbassare la soglia di confidence
al retrieval** (es. accettare ≥70 quando l'engine ha < 200 chunk), o
promuovere manualmente i chunk-quarantine di nicchia. Trade-off: qualità
vs copertura, da decidere per-engine.

---

## Cosa NON conclude questo finding

- **Non** dice che la KB è inutile. Dice che il suo valore è condizionale
  alla copertura e va attivato selettivamente.
- **Non** invalida le Fasi 1-6. La pipeline funziona: 8 517 chunk
  classificati, embedded, queryabili, 20/20 test funzionali PASS. Il
  finding riguarda *come* e *quando* usare la KB, non *se* costruirla.
- **Non** è un fallimento del comparison test. Al contrario: il test ha
  fatto il suo lavoro — ha esposto un limite reale invece di stampare un
  "PASS" cosmetico. È esattamente il segnale che serviva prima di
  costruire 48 tool sopra una KP squilibrata.

---

## Azione immediata raccomandata

Prima di iniziare Fase 2 (prodotto):

1. **Harvest mirato Ren'Py + Stride + Defold** (le 3 nicchie deboli) con
   focus sulle categorie meta-gioco mancanti.
2. **Soglia di retrieval adattiva per engine** in `lib/knowledge.ts`
   (confidence floor più basso per engine sotto-coperti).
3. **Gate di similarity** nei tool: niente grounding se i top-K non
   superano la soglia di pertinenza.
4. **Benchmark suite onesta**: 5-10 task su nicchie dove il modello base
   è debole, da rieseguire ad ogni espansione del dataset per misurare il
   boost reale nel tempo.
