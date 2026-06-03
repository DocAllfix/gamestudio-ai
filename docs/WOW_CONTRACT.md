# WOW CONTRACT — cosa l'MVP day-1 GARANTISCE

**Data**: 2026-06-03
**Status**: contratto di lancio. Definisce, in modo verificabile, cosa il
prodotto deve garantire al day-1 — i criteri di accettazione che gateano il
lancio. È la guida di scope condivisa dai 4 workstream.
**Companion**: [COMPETITIVE_LANDSCAPE_2026.md](COMPETITIVE_LANDSCAPE_2026.md)
(perché questo posizionamento), [PROJECT_STATUS.md](../PROJECT_STATUS.md).

---

## §1 — La promessa wow (in una frase)

> *"Scrivi un'idea (e, se vuoi, carica immagini/musica/storyboard). 90-900
> secondi dopo hai un gioco che GIRA davvero — verificato, bilanciato, senza
> soft-lock — giocabile nel browser e su mobile (installabile come app), su 5
> motori reali. Ed è TUO: lo scarichi come progetto vero e lo spedisci."*

Il wow NON è "genera codice" (lo fa Cursor/SEELE/Rosebud). Il wow è
**"genera un gioco VERIFICATO che è tuo"**. Lo scope è la verticale verificata,
non i 48 tool / 8 engine / 6 moduli completi.

---

## §2 — I 5 motori del lancio

Numeri KB reali dal DB Supabase (`code_knowledge`, totale **7336** —
NON 7503/8517 dei doc storici; verificato 2026-06-03).

| Motore | Ruolo | Browser | Mobile | 3D | KB chunk (q≥4) |
|---|---|---|---|---|---|
| **Godot** | Generalista 2D + 3D capace | ✅ WASM | PWA | sì (KB ha pattern FPS) | 2551 (1985) |
| **Phaser** | Instant browser, arcade/puzzle | ✅ nativo | PWA | no | 974 (85) ⚠️ |
| **Three.js** | Showcase 3D (T09), low-poly/voxel via CC0 | ✅ nativo | PWA | sì | 976 (665) |
| **Babylon.js** | **Giochi 3D veri** (fisica/GUI built-in) | ✅ nativo | PWA | sì | 0 (gen LLM) |
| **Defold** | **Mobile-first** (.apk native + PWA) | ✅ nativo | **.apk** | no | 684 (416) |

Note:
- **Phaser**: solo 85 chunk q≥4, KB debole. Ma il modello base è fortissimo su
  JS (`FINDING_kb_value_eval`: 10/10 senza KB) → Phaser non *ha bisogno* della
  KB. È il motore "instant browser" a costo zero di build.
- **Babylon**: 0 chunk KB (harvest deferito — materiale OSS scarso, ~29 repo).
  Si genera con la competenza LLM (TS, forte come Phaser). Il suo valore unico
  è `NullEngine` (verifica headless server-side, vedi §3) + fisica built-in.

**Copertura dimensionale day-1**: 2D (Godot/Phaser/Defold) + 3D showcase
(Three.js) + 3D giochi (Babylon/Godot) + mobile native .apk (Defold). Nessun
competitor offre questa combinazione insieme.

---

## §3 — Criteri di accettazione day-1 (gate verificabili)

Ancorati alle costanti già definite in
[`lib/contracts/evaluation-metrics.contract.ts`](../lib/contracts/evaluation-metrics.contract.ts)
— **NON ridefinire qui, si citano** (single source of truth nel contratto):

| Garanzia | Soglia | Costante | Come si misura |
|---|---|---|---|
| Gira / non crasha | ≥ 95% | `SMOKE_TEST_PASS_RATE_MIN = 0.95` | smoke test headless 10s in E2B |
| Zero soft-lock | 0 | `SOFT_LOCK_COUNT_MAX = 0` | D.3 ASP (clingo) sul world_graph |
| Bilanciato | RMSE < 0.15 | `STRESS_CURVE_RMSE_MAX = 0.15` | D.6 Playtester vs curva target |
| Coerenza estetica | ≥ 0.75 | `AESTHETIC_COHERENCE_MIN = 0.75` | CLIP-sim + palette match vs style pack |
| Costo per gioco | < $1.50 | `GENERATION_COST_USD_MAX = 1.5` | somma `tool_call.cost_usd` nel DAG (Free tier) |
| Tempo di generazione | < 15 min | `GENERATION_TIME_SECONDS_MAX = 900` | Trigger.dev job end-to-end |

**+ 3 criteri delle prerogative di lancio** (da contrattualizzare):
- **Giocabile in browser** — via porta `webExport()` (vedi §6).
- **Installabile su mobile come PWA** — manifest + service worker + input touch.
- **Export .apk native verificato** — via Defold (build + smoke headless
  ufficiale "senza grafica/suono"). **Si promette .apk solo dove il test passa.**

---

## §4 — Scope MVP day-1: cosa È e cosa NON è

### DENTRO — tier FREE (costo basso, sostenibile)

5 motori; ~3-5 generi dove la KB regge (incl. 3D showcase/adventure); **BYOA**
(immagine/musica/storyboard → contesto generazione — già contrattualizzato,
basso costo); **3D da asset CC0** (Quaternius/KayKit/Poly Haven indicizzati +
`match_assets` su `asset_type='model_3d'` + style pack C01-C08 — *content
assembly da catalogo*, NON generazione); catena code_gen + sprite-2D +
assembler; D.3 soft-lock + D.6 smoke test; `game_parameters` game-feel; browser
play + **mobile PWA + .apk native via Defold**; feed play-in-place; badge/fork;
Tip Jar.

### DENTRO — tier PAYWALL (Creator+, costo reale → chi consuma il caro paga)

**Generazione 3D AI custom** (`model_3d_gen` Meshy/TRELLIS.2 $0.005-0.20/asset)
+ **audio generativo** (Suno BGM $0.02-0.11/traccia, ElevenLabs SFX/voci) +
**sprite premium** (FLUX). Decisione: 3D/audio generativo è day-1 MA sui tier
paganti — si promette perché i provider sono maturi e si wirano dietro le porte
(§6), ma NON è nel Free (allinea costo e ricavo, vedi §9).

### DA TESTARE DALL'INIZIO (non feature-utente finché non c'è Order Form)

**World Labs Marble** — porta `WorldGenPort` + adattatore + smoke test di
integrazione (GLB → engine → entity_placement → D.6 cammina nel mondo). Account
API paid basta per il test interno (legale). Order Form solo per il volume
utenti. → Segnale precoce: se "mondo Marble + nostri tool + verifica" funziona,
abbiamo validato il differenziatore di Fase 2 con pochi dollari.

### FUORI (fast-follow / Fase 2)

Multiplayer Nakama (verifica più dura: 2+ client sincronizzati); .apk Godot
(richiede template pre-baked + emulatore headless — indurire prima di
promettere); Marble come feature-utente (Order Form); `level_layout_3d` /
`heightmap_gen`; Playtester Agent completo; gli altri 3 motori (renpy /
monogame / love2d / stride); Studio/Code Mode; i 48 tool completi; store nativi
(Play / App Store).

### Razionale del taglio

Finding del progetto (LLM già forte sui mainstream e su TS → Babylon senza KB),
fattibilità ~14 settimane, e **onestà**: il 3D/audio generativo SI promette
(provider maturi, wiring) ma dietro paywall per i costi; il multiplayer e
l'.apk Godot NO finché la verifica non regge (evita l'errore-SEELE di promettere
ciò che non è dimostrato).

**Nota differenziante**: il wow day-1 = 2D + 3D (CC0 + generativo) + mobile
native + BYOA + verifica + export posseduto + feed. Combinazione che NESSUN
competitor offre insieme.

---

## §5 — Il flywheel acceso dal day-1 (il moat che cresce)

Il vero moat di lungo periodo è l'auto-miglioramento basato su validazione
**utente reale** (non auto-validazione AI). L'infrastruttura EMA esiste già su
3 livelli (`code_knowledge.success_score`, `episodic_memory` in 005,
`asset_library_index.success_score` + `increment_asset_usage` in 003). **Manca
solo l'anello evento-utente → success.**

Definire `success` come EVENTO UTENTE REALE:
- gioco **scaricato** (segnale debole)
- gioco **pubblicato / condiviso** (forte)
- gioco **forkato da terzi** (fortissimo — validazione di terzi)
- gioco **NON rigenerato** (l'utente ha tenuto la prima versione)
- gioco **completato nel feed** da altri giocatori

Collegare `usage_events` (già in 005: `game_completed`, `game_exported_itch`,
`asset_uploaded`) → RPC `update_episodic_memory` + `success_score` dei
chunk/asset usati in quel gioco.

**Priorità**: è il pezzo a leva più alta dell'intero progetto, e oggi è il meno
implementato. Va acceso *piccolo e subito* (dal primo utente), non aspettando
il volume — perché è ciò che ci rende imbattibili nel medio termine (Astrocade
ha già 140M partite/mese di vantaggio sui dati).

---

## §6 — Contract proposal necessario in Fase 0: `webExport()` + porte provider

Il contratto `EngineAdapter`
([`assembly-pipeline.contract.ts`](../lib/contracts/assembly-pipeline.contract.ts))
ha `build()` / `smokeTest()` / `package()` ma **NON un metodo per il bundle web
giocabile in iframe**. Il browser play + il feed + il mobile PWA dipendono da
questo. → Proposta di contratto in Fase 0 (processo "contract proposal" del
Manifesto §02.3):

```ts
// da aggiungere a EngineAdapter
webExport(sandbox: SandboxHandle): Promise<WebBuildArtifact>;
```

Implementato diversamente per adattatore: Phaser/Three.js/Babylon ≈ identità
(già JS/TS); Godot/Defold = export WASM. Per i 5 motori, `smokeTest()` deve
girare **headless** nella sandbox: 2D via headless runner, 3D via `NullEngine`
(Babylon) / headless export (Godot), così la verifica copre anche il 3D.

**Porte dei provider generativi** (esagonale): `AudioGenPort` (Suno/ElevenLabs),
`Model3DPort` (Meshy/Tripo/TRELLIS.2), `ImageGenPort` (Replicate FLUX/SDXL),
`WorldGenPort` (World Labs Marble). Il dominio chiede la capacità ("genera
musica mood X"), la porta sceglie il provider → sostituibilità + verifica
offline con adattatori mock.

---

## §7 — Criteri di "PASS" del lancio

Il lancio è **go** quando, su un set di prova di **5 motori × 3-5 generi**, una
soglia definita di generazioni reali (NON mock) soddisfa TUTTI i criteri §3:

- **smoke test**: ≥ 95% delle build girano senza crash (= la costante).
- **evaluation gate**: ≥ 80% delle generazioni passano i 6 criteri §3 (soglia
  proposta, da tarare con dati reali — vedi le deferred tuning del blueprint
  Parte R: 0.75 e 0.15 sono guess iniziali da calibrare).
- **browser + mobile**: 100% delle build hanno `webExport` funzionante; le
  build Defold producono un .apk che passa lo smoke headless.
- **Marble**: il test di integrazione `WorldGenPort` produce almeno un mondo
  GLB caricabile e percorribile (segnale precoce, non gate di lancio).

Misurazione: run reali in E2B, costi loggati in `tool_executions`, esiti in
`build_artifacts`. Niente mock nel gate finale.

---

## §8 — Mappa ai 4 workstream (cosa serve per il wow day-1)

| WS | Consegna minima per il wow |
|---|---|
| **W1** (Reasoning) | D.1 Intent + D.2 Design + D.5 Execution (minimi) + i **gate** D.3 soft-lock e D.6 smoke; Hermes loop; il backend del flywheel (`usage_events`→`success_score`). |
| **W2** (Tools/LLM) | LLM router (OpenRouter+Helicone+cost cap); ~10-12 tool della verticale (code_gen ×5 motori, sprite_gen, asset_resolver, validator); le **porte generative** `AudioGenPort`/`Model3DPort`/`ImageGenPort` + adattatori (Suno/Meshy/ElevenLabs/Replicate); porta `WorldGenPort` (Marble) per il test. |
| **W3** (Runtime) | **5 engine adapter** (godot/phaser/threejs/babylon/defold) + `webExport()` + `smokeTest()` headless (incl. `NullEngine` Babylon) + **.apk Defold** + assembler + R2. |
| **W4** (Frontend) | Creator Mode (5-step §10) + feed iframe player (sandboxed) + PWA + **Tip Jar** + badge/fork + il **paywall generativo a crediti** (§9). |

---

## §9 — Modello economico bootstrap-safe

**Correzione critica** rispetto a `PIETRA_v5_ADDENDUM` §B.3, che ha un errore di
unit economics: Free NON è "a costo zero" (3 giochi × ~$1 = ~$3/mese); Creator
"margine $14-15" è in realtà ~$4 (19 − ~15 di costo, prima di Stripe). Per un
**bootstrap** questo è letale se un lancio vira virale.

**Modello corretto:**
- **Free = SOLO CC0 + LLM cached** (NIENTE generativo AI). Costo reale
  ~$0.30-1.00/mese per utente attivo = CAC accettabile. Il Free è marketing,
  non dev'essere "ricco".
- **Generativo AI (3D Meshy / audio Suno / sprite FLUX) = dietro paywall**
  Creator+. Allinea costo e ricavo: chi consuma il caro, paga.
- **Budget AI a crediti, non "N giochi"**: i tier vendono accesso illimitato ai
  giochi CC0 + un **budget generativo $X/mese**; oltre → crediti.
  **MAI "illimitato" su ciò che ha costo marginale reale** (il generativo).

**Costi reali verificati (giugno 2026):**
| Voce | Costo |
|---|---|
| Gioco CC0 (no generativo) | ~$0.30-1.00 |
| Gioco con generativo (Pro) | ~$1.40-4.20 |
| Suno BGM | $0.02-0.11/traccia |
| ElevenLabs SFX | ~$0.01-0.05/effetto |
| Meshy/TRELLIS.2 3D | $0.005-0.20/asset |
| World Labs Marble | ~$1.20/mondo |

**Leve di margine reali** (da Pietra, valide): DeepSeek routing 60% dei task
($0.14/MTok), prompt cache 90%, batch API 50%, asset CC0 a $0 di query.

**Confronto mercato**: Rosebud $20 / $60 / $120; i tier attuali ($19/$49/$99 in
`billing.contract.ts`) sono in linea, ma le **quote vanno riallineate** dal
modello "N giochi" al modello "budget-a-crediti". (I valori dei tier restano
nel contratto come single source of truth — qui si descrive il *modello*, non
si ridefiniscono i numeri.)

---

## §10 — GTM + onboarding (consolidamento, non reinvenzione)

**GTM** (da `pietra_v4` §11-sexies/septies, già maturo):
- **Founding Worlds Program**: 20-30 creator early access, badge "Founding World".
- **Game jam per-engine**: "Godot Metroidvania 72h", "Defold Mobile Puzzle Sprint".
- **Launch live**: stream "3 giochi completi in 60 min".
- **Loop virale**: badge "Made with [Brand]" → fork → share (ogni gioco porta
  utenti). È il motore di crescita a costo zero.
- **Affiliate**: revenue share su Pro per YouTuber/streamer.

**Onboarding Creator Mode (5 step)**:
1. Welcome — campo testo "Descrivi il gioco..." + chip preset genere (+ upload
   BYOA opzionale).
2. Engine picker — card motori con badge "Consigliato" sul migliore per il brief.
3. Piano di generazione — task con dipartimento, modello, **costo e tempo
   stimati** (trasparenza totale).
4. Generazione live — progress bar + stato per task.
5. Output — giocabile nel browser/feed + download .zip/.apk + "Apri in Studio".

**Monetizzazione creator**: Tip Jar day-1 (Stripe diretto, 0% fee, stile
Rosebud — differenziatore di retention) + affiliate; marketplace Polar.sh in
Fase 2.

---

## §11 — Riferimenti

- Soglie wow (single source of truth): [`evaluation-metrics.contract.ts`](../lib/contracts/evaluation-metrics.contract.ts)
- Tier/quota: [`billing.contract.ts`](../lib/contracts/billing.contract.ts) + RPC `check_quota` in [`005_product_schema.sql`](../supabase/migrations/005_product_schema.sql)
- Flywheel EMA: `episodic_memory` / `update_episodic_memory` (005), `increment_asset_usage` (003)
- Asset CC0 3D: [`ASSET_LIBRARY_MANIFEST.md`](ASSET_LIBRARY_MANIFEST.md) + `match_assets` (003)
- Posizionamento: [`COMPETITIVE_LANDSCAPE_2026.md`](COMPETITIVE_LANDSCAPE_2026.md)
- Numeri KB: **fonte unica** [`KB_STATE.md`](KB_STATE.md), auto-generata da `scripts/kb_state_report.py` (query dirette al DB). I doc storici divergono (7336 vs 7503 vs 8517) — il DB è la verità; rigenera `KB_STATE.md` quando la KB cambia.
