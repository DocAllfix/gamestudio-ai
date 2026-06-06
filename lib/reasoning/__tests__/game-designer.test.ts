import { describe, expect, it, vi, beforeEach } from "vitest";

// The designer calls the LLM router; mock it so the test is offline.
vi.mock("../../llm/router.js", () => ({ complete: vi.fn() }));
import { complete } from "../../llm/router.js";
import { designFromBrief, GameDesignDocSchema } from "../game-designer.js";

const VALID_DOC = {
    title: "Coin Rush",
    genre: "hardcore_platformer",
    difficulty: "balanced",
    pitch: "Sprint through crumbling ruins grabbing coins before the floor falls.",
    mechanics: ["double jump", "coin combo multiplier", "wall slide"],
    gameplay_loop: "Run right, chain coins for a multiplier, avoid the collapsing floor, reach the exit.",
    mood: "warm sunset palette, golden coins, dusty ruins",
    win_condition: "Reach the exit with the target coin count.",
    lose_condition: "Fall off-screen or get crushed by the collapsing floor.",
    protagonist_brief: "nimble fox explorer with a satchel, 16x16 pixel sprite",
    music_brief: "upbeat chiptune, 140bpm, adventurous",
    code_brief: "platformer controller with double jump, coin pickups, and a scrolling collapse hazard",
    confidence_score: 88,
    insufficient_brief: false,
};

beforeEach(() => vi.mocked(complete).mockReset());

describe("designFromBrief", () => {
    it("returns a schema-valid design doc on a good LLM response", async () => {
        vi.mocked(complete).mockResolvedValue({ output: VALID_DOC } as never);
        const doc = await designFromBrief("a platformer where you collect coins");
        expect(doc).not.toBeNull();
        expect(GameDesignDocSchema.safeParse(doc).success).toBe(true);
        expect(doc!.genre).toBe("hardcore_platformer");
        expect(doc!.mechanics.length).toBeGreaterThan(0);
    });

    it("falls back to null on an empty brief without calling the LLM", async () => {
        const doc = await designFromBrief("   ");
        expect(doc).toBeNull();
        expect(complete).not.toHaveBeenCalled();
    });

    it("falls back to null when the LLM output is null (router degraded)", async () => {
        // The router returns {output:null} when it degrades; the doc validation
        // fails → null, same path as an LLM error (which the catch also nulls).
        vi.mocked(complete).mockResolvedValue({ output: null } as never);
        const doc = await designFromBrief("a roguelike");
        expect(doc).toBeNull();
    });

    it("falls back to null when the model flags an insufficient brief", async () => {
        vi.mocked(complete).mockResolvedValue({
            output: { ...VALID_DOC, insufficient_brief: true, confidence_score: 10 },
        } as never);
        const doc = await designFromBrief("asdf");
        expect(doc).toBeNull();
    });

    it("falls back to null on a malformed (non-enum genre) response", async () => {
        vi.mocked(complete).mockResolvedValue({
            output: { ...VALID_DOC, genre: "not_a_real_genre" },
        } as never);
        const doc = await designFromBrief("a game");
        expect(doc).toBeNull();
    });
});
