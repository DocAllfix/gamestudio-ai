/**
 * Runtime / Assembler mock — consumed by W1 (Reasoning Orchestrator)
 * and W4 (Frontend project list) while W3 builds the real engine
 * adapters and the E2B-backed Assembler.
 *
 * Replace at merge time per Supreme Plan §07.
 */
import { randomUUID } from "node:crypto";

import {
    type AssemblerInput,
    AssemblerInputSchema,
    type AssemblerOutput,
    AssemblerOutputSchema,
    type ItchPackagerInput,
    ItchPackagerInputSchema,
    type ItchPackagerOutput,
    ItchPackagerOutputSchema,
} from "../contracts/assembly-pipeline.contract.js";

/** Mock end-to-end build: validates input, returns a fake R2 URL +
 * a passing smoke test outcome. */
export async function runtimeBuild(
    input: AssemblerInput,
): Promise<AssemblerOutput> {
    const parsed = AssemblerInputSchema.parse(input);
    const artifactId = randomUUID();

    return AssemblerOutputSchema.parse({
        artifact_id: artifactId,
        download_url: `https://mock-r2.example.com/artifacts/${artifactId}.zip`,
        size_bytes: 1024 * 1024,
        build_log: `[mocked build] engine=${parsed.engine} ` +
            `tool_outputs=${Object.keys(parsed.tool_outputs).length}`,
        smoke_test: parsed.run_smoke_test
            ? {
                  ran: true,
                  passed: true,
                  crash_reason: null,
                  duration_ms: 0,
              }
            : {
                  ran: false,
                  passed: null,
                  crash_reason: null,
                  duration_ms: null,
              },
        total_duration_ms: 0,
    });
}

/** Mock itch.io upload: validates input, returns a fake itch build URL. */
export async function pushToItch(
    input: ItchPackagerInput,
): Promise<ItchPackagerOutput> {
    const parsed = ItchPackagerInputSchema.parse(input);
    return ItchPackagerOutputSchema.parse({
        pushed: true,
        itch_build_url: `${parsed.target_url}/builds/mocked-build-id`,
        butler_log: "[mocked butler push]",
    });
}
