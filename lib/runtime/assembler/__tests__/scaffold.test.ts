import { describe, it, expect } from "vitest";
import { scaffoldProject } from "../scaffold.js";
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
