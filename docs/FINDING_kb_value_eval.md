# FINDING — Comparison test, 8 motori (Fase 1ter verification)

**Data**: 2026-05-22
**Setup**: `12_comparison_test_all_engines.ts`. Per ogni motore: un task
"mainstream" (player controller, base game class, scene loader, ecc.) sulla
categoria con coverage più forte. gpt-4o @ T=0.2 genera A (senza KB) e B
(con KB). Sonnet 4.6 valuta su 5 criteri 0-2. Gate KB = B vince ≥3/5.

## Risultati nudi

| Engine | Task | A | B | Δ | Wins |
|---|---|---:|---:|---:|---:|
| godot | A01_player_controller | 8/10 | 9/10 | +1 | 1/5 |
| phaser | A01_player_controller | 10/10 | 10/10 | 0 | 0/5 |
| renpy | C03_dialogue_narrative | 9/10 | 10/10 | +1 | 1/5 |
| defold | E01_project_structure | 10/10 | 10/10 | 0 | 0/5 |
| monogame | E01_project_structure | 10/10 | 10/10 | 0 | 0/5 |
| love2d | E03_game_flow | 10/10 | 10/10 | 0 | 0/5 |
| threejs | E01_project_structure | 10/10 | 10/10 | 0 | 0/5 |
| stride | B03_physics_collision | 10/10 | 10/10 | 0 | 0/5 |

**Totali**: A=77/80, B=79/80, Δ=+2 su 80, gate passati 0/8.

## Lettura onesta

**La KB ha portato +2 punti totali su 80. Nessun motore passa il gate ≥3/5.**

Non è il fallimento che sembra. Tre fattori chiave:

1. **Effetto soffitto reale**. 6 dei 7 pareggi sono 10/10 contro 10/10.
   gpt-4o è già **perfetto** sui task scelti (player controller Phaser,
   game class MonoGame, scene loader Three.js, state machine LÖVE,
   collection script Defold, physics-pickup Stride). Quando A è al
   massimo, B non può vincere — può solo pareggiare. **Sui task standard
   gpt-4o non ha bisogno della KB.**

2. **Stride col 10/10 è il dato più sorprendente**. È l'engine di nicchia
   con solo 215 chunk: l'ipotesi era che fosse lì che la KB doveva
   spingere di più. Invece A=10 anche per Stride. Significa che gpt-4o
   conosce molto bene anche le API di Stride (SyncScript, RigidbodyComponent,
   NewCollisions). La nostra paura che il modello base fosse debole sugli
   engine di nicchia era infondata su task semplici.

3. **Godot e Ren'Py sono gli unici a non saturare A**. A=8 e A=9. Sono
   anche i casi dove B vince (+1 ciascuno). Il pattern è: dove il modello
   base non è già perfetto, la KB aggiunge un po' di qualità — ma
   solo +1, non i 3/5 attesi.

## Conclusione strategica

Il blueprint promette "Dataset Boost" misurato su gate ≥3/5. Questo test
**non lo passa** su task mainstream perché gpt-4o (4.x è il modello
intelligente forte di OpenAI, generalmente molto bravo a code-gen) è
troppo bravo da solo. Il test originale di Fase 7 (Ren'Py inventory)
passava il gate perché era un task molto specifico dove il modello
faceva errori (e quel gate è confermato).

**Tre opzioni di lettura**:

- **A. La KB è inutile su task mainstream con un modello forte come
  gpt-4o.** Verosimile. La KB serve dove (a) il modello sbaglia
  e (b) abbiamo materiale specifico — la stessa lezione del FINDING
  Fase 7 (Dataset Boost mirato, non globale).
- **B. Il test ha task troppo facili.** Anche vero. Su un task
  "metroidvania con wall-jump + dash + parry" Godot probabilmente
  vincerebbe ≥3/5. Sui task base lo standard è già 10/10.
- **C. Il modello generatore è troppo capace.** Anche vero. Con un
  modello più debole (gpt-4o-mini o open-source 7B), la KB
  probabilmente vincerebbe ovunque.

## Cosa significa per il prodotto

Game Studio AI Phase 2 userà getReferences() prima di ogni tool. Su task
**standard** la KB non muove la metrica con gpt-4o. Su task **specifici**
(la nicchia Ren'Py inventory di Fase 7 vinta 4/5) la KB muove la metrica.
La KB resta strategica perché:
- Quando il modello sbaglia su un dettaglio (vedi A=8 Godot: jump=-600 vs
  reale -500), il riferimento dal KB lo corregge.
- Su task di nicchia (engine non mainstream, framework specifici, pattern
  particolari come dialogue tree o save system) il KB è la differenza tra
  un output funzionale e uno generico.
- Con modelli più piccoli/economici (gpt-4o-mini, claude-haiku), il KB
  diventa l'unica leva di qualità.

**Il KB non va misurato globalmente: va misurato sui task dove serve.**

## Costo del test

8 generazioni × 2 (A+B) + 8 valutazioni sonnet-4-6 ≈ $0.25.
