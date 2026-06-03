/**
 * WorldGenPort (World Labs Marble) — INTERNAL TEST ONLY.
 *
 * Two layers:
 *  - unit (always runs): a fake transport drives the create→poll→result
 *    flow; asserts the contract output shape, a non-empty collider GLB
 *    url, and the glTF-header validator (pure function).
 *  - integration (only when WORLDLABS_API_KEY is set): hits the real
 *    Marble API, asserts a non-empty collider_url and that the
 *    downloaded GLB has a valid glTF magic header.
 *
 * Marble is NOT a user-facing feature (Order Form gate) — these tests
 * validate the adapter technically, nothing more.
 */
import { describe, expect, it } from "vitest";

import {
    MarbleWorldGenPort,
    isValidGlbHeader,
    type MarbleTransport,
} from "../index.js";
import { WorldGenOutputSchema } from "../../../contracts/generative.contract.js";

const baseInput = {
    project_id: "00000000-0000-4000-8000-000000000000",
    plan_version: 1,
    trace_id: "trace_world",
    prompt: "a foggy ruined courtyard",
    style_pack_id: "sp_dark",
};

/** Fake transport: create returns a job id, poll returns succeeded with
 * URLs, download returns bytes with a valid glTF magic header. */
function fakeTransport(): MarbleTransport {
    const glbBytes = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00]); // "glTF" + version 2
    return {
        async createWorld() {
            return { job_id: "job_123" };
        },
        async pollWorld() {
            return {
                status: "succeeded",
                splat_url: "https://worldlabs.example.com/w/job_123.spz",
                collider_url: "https://worldlabs.example.com/w/job_123.glb",
                cost_usd: 1.2,
            };
        },
        async download() {
            return glbBytes.buffer;
        },
    };
}

describe("isValidGlbHeader", () => {
    it("accepts a buffer starting with the glTF magic", () => {
        const buf = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00]).buffer;
        expect(isValidGlbHeader(buf)).toBe(true);
    });

    it("rejects a buffer without the glTF magic", () => {
        const buf = new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer;
        expect(isValidGlbHeader(buf)).toBe(false);
    });
});

describe("MarbleWorldGenPort (unit, fake transport)", () => {
    it("generateWorld returns a contract-valid WorldGenOutput", async () => {
        const port = new MarbleWorldGenPort(fakeTransport());
        const res = await port.generateWorld(baseInput);
        expect(() => WorldGenOutputSchema.parse(res)).not.toThrow();
    });

    it("returns a non-empty collider GLB url", async () => {
        const port = new MarbleWorldGenPort(fakeTransport());
        const res = await port.generateWorld(baseInput);
        expect(res.collider_url.length).toBeGreaterThan(0);
    });

    it("validates the downloaded GLB has a glTF header", async () => {
        const port = new MarbleWorldGenPort(fakeTransport());
        const valid = await port.verifyGlb(
            (await port.generateWorld(baseInput)).collider_url,
        );
        expect(valid).toBe(true);
    });
});

// Integration: only when a real paid key is present. Internal test —
// not user-facing (Order Form gate).
const itIntegration = process.env.WORLDLABS_API_KEY ? it : it.skip;

describe("MarbleWorldGenPort (integration, real Marble API)", () => {
    itIntegration(
        "generates a real world with a loadable collider GLB",
        async () => {
            const { makeMarblePort } = await import("../index.js");
            const port = makeMarblePort();
            const res = await port.generateWorld(baseInput);
            expect(res.collider_url.length).toBeGreaterThan(0);
            expect(await port.verifyGlb(res.collider_url)).toBe(true);
        },
        120_000,
    );
});
