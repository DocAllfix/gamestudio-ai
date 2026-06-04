import { z } from "zod";

import { ToolInputBaseSchema, ToolOutputBaseSchema } from "../../../contracts/tool-registry.contract.js";
import { GameGraphNodeSchema } from "../../../contracts/game-graph.contract.js";
import { AbstractLayoutSchema } from "../_shared-map.js";

export const LevelLayout2dInputSchema = ToolInputBaseSchema.extend({
    /** Genre drives the auto strategy selection. */
    genre: z.string().min(1),
    /** The world-graph node to expand into playable space. */
    node: GameGraphNodeSchema,
    size: z.enum(["s", "m", "l"]).default("m"),
    density: z.number().min(0).max(1).default(0.5),
    theme: z.string().nullable().default(null),
    difficulty: z.enum(["chill", "balanced", "hard", "brutal"]).default("balanced"),
    /** Deterministic regeneration seed; defaults to a stable hash if omitted. */
    seed: z.number().int().optional(),
    strategy: z
        .enum([
            "auto",
            "llm",
            "rotjs_digger",
            "rotjs_uniform",
            "rotjs_cellular",
            "rotjs_maze",
            "platform",
            "grid_puzzle",
            "arena",
        ])
        .default("auto"),
    tile_px: z.number().int().min(1).default(16),
});
export type LevelLayout2dInput = z.infer<typeof LevelLayout2dInputSchema>;

export const LevelLayout2dOutputSchema = ToolOutputBaseSchema.extend({
    layout: AbstractLayoutSchema,
    /** True when the genre is non-spatial and no map was produced. */
    non_spatial: z.boolean().default(false),
});
export type LevelLayout2dOutput = z.infer<typeof LevelLayout2dOutputSchema>;
