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
        "topic:phaser3 topic:game",
        "topic:phaser topic:html5-game",
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
        "topic:monogame topic:game",
        "topic:monogame topic:csharp",
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

# Maps repo.language to our engine bucket. Used to weed out false positives
# (a "godot platformer" query returning a JS clone of a Godot game).
ENGINE_LANGUAGES: dict[str, set[str]] = {
    "godot":    {"gdscript", "godot script"},
    "phaser":   {"javascript", "typescript"},
    "renpy":    {"renpy", "python"},
    "defold":   {"lua"},
    "monogame": {"c#"},
    "love2d":   {"lua"},
    "threejs":  {"javascript", "typescript"},
    "stride":   {"c#"},
}
