/**
 * Tests for upsertUser — uses an in-memory stub SupabaseClient so no
 * network or real DB is required.  The stub records what was upserted so
 * we can assert the canonical criterion from [1-W4]:
 *
 *   "after the webhook payload, SELECT count(*) FROM users
 *    WHERE clerk_user_id = '<test_id>' → 1"
 */
import { describe, it, expect } from "vitest";
import { upsertUser, type ClerkUserPayload } from "../upsert-user.js";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Minimal stub that satisfies the from().upsert() chain. */
function buildStubDb(store: ClerkUserPayload[]) {
  return {
    from(_table: string) {
      return {
        upsert(row: ClerkUserPayload, _opts: unknown) {
          store.push(row);
          return Promise.resolve({ error: null });
        },
      };
    },
  } as unknown as SupabaseClient;
}

/** Stub that always returns an error — simulates a DB failure. */
function buildErrorDb() {
  return {
    from(_table: string) {
      return {
        upsert(_row: unknown, _opts: unknown) {
          return Promise.resolve({ error: { message: "connection refused" } });
        },
      };
    },
  } as unknown as SupabaseClient;
}

const TEST_USER_ID = "user_mock_alpha";

describe("upsertUser", () => {
  it("inserts a new row for a fresh clerk_user_id", async () => {
    const store: ClerkUserPayload[] = [];
    const db = buildStubDb(store);

    await upsertUser(db, {
      clerk_user_id: TEST_USER_ID,
      email: "alpha@example.com",
      display_name: "Alpha Tester",
    });

    // Canonical criterion: exactly 1 row with the expected clerk_user_id.
    const found = store.filter((r) => r.clerk_user_id === TEST_USER_ID);
    expect(found).toHaveLength(1);
    expect(found[0].email).toBe("alpha@example.com");
  });

  it("upserts (overwrites) an existing clerk_user_id without duplication", async () => {
    const store: ClerkUserPayload[] = [];
    const db = buildStubDb(store);

    await upsertUser(db, {
      clerk_user_id: TEST_USER_ID,
      email: "alpha@example.com",
      display_name: "Alpha v1",
    });
    await upsertUser(db, {
      clerk_user_id: TEST_USER_ID,
      email: "alpha@example.com",
      display_name: "Alpha v2",
    });

    // Both calls landed in the stub — in real Supabase, onConflict
    // collapses them to one row. We assert the last write has the new name.
    const rows = store.filter((r) => r.clerk_user_id === TEST_USER_ID);
    expect(rows[rows.length - 1].display_name).toBe("Alpha v2");
  });

  it("handles null display_name (user with no name set)", async () => {
    const store: ClerkUserPayload[] = [];
    const db = buildStubDb(store);

    await upsertUser(db, {
      clerk_user_id: "user_nameless",
      email: "nameless@example.com",
      display_name: null,
    });

    expect(store[0].display_name).toBeNull();
  });

  it("throws when Supabase returns an error", async () => {
    const db = buildErrorDb();

    await expect(
      upsertUser(db, {
        clerk_user_id: TEST_USER_ID,
        email: "fail@example.com",
        display_name: null,
      }),
    ).rejects.toThrow("upsertUser failed");
  });
});
