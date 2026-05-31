/**
 * Assembly Pipeline Contract — interface every Engine Adapter implements.
 *
 * Eight EngineAdapters live in `lib/runtime/engines/`. Each one knows
 * how to take a Game Plan + tool outputs (code, sprites, audio, 3D)
 * and produce a playable build inside the E2B sandbox, then package it
 * as a downloadable .zip in R2.
 *
 * The contract has TWO halves:
 *   1. EngineAdapterInterface — the methods each adapter implements
 *   2. AssemblerInput/Output schemas — the call envelope the
 *      Orchestrator (W1) sends to W3's Assembler entrypoint
 *
 * Phase 2 deferred: Steam pipeline (W3 publishers/steam.ts) and mobile
 * exports (iOS / Android via Godot/Defold native builders).
 */
import { z } from "zod";

import { EngineEnum } from "./game-plan.contract.js";

// ---- Per-engine adapter interface ----------------------------------------

/** Sandbox handle returned by E2B. The runtime treats it as opaque; the
 * adapter passes it back into `runCommand`, `writeFile`, etc. */
export interface SandboxHandle {
    /** Opaque id from E2B. */
    id: string;
    /** Tear down the sandbox and release resources. */
    close(): Promise<void>;
}

/** Result of a sandbox shell command. */
export interface CommandResult {
    exit_code: number;
    stdout: string;
    stderr: string;
    duration_ms: number;
}

/** Result of a headless smoke test run. */
export interface SmokeTestResult {
    passed: boolean;
    crash_reason: string | null;
    duration_ms: number;
    /** Bytes of stdout/stderr captured during the run, for debugging. */
    logs: string;
}

export interface BuildArtifact {
    /** Reference id used to store + retrieve the build from R2. */
    artifact_id: string;
    /** R2 signed URL the user / runtime can download from. */
    download_url: string;
    /** Total bytes — surfaced in the UI. */
    size_bytes: number;
    /** Per-engine metadata (e.g. exported_for, build_target). */
    metadata: Record<string, unknown>;
}

export interface EngineAdapter {
    /** Stable engine id matching the EngineEnum entry. */
    readonly engine: z.infer<typeof EngineEnum>;
    /** Boot an E2B sandbox preconfigured with this engine's toolchain. */
    bootSandbox(): Promise<SandboxHandle>;
    /** Write a file inside the sandbox at the given path. */
    writeFile(
        sandbox: SandboxHandle,
        path: string,
        content: string | Buffer,
    ): Promise<void>;
    /** Run a shell command inside the sandbox. */
    runCommand(
        sandbox: SandboxHandle,
        command: string,
        timeoutMs?: number,
    ): Promise<CommandResult>;
    /** Compile / build the project. Returns a CommandResult on the
     * build invocation. */
    build(sandbox: SandboxHandle): Promise<CommandResult>;
    /** Headless 10-second smoke test: launch, crash-detect, kill. */
    smokeTest(sandbox: SandboxHandle): Promise<SmokeTestResult>;
    /** Zip the build output and upload to R2. */
    package(sandbox: SandboxHandle): Promise<BuildArtifact>;
}

// ---- Assembler call envelope ---------------------------------------------

/** The full input the Orchestrator hands to the Assembler. */
export const AssemblerInputSchema = z.object({
    project_id: z.string().uuid(),
    plan_version: z.number().int().min(1),
    engine: EngineEnum,
    /** Tool outputs keyed by DAG node id. The Assembler walks the DAG
     * topologically and writes each output into the sandbox FS at the
     * engine-conventional path. */
    tool_outputs: z.record(
        z.object({
            tool_id: z.string().min(1),
            files: z.array(
                z.object({
                    path: z.string().min(1),
                    /** Either inline content or a R2 URL to fetch from. */
                    content: z.union([z.string(), z.string().url()]),
                    encoding: z.enum(["utf-8", "base64", "url-ref"]),
                }),
            ),
        }),
    ),
    /** Whether to run the smoke test as part of assembly. The
     * Orchestrator usually says yes; the Studio Mode "skip QA" debug
     * checkbox sends false. */
    run_smoke_test: z.boolean().default(true),
});
export type AssemblerInput = z.infer<typeof AssemblerInputSchema>;

export const AssemblerOutputSchema = z.object({
    artifact_id: z.string().uuid(),
    download_url: z.string().url(),
    size_bytes: z.number().int().min(0),
    build_log: z.string(),
    smoke_test: z.object({
        ran: z.boolean(),
        passed: z.boolean().nullable(),
        crash_reason: z.string().nullable(),
        duration_ms: z.number().int().min(0).nullable(),
    }),
    total_duration_ms: z.number().int().min(0),
});
export type AssemblerOutput = z.infer<typeof AssemblerOutputSchema>;

// ---- Publisher contracts (itch.io now, Steam Phase 2) --------------------

export const ItchPackagerInputSchema = z.object({
    artifact_id: z.string().uuid(),
    /** Itch.io game URL the user already created via the UI. */
    target_url: z.string().url(),
    /** Channel slug per itch.io conventions ("html5", "windows", ...). */
    channel: z.string().min(1),
    /** OAuth token from W4's Clerk → itch.io connection. */
    butler_api_key: z.string().min(1),
});
export type ItchPackagerInput = z.infer<typeof ItchPackagerInputSchema>;

export const ItchPackagerOutputSchema = z.object({
    pushed: z.boolean(),
    itch_build_url: z.string().url().nullable(),
    butler_log: z.string(),
});
export type ItchPackagerOutput = z.infer<typeof ItchPackagerOutputSchema>;
