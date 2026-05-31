/**
 * BaaS SDK mocks — Clerk, Stripe, R2, E2B, Trigger.dev.
 *
 * Used by every workstream in test mode and by W4 while it integrates
 * the real SDKs. Each mock is shape-faithful to the SDK's published
 * TypeScript types but returns canned data so unit tests don't need
 * the BaaS to be reachable.
 *
 * Replace at merge time per Supreme Plan §07.
 */
import { randomUUID } from "node:crypto";

// ---- Clerk ---------------------------------------------------------------

export interface MockClerkUser {
    id: string;
    primaryEmailAddress: { emailAddress: string };
    firstName: string | null;
    lastName: string | null;
}

export const clerkMock = {
    /** Returns a deterministic fake user — useful in unit tests. */
    currentUser(userId = "user_mock_alpha"): MockClerkUser {
        return {
            id: userId,
            primaryEmailAddress: { emailAddress: "alpha@example.com" },
            firstName: "Alpha",
            lastName: "Tester",
        };
    },
    /** Stub for Clerk auth middleware — always allows. */
    isAuthenticated(): boolean {
        return true;
    },
};

// ---- Stripe --------------------------------------------------------------

export const stripeMock = {
    async createCheckoutSession(args: {
        userId: string;
        priceId: string;
        successUrl: string;
        cancelUrl: string;
    }): Promise<{ id: string; url: string }> {
        return {
            id: `cs_mock_${randomUUID().slice(0, 8)}`,
            url: `${args.successUrl}?session=mocked`,
        };
    },

    async constructWebhookEvent(_payload: string, _signature: string) {
        return {
            type: "checkout.session.completed",
            data: { object: { id: "cs_mocked", customer: "cus_mocked" } },
        };
    },
};

// ---- R2 (S3-compatible) --------------------------------------------------

export const r2Mock = {
    async putObject(args: {
        bucket: string;
        key: string;
        body: Buffer | string;
    }): Promise<{ etag: string }> {
        return { etag: `mock-etag-${randomUUID().slice(0, 8)}` };
    },

    async getSignedUrl(args: {
        bucket: string;
        key: string;
        expiresIn: number;
    }): Promise<string> {
        return `https://mock-r2.example.com/${args.bucket}/${args.key}?exp=${args.expiresIn}`;
    },
};

// ---- E2B sandbox ---------------------------------------------------------

export interface MockSandbox {
    id: string;
    close(): Promise<void>;
}

export const e2bMock = {
    async createSandbox(): Promise<MockSandbox> {
        const id = `sbx_mock_${randomUUID().slice(0, 8)}`;
        return {
            id,
            async close() {
                // no-op
            },
        };
    },

    async runCommand(_sbx: MockSandbox, cmd: string): Promise<{
        exitCode: number;
        stdout: string;
        stderr: string;
    }> {
        return {
            exitCode: 0,
            stdout: `[mocked run] ${cmd}`,
            stderr: "",
        };
    },

    async writeFile(
        _sbx: MockSandbox,
        path: string,
        content: string | Buffer,
    ): Promise<void> {
        // no-op; recorded only in the test runner's view
        if (path === "") {
            throw new Error("writeFile: path must be non-empty");
        }
        if (typeof content === "string" && content.length > 100_000_000) {
            throw new Error("writeFile: content too large");
        }
    },
};

// ---- Trigger.dev ---------------------------------------------------------

export const triggerMock = {
    async run(taskId: string, payload: Record<string, unknown>): Promise<{
        runId: string;
    }> {
        return {
            runId: `run_mock_${taskId}_${randomUUID().slice(0, 8)}`,
        };
    },
};

// ---- PostHog -------------------------------------------------------------

export const posthogMock = {
    capture(_event: string, _properties: Record<string, unknown>): void {
        // no-op
    },
    identify(_userId: string, _properties: Record<string, unknown>): void {
        // no-op
    },
};
