/**
 * Programmable fake SandboxSession for engine-adapter tests.
 *
 * Unlike `e2bMock` (which always returns exitCode 0), this fake lets a
 * test script the exact CommandResult per command — so we can drive a
 * smokeTest to passed=true or passed=false from the test, with no
 * network and no real sandbox. It also records every command + written
 * file for assertions.
 *
 * Not a *.test.ts file, so vitest's include glob does not collect it.
 */
import type {
    CommandResult,
    SandboxHandle,
} from "../../../contracts/assembly-pipeline.contract.js";
import type { SandboxSession } from "../../sandbox/e2b.js";

/** A scripted response: matched against a command by substring. */
export interface ScriptEntry {
    /** Substring the command must contain to match this entry. */
    match: string;
    exit_code?: number;
    stdout?: string;
    stderr?: string;
}

export interface FakeSandbox extends SandboxSession {
    readonly commands: string[];
    readonly files: Map<string, string | Buffer>;
    readonly closed: () => boolean;
}

/** Build a fake sandbox. Commands are matched against `script` in order;
 * the first entry whose `match` is a substring of the command wins. An
 * unmatched command defaults to exit_code 0 with an echo stdout. */
export function makeFakeSandbox(
    script: ScriptEntry[] = [],
    opts: { id?: string } = {},
): FakeSandbox {
    const commands: string[] = [];
    const files = new Map<string, string | Buffer>();
    let isClosed = false;

    const handle: SandboxHandle = {
        id: opts.id ?? "sbx_fake_001",
        async close(): Promise<void> {
            isClosed = true;
        },
    };

    return {
        ...handle,

        commands,
        files,
        closed: () => isClosed,

        async writeFile(path: string, content: string | Buffer): Promise<void> {
            if (path === "") throw new Error("writeFile: path must be non-empty");
            files.set(path, content);
        },

        async runCommand(command: string): Promise<CommandResult> {
            commands.push(command);
            const entry = script.find((e) => command.includes(e.match));
            return {
                exit_code: entry?.exit_code ?? 0,
                stdout: entry?.stdout ?? `[fake run] ${command}`,
                stderr: entry?.stderr ?? "",
                duration_ms: 1,
            };
        },
    };
}
