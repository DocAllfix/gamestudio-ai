import { z } from "zod";

import { ToolInputBaseSchema, ToolOutputBaseSchema } from "../../../contracts/tool-registry.contract.js";
import { TileFileSchema } from "../tilemap_populate/schema.js";

export const HeightmapGenInputSchema = ToolInputBaseSchema.extend({
    width: z.number().int().min(2).max(512).default(64),
    height: z.number().int().min(2).max(512).default(64),
    seed: z.number().int().optional(),
    octaves: z.number().int().min(1).max(8).default(4),
    scale: z.number().min(1).default(24),
    persistence: z.number().min(0).max(1).default(0.5),
    biome: z.string().nullable().default(null),
});
export type HeightmapGenInput = z.infer<typeof HeightmapGenInputSchema>;

export const HeightmapGenOutputSchema = ToolOutputBaseSchema.extend({
    width: z.number().int(),
    height: z.number().int(),
    /** Row-major normalized [0,1] heights. */
    heightmap: z.array(z.array(z.number())),
    files: z.array(TileFileSchema),
});
export type HeightmapGenOutput = z.infer<typeof HeightmapGenOutputSchema>;
