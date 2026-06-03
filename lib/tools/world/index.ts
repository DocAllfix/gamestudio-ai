/**
 * WorldGenPort adapter — World Labs Marble.
 *
 * ⚠️ INTERNAL TEST — NOT USER-FACING (Order Form gate). ⚠️
 * Marble (~$1.20/world) is NOT yet a product feature: serving it at
 * volume requires a World Labs Order Form (see
 * COMPETITIVE_LANDSCAPE_2026.md §6). A paid API account is legal for
 * internal validation only. This adapter is therefore deliberately NOT
 * wired into the user-facing tool registry and NOT gated by check_quota
 * (it never reaches an end user). `assertInternalUseOnly()` is the guard
 * any future caller must pass through, documenting the constraint in
 * code.
 *
 * Implements the contract port verbatim (drop-in for worldgen.mock.ts):
 * generateWorld(input) → { splat_url, collider_url } where collider_url
 * is the walkable collider GLB.
 */
import {
    type WorldGenPort,
    type WorldGenInput,
    type WorldGenOutput,
    WorldGenInputSchema,
    WorldGenOutputSchema,
} from "../../contracts/generative.contract.js";

/** glTF binary magic: ASCII "glTF" = 0x46546C67 little-endian. */
const GLTF_MAGIC = 0x46546c67;

/** True iff `buffer` begins with the glTF binary (GLB) magic header. */
export function isValidGlbHeader(buffer: ArrayBuffer): boolean {
    if (buffer.byteLength < 4) {
        return false;
    }
    const view = new DataView(buffer);
    return view.getUint32(0, true) === GLTF_MAGIC;
}

export interface MarbleCreateResult {
    job_id: string;
}

export interface MarblePollResult {
    status: "pending" | "succeeded" | "failed";
    splat_url?: string;
    collider_url?: string;
    cost_usd?: number;
}

/** The Marble HTTP surface the adapter depends on. Injected so the unit
 * tests run without hitting the paid API; the default uses `fetch`. */
export interface MarbleTransport {
    createWorld(input: WorldGenInput): Promise<MarbleCreateResult>;
    pollWorld(jobId: string): Promise<MarblePollResult>;
    download(url: string): Promise<ArrayBuffer>;
}

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 100_000;

export class MarbleWorldGenPort implements WorldGenPort {
    constructor(private readonly transport: MarbleTransport) {}

    async generateWorld(input: WorldGenInput): Promise<WorldGenOutput> {
        const parsed = WorldGenInputSchema.parse(input);
        const start = Date.now();

        const { job_id } = await this.transport.createWorld(parsed);

        let result: MarblePollResult | null = null;
        const deadline = Date.now() + POLL_TIMEOUT_MS;
        while (Date.now() < deadline) {
            const poll = await this.transport.pollWorld(job_id);
            if (poll.status === "succeeded") {
                result = poll;
                break;
            }
            if (poll.status === "failed") {
                throw new Error(`Marble world generation failed for job ${job_id}`);
            }
            await sleep(POLL_INTERVAL_MS);
        }
        if (!result || !result.splat_url || !result.collider_url) {
            throw new Error(`Marble world generation timed out for job ${job_id}`);
        }

        return WorldGenOutputSchema.parse({
            trace_id: parsed.trace_id,
            cost_usd: result.cost_usd ?? 0,
            latency_ms: Date.now() - start,
            qa_log: [],
            splat_url: result.splat_url,
            collider_url: result.collider_url,
        });
    }

    /** Download the collider GLB and confirm it has a valid glTF header.
     * Internal smoke check that Marble returned a real binary, not an
     * error page. */
    async verifyGlb(url: string): Promise<boolean> {
        const bytes = await this.transport.download(url);
        return isValidGlbHeader(bytes);
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

/** Guard documenting that Marble is internal-only. Any caller wiring this
 * into a user flow must acknowledge the Order Form gate; today nothing
 * does. */
export function assertInternalUseOnly(): void {
    if (process.env.WORLDLABS_USER_FACING === "true") {
        throw new Error(
            "WorldGenPort (Marble) is internal-test only — user-facing use requires a signed World Labs Order Form.",
        );
    }
}

/** Default transport over the real World Labs Marble HTTP API. Shapes
 * follow an async job model (create → poll → result). Endpoint paths are
 * placeholders pending the signed integration spec; isolated here so the
 * tested logic (parse + GLB validation) is provider-agnostic. */
function defaultTransport(): MarbleTransport {
    const apiKey = requireEnv("WORLDLABS_API_KEY");
    const base = process.env.WORLDLABS_API_BASE ?? "https://api.worldlabs.ai/v1";
    const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

    return {
        async createWorld(input) {
            const res = await fetch(`${base}/marble/worlds`, {
                method: "POST",
                headers,
                body: JSON.stringify({ prompt: input.prompt, style: input.style_pack_id }),
            });
            if (!res.ok) {
                throw new Error(`Marble createWorld failed: ${res.status} ${await res.text()}`);
            }
            const body = (await res.json()) as { id: string };
            return { job_id: body.id };
        },
        async pollWorld(jobId) {
            const res = await fetch(`${base}/marble/worlds/${jobId}`, { headers });
            if (!res.ok) {
                throw new Error(`Marble pollWorld failed: ${res.status} ${await res.text()}`);
            }
            const body = (await res.json()) as {
                status: "pending" | "succeeded" | "failed";
                splat_url?: string;
                collider_url?: string;
                cost_usd?: number;
            };
            return body;
        },
        async download(url) {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`Marble download failed: ${res.status}`);
            }
            return res.arrayBuffer();
        },
    };
}

/** Build the real Marble port. INTERNAL TEST ONLY (Order Form gate). */
export function makeMarblePort(): MarbleWorldGenPort {
    assertInternalUseOnly();
    return new MarbleWorldGenPort(defaultTransport());
}
