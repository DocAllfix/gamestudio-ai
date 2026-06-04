import { z } from "zod";

import { ToolInputBaseSchema, ToolOutputBaseSchema } from "../../../contracts/tool-registry.contract.js";
import { AbstractLayoutSchema } from "../_shared-map.js";

export const TilemapPopulateInputSchema = ToolInputBaseSchema.extend({
    layout: AbstractLayoutSchema,
    style_pack_id: z.string().min(1),
    genre: z.string().min(1),
    engine: z.string().min(1),
    tier: z.enum(["free", "creator", "studio"]).default("free"),
    /** Palette hex of the style pack (style_packs.palette_hex) for consistency. */
    palette_hex: z.array(z.string()).default([]),
    strategy: z.enum(["llm", "wfc", "autotile"]).default("autotile"),
});
export type TilemapPopulateInput = z.infer<typeof TilemapPopulateInputSchema>;

/** The file entry written into AssemblerInput.tool_outputs[node_id].files[]. */
export const TileFileSchema = z.object({
    path: z.string().min(1),
    content: z.string(),
    encoding: z.enum(["utf-8", "base64", "url-ref"]),
});

export const TilemapPopulateOutputSchema = ToolOutputBaseSchema.extend({
    /** The Tiled JSON map object (also serialized into files[]). */
    tilemap: z.record(z.unknown()),
    tileset: z.object({
        name: z.string(),
        url: z.string(),
        source: z.enum(["catalog", "generated", "default"]),
        license: z.string().nullable(),
    }),
    files: z.array(TileFileSchema),
});
export type TilemapPopulateOutput = z.infer<typeof TilemapPopulateOutputSchema>;
