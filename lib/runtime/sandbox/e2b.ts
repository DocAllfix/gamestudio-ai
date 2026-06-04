/**
 * E2B sandbox wrapper — Workstream W3.
 *
 * Adapts the E2B SDK to the canonical `SandboxHandle` / `CommandResult`
 * from lib/contracts/assembly-pipeline.contract.ts. Every engine adapter
 * boots its sandbox through here.
 *
 * The wrapper depends on an injected `E2bClient` rather than importing the
 * `e2b` SDK directly: in tests we inject `e2bMock` (baas.mock.ts) so the
 * suite runs with no network; the real SDK client is wired in at
 * integration time and satisfies the same shape.
 */
import type {
    CommandResult,
    SandboxHandle,
} from "../../contracts/assembly-pipeline.contract.js";

/** Raw sandbox object returned by the client's `createSandbox`. */
export interface E2bRawSandbox {
    id: string;
    close(): Promise<void>;
}

/** What this wrapper needs from an E2B SDK client. `e2bMock` and the real
 * `e2b` SDK both satisfy it (the real SDK's exit field is `exitCode`). */
export interface E2bClient {
    createSandbox(): Promise<E2bRawSandbox>;
    runCommand(
        sandbox: E2bRawSandbox,
        command: string,
    ): Promise<{ exitCode: number; stdout: string; stderr: string }>;
    writeFile(
        sandbox: E2bRawSandbox,
        path: string,
        content: string | Buffer,
    ): Promise<void>;
}

/** A SandboxHandle bound to a concrete sandbox + client, exposing the
 * file/command operations the engine adapters use. */
export interface SandboxSession extends SandboxHandle {
    writeFile(path: string, content: string | Buffer): Promise<void>;
    runCommand(command: string, timeoutMs?: number): Promise<CommandResult>;
}

/** Boot a sandbox via the injected client and return a SandboxSession. */
export async function bootSandbox(client: E2bClient): Promise<SandboxSession> {
    let raw: E2bRawSandbox;
    try {
        raw = await client.createSandbox();
    } catch (error) {
        console.error("e2b.bootSandbox failed", { error });
        throw new Error(
            `Failed to boot E2B sandbox: ${(error as Error).message}`,
        );
    }

    let closed = false;

    return {
        id: raw.id,

        async writeFile(path: string, content: string | Buffer): Promise<void> {
            try {
                await client.writeFile(raw, path, content);
            } catch (error) {
                console.error("e2b.writeFile failed", { sandbox: raw.id, path, error });
                throw error;
            }
        },

        async runCommand(command: string): Promise<CommandResult> {
            const start = Date.now();
            try {
                const res = await client.runCommand(raw, command);
                return {
                    exit_code: res.exitCode,
                    stdout: res.stdout,
                    stderr: res.stderr,
                    duration_ms: Date.now() - start,
                };
            } catch (error) {
                console.error("e2b.runCommand failed", { sandbox: raw.id, command, error });
                throw error;
            }
        },

        async close(): Promise<void> {
            if (closed) return;
            closed = true;
            try {
                await raw.close();
            } catch (error) {
                console.error("e2b.close failed", { sandbox: raw.id, error });
                throw error;
            }
        },
    };
}
