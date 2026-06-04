/**
 * Palette swap — caveat-2 fix (WFC/mixed-source tiles look inconsistent).
 *
 * Re-maps an arbitrary tile color onto the shared style-pack palette
 * (style_packs.palette_hex). Tiles from different CC0 sources, quantized to the
 * same palette, read as a coherent set; the same tileset re-palettized serves
 * multiple biomes (forest → haunted woods). WFC chooses adjacency; palette swap
 * unifies color; the style pack's post_fx finishes the look.
 *
 * Pure, synchronous, zero-dep. Operates on hex strings / RGB tuples — the actual
 * pixel rewrite happens where the tileset image is processed (W3 / asset stage);
 * here we expose the deterministic color mapping used to build the palette LUT.
 */

export interface Rgb {
    r: number;
    g: number;
    b: number;
}

/** Parse "#rrggbb" / "#rgb" → RGB. Returns null on malformed input. */
export function hexToRgb(hex: string): Rgb | null {
    const h = hex.trim().replace(/^#/, "");
    if (h.length === 3) {
        const r = parseInt(h[0]! + h[0]!, 16);
        const g = parseInt(h[1]! + h[1]!, 16);
        const b = parseInt(h[2]! + h[2]!, 16);
        return [r, g, b].some(Number.isNaN) ? null : { r, g, b };
    }
    if (h.length === 6) {
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        return [r, g, b].some(Number.isNaN) ? null : { r, g, b };
    }
    return null;
}

export function rgbToHex({ r, g, b }: Rgb): string {
    const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
    return `#${c(r)}${c(g)}${c(b)}`;
}

/** Perceptual-ish squared distance (weighted, cheap; good enough for LUTs). */
export function colorDistance(a: Rgb, b: Rgb): number {
    // Rec.601 luma weights — favours matching brightness ramps over raw RGB.
    const dr = (a.r - b.r) * 0.3;
    const dg = (a.g - b.g) * 0.59;
    const db = (a.b - b.b) * 0.11;
    return dr * dr + dg * dg + db * db;
}

/**
 * A target palette built from a style pack's palette_hex. `nearest()` snaps any
 * color to the closest palette entry — the core of the consistency fix.
 */
export class Palette {
    private readonly colors: Rgb[];

    constructor(hexColors: readonly string[]) {
        this.colors = hexColors
            .map((h) => hexToRgb(h))
            .filter((c): c is Rgb => c !== null);
    }

    get size(): number {
        return this.colors.length;
    }

    /** Snap a color to the nearest palette entry. Identity if palette is empty. */
    nearest(color: Rgb): Rgb {
        if (this.colors.length === 0) return color;
        let best = this.colors[0]!;
        let bestD = colorDistance(color, best);
        for (let i = 1; i < this.colors.length; i++) {
            const d = colorDistance(color, this.colors[i]!);
            if (d < bestD) {
                bestD = d;
                best = this.colors[i]!;
            }
        }
        return best;
    }

    nearestHex(hex: string): string {
        const rgb = hexToRgb(hex);
        return rgb ? rgbToHex(this.nearest(rgb)) : hex;
    }

    /**
     * Build a remap LUT from a source set of colors to this palette. Used to
     * recolor a tileset's color table deterministically.
     */
    buildLut(sourceHex: readonly string[]): Map<string, string> {
        const lut = new Map<string, string>();
        for (const hex of sourceHex) {
            const rgb = hexToRgb(hex);
            if (rgb) lut.set(hex.toLowerCase(), rgbToHex(this.nearest(rgb)));
        }
        return lut;
    }
}
