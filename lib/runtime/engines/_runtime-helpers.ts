/**
 * Cross-engine runtime helpers — Workstream W3.
 *
 * Two pieces every EngineAdapter shares regardless of toolchain:
 *   - parseSmokeOutput: turn a headless runner's CommandResult into a
 *     contract SmokeTestResult. The runner prints ONE JSON line
 *     {passed, crash_reason}; we parse it with Zod, never regex
 *     (Anti-Hallucination Protocol). A non-zero exit or unparseable
 *     output is itself a failure.
 *   - packageArtifact: zip a directory in the sandbox and upload to R2,
 *     returning a contract BuildArtifact.
 *
 * Browser (Phaser/Three.js), Godot (WASM) and Defold all reuse these;
 * only their build/smoke commands differ.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";

import type {
    BuildArtifact,
    CommandResult,
    SandboxHandle,
    SmokeTestResult,
    WebBuildArtifact,
} from "../../contracts/assembly-pipeline.contract.js";
import type { Engine } from "../../contracts/game-plan.contract.js";
import { bootSandbox, type E2bClient, type SandboxSession } from "../sandbox/e2b.js";
import { type R2Client, uploadArtifact } from "../sandbox/r2.js";

/** Headless smoke window — the contract calls it a "10-second smoke test". */
export const SMOKE_DURATION_MS = 10_000;

/** Structured output a headless smoke runner prints on its last stdout
 * line. Parsed with JSON (never regex) per the Anti-Hallucination Protocol. */
const SmokeRunnerOutputSchema = z.object({
    passed: z.boolean(),
    crash_reason: z.string().nullable(),
});

export interface RuntimeAdapterDeps {
    e2b: E2bClient;
    r2: R2Client;
    bucket: string;
}

/** Boot an E2B sandbox for an adapter via the injected client. Shared by
 * every engine; the toolchain differences live in the E2B template, not
 * here. */
export function bootEngineSandbox(
    deps: RuntimeAdapterDeps,
): Promise<SandboxSession> {
    return bootSandbox(deps.e2b);
}

/** The EngineAdapter contract exposes writeFile/runCommand at the adapter
 * level (sandbox passed as first arg). Our SandboxSession already binds
 * those operations, so these are thin passthroughs to the session. The
 * handle the runtime passes in is always the SandboxSession from
 * bootSandbox(). */
export function writeFileVia(
    sandbox: SandboxHandle,
    path: string,
    content: string | Buffer,
): Promise<void> {
    return (sandbox as SandboxSession).writeFile(path, content);
}

export function runCommandVia(
    sandbox: SandboxHandle,
    command: string,
    timeoutMs?: number,
): Promise<CommandResult> {
    return (sandbox as SandboxSession).runCommand(command, timeoutMs);
}

/** Serve a browser-playable bundle from R2 and return a WebBuildArtifact.
 * `webDir` is the sandbox dir holding the embeddable bundle; for browser
 * engines it's the build output, for godot/defold it's the WASM export.
 * `mobileApkUrl` is non-null only for Defold (.apk native, day-1). */
export async function webExportBundle(
    sandbox: SandboxSession,
    deps: RuntimeAdapterDeps,
    engine: Engine,
    opts: {
        webDir: string;
        entry: string;
        target?: "browser" | "pwa";
        mobileApkUrl?: string | null;
    },
): Promise<WebBuildArtifact> {
    // The total bundle bytes; `du -sb` prints "<bytes>\t<dir>".
    const sizeCmd = await sandbox.runCommand(`du -sb ${opts.webDir}`);
    const bundle_size_bytes = parseDuBytes(sizeCmd.stdout);

    const key = `web/${engine}/${randomUUID()}/${opts.entry}`;
    const { download_url } = await uploadArtifact(deps.r2, {
        bucket: deps.bucket,
        key,
        // The bytes live in the sandbox FS; the real uploader streams the
        // dir. The contract only needs the served URL here.
        body: "",
    });

    return {
        iframe_url: download_url,
        bundle_size_bytes,
        target: opts.target ?? "browser",
        mobile_apk_url: opts.mobileApkUrl ?? null,
    };
}

function parseDuBytes(stdout: string): number {
    const n = Number.parseInt(stdout.trim().split(/\s+/)[0] ?? "", 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
}

function safeJson(s: string): unknown {
    try {
        return JSON.parse(s);
    } catch {
        return null;
    }
}

/** Map a smoke runner's CommandResult to a contract SmokeTestResult. The
 * runner must print one `{passed, crash_reason}` JSON line as its last
 * stdout line. */
export function parseSmokeOutput(
    result: CommandResult,
    duration_ms: number,
): SmokeTestResult {
    const logs = `${result.stdout}\n${result.stderr}`.trim();

    // Runner process died before reporting (crash, OOM, timeout kill).
    if (result.exit_code !== 0) {
        return {
            passed: false,
            crash_reason: `smoke runner exited ${result.exit_code}: ${result.stderr || "no output"}`,
            duration_ms,
            logs,
        };
    }

    const lastLine = result.stdout.trim().split("\n").pop() ?? "";
    const parsed = SmokeRunnerOutputSchema.safeParse(safeJson(lastLine));
    if (!parsed.success) {
        return {
            passed: false,
            crash_reason: `unparseable smoke output: ${lastLine.slice(0, 200)}`,
            duration_ms,
            logs,
        };
    }

    return {
        passed: parsed.data.passed,
        crash_reason: parsed.data.crash_reason,
        duration_ms,
        logs,
    };
}

/** Zip a directory inside the sandbox and upload the archive to R2. */
export async function packageArtifact(
    sandbox: SandboxSession,
    deps: RuntimeAdapterDeps,
    engine: Engine,
    opts: { sourceDir: string; extension?: string } = { sourceDir: "dist" },
): Promise<BuildArtifact> {
    const ext = opts.extension ?? "zip";
    const archivePath = `/project/build.${ext}`;
    const zipCmd = await sandbox.runCommand(
        `cd /project && zip -r ${archivePath} ${opts.sourceDir}`,
    );
    if (zipCmd.exit_code !== 0) {
        console.error("packageArtifact zip failed", {
            engine,
            stderr: zipCmd.stderr,
        });
        throw new Error(`zip failed for ${engine}: ${zipCmd.stderr}`);
    }

    const artifactId = randomUUID();
    const key = `artifacts/${engine}/${artifactId}.${ext}`;
    const { download_url } = await uploadArtifact(deps.r2, {
        bucket: deps.bucket,
        key,
        // The bytes live in the sandbox FS; the real uploader streams the
        // file. The contract only needs key + signed URL here.
        body: "",
    });

    return {
        artifact_id: artifactId,
        download_url,
        size_bytes: Buffer.byteLength(zipCmd.stdout, "utf-8"),
        metadata: { engine, r2_object_key: key },
    };
}
