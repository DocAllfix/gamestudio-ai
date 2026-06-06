import { describe, expect, it, vi } from "vitest";
import { referenceGroundingFor, type ReferenceGamesDeps } from "../reference-games.js";

const rows = [
    {
        title: "Celeste-like",
        genre_tags: ["hardcore_platformer"],
        notable_features: ["tight controls"],
        visual_analysis: {
            mood: "melancholic",
            art_direction: "pixel art",
            dominant_palette: ["#A8D8D0", "#4A7C9D"],
            notable_visual_elements: ["snowy peaks", "dash trails"],
        },
    },
];

describe("referenceGroundingFor", () => {
    it("builds a compact grounding block from genre-matched games", async () => {
        const deps: ReferenceGamesDeps = { fetchByGenre: vi.fn(async () => rows) };
        const out = await referenceGroundingFor("hardcore_platformer", deps);
        expect(out).toContain("Celeste-like");
        expect(out).toContain("melancholic");
        expect(out).toContain("#A8D8D0");
        // It frames references as inspiration, not a copy directive.
        expect(out.toLowerCase()).toContain("don't copy");
    });

    it("returns empty string when no references match (designer still runs)", async () => {
        const deps: ReferenceGamesDeps = { fetchByGenre: vi.fn(async () => []) };
        expect(await referenceGroundingFor("card_game", deps)).toBe("");
    });

    it("returns empty string on a fetch failure (graceful degradation)", async () => {
        const deps: ReferenceGamesDeps = {
            fetchByGenre: vi.fn(async () => {
                throw new Error("db down");
            }),
        };
        // A throwing dep must never crash the design step — it degrades to "".
        expect(await referenceGroundingFor("jrpg", deps)).toBe("");
    });
});
