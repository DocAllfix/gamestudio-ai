/**
 * Cloudflare R2 storage helper — Workstream W3.
 *
 * Uploads a build artifact (.zip / WASM bundle) to R2 and returns the
 * object key plus a signed download URL the runtime / UI can hand out.
 *
 * R2 is S3-compatible; the real client is built on @aws-sdk/client-s3 +
 * @aws-sdk/s3-request-presigner. We depend on an injected `R2Client`
 * instead of importing the SDK directly, so tests inject `r2Mock`
 * (baas.mock.ts) and run with no network. The real client is wired in at
 * integration time and satisfies the same shape.
 */

/** Default signed-URL lifetime: 1 hour. */
const DEFAULT_EXPIRES_IN = 3600;

/** What this helper needs from an R2 (S3-compatible) client. `r2Mock` and
 * the real @aws-sdk wrapper both satisfy it. */
export interface R2Client {
    putObject(args: {
        bucket: string;
        key: string;
        body: Buffer | string;
        /** MIME type so R2 serves .wasm/.js/.html with correct headers when
         * the bucket is public (browsers refuse to run wasm sent as text). */
        contentType?: string;
    }): Promise<{ etag: string }>;
    getSignedUrl(args: {
        bucket: string;
        key: string;
        expiresIn: number;
    }): Promise<string>;
}

export interface UploadInput {
    bucket: string;
    key: string;
    body: Buffer | string;
}

export interface UploadResult {
    r2_object_key: string;
    download_url: string;
}

/** Upload an artifact to R2 and return its object key + a signed URL. */
export async function uploadArtifact(
    client: R2Client,
    input: UploadInput,
    options: { expiresIn?: number } = {},
): Promise<UploadResult> {
    if (input.key === "") {
        throw new Error("uploadArtifact: object key must be non-empty");
    }

    const expiresIn = options.expiresIn ?? DEFAULT_EXPIRES_IN;

    try {
        await client.putObject({
            bucket: input.bucket,
            key: input.key,
            body: input.body,
        });
        const downloadUrl = await client.getSignedUrl({
            bucket: input.bucket,
            key: input.key,
            expiresIn,
        });
        return { r2_object_key: input.key, download_url: downloadUrl };
    } catch (error) {
        console.error("r2.uploadArtifact failed", {
            bucket: input.bucket,
            key: input.key,
            error,
        });
        throw new Error(
            `Failed to upload artifact to R2 (${input.key}): ${(error as Error).message}`,
        );
    }
}

/** MIME types a web game export serves. Wrong types break in the browser:
 * .wasm sent as text/plain refuses to stream-compile; .js as text/plain is
 * blocked by strict MIME checking. Defaults to octet-stream. */
const MIME_BY_EXT: Record<string, string> = {
    html: "text/html; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    mjs: "text/javascript; charset=utf-8",
    wasm: "application/wasm",
    pck: "application/octet-stream",
    json: "application/json",
    css: "text/css; charset=utf-8",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    svg: "image/svg+xml",
    mp3: "audio/mpeg",
    ogg: "audio/ogg",
    wav: "audio/wav",
    glb: "model/gltf-binary",
    gltf: "model/gltf+json",
    wasmmap: "application/json",
};

export function contentTypeFor(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

/** One file to upload, with its bytes and R2 key. */
export interface DirFile {
    key: string;
    body: Buffer;
}

/**
 * Upload many files (a built web bundle) to R2 under a common prefix, each
 * with its correct MIME type. Returns the keys uploaded. The caller builds
 * the public URL to the entry (index.html) from R2_PUBLIC_URL.
 */
export async function uploadDir(
    client: R2Client,
    bucket: string,
    files: DirFile[],
): Promise<string[]> {
    const uploaded: string[] = [];
    for (const f of files) {
        try {
            await client.putObject({
                bucket,
                key: f.key,
                body: f.body,
                contentType: contentTypeFor(f.key),
            });
            uploaded.push(f.key);
        } catch (error) {
            console.error("r2.uploadDir failed", { bucket, key: f.key, error });
            throw new Error(`Failed to upload ${f.key} to R2: ${(error as Error).message}`);
        }
    }
    return uploaded;
}
