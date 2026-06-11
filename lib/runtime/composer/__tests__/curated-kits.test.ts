import { describe, it, expect } from "vitest";

import { pickKit, CURATED_KITS } from "../curated-kits.js";

describe("pickKit", () => {
    it("matches a forest theme → the dark-forest-fantasy kit", () => {
        expect(pickKit("a haunted forest")?.id).toBe("dark-forest-fantasy");
        expect(pickKit("Spooky Woods at night")?.id).toBe("dark-forest-fantasy");
    });

    it("no matching theme → null (falls back to the CC0 resolver)", () => {
        expect(pickKit("lava cave")).toBeNull();
        expect(pickKit("space station")).toBeNull();
    });

    it("every kit is complete: 3 assets, each with a url + license", () => {
        for (const k of CURATED_KITS) {
            for (const a of [k.character, k.tileset, k.background]) {
                expect(a.download_url).toMatch(/^https?:\/\//);
                expect(a.license).toBeTruthy();
                expect(a.asset_library_id).toMatch(/^[0-9a-f-]{36}$/);
            }
        }
    });
});
