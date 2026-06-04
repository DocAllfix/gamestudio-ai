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
