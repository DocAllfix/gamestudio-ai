/**
 * Curated kits (FASE 4 — the asset moat, first slice). A kit is a COHERENT set of
 * assets — character + tileset + background — that we have HAND-VERIFIED clean,
 * with KNOWN metadata (frame layout, tile size). The composer renders a kit
 * perfectly: no detection guessing → no animation flicker, right size, one style.
 *
 * This is the hand-curated CC0/CC-BY version ("CC0 premium che possediamo noi").
 * The generated/owned library (FLUX + character coherence, batch-curated) is the
 * later expansion that rides on the SAME composer/detector tooling; the CLIP +
 * palette automation scales the curation. For now: a small, verified set.
 *
 * Each character is a SINGLE sprite (frame: null) → rendered whole + static, so it
 * can never blink out mid-walk (the flicker arbitrary catalog sheets cause).
 * Animated kits (a known walk row) come with the curated library.
 */
import type { FrameMeta } from "../../contracts/game-spec.contract.js";

interface KitAsset {
    asset_library_id: string;
    download_url: string;
    license: string;
}

export interface CuratedKit {
    id: string;
    /** Lowercase theme tags — a design theme/mood that CONTAINS any tag picks this kit. */
    themes: string[];
    character: KitAsset & { frame: FrameMeta | null };
    tileset: KitAsset & { tile_px: number };
    background: KitAsset;
}

export const CURATED_KITS: CuratedKit[] = [
    {
        // Hand-verified 2026-06-11: bright pixel priestess (single, static) over a
        // dark forest with a grass platformer tileset — good contrast, all CC-BY-4.0.
        id: "dark-forest-fantasy",
        themes: ["forest", "haunted", "wood", "spooky", "dark", "fantasy", "medieval", "rpg", "witch", "gothic", "night", "fairy"],
        character: {
            asset_library_id: "1f385b18-f10a-44fb-9d0f-64fc9e2ed9fa",
            download_url: "https://opengameart.org/sites/default/files/16_3.png",
            license: "CC-BY-4.0",
            frame: null, // single sprite → whole image, static (no flicker)
        },
        tileset: {
            asset_library_id: "c8008c37-6b5d-4c25-aa96-58b7f2b929d7",
            download_url: "https://opengameart.org/sites/default/files/tilemap_.png",
            license: "CC-BY-4.0",
            tile_px: 16, // "Tileset Platformer 16px" — tile 0 is grass-topped ground
        },
        background: {
            asset_library_id: "f7cf9a60-6b90-4f59-91fe-a0a7c5352e73",
            download_url: "https://opengameart.org/sites/default/files/forest_back_550_x_400.png",
            license: "CC-BY-4.0",
        },
    },
];

/** The first kit whose theme tags match the design theme, or null (→ the CC0
 * resolver). Substring match so "a haunted forest" hits the "forest"/"haunted" tags. */
export function pickKit(theme: string): CuratedKit | null {
    const t = theme.toLowerCase();
    return CURATED_KITS.find((k) => k.themes.some((tag) => t.includes(tag))) ?? null;
}
