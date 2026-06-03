/**
 * Defold EngineAdapter — Workstream W3.
 *
 * Defold is the day-1 native-.apk prerogative (WOW §3):
 *   build()     = `java -jar bob.jar ... --platform armv7-android bundle`,
 *                 producing a native Android .apk, then verify the .apk
 *                 exists. A missing .apk is surfaced as a non-zero result.
 *   smokeTest() = Defold's official headless smoke "without graphics/
 *                 sound" — a JSON-line runner (shared parse helper).
 *   package()   = zip the bundle dir + upload to R2.
 *
 * Required E2B template binaries (bob.jar, a JDK, the Android bundle
 * tooling) are documented in lib/runtime/sandbox/E2B_TEMPLATE.md.
 */
import { randomUUID } from "node:crypto";

import type {
    BuildArtifact,
    CommandResult,
    EngineAdapter,
    SandboxHandle,
    SmokeTestResult,
    WebBuildArtifact,
} from "../../contracts/assembly-pipeline.contract.js";
import type { Engine } from "../../contracts/game-plan.contract.js";
import type { SandboxSession } from "../sandbox/e2b.js";
import { uploadArtifact } from "../sandbox/r2.js";
import {
    bootEngineSandbox,
    packageArtifact,
    parseSmokeOutput,
    runCommandVia,
    type RuntimeAdapterDeps,
    SMOKE_DURATION_MS,
    webExportBundle,
    writeFileVia,
} from "./_runtime-helpers.js";

/** Bundle output dir inside the sandbox. */
export const DEFOLD_BUNDLE_DIR = "/project/build/android";
/** Native Android artifact produced by the bundle step. */
export const DEFOLD_APK_PATH = `${DEFOLD_BUNDLE_DIR}/game.apk`;
/** HTML5 (WASM) bundle dir — the browser-embeddable export. */
export const DEFOLD_WEB_DIR = "/project/build/html5";
/** Headless "no graphics/sound" smoke runner dropped into the sandbox. */
export const DEFOLD_SMOKE_RUNNER = "/project/defold-smoke-runner.mjs";

export class DefoldAdapter implements EngineAdapter {
    readonly engine: Engine = "defold";

    constructor(private readonly deps: RuntimeAdapterDeps) {}

    bootSandbox(): Promise<SandboxHandle> {
        return bootEngineSandbox(this.deps);
    }

    writeFile(sandbox: SandboxHandle, path: string, content: string | Buffer): Promise<void> {
        return writeFileVia(sandbox, path, content);
    }

    runCommand(sandbox: SandboxHandle, command: string, timeoutMs?: number): Promise<CommandResult> {
        return runCommandVia(sandbox, command, timeoutMs);
    }

    async build(sandbox: SandboxSession): Promise<CommandResult> {
        const start = Date.now();
        const bundleCmd = await sandbox.runCommand(
            `java -jar /opt/bob.jar --platform armv7-android ` +
                `--bundle-output ${DEFOLD_BUNDLE_DIR} --archive resolve build bundle`,
        );
        if (bundleCmd.exit_code !== 0) {
            return bundleCmd;
        }

        const check = await sandbox.runCommand(`test -f ${DEFOLD_APK_PATH}`);
        if (check.exit_code !== 0) {
            console.error("defold.build apk not produced", {
                apk: DEFOLD_APK_PATH,
            });
            return {
                exit_code: 1,
                stdout: bundleCmd.stdout,
                stderr: `Defold bundle did not produce .apk at ${DEFOLD_APK_PATH}`,
                duration_ms: Date.now() - start,
            };
        }

        return { ...bundleCmd, duration_ms: Date.now() - start };
    }

    async smokeTest(sandbox: SandboxSession): Promise<SmokeTestResult> {
        const start = Date.now();
        const result = await sandbox.runCommand(
            `node ${DEFOLD_SMOKE_RUNNER} ${DEFOLD_BUNDLE_DIR}`,
            SMOKE_DURATION_MS + 5_000,
        );
        return parseSmokeOutput(result, Date.now() - start);
    }

    async package(sandbox: SandboxSession): Promise<BuildArtifact> {
        return packageArtifact(sandbox, this.deps, this.engine, {
            sourceDir: "build/android",
        });
    }

    /** Defold is the day-1 native-.apk engine: webExport serves the HTML5
     * (WASM) bundle as the iframe AND uploads the .apk so the UI can offer
     * a native Android install (mobile_apk_url). */
    async webExport(sandbox: SandboxSession): Promise<WebBuildArtifact> {
        const apkCheck = await sandbox.runCommand(`test -f ${DEFOLD_APK_PATH}`);
        let mobileApkUrl: string | null = null;
        if (apkCheck.exit_code === 0) {
            const { download_url } = await uploadArtifact(this.deps.r2, {
                bucket: this.deps.bucket,
                key: `mobile/${this.engine}/${randomUUID()}.apk`,
                body: "",
            });
            mobileApkUrl = download_url;
        } else {
            console.error("defold.webExport: .apk missing, mobile_apk_url=null", {
                apk: DEFOLD_APK_PATH,
            });
        }

        return webExportBundle(sandbox, this.deps, this.engine, {
            webDir: DEFOLD_WEB_DIR,
            entry: "index.html",
            target: "browser",
            mobileApkUrl,
        });
    }
}
