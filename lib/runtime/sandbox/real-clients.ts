/**
 * ============================================================================
 * REAL E2B + R2 CLIENTS — Ondata-1 activation template (NOT compiled yet)
 * ============================================================================
 *
 * This file is `.ts.template` on purpose: tsc does NOT compile it, so the merge
 * stays green WITHOUT the e2b / @aws-sdk SDKs in package.json.
 *
 * TO ACTIVATE (Ondata 1, when E2B + R2 credentials are ready):
 *   1. npm install e2b @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 *   2. rename this file:  real-clients.ts.template  →  real-clients.ts
 *   3. wire createRealDeps() into lib/runtime/runtime-build.ts (the bridge)
 *   4. swap the runtime.mock imports in lib/reasoning/{execution,evaluation}.ts
 *      and lib/runtime/runtime-client.ts to use the real assemble path
 *   5. npx tsc --noEmit && npx vitest run   (gate must stay green)
 *
 * The wrappers adapt the vendor SDKs to W3's injected interfaces
 * (E2bClient, R2Client) defined in ./e2b.ts and ./r2.ts. No W3 code changes.
 */
import { Sandbox } from "e2b";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { E2bClient, E2bRawSandbox } from "./e2b.js";
import type { R2Client } from "./r2.js";
import type { RuntimeAdapterDeps } from "../engines/_runtime-helpers.js";

// ---- E2B real client -------------------------------------------------------
// Reads E2B_API_KEY from env. createSandbox boots the W3-owned template image.
export function createE2bClient(): E2bClient {
    const apiKey = process.env.E2B_API_KEY;
    if (!apiKey) throw new Error("E2B_API_KEY missing — required to boot sandboxes.");

    // The W3-owned template (e2b/e2b.Dockerfile) carries the 5-engine toolchain
    // (esbuild, godot + export templates, bob.jar/JDK, chromium, zip). Without
    // it the default image is bare and build() fails with exit 127.
    const template = process.env.E2B_TEMPLATE_ID;

    return {
        async createSandbox(): Promise<E2bRawSandbox> {
            const sbx = template
                ? await Sandbox.create(template, { apiKey })
                : await Sandbox.create({ apiKey });
            return {
                id: sbx.sandboxId,
                // keep a handle so runCommand/writeFile can reach the SDK object
                _sdk: sbx,
                async close() {
                    await sbx.kill();
                },
            } as unknown as E2bRawSandbox;
        },
        async runCommand(sandbox, command) {
            const sbx = (sandbox as unknown as { _sdk: Sandbox })._sdk;
            // The SDK throws CommandExitError on a non-zero exit; the engine
            // adapters expect a result with exit_code so they can handle a
            // failed build/smoke gracefully. Convert the error back to a result.
            try {
                const res = await sbx.commands.run(command);
                return { exitCode: res.exitCode, stdout: res.stdout, stderr: res.stderr };
            } catch (error) {
                const e = error as { exitCode?: number; result?: { exitCode?: number; stdout?: string; stderr?: string }; stdout?: string; stderr?: string; message?: string };
                const exitCode = e.exitCode ?? e.result?.exitCode ?? 1;
                return {
                    exitCode,
                    stdout: e.result?.stdout ?? e.stdout ?? "",
                    stderr: e.result?.stderr ?? e.stderr ?? e.message ?? "command failed",
                };
            }
        },
        async writeFile(sandbox, path, content) {
            const sbx = (sandbox as unknown as { _sdk: Sandbox })._sdk;
            // The e2b SDK accepts string | ArrayBuffer | Blob | ReadableStream,
            // not Node Buffer. Pass strings through; convert Buffer to a view
            // over its underlying ArrayBuffer.
            const payload: string | ArrayBuffer =
                typeof content === "string"
                    ? content
                    : content.buffer.slice(
                          content.byteOffset,
                          content.byteOffset + content.byteLength,
                      ) as ArrayBuffer;
            await sbx.files.write(path, payload);
        },
        async listFiles(sandbox, dir) {
            const sbx = (sandbox as unknown as { _sdk: Sandbox })._sdk;
            // Walk the tree deep enough to catch nested export output (Godot
            // emits a flat dir; defold/three may nest a level or two).
            const entries = await sbx.files.list(dir, { depth: 5 });
            return entries
                .filter((e) => e.type === "file")
                .map((e) => ({ path: e.path, size: e.size ?? 0 }));
        },
        async readFile(sandbox, path) {
            const sbx = (sandbox as unknown as { _sdk: Sandbox })._sdk;
            const bytes = await sbx.files.read(path, { format: "bytes" });
            return Buffer.from(bytes);
        },
    };
}

// ---- R2 real client (S3-compatible) ---------------------------------------
// R2 speaks the S3 API. Reads R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY.
export function createR2Client(): R2Client {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    if (!endpoint || !accessKeyId || !secretAccessKey) {
        throw new Error("R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY missing.");
    }
    const s3 = new S3Client({
        region: "auto",
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
    });

    return {
        async putObject({ bucket, key, body, contentType }) {
            const out = await s3.send(
                new PutObjectCommand({
                    Bucket: bucket,
                    Key: key,
                    Body: body,
                    // Without this R2 serves everything as octet-stream, so the
                    // browser downloads index.html instead of rendering it and
                    // refuses to stream-compile the .wasm.
                    ContentType: contentType,
                }),
            );
            return { etag: out.ETag ?? "" };
        },
        async getSignedUrl({ bucket, key, expiresIn }) {
            return getSignedUrl(
                s3,
                new GetObjectCommand({ Bucket: bucket, Key: key }),
                { expiresIn },
            );
        },
    };
}

// ---- Combined deps for the runtime bridge ---------------------------------
export function createRealDeps(): RuntimeAdapterDeps {
    return {
        e2b: createE2bClient(),
        r2: createR2Client(),
        bucket: process.env.R2_BUCKET ?? "",
        // Public CDN base for the built game (https://pub-xxx.r2.dev). The
        // playable iframe_url is `${R2_PUBLIC_URL}/web/<engine>/<id>/index.html`.
        publicUrl: process.env.R2_PUBLIC_URL,
    };
}
