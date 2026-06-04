/**
 * Trigger.dev assembly job entrypoint — Workstream W3.
 *
 * The Assembler is a long task (boot sandbox → DAG walk → build → smoke
 * test → R2 upload) that the Orchestrator (W1) dispatches asynchronously.
 * This module is the enqueue side: it contract-validates the
 * AssemblerInput and dispatches the task, returning the Trigger.dev run id.
 * The build body itself lands in [5-W3]'s Assembler.
 *
 * Per the BaaS perimeter (CLAUDE.md): never write the worker/queue — that's
 * Trigger.dev. We depend on an injected `TriggerClient` instead of the
 * @trigger.dev/sdk so tests inject `triggerMock` and run with no network.
 */
import {
    type AssemblerInput,
    AssemblerInputSchema,
} from "../../contracts/assembly-pipeline.contract.js";

/** Stable task id the worker registers under. */
export const ASSEMBLY_TASK_ID = "runtime-assembly";

/** What this entrypoint needs from a Trigger.dev client. `triggerMock` and
 * the real @trigger.dev/sdk both satisfy it. */
export interface TriggerClient {
    run(
        taskId: string,
        payload: Record<string, unknown>,
    ): Promise<{ runId: string }>;
}

export interface EnqueueResult {
    run_id: string;
}

/** Validate the assembly input against the contract, then dispatch the
 * long task. Throws (before dispatch) on a malformed input. */
export async function enqueueAssembly(
    client: TriggerClient,
    input: AssemblerInput,
): Promise<EnqueueResult> {
    const parsed = AssemblerInputSchema.parse(input);

    try {
        const { runId } = await client.run(
            ASSEMBLY_TASK_ID,
            parsed as unknown as Record<string, unknown>,
        );
        return { run_id: runId };
    } catch (error) {
        console.error("trigger.enqueueAssembly dispatch failed", {
            project_id: parsed.project_id,
            engine: parsed.engine,
            error,
        });
        throw new Error(
            `Failed to enqueue assembly for project ${parsed.project_id}: ${(error as Error).message}`,
        );
    }
}
