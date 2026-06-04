import { z } from "zod";

import { ToolInputBaseSchema, ToolOutputBaseSchema } from "../../../contracts/tool-registry.contract.js";
import { GameGraphNodeSchema } from "../../../contracts/game-graph.contract.js";
import { EntitySlotSchema, PointSchema } from "../_shared-map.js";
import { TileFileSchema } from "../tilemap_populate/schema.js";

export const LevelLayout3dInputSchema = ToolInputBaseSchema.extend({
    genre: z.string().min(1),
    node: GameGraphNodeSchema,
    size: z.enum(["s", "m", "l"]).default("m"),
    biome: z.string().nullable().default(null),
    seed: z.number().int().optional(),
});
export type LevelLayout3dInput = z.infer<typeof LevelLayout3dInputSchema>;

export const Layout3dSchema = z.object({
    node_id: z.string(),
    width: z.number().int(),
    height: z.number().int(),
    heightmap: z.array(z.array(z.number())),
    walkable: z.array(z.array(z.boolean())),
    entity_slots: z.array(EntitySlotSchema),
    spawn: PointSchema,
    exit: PointSchema,
    meta: z.object({ genre: z.string(), biome: z.string().nullable(), seed: z.number().int() }),
});
export type Layout3d = z.infer<typeof Layout3dSchema>;

export const LevelLayout3dOutputSchema = ToolOutputBaseSchema.extend({
    layout: Layout3dSchema,
    files: z.array(TileFileSchema),
});
export type LevelLayout3dOutput = z.infer<typeof LevelLayout3dOutputSchema>;
