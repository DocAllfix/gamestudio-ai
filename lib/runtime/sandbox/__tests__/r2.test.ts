/**
 * Tests for the R2 storage helper (lib/runtime/sandbox/r2.ts).
 *
 * We inject `r2Mock` from baas.mock.ts so the suite runs with no network
 * and no real @aws-sdk/client-s3 installed. The helper uploads a build
 * artifact and returns its object key + a signed download URL.
 */
import { describe, expect, it } from "vitest";

import { r2Mock } from "../../../_mocks/baas.mock.js";
import { uploadArtifact } from "../r2.js";

const BUCKET = "game-builds";

describe("r2 storage helper", () => {
    it("upload returns a non-empty object key and signed URL", async () => {
        const res = await uploadArtifact(r2Mock, {
            bucket: BUCKET,
            key: "artifacts/abc123.zip",
            body: Buffer.from("PK fake zip"),
        });

        expect(res.r2_object_key).toBe("artifacts/abc123.zip");
        expect(res.download_url.length).toBeGreaterThan(0);
        expect(res.download_url).toMatch(/^https?:\/\//);
        expect(res.download_url).toContain(BUCKET);
        expect(res.download_url).toContain("artifacts/abc123.zip");
    });

    it("respects a custom signed-URL expiry", async () => {
        const res = await uploadArtifact(
            r2Mock,
            { bucket: BUCKET, key: "k.zip", body: "data" },
            { expiresIn: 900 },
        );
        expect(res.download_url).toContain("exp=900");
    });

    it("rejects an empty object key", async () => {
        await expect(
            uploadArtifact(r2Mock, { bucket: BUCKET, key: "", body: "x" }),
        ).rejects.toThrow();
    });
});
