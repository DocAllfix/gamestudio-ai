/**
 * project_validator — checks a project file list has the engine's
 * required entrypoint/manifest. A missing manifest means the assembled
 * project won't open in the engine, so it fails QA.
 */
import { z } from "zod";

import {
    ToolInputBaseSchema,
    ToolOutputBaseSchema,
    type ToolInvocation,
} from "../../../contracts/tool-registry.contract.js";
import { makeResult, type Tool } from "../../_shared.js";

/** Required manifest/entrypoint file per engine. */
const REQUIRED_ENTRYPOINT: Record<string, string> = {
    godot: "project.godot",
    defold: "game.project",
    phaser: "index.html",
    threejs: "index.html",
    babylon: "index.html",
};

export const ProjectValidatorInputSchema = ToolInputBaseSchema.extend({
    engine: z.string().min(1),
    files: z.array(z.string()).min(1),
});
export type ProjectValidatorInput = z.infer<typeof ProjectValidatorInputSchema>;

export const ProjectValidatorOutputSchema = ToolOutputBaseSchema.extend({
    valid: z.boolean(),
    missing: z.array(z.string()),
});
export type ProjectValidatorOutput = z.infer<typeof ProjectValidatorOutputSchema>;

async function handler(invocation: ToolInvocation) {
    const start = Date.now();
    const input = ProjectValidatorInputSchema.parse({
        ...invocation.input,
        project_id: invocation.project_id,
        plan_version: invocation.plan_version,
        trace_id: invocation.trace_id,
    });

    const required = REQUIRED_ENTRYPOINT[input.engine];
    const present = required ? input.files.includes(required) : true;
    const missing = required && !present ? [required] : [];

    const output: ProjectValidatorOutput = {
        trace_id: invocation.trace_id,
        cost_usd: 0,
        latency_ms: Date.now() - start,
        qa_log: [],
        valid: present,
        missing,
    };
    return makeResult({
        invocation: { tool_id: "project_validator", node_id: invocation.node_id, trace_id: invocation.trace_id },
        output,
        qa_log: [
            {
                check: "entrypoint_present",
                passed: present,
                detail: required ? `requires ${required}` : "no manifest requirement",
            },
        ],
        latency_ms: Date.now() - start,
    });
}

const descriptor: Tool = {
    id: "project_validator",
    name: "Project Validator",
    description: "Verifies the engine's required manifest/entrypoint is present in the project file list.",
    category: "qa",
    inputSchema: ProjectValidatorInputSchema,
    outputSchema: ProjectValidatorOutputSchema,
    estimatedCostUsd: 0,
    estimatedDurationSeconds: 1,
    handler,
};

export default descriptor;
