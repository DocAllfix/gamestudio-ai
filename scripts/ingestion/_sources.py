"""Data sources for the GitHub scraper (Fase 1).

Lives alongside 01_scrape.py only because these tables are large and would
push the script over the 400-line file-size budget in CLAUDE.md. The
content is canonical reference data, not logic — every value here is
documented in docs/SUPREME_RAG_BLUEPRINT.md §02.2.
"""
from __future__ import annotations

SEARCH_QUERIES: dict[str, list[str]] = {
    "godot": [
        "godot 4 platformer",
        "godot 4 metroidvania",
        "godot roguelike",
        "godot rpg top-down",
        "godot action 2d",
        "godot puzzle",
        "godot horror",
        "godot game jam",
        "godot demo project",
        "godot 4 shooter",
        "godot 4 fps",
        "godot multiplayer",
        "godot shader",
        "godot 4 3d",
        "godot survival",
        "godot stealth",
        "godot card game",
        "godot tower defense",
        "godot bullet hell",
        "gdextension",
        "topic:godot-4 topic:game",
        "topic:godot topic:platformer",
        "topic:godot topic:roguelike",
    ],
    "phaser": [
        "phaser 3 game",
        "phaser platformer",
        "phaser puzzle html5",
        "phaser arcade",
        "phaser rpg",
        "phaser game jam",
        "phaser tower defense",
        "phaser endless runner",
        "phaser shooter",
        "phaser match-3",
        "phaser racing",
        "phaser multiplayer",
        "phaser bullet hell",
        "phaser tile",
        "phaser io game",
        "topic:phaser3 topic:game",
        "topic:phaser topic:html5-game",
        # Fase 1ter P1 — target the C03 (dialogue/narrative) and C04
        # (save/load) cells that are empty for Phaser.
        "phaser visual novel",
        "phaser dialogue system",
        "phaser text adventure",
        "phaser adventure game",
        "phaser save load localstorage",
        "phaser inventory rpg",
    ],
    "renpy": [
        "renpy visual novel",
        "renpy dating sim",
        "renpy game",
        "renpy horror",
        "renpy mystery",
        "renpy jam",
        "renpy tutorial",
        "renpy choices branching",
        "renpy otome",
        "renpy short story",
        "topic:renpy topic:visual-novel",
        "topic:renpy topic:game",
    ],
    "defold": [
        "defold game",
        "defold mobile",
        "defold puzzle",
        "defold platformer",
        "defold arcade",
        "defold shooter",
        "defold tutorial",
        "defold sample",
        "defold demo",
        "defold lua game",
        "defold mobile game",
        "defold gui",
        "defold extension",
        "defold rpg",
        "defold roguelike",
        "topic:defold topic:game",
        "topic:defold-engine",
    ],
    "monogame": [
        "monogame game",
        "monogame platformer",
        "monogame xna sample",
        "monogame rpg",
        "monogame tutorial",
        "monogame demo",
        "monogame shooter",
        "monogame roguelike",
        "FNA game",
        "monogame 2d engine",
        "monogame 2d game",
        "monogame multiplayer",
        "monogame puzzle",
        "topic:monogame topic:game",
        "topic:monogame topic:csharp",
        # Fase 1ter P1 — target the C01 (progression) and C03 (dialogue)
        # cells that are empty for MonoGame.
        "monogame jrpg",
        "monogame dialogue system",
        "monogame leveling experience system",
        "monogame inventory rpg",
        "monogame visual novel",
    ],
    "love2d": [
        "love2d game",
        "love2d platformer",
        "love game lua",
        "löve game",
        "love2d rpg",
        "love2d shooter",
        "love2d tutorial",
        "love2d roguelike",
        "love2d puzzle",
        "love2d arcade",
        "love2d engine",
        "love2d minigame",
        "love2d jam",
        "love2d demo",
        "love2d entity component",
        "lua love game",
        "topic:love2d topic:game",
        "topic:love2d topic:lua",
    ],
    "threejs": [
        "three.js game",
        "threejs game 3d browser",
        "three.js shooter",
        "three.js racing",
        "three.js platformer 3d",
        "three.js fps",
        "three.js demo game",
        "three.js endless runner",
        "three.js puzzle 3d",
        "webgl game three",
        "three.js minecraft",
        "three.js cannon physics",
        "three.js rapier",
        "three.js multiplayer",
        "three.js shader game",
        "three.js space game",
        "three.js infinite runner",
        "topic:threejs topic:game",
        "topic:three-js topic:game",
    ],
    "stride": [
        "stride engine game",
        "stride3d game",
        "stride3d sample",
        "stride3d demo",
        "stride engine tutorial",
        "stride3d platformer",
        "stride3d fps",
        "xenko game",
        "stride 3d engine",
        "stride3d csharp",
        "topic:stride3d",
        "topic:stride-engine",
    ],
}

AWESOME_LISTS: dict[str, list[str]] = {
    "godot":    ["https://raw.githubusercontent.com/godotengine/awesome-godot/master/README.md"],
    "phaser":   ["https://raw.githubusercontent.com/Raiper34/awesome-phaser3/master/README.md"],
    "monogame": ["https://raw.githubusercontent.com/aloisdeniel/awesome-monogame/master/README.md"],
    "love2d":   ["https://raw.githubusercontent.com/love2d-community/awesome-love2d/master/README.md"],
    "renpy":    ["https://raw.githubusercontent.com/tom-overton/awesome-renpy/main/README.md"],
    "defold":   ["https://raw.githubusercontent.com/Lerg/awesome-defold/master/README.md"],
    "threejs":  [],
    "stride":   [],
}

OFFICIAL_SAMPLES: dict[str, list[str]] = {
    "godot": [
        "https://github.com/godotengine/godot-demo-projects",
        "https://github.com/GDQuest/godot-2d-platformer-demo",
        "https://github.com/GDQuest/learn-gdscript",
    ],
    "phaser": [
        "https://github.com/photonstorm/phaser3-examples",
        "https://github.com/phaserjs/template-vite",
    ],
    "renpy": [
        "https://github.com/renpy/renpy",
    ],
    "defold": [
        "https://github.com/defold/defold-examples",
    ],
    "monogame": [
        "https://github.com/MonoGame/MonoGame.Samples",
    ],
    "love2d": [],
    "threejs": [
        "https://github.com/mrdoob/three.js",
    ],
    "stride": [
        "https://github.com/stride3d/stride",
    ],
}

TOPIC_QUERIES: dict[str, list[str]] = {
    "godot":    ["godot-4", "godot-engine", "gdscript"],
    "phaser":   ["phaser3", "phaserjs", "phaser-3"],
    "renpy":    ["renpy", "visual-novel", "ren-py"],
    "defold":   ["defold", "defold-engine"],
    "monogame": ["monogame", "xna-framework"],
    "love2d":   ["love2d", "love-2d"],
    "threejs":  ["threejs", "three-js", "webgl-game"],
    "stride":   ["stride3d", "stride-engine"],
}


HARVEST_ORGS: dict[str, list[str]] = {
    "godot":    ["godotengine", "GDQuest", "KoBeWi", "nathanhoad", "heartbeast",
                 "uheartbeast", "MakerTech"],
    "phaser":   ["phaserjs", "photonstorm", "samme", "rexrainbow"],
    "renpy":    ["renpy"],
    "defold":   ["defold", "britzl", "subsoap", "selimanac"],
    "monogame": ["MonoGame", "FNA-XNA"],
    "love2d":   ["rxi", "love2d-community", "Ulydev", "1bardesign", "Beelz"],
    "threejs":  ["mrdoob", "donmccurdy", "felixmariotto"],
    "stride":   ["stride3d"],
}


SUBDIR_EXPANSIONS: dict[str, str] = {
    # parent_repo_html_url -> glob anchor (relative to repo root). The glob
    # matches a marker file proving the subdir is a real project for that
    # engine, then we extract `match.parent` as the synthetic project root.
    "https://github.com/mrdoob/three.js":                 "examples/*.html:file",
    "https://github.com/godotengine/godot-demo-projects": "**/project.godot",
    "https://github.com/phaserjs/examples":               "public/src/*/",
    "https://github.com/defold/defold-examples":          "**/game.project",
    "https://github.com/stride3d/stride":                 "samples/*/",
}


# Hand-vetted high-value repos: games or libraries known in the community as
# exemplary references. They are added to the manifest with `source="notable"`
# and `notable=True`, bypass `passes_basic_filters` (so license=NOASSERTION
# slips through), and are protected during the pre-clone curation pass.
NOTABLE_REPOS: dict[str, list[tuple[str, str]]] = {
    "godot": [
        ("GDQuest", "godot-2d-builder"),
        ("GDQuest", "godot-design-patterns"),
        ("GDQuest", "godot-procedural-generation"),
        ("uheartbeast", "Heart-Platformer-Godot-4"),
        ("nathanhoad", "godot_dialogue_manager"),
        ("SlayHorizon", "godot-tiny-mmo"),
    ],
    "phaser": [
        ("photonstorm", "phaser-ce"),
        ("phaserjs", "phaser"),
        ("sporadic-labs", "tile-extruder"),
        ("digitsensitive", "phaser3-typescript"),
        ("orange-games", "phaser-input"),
        # Fase 1ter P1 — RPG/dialogue reference. Size > curator cap but
        # licensed MIT and load-bearing for the C03/C04 cells.
        ("SkyAlpha", "luminus-rpg"),
    ],
    "renpy": [
        ("renpy", "renpy"),
    ],
    "defold": [
        ("subsoap", "defos"),
        ("britzl", "platypus"),
        ("britzl", "monarch"),
        ("britzl", "defold-input"),
    ],
    "monogame": [
        ("MonoGame", "MonoGame.Samples"),
        ("FNA-XNA", "FNA"),
        ("mellinoe", "veldrid-samples"),
        ("craftworkgames", "MonoGame.Extended"),
        # Fase 1ter P1 — full-engine 2D framework, MIT, mid-size. Brings
        # ECS / dialogue / save patterns that the C01/C03 cells need.
        ("Martenfur", "Monofoxe"),
    ],
    "love2d": [
        ("Stabyourself", "mari0"),
        ("hawkthorne", "hawkthorne-journey"),
        ("Ulydev", "push"),
        ("bjornbytes", "lovr"),
        ("1bardesign", "batteries"),
        ("lume", "lume"),
    ],
    "threejs": [
        ("elalish", "manifold"),
        ("felixmariotto", "three-mesh-ui"),
        ("IceCreamYou", "THREE.Terrain"),
        ("schteppe", "cannon.js"),
    ],
    "stride": [
        ("stride3d", "stride-community-toolkit"),
    ],
}


CURATED_REPOS: dict[str, list[tuple[str, str]]] = {
    "godot": [
        ("godotengine", "godot-demo-projects"),
        ("godotengine", "godot"),
        # Fase 1quater — Gemini Deep Research, verified MIT, fill niche gaps.
        ("Inglo-Games", "StealthDemo"),            # stealth (zero genre)
        ("NoisyChain", "Sakuga-Engine"),           # fighting (zero genre)
        ("MiniDigger", "ProjectTD-Godot"),         # tower_defense
        ("jeremy-miller", "godot-tower-defense"),  # tower_defense
        ("kiwijuice56", "biocyte-defenders"),      # tower_defense 3D
        ("ectucker1", "EctGodotUtils"),            # hit_stop
        ("elgatopanzon", "deus-breakout"),         # hit_stop (ECS)
        ("yurukusa", "spell-cascade"),             # hit_stop
        ("Nintorch", "Godotzilla"),                # boss_phase
        ("itsantonle", "Godot-Mini-Projects"),     # boss_phase
        ("HermeticOrmus", "claude-code-game-development"),  # boss_phase
        ("MarekZdun", "godot-audio-manager"),      # footstep_system
        ("bbbscarter", "event-audio-godot"),       # footstep_system
        # Fase 2 Resource Hunt (2026-05-24) — license verified via gh API.
        ("EladKarni", "godot4-2d-platformer-template"),    # MIT, coyote/jump-buffer
        ("GreenCloversGames", "Scalable-Platformer-Template"),  # MIT
        ("bitbrain", "pandora"),                   # MIT, RPG data addon (T05/T08)
        ("newold3", "Godot-RPG-Creator"),          # MIT, RPG editor (T05)
        ("tuananhcn", "Turn-Base-RPG"),            # MIT, turn-based (T05)
        ("Ziden", "godot-turn-based-rpg"),         # MIT, combat resolver (T05)
        ("krazyjakee", "DungeonTemplateLibrary-Godot"),  # MIT, BSP dungeon (T08)
        ("statico", "godot-roguelike-example"),    # MIT, BSP+behavior trees (T08)
        ("RGonzalezTech", "Friendslop-Template"),  # MIT, multiplayer (T11)
        ("heroiclabs", "nakama-project-template"), # Apache-2.0, server scaffold (T11)
        ("code-forge-temple", "local-llm-npc"),    # CC-BY-4.0, Ollama NPC C# (T12)
        ("nthnn", "noko"),                         # MIT, Ollama plugin GDScript (T12)
        ("af009", "fuku"),                         # MIT, multi-provider AI (T12)
        ("glennDittmann", "godot-pixel-art-template"),  # MIT, pixel config (T14)
        ("MaxiimPetrov", "Divine-Retribution-8-bit-Project"),  # MIT, retro (T14)
        ("ahopness", "GodotRetro"),                # CC0, 22 retro shaders (T14)
    ],
    "phaser":   [
        ("phaserjs", "examples"),
        # Fase 1ter P1 — RPG/dialogue/save reference projects.
        ("photonstorm", "phaser3-examples"),
        # Fase 1quater — Gemini Deep Research, verified MIT/Apache.
        ("ikraamg", "ForestRPG"),                  # jrpg
        ("Zbyron", "phaser-rpg-battlesystem"),     # jrpg turn-based
        ("juwalbose", "phaser3_visualnovelengine"),# C03 dialogue / VN
        ("mikewesthad", "navmesh"),                # B04 navigation (377 stars)
        ("Jerenaux", "pathfinding_tutorial"),      # B04 navigation
        ("RaresAil", "phaser-pathfinding"),        # B04 navigation
        # Fase 2 Resource Hunt (2026-05-24) — verified MIT via gh API.
        ("remarkablegames", "phaser-platformer"),  # MIT, Arcade physics (T04)
    ],
    "renpy": [
        ("renpy", "renpy"),
        # Fase 2 Resource Hunt — verified MIT via gh API.
        ("remarkablegames", "renpy-template"),     # MIT, CI workflow (T02)
    ],
    "defold":   [
        ("defold", "defold"),
        # Fase 2 Resource Hunt — verified MIT via gh API.
        ("Lerg", "match3swipe"),                   # MIT, swipe match-3 (T03)
    ],
    "monogame": [
        ("MonoGame", "MonoGame"),
        # Fase 1ter P1 — MonoGame.Extended ships Scene/Tiled/ECS + RPG bits.
        ("craftworkgames", "MonoGame.Extended"),
        # Fase 2 Resource Hunt — verified MIT via gh API.
        ("endrealm", "Monogame-Platformer-Example"),  # MIT, LDtk parsing (T07)
        ("jlauener", "MonoPunk"),                  # MIT, pixel-perfect 2D (T07)
        ("DreamyStranger", "MonoGame-Platformer"), # MIT, OOP+component (T07)
    ],
    "love2d":   [
        ("love2d", "love"),
        # Fase 1quater — Gemini Deep Research, verified MIT.
        ("srijan-paul", "shriek"),                 # horror (zero genre)
        ("ActivexDiamond", "gophwar"),             # tower_defense
        # Fase 2 Resource Hunt — verified MIT via gh API.
        ("Cod-e-Codes", "CardGame"),               # MIT, card+AI (T06)
        ("heisenberg23911", "CardGame"),           # MIT, multi-scene card (T06)
        ("srijan-paul", "bullet_hell"),            # MIT, ECS bullet hell (T13)
    ],
    "threejs":  [
        ("mrdoob", "three.js"),
        # Fase 2 Resource Hunt — verified via gh API, closes G.4 postprocessing.
        ("pmndrs", "postprocessing"),              # Zlib, EffectComposer (T09)
        ("N8python", "n8ao"),                      # CC0, SSAO drop-in (T09)
        ("FarazzShaikh", "THREE-CustomShaderMaterial"),  # MIT, toon/stylized (T09)
        ("Ameobea", "three-good-godrays"),         # Zlib (file LICENSE), godrays (T09)
        ("gkjohnson", "three-gpu-pathtracer"),     # MIT, DoF/LUT cinematic (T09)
        ("squarefeet", "ShaderParticleEngine"),    # MIT, GLSL particles (T09/T13)
    ],
    "stride":   [("stride3d", "stride")],
}


LICENSE_BYPASS_ORGS: set[str] = {
    "renpy", "godotengine", "GDQuest", "phaserjs", "photonstorm",
    "stride3d", "MonoGame", "defold", "britzl", "rxi", "mrdoob",
    "Stabyourself", "hawkthorne", "FNA-XNA", "nathanhoad",
    "uheartbeast", "KoBeWi", "SlayHorizon", "sporadic-labs",
    "digitsensitive", "orange-games", "subsoap", "selimanac",
    "Ulydev", "bjornbytes", "1bardesign", "lume", "Beelz",
    "elalish", "felixmariotto", "IceCreamYou", "schteppe",
    "mellinoe", "craftworkgames", "donmccurdy", "samme",
    "rexrainbow", "heartbeast", "MakerTech",
}


# Maps repo.language to our engine bucket. Used to weed out false positives
# (a "godot platformer" query returning a JS clone of a Godot game).
ENGINE_LANGUAGES: dict[str, set[str]] = {
    "godot":    {"gdscript", "godot script"},
    "phaser":   {"javascript", "typescript"},
    "renpy":    {"renpy", "ren'py", "python"},
    "defold":   {"lua"},
    "monogame": {"c#"},
    "love2d":   {"lua"},
    "threejs":  {"javascript", "typescript"},
    "stride":   {"c#"},
}
