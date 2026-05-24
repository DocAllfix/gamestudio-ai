Materiale Operativo per Generazione Codice: T12, T13, T14
T12 - Social Sim / Generative Agents
Analisi Copertura Repository
Il panorama dei progetti OSS per Godot 4 con integrazione locale di LLM offre plugin stabili per le API, ma manca di un clone completo di Smallville con licenza permissiva.

Il progetto aphae implementa una simulazione di ufficio con agenti IA e Ollama, ma è rilasciato con licenza proprietaria restrittiva (All Rights Reserved).   

Il progetto local-llm-npc fornisce una base eccellente in C# per NPC conversazionali con Gemma 3n, documentando chiaramente l'uso di Ollama locale.   

Repository OSS di Riferimento
Repository	URL GitHub	Licenza	Utilizzo per Generazione Codice
local-llm-npc	https://github.com/code-forge-temple/local-llm-npc	
CC BY 4.0 

Il generatore deve estrarre l'architettura C# per il binding asincrono con l'host Ollama locale e il modello Gemma 3n.

noko	https://github.com/nthnn/noko	
MIT 

Il codice generato in GDScript deve replicare la struttura del nodo NokoPrompt per inviare prompt in background senza bloccare il thread principale.

fuku	https://github.com/af009/fuku	
MIT 

Il generatore deve implementare il pattern di routing delle richieste API verso localhost:11434 con dizionari JSON contenenti il parametro stream: false.

  
World Graph Tipico
Zona (ID)	Nome	Connessioni (Edges)	Gating Tipico del Genere
Z1	Hub Residenziale	Z2	Il giocatore o l'agente può entrare solo se la variabile globale del ciclo diurno indica le ore notturne.
Z2	Piazza Centrale	Z1, Z3, Z4	L'accesso è sempre libero per favorire le collisioni tra i nodi CharacterBody2D e innescare i prompt LLM.
Z3	Area Lavorativa	Z2, Z5	Il punto di transito richiede l'equipaggiamento di uno strumento specifico verificato tramite script di inventario.
Z4	Mercato Locale	Z2	Il giocatore deve possedere un valore di valuta superiore a zero nel dizionario dei dati di salvataggio.
Z5	Area Riservata	Z3	Il passaggio è bloccato finché il punteggio di affinità generato dall'LLM per il proprietario non supera la soglia di 80/100.
Pacing Curve Tipica
Fase (Ciclo)	Normalizzato (0-1)	Implementazione e Trigger
Intro (08:00)	0.20	Gli script istanziano gli agenti nei rispettivi nodi di spawn residenziali e inizializzano il prompt di sistema per la giornata.
Build (12:00)	0.50	I timer di navigazione forzano lo spostamento degli NPC verso Z2 per innalzare le probabilità di interazione sociale.
Mid (15:00)	0.40	Il codice disperde le entità verso le aree lavorative riducendo le chiamate API per evitare la saturazione della memoria contestuale.
Climax (19:00)	0.90	Il motore forza un raduno di massa in Z4 per calcolare i riepiloghi delle relazioni tramite chiamate API LLM simultanee in coda.
End (23:00)	0.10	
Le funzioni di pulizia riducono le stringhe di memoria in sintesi brevi e riportano le coordinate spaziali degli agenti a Z1.

  
Rules Ranges Sensati
Regola / Parametro	Range Sensato	Nota Operativa per Generazione
HP (Energia Sociale)	0 - 100 punti	Il valore diminuisce di 5 punti per ogni interazione LLM completata.
DMG (Danno Relazionale)	-20 - +20 punti	Il parser deve mappare l'analisi del sentiment restituita dall'LLM su questo intervallo numerico.
Checkpoint Freq	1 per ciclo	Il salvataggio serializza l'array JSON della cronologia LLM su file al completamento di ogni giornata di gioco.
Durata Media Run	10 - 20 minuti	Il timer globale converte 1 secondo di tempo reale in 1 minuto di tempo simulato.
Lunghezza Contesto	512 - 2048 token	Lo script di invio deve troncare i messaggi più vecchi per prevenire timeout dal demone Ollama locale.
T13 - Bullet Hell / Arcade Puro
Analisi Copertura Repository
Esiste una lacuna significativa per i template LÖVE recenti che includano un WaveSpawner avanzato con licenza MIT esplicita.

Il progetto nbml fornisce un ottimo parser per pattern stile BulletML, ma la licenza esatta non è specificata chiaramente nei metadati principali.   

Il progetto bullet_hell di srijan-paul è il punto di partenza ottimale grazie all'implementazione nativa di ECS (Entity Component System) e fisica custom in Lua.   

Repository OSS di Riferimento
Repository	URL GitHub	Licenza	Utilizzo per Generazione Codice
bullet_hell	https://github.com/srijan-paul/bullet_hell	
MIT 

Il generatore deve estrarre il sistema di risoluzione delle collisioni ottimizzato per evitare i rallentamenti nativi della libreria Box2D.

love2d-shmup	https://github.com/Achie72/love2d-shmup	
Open Source 

Il codice Lua deve riutilizzare la configurazione dell'ambiente globale per la gestione della risoluzione canvas verticale.

nbml	https://github.com/sharpobject/nbml	
Unspecified 

Il generatore estrarrà la struttura logica per compilare le tabelle dei pattern di proiettili in file esterni interpretati a runtime.

  
World Graph Tipico
Zona (ID)	Nome	Connessioni (Edges)	Gating Tipico del Genere
S1	Fase Iniziale	S2	Lo scorrimento verticale procede finché il timer interno della funzione love.update non raggiunge i 30 secondi.
S2	Assalto Mid-Boss	S3	Lo schermo smette di scorrere e il gating richiede l'azzeramento della variabile HP del nodo nemico principale.
S3	Sciame di Proiettili	S4	Il sistema sblocca l'avanzamento solo dopo aver cancellato dalla tabella globale i detriti generati dall'esplosione di S2.
S4	Boss Finale (Fase 1)	S5	La logica disabilita i danni al boss finché il giocatore non distrugge prima le due torrette laterali.
S5	Boss Finale (Fase 2)	Vittoria	L'evento di transizione richiede la sopravvivenza del giocatore per 60 secondi contro un pattern Danmaku incontrollabile.
Pacing Curve Tipica
Fase (Livello)	Normalizzato (0-1)	Implementazione e Trigger
Intro	0.20	
Il WaveSpawner inietta nella tabella delle entità nemici con vettori di movimento lineari e rateo di fuoco inferiore a 1 Hz.

Build	0.60	
La logica spawn incrementa la frequenza di fuoco e genera vettori di proiettili interpolati tramite la funzione math.sin.

Mid	0.40	Il sistema sospende temporaneamente lo spawn dei proiettili per rilasciare nodi potenziamento che ripristinano l'area giocabile.
Climax	1.00	Il generatore esegue un ciclo for per istanziare pattern a spirale concentrica che coprono l'80% dei pixel dello schermo.
End	0.00	Una singola istruzione iterativa svuota la tabella bullets, azzerando la minaccia e avviando l'animazione di punteggio.
  
Rules Ranges Sensati
Regola / Parametro	Range Sensato	Nota Operativa per Generazione
HP (Vite Giocatore)	1 - 3 vite	La gestione dei danni è binaria poiché la collisione dell'hitbox di 1 pixel con un proiettile sottrae esattamente 1 vita intera.
DMG (Danno Armi)	1 - 5 danni/frame	Il calcolo dei danni non usa RNG per garantire che il tempo di uccisione dei nemici sia matematicamente prevedibile dal giocatore.
Checkpoint Freq	0 per livello	La progressione arcade pura impone il riavvio del file main.lua dal frame iniziale in caso di Game Over.
Durata Media Livello	120 - 180 secondi	L'intero script del WaveSpawner deve essere sincronizzato sulla durata esatta del file audio in background.
Limite Entità Attive	1000 - 5000 istanze	
Il rendering deve obbligatoriamente implementare love.graphics.newSpriteBatch per mantenere il target di 60 FPS.

  
T14 - Retro 8-bit Restricted
Analisi Copertura Repository
I progetti che implementano vincoli Pico-8 puri su Godot 4 sono estremamente rari, richiedendo l'adattamento di asset creati per versioni precedenti.

Il pacchetto GodotRetro è ottimizzato per Godot 3.5, il generatore dovrà convertire i file .shader per la sintassi GLSL aggiornata di Godot 4.x.   

Il repository godot-pixel-art-template copre accuratamente le impostazioni del file project.godot necessarie per disabilitare il sub-pixel rendering.   

Repository OSS di Riferimento
Repository	URL GitHub	Licenza	Utilizzo per Generazione Codice
godot-pixel-art-template	https://github.com/glennDittmann/godot-pixel-art-template	
Presente 

Il generatore deve copiare le chiavi di configurazione per display/window/size/viewport_width e l'impostazione nearest per il filtro texture.

Divine-Retribution-8-bit	https://github.com/MaxiimPetrov/Divine-Retribution-8-bit-Project	
MIT 

Il codice GDScript deve implementare la logica del CharacterBody2D per salti rigidi senza interpolazione di inerzia.

GodotRetro	https://github.com/ahopness/GodotRetro	
CC0 / MIT 

Il generatore deve istanziare un CanvasLayer con un ColorRect contenente lo shader per l'effetto di dithering e limitazione colore.

  
World Graph Tipico
Zona (ID)	Nome	Connessioni (Edges)	Gating Tipico del Genere
R1	Schermata di Avvio	R2	Il limite della TileMap blocca i bordi, richiedendo l'ingresso in una Area2D di transizione a destra.
R2	Abisso Platform	R1, R3	Il salto richiede il posizionamento esatto al limite del pixel per evitare il volume di trigger letale sul fondo.
R3	Stanza del Potenziamento	R2	La raccolta dell'oggetto modifica lo stato del Singleton globale permettendo la distruzione dei blocchi fragili in R4.
R4	Corridoio Sigillato	R2, R5	Il metodo queue_free() viene chiamato sui tile di barriera solo se la condizione dell'inventario è soddisfatta.
R5	Arena del Boss	Nessuna	L'attivazione dell'area blocca lo scorrimento della telecamera e chiude l'ingresso istanziando tile solidi alle spalle del giocatore.
Pacing Curve Tipica
Fase (Livello)	Normalizzato (0-1)	Implementazione e Trigger
Intro	0.20	Il nodo spawn posiziona due istanze di nemici con logica di pattugliamento lineare move_and_slide lenta.
Build	0.50	Il layout introduce piattaforme mobili che richiedono la sincronizzazione manuale del salto basata sul conteggio dei frame.
Mid	0.80	La disposizione spaziale posiziona ostacoli statici che causano knockback istantaneo verso i precipizi letali.
Climax	1.00	Il nodo Boss esegue un loop match state-machine con tre attacchi temporizzati rigidamente senza telegrafia fluida.
End	0.00	La variabile booleana get_tree().paused viene impostata su vero, fermando l'aggiornamento fisico per calcolare il punteggio.
Rules Ranges Sensati
Regola / Parametro	Range Sensato	Nota Operativa per Generazione
Dimensione Palette	4 - 16 colori	
Il GDShader deve processare il buffer dello schermo applicando una funzione floor sui canali RGB mappata su array costanti.

Risoluzione Nativ	160x144 - 320x240	
Il generatore deve imporre queste risoluzioni fisse disabilitando l'antialiasing per evitare la sfocatura dei sub-pixel.

HP (Unità)	1 - 6 punti	La barra della salute deve essere renderizzata esclusivamente tramite nodi TextureRect discreti anziché componenti ProgressBar.
Checkpoint Freq	1 per livello	L'evento di respawn impone la ricarica completa del file .tscn della scena tramite reload_current_scene().
Frequenza Audio	11025 - 22050 Hz	Il generatore deve aggiungere un AudioEffectBitCrush al bus Master per degradare artificialmente l'audio generato dai nodi AudioStreamPlayer.
  

github.com
rsanandres/aphae: AI Agent Office Simulation — Godot 4 + Ollama - GitHub
Si apre in una nuova finestra

github.com
code-forge-temple/local-llm-npc: An interactive educational game built for the Google Gemma 3n Impact Challenge. - GitHub
Si apre in una nuova finestra

dev.to
How I Built an Offline AI-Powered NPC System with Godot and Gemma 3n - DEV Community
Si apre in una nuova finestra

forum.godotengine.org
Offline AI-Powered NPCs Teaching Sustainable Farming — Built with Godot 4.x and Gemma 3n
Si apre in una nuova finestra

github.com
GitHub - nthnn/noko: User-friendly Godot plugin that facilitates seamless interaction with Ollama models via API that empowers developers to enhance their games with interactive Large Language Models (LLMs), enabling dynamic dialogues, intelligent NPCs, and more.
Si apre in una nuova finestra

github.com
af009/fuku: AI Assistant for Godot - GitHub
Si apre in una nuova finestra

github.com
jonradoff/awesome-agent-almanac - GitHub
Si apre in una nuova finestra

love2d.org
Bullet Hell Patterns - LÖVE - Love2d.org
Si apre in una nuova finestra

github.com
GitHub - srijan-paul/bullet_hell: an unnamed bullet hell game written in Lua, using the LÖVE game engine.
Si apre in una nuova finestra

awesome.ecosyste.ms
LÖVE | Ecosyste.ms: Awesome
Si apre in una nuova finestra

github.com
love2d-shmup/devlog_8.md at main · Achie72/love2d-shmup · GitHub
Si apre in una nuova finestra

github.com
love2d-shmup/.luacheckrc at main - GitHub
Si apre in una nuova finestra

reddit.com
What maths do I need to develop a decent shmup? : r/gamedev - Reddit
Si apre in una nuova finestra

blood.church
making a simple shoot-em-up with FNA and MoonTools.ECS | BLOOD CHURCH
Si apre in una nuova finestra

github.com
GitHub - ahopness/GodotRetro: A pack of retro shaders for Godot.
Si apre in una nuova finestra

godotengine.org
Godot Retro - Godot Asset Library
Si apre in una nuova finestra

github.com
glennDittmann/godot-pixel-art-template - GitHub
Si apre in una nuova finestra

github.com
MaxiimPetrov/Divine-Retribution-8-bit-Project - GitHub
Si apre in una nuova finestra

github.com
GitHub - bukkbeek/GodotPixelRenderer: Complete 3D to Pixel Toolkit [Built using Godot Engine]
Si apre in una nuova finestra

github.com
Pixel perfect games in Godot · godotengine godot-proposals · Discussion #9256 - GitHub
Si apre in una nuova finestra
