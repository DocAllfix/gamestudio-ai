import { z } from "zod";

import { ToolInputBaseSchema, ToolOutputBaseSchema } from "../../../contracts/tool-registry.contract.js";
import { AbstractLayoutSchema } from "../_shared-map.js";
import { TileFileSchema } from "../tilemap_populate/schema.js";

export const EntityPlacementInputSchema = ToolInputBaseSchema.extend({
    layout: AbstractLayoutSchema,
    /** The concrete Tiled map produced by tilemap_populate. */
    tilemap: z.record(z.unknown()),
    genre: z.string().min(1),
    difficulty: z.enum(["chill", "balanced", "hard", "brutal"]).default("balanced"),
    engine: z.string().min(1),
    seed: z.number().int().optional(),
});
export type EntityPlacementInput = z.infer<typeof EntityPlacementInputSchema>;

export const PlacedEntitySchema = z.object({
    id: z.string(),
    kind: z.string(),
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    grants: z.array(z.string()).default([]),
});

export const EntityPlacementOutputSchema = ToolOutputBaseSchema.extend({
    entities: z.array(PlacedEntitySchema),
    tilemap_with_entities: z.record(z.unknown()),
    files: z.array(TileFileSchema),
});
export type EntityPlacementOutput = z.infer<typeof EntityPlacementOutputSchema>;
