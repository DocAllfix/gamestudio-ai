Ho abbastanza dati verificati. Compilo.

Harvest Three.js Postprocessing/Shader VFX — Risultati verificati
Tabella principale
#Repo★LicenzaCategoria gapCosa offre1pmndrs/postprocessing~2.8kZlibEffectComposer pipelineReimplementazione completa di EffectComposer: BloomEffect, DepthOfFieldEffect, ChromaticAberrationEffect, SMAAEffect, ToneMappingEffect, VignetteEffect — tutto in un'unica pipeline composable; gestisce correttamente il color-space sRGB. (autore: vanruesc → ora sotto pmndrs)2gkjohnson/three-gpu-pathtracer~1.6kMITDepth-of-field / color grading cinematicPath tracer GPU-accelerated su WebGL con WebGLPathTracer; include DoF fisico (fstop, aperture blades, bokeh anamorphic) e supporto LUT tone-mapping via ACESFilmicToneMapping; utile per preview cinematici T09.3N8python/n8ao~462CC0SSAO / ambient occlusion postpassN8AOPass drop-in per EffectComposer: SSAO ad alta qualità con temporal stability, configura aoRadius, distanceFalloff, intensity; compatibile sia con vanilla three.js sia con pmndrs/postprocessing.4Ameobea/three-good-godrays~198MITVolumetric godraysGodraysPass screen-space raymarched per pmndrs/postprocessing: campiona la shadow map per determinare occlusione, parametri density, distanceAttenuation, raymarchSteps; supporta tutti i tipi di shadow map three.js.5FarazzShaikh/THREE-CustomShaderMaterial~1.3kMITToon/cel-shading + stylizedCSM permette di iniettare vertex/fragment shader custom sopra qualsiasi MeshPhysicalMaterial / MeshToonMaterial senza riscrivere il material system; pattern chiave per toon shading, watercolor filter, painterly look su oggetti già lit.6manbust/three-js-toon-shader~(nuovo, 2025)verificare¹Toon/cel + outline post-processImplementazione production-grade di cel shading via gradient maps + edge detection da Depth/Normal buffer (depth discontinuity + normal discontinuity); distance attenuation sulle linee; framework-agnostic (vanilla, R3F, Vue).7Alchemist0823/three.quarks~732MITParticle system shader-basedVFX engine completo: GPU instancing + interleaved buffer, emitter shapes, behaviours (SizeOverLife, ColorOverLife, RotationOverLife), curve parameters via Bezier lookup table; include editor JSON-compatibile con three.js.8squarefeet/ShaderParticleEngine~700MIT²Particle system GLSLEngine particellare GLSL-heavy per three.js, sposta il calcolo posizioni sul GPU; più datato di three.quarks ma pattern molto riutilizzabili per particle burst, trail, sprite atlas.

¹ manbust/three-js-toon-shader: il repo è attivo (nov 2025) ma la licenza non è dichiarata in modo esplicito nel README dai risultati di ricerca. Verificare LICENSE file prima di ingestire. Se mancante, skippa o contatta autore.
² squarefeet/ShaderParticleEngine: licenza MIT confermata da package.json del repo originale; repo in maintenance mode ma codice stabile.


Repo già nel KB (conferma da ENGINE_MECHANICS_KIT.md) — skip

mrdoob/three.js (skippa per policy)
pmndrs/drei (skippa per policy)
donmccurdy/* (skippa per policy)
Alchemist0823/three.quarks — già citato nel KB come D03 in ENGINE_MECHANICS_KIT, sezione Three.js. Includilo nell'harvest solo se la copertura chunk è < 5.
MenacingMecha/godot-psx-style-demo — già indicizzato su Godot, non Three.js.


Priorità di harvest consigliata
PrioritàRepoMotivo🔴 Altapmndrs/postprocessingEffectComposer è il cuore del gap G.4; se non nel KB è il più urgente🔴 AltaN8python/n8aoSSAO CC0, pattern riutilizzabile in ogni scena T09🟠 MediaFarazzShaikh/THREE-CustomShaderMaterialPattern per stylized rendering, copre sia toon che painterly🟠 MediaAmeobea/three-good-godraysGodrays chiavi-in-mano per T09 wow effect🟡 Bassagkjohnson/three-gpu-pathtracerPesante (path tracing real-time), utile solo per cinematic T09 preview — repo grande, estrai solo /src/materials/ e /src/uniforms/🟡 BassaAlchemist0823/three.quarksSe chunk nel KB già > 10, skippa⚪ Verifica primamanbust/three-js-toon-shaderControlla LICENSE file

Stima chunk aggiuntivi attesi
Harvest mirato su 5 repo (pmndrs/postprocessing, N8python/n8ao, FarazzShaikh/THREE-CustomShaderMaterial, Ameobea/three-good-godrays, squarefeet/ShaderParticleEngine): atteso +60–110 chunk su categoria D03 (shader/postprocessing) di Three.js. Costo classify stimato ~$0.04–0.06. Dimensioni repo: tutti < 50 MB eccetto three-gpu-pathtracer (~30 MB con examples).

Stato OSS Stride al 2026 (≤100 parole)
Stride 4.3 è uscito a novembre 2025 con la stride3d organization ancora attiva. Il repo stride-community-toolkit è in sviluppo attivo, ma si tratta di utility wrapper, non di pattern di gioco riutilizzabili. Non sono emersi — nei risultati di ricerca 2024–2026 — nuovi progetti OSS permissivi di terze parti fuori dalla stride3d organization con pattern gameplay sufficientemente generici (combat, AI, dialogue, save). La situazione strutturale del gap G.3 rimane invariata: l'ecosistema OSS harvestabile è ancora limitato ai ~6 repo originali già processati. Decisione G.3 (Stride = beta) confermata. WikipediaGitHub