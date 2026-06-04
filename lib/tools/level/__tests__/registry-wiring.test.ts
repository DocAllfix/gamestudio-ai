/**
 * Registry wiring — the 5 map-gen tools are dispatchable.
 */
import { describe, expect, it } from "vitest";

import { isImplemented } from "../../registry.js";

describe("map-gen tools registered", () => {
    it.each([
        "level_layout_2d",
        "tilemap_populate",
        "entity_placement",
        "level_layout_3d",
        "heightmap_gen",
    ] as const)("%s is implemented", (id) => {
        expect(isImplemented(id)).toBe(true);
    });
});
