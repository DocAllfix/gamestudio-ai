/**
 * WorldGen port mock — consumed by W1 / W4 while W3 builds the real World
 * Labs Marble adapter. Zod-validates input against generative.contract.ts and
 * returns placeholder splat/collider URLs. No network. Replace at merge §07.
 */
import {
    type WorldGenPort,
    WorldGenInputSchema,
    WorldGenOutputSchema,
    type WorldGenInput,
    type WorldGenOutput,
} from "../contracts/generative.contract.js";

export const worldGenMock: WorldGenPort = {
    async generateWorld(input: WorldGenInput): Promise<WorldGenOutput> {
        const parsed = WorldGenInputSchema.parse(input);
        return WorldGenOutputSchema.parse({
            trace_id: parsed.trace_id,
            cost_usd: 0,
            latency_ms: 0,
            qa_log: [],
            splat_url: "https://mock-r2.example.com/world/mocked.spz",
            collider_url: "https://mock-r2.example.com/world/mocked-collider.glb",
        });
    },
};
