/**
 * Pixel Snap — turn an image into clean pixel art (Studio utility).
 *
 * Deterministic, zero-dependency. Operates on RGBA pixel arrays so it's
 * unit-testable without a canvas: the Studio UI decodes the image to ImageData,
 * calls these functions, then re-encodes. Two steps that matter for the
 * "less AI look" the community asks for: quantize to a small palette (optionally
 * a retro preset) and snap each pixel to the nearest palette colour.
 */

export type RGB = [number, number, number];

/** Built-in retro palettes (subset; extend as needed). */
export const PALETTES: Record<string, RGB[]> = {
  gameboy: [
    [15, 56, 15],
    [48, 98, 48],
    [139, 172, 15],
    [155, 188, 15],
  ],
  pico8: [
    [0, 0, 0], [29, 43, 83], [126, 37, 83], [0, 135, 81],
    [171, 82, 54], [95, 87, 79], [194, 195, 199], [255, 241, 232],
    [255, 0, 77], [255, 163, 0], [255, 236, 39], [0, 228, 54],
    [41, 173, 255], [131, 118, 156], [255, 119, 168], [255, 204, 170],
  ],
};

function dist2(a: RGB, b: RGB): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

/** Nearest colour in a palette (squared-distance, no sqrt needed). */
export function nearest(color: RGB, palette: RGB[]): RGB {
  let best = palette[0];
  let bestD = Infinity;
  for (const p of palette) {
    const d = dist2(color, p);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/**
 * Snap every pixel of an RGBA buffer to its nearest palette colour, preserving
 * alpha. Returns a new Uint8ClampedArray (does not mutate the input).
 */
export function snapToPalette(rgba: Uint8ClampedArray | number[], palette: RGB[]): Uint8ClampedArray {
  if (palette.length === 0) throw new Error("pixel-snap: palette must not be empty");
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const [r, g, b] = nearest([rgba[i], rgba[i + 1], rgba[i + 2]], palette);
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = rgba[i + 3]; // keep alpha
  }
  return out;
}

/**
 * Quantize to N levels per channel (posterize) — a palette-free way to reduce
 * colours toward a crisp pixel look. `levels` 2..256.
 */
export function posterize(rgba: Uint8ClampedArray | number[], levels: number): Uint8ClampedArray {
  const n = Math.max(2, Math.min(256, Math.floor(levels)));
  const step = 255 / (n - 1);
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    out[i] = Math.round(Math.round(rgba[i] / step) * step);
    out[i + 1] = Math.round(Math.round(rgba[i + 1] / step) * step);
    out[i + 2] = Math.round(Math.round(rgba[i + 2] / step) * step);
    out[i + 3] = rgba[i + 3];
  }
  return out;
}
