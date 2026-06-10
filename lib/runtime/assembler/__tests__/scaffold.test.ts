import { describe, it, expect } from "vitest";
import { scaffoldProject, sanitizeGodot4 } from "../scaffold.js";
import { buildFallbackSpec } from "../../composer/fallback-spec.js";
import type { AssemblerInput } from "../../../contracts/assembly-pipeline.contract.js";

type ToolOutputs = AssemblerInput["tool_outputs"];

const codeNode = (toolId: string, code: string): ToolOutputs[string] => ({
    tool_id: toolId,
    files: [{ path: "main", content: code, encoding: "utf-8" }],
});

describe("scaffoldProject", () => {
    it("godot: produces a buildable project (project.godot + Web preset + main scene)", () => {
        const outputs: ToolOutputs = {
            n1: codeNode("code_gen_godot_gdscript", "extends Node2D\nfunc _ready(): pass"),
        };
        const files = scaffoldProject("godot", outputs);
        const paths = files.map((f) => f.path);
        expect(paths).toContain("/project/project.godot");
        expect(paths).toContain("/project/export_presets.cfg");
        expect(paths).toContain("/project/main.tscn");
        expect(paths).toContain("/project/main.gd");

        const preset = files.find((f) => f.path === "/project/export_presets.cfg");
        expect(preset?.content).toContain('platform="Web"');
        const gd = files.find((f) => f.path === "/project/main.gd");
        expect(gd?.content).toContain("extends Node2D");
    });

    it("godot: forces the main script to extend Node2D (matches main.tscn)", () => {
        // The .tscn mounts the script on a Node2D; a script extending anything
        // else (or nothing → RefCounted) fails to instance → grey screen.
        const cases = [
            ["extends RefCounted\nfunc _init(): pass", "extends Node2D"],
            ["func _ready(): pass", "extends Node2D"], // no extends → prepended
            ["extends Node2D\nfunc _ready(): pass", "extends Node2D"], // kept
        ];
        for (const [input, mustContain] of cases) {
            const files = scaffoldProject("godot", { n1: codeNode("code_gen_godot_gdscript", input) });
            const gd = files.find((f) => f.path === "/project/main.gd");
            expect(gd?.content.startsWith(mustContain)).toBe(true);
            expect(gd?.content).not.toContain("extends RefCounted");
        }
    });

    it("godot: empty/no-game code falls back to the guaranteed-playable template", () => {
        // The "100% playable" net: when code_gen produced nothing usable (LLM
        // 402, exception, all heals failed), the scaffold must NOT ship a bare
        // `extends Node2D` (empty scene → grey). It substitutes a real game.
        for (const empty of ["", "extends Node2D", "extends Node2D\n\n", "   "]) {
            const files = scaffoldProject("godot", { n1: codeNode("code_gen_godot_gdscript", empty) });
            const gd = files.find((f) => f.path === "/project/main.gd");
            expect(gd?.content).toContain("func _ready");
            expect(gd?.content).toContain("func _physics_process");
            expect(gd?.content).toContain("__GS__"); // publishes state → passes the gate
        }
    });

    it("godot fallback is now COMPOSED (declarative scene + real level), not bare", () => {
        // FASE 3: the fallback is the composer, not a hand-written template.
        const files = scaffoldProject("godot", { n1: codeNode("code_gen_godot_gdscript", "") });
        const tscn = files.find((f) => f.path === "/project/main.tscn");
        expect(tscn?.content).toContain('type="CharacterBody2D"'); // a composed Player node
        const gd = files.find((f) => f.path === "/project/main.gd");
        expect(gd?.content).toContain("const SOLID"); // the real level grid from the composer
    });

    it("FASE 3.2: a gamespec.json → COMPOSED scene (not code_gen) + carries assets", () => {
        const spec = buildFallbackSpec("godot"); // any valid GameSpec
        const outputs: ToolOutputs = {
            compose: {
                tool_id: "compose_gamespec",
                files: [
                    { path: "gamespec.json", content: JSON.stringify(spec), encoding: "utf-8" },
                    { path: "/project/assets/sprites/sprite_gen.png", content: "https://r2/hero.png", encoding: "url-ref" },
                ],
            },
        };
        const files = scaffoldProject("godot", outputs);
        const tscn = files.find((f) => f.path === "/project/main.tscn");
        expect(tscn?.content).toContain('type="CharacterBody2D"'); // a composed Player node, not the bare scene
        const paths = files.map((f) => f.path);
        expect(paths).toContain("/project/assets/sprites/sprite_gen.png"); // resolved asset carried to res://
        expect(paths).not.toContain("gamespec.json"); // the marker itself is not shipped
    });

    it("phaser fallback composes a real scene when there's no usable code", () => {
        const files = scaffoldProject("phaser", { n1: codeNode("code_gen_phaser_js", "") });
        const js = files.find((f) => f.path === "/project/src/main.js");
        expect(js?.content).toContain("class MainScene extends Phaser.Scene");
        expect(js?.content).toContain("window.__GAME_STATE__"); // playable gate signal
        expect(files.map((f) => f.path)).toContain("/project/dist/index.html");
    });

    it("sanitizeGodot4: rewrites the common Godot 3 → 4 patterns", () => {
        expect(sanitizeGodot4("onready var p = 1")).toContain("@onready var p");
        expect(sanitizeGodot4("export var hp = 100")).toContain("@export var hp");
        expect(sanitizeGodot4("var b = KinematicBody2D.new()")).toContain("CharacterBody2D");
        expect(sanitizeGodot4("var s = Sprite.new()")).toContain("Sprite2D.new()");
        expect(sanitizeGodot4("r.rect_position = Vector2()")).toContain(".position");
        expect(sanitizeGodot4("c.color = Color.red")).toContain("Color.RED");
        expect(sanitizeGodot4("var n = scene.instance()")).toContain(".instantiate()");
        // Already-correct Godot 4 is left untouched.
        expect(sanitizeGodot4("@onready var p = 1")).toBe("@onready var p = 1");
    });

    it("phaser: code becomes the esbuild entry and an index.html is added", () => {
        const files = scaffoldProject("phaser", { n1: codeNode("code_gen_phaser_js", "new Phaser.Game({})") });
        const paths = files.map((f) => f.path);
        expect(paths).toContain("/project/src/main.js");
        expect(paths).toContain("/project/dist/index.html");
        const entry = files.find((f) => f.path === "/project/src/main.js");
        expect(entry?.content).toContain("Phaser.Game");
    });

    it("babylon: TS entry (not .js)", () => {
        const files = scaffoldProject("babylon", { n1: codeNode("code_gen_babylon_ts", "const x = 1") });
        expect(files.map((f) => f.path)).toContain("/project/src/main.ts");
    });

    it("defold: produces game.project + bootstrap collection + script", () => {
        const files = scaffoldProject("defold", { n1: codeNode("code_gen_defold_lua", "function init(self) end") });
        const paths = files.map((f) => f.path);
        expect(paths).toContain("/project/game.project");
        expect(paths).toContain("/project/main/main.collection");
        expect(paths).toContain("/project/main/main.script");
    });

    it("carries asset url-refs through alongside the project", () => {
        const outputs: ToolOutputs = {
            n1: codeNode("code_gen_phaser_js", "game()"),
            n2: {
                tool_id: "sprite_gen",
                files: [{ path: "/project/assets/sprites/hero.png", content: "https://r2/hero.png", encoding: "url-ref" }],
            },
        };
        const files = scaffoldProject("phaser", outputs);
        const asset = files.find((f) => f.path === "/project/assets/sprites/hero.png");
        expect(asset?.encoding).toBe("url-ref");
        expect(asset?.content).toBe("https://r2/hero.png");
    });

    it("rejects a non-day-1 engine with no adapter", () => {
        expect(() => scaffoldProject("renpy" as never, {})).toThrow(/no scaffold/);
    });
});
