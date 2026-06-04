/**
 * Autotiling — caveat-1 fix (only 35 tilesets in the DB).
 *
 * From a single "blob" tileset (the 47-tile reference arrangement) we pick the
 * correct tile variant for each filled cell from its 8-neighbour bitmask. This
 * turns ONE base tileset into a complete, seam-correct terrain set — the free
 * tier gets rich maps with no AI generation. Pure, synchronous, zero-dep.
 *
 * Reference: the 47-tile "blob" set (4-bit edge + corner mask) covers every
 * meaningful neighbourhood. We compute the canonical blob index and map it to a
 * gid offset within the tileset (firstgid + offset).
 *
 * The 8 neighbours, bit positions (matching the common blob convention):
 *   NW(1)  N(2)  NE(4)
 *    W(8)   *   E(16)
 *   SW(32) S(64) SE(128)
 * Corner bits only count when both adjacent edges are filled (so corners do not
 * create impossible tiles) — this reduces 256 → 47 canonical cases.
 */

/** filled[y][x] = true means this cell is the terrain we're auto-tiling. */
export type FilledMask = boolean[][];

function at(mask: FilledMask, x: number, y: number): boolean {
    return mask[y]?.[x] === true;
}

/**
 * Compute the 8-bit blob mask for cell (x,y), with corner bits gated on their
 * two adjacent edges (the standard rule that collapses 256 → 47).
 */
export function blobMask(mask: FilledMask, x: number, y: number): number {
    const n = at(mask, x, y - 1);
    const s = at(mask, x, y + 1);
    const w = at(mask, x - 1, y);
    const e = at(mask, x + 1, y);
    const nw = at(mask, x - 1, y - 1) && n && w;
    const ne = at(mask, x + 1, y - 1) && n && e;
    const sw = at(mask, x - 1, y + 1) && s && w;
    const se = at(mask, x + 1, y + 1) && s && e;

    return (
        (nw ? 1 : 0) |
        (n ? 2 : 0) |
        (ne ? 4 : 0) |
        (w ? 8 : 0) |
        (e ? 16 : 0) |
        (sw ? 32 : 0) |
        (s ? 64 : 0) |
        (se ? 128 : 0)
    );
}

/**
 * Build the canonical 47-entry lookup: each distinct gated bitmask → a dense
 * 0..46 index. Deterministic (sorted), so the same mask always maps to the same
 * tile offset across runs and engines.
 */
function buildBlob47Table(): Map<number, number> {
    const seen = new Set<number>();
    // Enumerate all 256 raw masks, re-gate corners, collect the distinct values.
    for (let raw = 0; raw < 256; raw++) {
        const n = !!(raw & 2);
        const s = !!(raw & 64);
        const w = !!(raw & 8);
        const e = !!(raw & 16);
        const nw = !!(raw & 1) && n && w;
        const ne = !!(raw & 4) && n && e;
        const sw = !!(raw & 32) && s && w;
        const se = !!(raw & 128) && s && e;
        const gated =
            (nw ? 1 : 0) | (n ? 2 : 0) | (ne ? 4 : 0) | (w ? 8 : 0) |
            (e ? 16 : 0) | (sw ? 32 : 0) | (s ? 64 : 0) | (se ? 128 : 0);
        seen.add(gated);
    }
    const sorted = [...seen].sort((a, b) => a - b);
    const table = new Map<number, number>();
    sorted.forEach((m, i) => table.set(m, i));
    return table;
}

const BLOB47 = buildBlob47Table();

/** Number of distinct tiles a blob tileset must provide (canonically 47). */
export const BLOB_TILE_COUNT = BLOB47.size;

/**
 * Resolve the gid for a filled cell from its neighbourhood. Empty cells return
 * 0 (no tile). `firstgid` is the tileset's base gid in the Tiled map.
 */
export function autotileGid(mask: FilledMask, x: number, y: number, firstgid: number): number {
    if (!at(mask, x, y)) return 0;
    const offset = BLOB47.get(blobMask(mask, x, y)) ?? 0;
    return firstgid + offset;
}

/**
 * Auto-tile a whole filled mask into a flat gid array (row-major, length w*h)
 * ready for a Tiled tilelayer `data`.
 */
export function autotileLayer(mask: FilledMask, firstgid: number): number[] {
    const h = mask.length;
    const w = mask[0]?.length ?? 0;
    const data: number[] = new Array(w * h).fill(0);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            data[y * w + x] = autotileGid(mask, x, y, firstgid);
        }
    }
    return data;
}
