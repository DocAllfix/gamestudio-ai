/**
 * Game Plan versioning backend — day-1 scope (BOM B.1).
 *
 * Persists a NEW plan version from a parent plan + an RFC 6902
 * GamePlanPatch (emitted by D.2 Design Planner). The patch is applied in
 * TS here, then recorded via the `apply_game_plan_diff` RPC (migration
 * 005) which enforces optimistic concurrency on `parent_version`.
 *
 * Out of scope (F2, Studio Mode UI / W4): interactive replay of the
 * patch chain + undo/redo.
 *
 * The Supabase client is injected so the wrapper is testable offline
 * (cf. lib/knowledge.ts uses a module-level singleton; here we take it
 * as a parameter to keep the persist path pure of env at import time).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
    type GamePlan,
    type GamePlanPatch,
} from "../contracts/game-plan.contract.js";

/** Split an RFC 6902 JSON Pointer ("/meta/title") into its segments,
 * decoding the ~1 / ~0 escapes per the spec. */
function pointerSegments(path: string): string[] {
    return path
        .split("/")
        .slice(1)
        .map((seg) => seg.replace(/~1/g, "/").replace(/~0/g, "~"));
}

/** Walk to the container holding the last segment, returning [parent,
 * key]. Throws if an intermediate path segment is missing. */
function resolveParent(
    root: Record<string, unknown>,
    segments: string[],
): [Record<string, unknown>, string] {
    let cursor: Record<string, unknown> = root;
    for (let i = 0; i < segments.length - 1; i++) {
        const next = cursor[segments[i]!];
        if (typeof next !== "object" || next === null) {
            throw new Error(`rfc6902: path segment "${segments[i]}" is not an object`);
        }
        cursor = next as Record<string, unknown>;
    }
    return [cursor, segments[segments.length - 1]!];
}

/** Apply add/remove/replace ops to a GamePlan, returning a NEW plan
 * (the input is not mutated). Only the three ops the contract emits are
 * supported. Object paths only (the plan has no array targets in the
 * day-1 refinement set). */
export function applyRfc6902(
    plan: GamePlan,
    ops: GamePlanPatch["ops"],
): GamePlan {
    const draft = structuredClone(plan) as unknown as Record<string, unknown>;
    for (const op of ops) {
        const segments = pointerSegments(op.path);
        if (segments.length === 0) {
            throw new Error("rfc6902: empty path is not supported");
        }
        const [parent, key] = resolveParent(draft, segments);
        if (op.op === "remove") {
            delete parent[key];
        } else {
            parent[key] = op.value;
        }
    }
    return draft as unknown as GamePlan;
}

export interface PersistDiffArgs {
    supabase: SupabaseClient;
    /** The current head plan the patch was computed against. */
    parentPlan: GamePlan;
    patch: GamePlanPatch;
}

export interface PersistDiffResult {
    new_version: number;
    /** Id of the inserted game_plan_versions row. */
    version_id: string;
    /** The materialized plan stored for the new version. */
    materialized_plan: GamePlan;
}

/** Apply the patch, bump the version, and record it via the RPC. The
 * RPC raises `parent_version_mismatch` when the project's latest version
 * has moved past `patch.parent_version`; we surface it as a thrown
 * Error so the caller (Hermes loop) can decide to re-fetch + retry. */
export async function persistGamePlanDiff(
    args: PersistDiffArgs,
): Promise<PersistDiffResult> {
    const { supabase, parentPlan, patch } = args;
    const newVersion = patch.parent_version + 1;
    const materialized: GamePlan = {
        ...applyRfc6902(parentPlan, patch.ops),
        plan_version: newVersion,
    };

    const { data, error } = await supabase.rpc("apply_game_plan_diff", {
        p_project_id: patch.project_id,
        p_parent_version: patch.parent_version,
        p_new_version: newVersion,
        p_patch: patch.ops,
        p_materialized_plan: materialized,
        p_summary: patch.summary,
    });

    if (error) {
        console.error({ context: "persistGamePlanDiff", patch, error });
        throw new Error(error.message);
    }

    return {
        new_version: newVersion,
        version_id: data as string,
        materialized_plan: materialized,
    };
}
