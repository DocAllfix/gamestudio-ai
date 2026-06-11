/**
 * Prompt → GameSpec (FASE 3, Part 2 tracer bullet). The LLM produces DATA, not
 * rendering code: a COMPACT design brief (genre / title / theme / difficulty),
 * which a DETERMINISTIC step expands into a full, renderable GameSpec. The
 * composer renders it. This is "the LLM produces the GameSpec" half of FASE 3 —
 * proven end-to-end (prompt → composed game) without the LLM ever writing a line
 * of engine code.
 *
 * The expensive/fragile work (scene composition, asset wiring, the huge
 * solid_tiles grid) stays deterministic; the LLM only chooses WHAT the game is.
 */
import { randomUUID } from "node:crypto";

import { z } from "zod";

import { GenreEnum } from "../../contracts/game-plan.contract.js";
import type { Engine } from "../../contracts/game-plan.contract.js";
import { GENRE_TO_ARCHETYPE } from "../../contracts/game-spec.contract.js";
import type { SideScrollerSpec, TopDownGridSpec } from "../../contracts/game-spec.contract.js";
import { complete } from "../../llm/router.js";
import { defaultMatchAssets, fetchAssetMeta } from "../../tools/asset-resolver/index.js";
import type { AssetMeta, MatchedAsset } from "../../tools/asset-resolver/index.js";
import { DEFAULT_PLATFORMER_PHYSICS } from "../../tools/level/_platformer-physics.js";
import { buildPlatformerLevel, buildTopDownRoom } from "./sample-level.js";

/** The compact design the LLM emits — WHAT the game is, not how to render it. */
export const DesignBriefSchema = z.object({
    genre: GenreEnum,
    title: z.string().min(1).max(60),
    theme: z.string().min(1).max(40),
    difficulty: z.enum(["easy", "normal", "hard"]),
});
export type DesignBrief = z.infer<typeof DesignBriefSchema>;

const SYSTEM =
    "You are a game designer. From the user's idea pick the single best fit and return JSON only:\n" +
    '{ "genre": one of [GENRES], "title": a short catchy title, "theme": one or two words ' +
    '(e.g. forest, dungeon, space, ruins), "difficulty": "easy" | "normal" | "hard" }.\n' +
    "Choose the genre that matches the idea; if unsure use hardcore_platformer.";

/** Call the LLM (gpt-4.1-mini via the OpenAI router path) → a validated brief. */
export async function proposeDesign(prompt: string): Promise<DesignBrief> {
    const res = await complete({
        model: "gpt-4.1-mini",
        system: SYSTEM.replace("GENRES", GenreEnum.options.join(", ")),
        user: prompt,
        response_schema: DesignBriefSchema,
        max_tokens: 200,
        temperature: 0.3,
        trace_id: `design_${randomUUID()}`,
    });
    return DesignBriefSchema.parse(res.output);
}

/** Deterministic expansion: a compact brief → a full, renderable GameSpec. The
 * composer-only archetypes (side_scroller / top_down) are built directly; any
 * other genre falls back to a platformer so it still renders. */
export function designToGameSpec(brief: DesignBrief, engine: Engine): SideScrollerSpec | TopDownGridSpec {
    const topDown = GENRE_TO_ARCHETYPE[brief.genre] === "top_down_grid";
    const W = 48, H = topDown ? 22 : 24, TILE = 16;
    const speed = brief.difficulty === "hard" ? 1.15 : brief.difficulty === "easy" ? 0.85 : 1;
    const solid = topDown
        ? buildTopDownRoom({ width: W, height: H })
        : buildPlatformerLevel({ width: W, height: H, tilePx: TILE, physics: DEFAULT_PLATFORMER_PHYSICS });

    const common = {
        meta: { project_id: "00000000-0000-4000-8000-000000000000", plan_version: 1, engine, style_pack_id: "pixel-art-dark", title: brief.title },
        world: { width_tiles: W, height_tiles: H, tile_px: TILE, tmj_path: "/p/level.tmj", tileset_slot: "tileset", solid_tiles: solid },
        player: { spawn_tile: { x: topDown ? 8 : 3, y: topDown ? 8 : H - 5 }, asset_slot: "sprite_gen", hitbox_px: { w: 30, h: 44 }, facing: "right" as const },
        entities: [],
        camera: { zoom: 1.3, deadzone_px: { w: 80, h: 60 }, follow: "player" as const, clamp_to_world: true },
        parallax: [],
        background: { asset_slot: "background", fill_mode: "stretch_cover" as const },
        hud: { elements: [{ type: "label" as const, text: brief.title }] },
        goal: { type: "reach_exit" as const, exit_tile: { x: W - 4, y: H - 4 } },
        mechanics: { flags: [], delta_script_path: null },
        asset_slots: [
            { slot: "background", role: "background" as const, binding: null, tile_size: null, frame: null, palette_hex: [], pixel_art: true },
            { slot: "tileset", role: "tileset" as const, binding: null, tile_size: TILE, frame: null, palette_hex: [], pixel_art: true },
            { slot: "sprite_gen", role: "character" as const, binding: null, tile_size: null, frame: null, palette_hex: [], pixel_art: true },
        ],
    };

    if (topDown) {
        return { archetype: "top_down_grid", ...common, physics: { gravity: 0, jump_velocity: 0, move_speed: Math.round(200 * speed) } } as TopDownGridSpec;
    }
    return {
        archetype: "side_scroller_platform", ...common,
        physics: { gravity: DEFAULT_PLATFORMER_PHYSICS.gravity, jump_velocity: DEFAULT_PLATFORMER_PHYSICS.jump_velocity, move_speed: Math.round(DEFAULT_PLATFORMER_PHYSICS.move_speed * speed) },
    } as SideScrollerSpec;
}

type Slot = SideScrollerSpec["asset_slots"][number];

// The style packs in the (frozen) catalog that have full cross-type coverage —
// background + tileset + single character. Anchoring the scene on one of them
// gives a COHERENT look (one style) instead of a painted bg + pixel tiles +
// sketch character. Recompute: unnest(style_pack_compat) grouped, HAVING a hit
// in each of background / tileset / sprite(single,alpha).
const COVERAGE_PACKS = new Set(["B01", "A01", "B03", "B04", "A06", "A08", "A05", "A03"]);

const themeQuery = {
    character: (t: string) => `${t} character hero creature sprite`,
    tileset: (t: string) => `${t} ground terrain tileset tiles`,
    background: (t: string) => `${t} background landscape sky scene`,
};

/** Catalog hits for a character slot often include scenery collections the vision
 * pass hasn't tagged yet → reject obvious non-characters by description too. */
const notCollection = (h: MatchedAsset): boolean =>
    !/collection|\bpack\b|\bset\b|trees|tiles|bundle|sheet of|assets/i.test(h.semantic_description);

function bindSlot(slot: Slot, a: MatchedAsset): void {
    // A catalog row can have a null download_url (the interface types it string,
    // the data doesn't always honour it) — binding it would emit a url-ref file
    // with null content and fail the AssemblerInput schema. Skip → placeholder.
    if (!a.download_url) return;
    slot.binding = {
        source: "catalog", slot: slot.slot, asset_library_id: a.id,
        download_url: a.download_url, license: a.license,
        attribution_required: false, creator_name: null,
    };
}

/** Resolve assets by theme AND coherence. The character is picked first — a
 * usable single sprite, PREFERRING one that lives in a full-coverage style pack —
 * and that pack anchors the tileset + background so the three slots share one
 * style. No coverage-pack character for the theme → best-per-slot (kind-filtered),
 * accepting mixed styles over an empty scene. */
export async function resolveSlots(spec: SideScrollerSpec | TopDownGridSpec, theme: string): Promise<void> {
    const slotOf = (name: string): Slot | undefined => spec.asset_slots.find((s) => s.slot === name);
    const charSlot = slotOf("sprite_gen"), tileSlot = slotOf("tileset"), bgSlot = slotOf("background");

    // 1) Character — also yields the anchor style for the rest of the scene.
    let anchor: string | undefined;
    if (charSlot) {
        const hits = await defaultMatchAssets({ description: themeQuery.character(theme), asset_type: "sprite", require_alpha: true });
        const meta = await fetchAssetMeta(hits.map((h) => h.id));
        const usable = hits.filter((h) => {
            const k = meta.get(h.id)?.sprite_kind;
            return k !== "object_pack" && k !== "non_asset" && notCollection(h);
        });
        const isSingle = (h: MatchedAsset) => meta.get(h.id)?.sprite_kind === "single";
        const inCov = (h: MatchedAsset) => (meta.get(h.id)?.style_pack_compat ?? []).some((s) => COVERAGE_PACKS.has(s));
        // Prefer a SINGLE sprite: it renders as a WHOLE image, dodging the fragile
        // sheet frame-detection that mis-slices arbitrary catalog sheets (an LPC
        // golem read as 64x128, a labelled hero sheet as 32x32) into a blank or
        // squished frame. Among singles prefer a coverage-pack one (style); then
        // any single; then a sheet; then anything usable.
        const best =
            usable.find((h) => isSingle(h) && inCov(h)) ??
            usable.find(isSingle) ??
            usable.find(inCov) ??
            usable[0];
        if (best) {
            bindSlot(charSlot, best);
            anchor = (meta.get(best.id)?.style_pack_compat ?? []).find((s) => COVERAGE_PACKS.has(s));
        }
    }

    // 2) Tileset + background — theme-FIRST, but prefer the anchor style when an
    //    in-style asset is ALSO a strong theme match (within the top hits). This
    //    keeps coherence without trading a lava tileset for an off-theme one just
    //    to match a (loose) style tag — theme fidelity wins on the CC0 catalog.
    const chooseStyled = (hits: MatchedAsset[], meta: Map<string, AssetMeta>, ok: (h: MatchedAsset) => boolean): MatchedAsset | undefined => {
        const themeBest = hits.find(ok);
        if (!anchor || !themeBest) return themeBest;
        const styled = hits.find((h) => ok(h) && (meta.get(h.id)?.style_pack_compat ?? []).includes(anchor));
        // Use the in-style asset only when it's NEARLY as good a theme match —
        // never trade a lava tileset for a garden one just to match the tag.
        return styled && styled.similarity >= themeBest.similarity - 0.03 ? styled : themeBest;
    };
    if (tileSlot) {
        const hits = await defaultMatchAssets({ description: themeQuery.tileset(theme), asset_type: "tileset" });
        const meta = await fetchAssetMeta(hits.map((h) => h.id));
        const best = chooseStyled(hits, meta, (h) => !/hex|isometric|hexagon/i.test(h.semantic_description));
        if (best) bindSlot(tileSlot, best);
    }
    if (bgSlot) {
        const hits = await defaultMatchAssets({ description: themeQuery.background(theme), asset_type: "background" });
        const meta = await fetchAssetMeta(hits.map((h) => h.id));
        const best = chooseStyled(hits, meta, () => true);
        if (best) bindSlot(bgSlot, best);
    }
}
