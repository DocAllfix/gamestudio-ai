import { describe, it, expect, afterEach } from "vitest";

import { buildExecutionDag } from "../dag-builder.js";

const base = { style_pack_id: "x", difficulty: "balanced" } as const;

describe("buildExecutionDag — composer pipeline (FASE 3.2)", () => {
    afterEach(() => {
        delete process.env.COMPOSER_PIPELINE;
    });

    it("flag ON + godot + 2D-spatial genre → ONE compose node, no code_gen / sprite_gen", () => {
        process.env.COMPOSER_PIPELINE = "true";
        const { nodes } = buildExecutionDag({ genre: "hardcore_platformer", engine: "godot", ...base });
        expect(nodes).toHaveLength(1);
        expect(nodes[0].tool_id).toBe("compose_gamespec");
        expect(nodes.some((n) => n.tool_id.startsWith("code_gen"))).toBe(false);
        expect(nodes.some((n) => n.tool_id === "sprite_gen")).toBe(false);
    });

    it("flag OFF → the existing code_gen pipeline, unchanged", () => {
        const { nodes } = buildExecutionDag({ genre: "hardcore_platformer", engine: "godot", ...base });
        expect(nodes.some((n) => n.tool_id.startsWith("code_gen"))).toBe(true);
        expect(nodes.some((n) => n.tool_id === "compose_gamespec")).toBe(false);
    });

    it("flag ON but non-spatial genre → NOT composed (old pipeline)", () => {
        process.env.COMPOSER_PIPELINE = "true";
        const { nodes } = buildExecutionDag({ genre: "visual_novel", engine: "godot", ...base });
        expect(nodes.some((n) => n.tool_id === "compose_gamespec")).toBe(false);
        expect(nodes.some((n) => n.tool_id.startsWith("code_gen"))).toBe(true);
    });

    it("flag ON but phaser → NOT composed (Godot-only for now)", () => {
        process.env.COMPOSER_PIPELINE = "true";
        const { nodes } = buildExecutionDag({ genre: "hardcore_platformer", engine: "phaser", ...base });
        expect(nodes.some((n) => n.tool_id === "compose_gamespec")).toBe(false);
    });
});
