/**
 * level_layout_2d — strategy selection, grant→slot, and the reachability moat.
 * All deps injected: no LLM, no rot-js, no network.
 */
import { describe, expect, it, vi } from "vitest";

import levelLayout2d from "../level_layout_2d/index.js";
import { ToolExecutionResultSchema } from "../../../contracts/tool-registry.contract.js";
import { isReachable } from "../_reachability.js";
import type { RotMapResult } from "../_strategies.js";

const baseInvocation = {
    tool_id: "level_layout_2d" as const,
    node_id: "room_1",
    project_id: "00000000-0000-4000-8000-000000000000",
    plan_version: 1,
    trace_id: "trace_ll2",
};

const node = (grants: string[] = []) => ({
    id: "room_1",
    display_name: "Room 1",
    requires: [],
    grants,
    tags: [],
});

/** A fully-open floor mask of w*h with two anchors. */
function openFloor(w: number, h: number): RotMapResult {
    return {
        floor: Array.from({ length: h }, () => Array.from({ length: w }, () => true)),
        anchors: [{ x: 1, y: 1 }, { x: w - 2, y: h - 2 }],
    };
}

describe("level_layout_2d", () => {
    it("non-spatial genre (visual_novel) early-returns succeeded, no map", async () => {
        const res = await levelLayout2d.handler(
            { ...baseInvocation, input: { genre: "visual_novel", node: node() } },
            { complete: vi.fn(), rotMap: vi.fn(), isReachable },
        );
        expect(res.status).toBe("succeeded");
        expect(res.output?.non_spatial).toBe(true);
    });

    it("roguelike uses a rot.js strategy and never calls the LLM", async () => {
        const complete = vi.fn();
        const res = await levelLayout2d.handler(
            { ...baseInvocation, input: { genre: "roguelike", node: node(["key_blue"]) } },
            { complete, rotMap: () => openFloor(16, 12), isReachable },
        );
        expect(complete).not.toHaveBeenCalled();
        expect(res.status).toBe("succeeded");
        const layout = res.output?.layout as { meta: { strategy: string }; entity_slots: unknown[] };
        expect(layout.meta.strategy).toBe("rotjs_uniform");
        // one required slot per grant
        expect(layout.entity_slots).toHaveLength(1);
    });

    it("produces a contract-valid ToolExecutionResult", async () => {
        const res = await levelLayout2d.handler(
            { ...baseInvocation, input: { genre: "roguelike", node: node() } },
            { complete: vi.fn(), rotMap: () => openFloor(16, 12), isReachable },
        );
        expect(() => ToolExecutionResultSchema.parse(res)).not.toThrow();
    });

    it("unreachable layout → rejected_by_qa after MAX_REGEN", async () => {
        // floor mask where entry region is walled off from the exit anchor
        const walled: RotMapResult = {
            floor: [
                [true, false, true],
                [true, false, true],
                [true, false, true],
            ],
            anchors: [{ x: 0, y: 0 }, { x: 2, y: 2 }], // entry left, exit right, separated
        };
        const res = await levelLayout2d.handler(
            { ...baseInvocation, input: { genre: "roguelike", node: node() } },
            { complete: vi.fn(), rotMap: () => walled, isReachable },
        );
        expect(res.status).toBe("rejected_by_qa");
        expect(res.output).toBeNull();
    });

    it("forced strategy honored (rotjs_cellular)", async () => {
        const res = await levelLayout2d.handler(
            { ...baseInvocation, input: { genre: "roguelike", node: node(), strategy: "rotjs_cellular" } },
            { complete: vi.fn(), rotMap: () => openFloor(16, 12), isReachable },
        );
        const layout = res.output?.layout as { meta: { strategy: string } };
        expect(layout.meta.strategy).toBe("rotjs_cellular");
    });
});
