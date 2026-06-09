/**
 * FASE 3 Part 2 — the deterministic half of prompt→GameSpec. The LLM call
 * (proposeDesign) is exercised live by scripts/verify/prompt_to_game.ts; here we
 * test designToGameSpec: a compact brief expands into a renderable GameSpec, and
 * the genre drives the archetype (the LLM's choice = a different game shape).
 */
import { describe, it, expect } from "vitest";

import { designToGameSpec } from "../from-prompt.js";
import { composeFor } from "../index.js";

describe("designToGameSpec (brief → renderable GameSpec)", () => {
    it("a platformer genre → a side_scroller spec that composes (hard bumps speed)", () => {
        const spec = designToGameSpec({ genre: "hardcore_platformer", title: "X", theme: "forest", difficulty: "hard" }, "phaser");
        expect(spec.archetype).toBe("side_scroller_platform");
        expect(spec.world.solid_tiles?.length).toBeGreaterThan(0);
        expect(spec.physics.move_speed).toBeGreaterThan(300); // hard = ×1.15
        expect(spec.meta.title).toBe("X");
        expect(() => composeFor(spec)).not.toThrow();
    });

    it("a top-down genre → a top_down_grid spec with no gravity", () => {
        const spec = designToGameSpec({ genre: "roguelike", title: "Y", theme: "dungeon", difficulty: "normal" }, "godot");
        expect(spec.archetype).toBe("top_down_grid");
        expect(spec.physics.gravity).toBe(0);
        expect(() => composeFor(spec)).not.toThrow();
    });
});
