/**
 * Studio deterministic utilities: slicer geometry + pixel-snap quantization.
 * Pure logic, no canvas needed.
 */
import { describe, it, expect } from "vitest";

import { sliceByGrid, sliceByFixedSize } from "../slicer.js";
import { nearest, snapToPalette, posterize, PALETTES } from "../pixel-snap.js";
import { heightField, normalMap, roughnessMap, derivePbr } from "../material-maps.js";

/** Build a flat WxH RGBA buffer of one colour. */
function flat(w: number, h: number, rgb: [number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
  }
  return { data, width: w, height: h };
}

describe("slicer", () => {
  it("slices a clean 4x4 grid into 16 frames in reading order", () => {
    const frames = sliceByGrid({ sheetWidth: 256, sheetHeight: 256, rows: 4, cols: 4 });
    expect(frames).toHaveLength(16);
    expect(frames[0]).toEqual({ index: 0, x: 0, y: 0, width: 64, height: 64 });
    expect(frames[4]).toEqual({ index: 4, x: 0, y: 64, width: 64, height: 64 }); // row 2, col 1
    expect(frames[15]).toEqual({ index: 15, x: 192, y: 192, width: 64, height: 64 });
  });

  it("accounts for margin between cells", () => {
    const frames = sliceByGrid({ sheetWidth: 70, sheetHeight: 32, rows: 1, cols: 2, margin: 6 });
    expect(frames[0].width).toBe(32);
    expect(frames[1].x).toBe(38); // 32 + 6 margin
  });

  it("infers the grid from a fixed frame size", () => {
    const frames = sliceByFixedSize({ sheetWidth: 128, sheetHeight: 64, frameWidth: 32, frameHeight: 32 });
    expect(frames).toHaveLength(8); // 4 cols x 2 rows
  });

  it("rejects invalid specs", () => {
    expect(() => sliceByGrid({ sheetWidth: 10, sheetHeight: 10, rows: 0, cols: 1 })).toThrow();
  });
});

describe("pixel-snap", () => {
  it("finds the nearest palette colour", () => {
    expect(nearest([10, 10, 10], PALETTES.gameboy)).toEqual([15, 56, 15]);
    expect(nearest([250, 240, 230], PALETTES.gameboy)).toEqual([155, 188, 15]);
  });

  it("snaps an RGBA buffer to a palette, preserving alpha", () => {
    const rgba = new Uint8ClampedArray([12, 12, 12, 200, 250, 240, 230, 128]);
    const out = snapToPalette(rgba, PALETTES.gameboy);
    expect([out[0], out[1], out[2]]).toEqual([15, 56, 15]);
    expect(out[3]).toBe(200); // alpha kept
    expect(out[7]).toBe(128);
  });

  it("posterize reduces to N levels per channel", () => {
    const rgba = new Uint8ClampedArray([100, 100, 100, 255]);
    const out = posterize(rgba, 2); // only 0 and 255 allowed
    expect(out[0]).toBe(255 - 0 === 255 ? out[0] : out[0]); // value snaps to {0,255}
    expect([0, 255]).toContain(out[0]);
    expect(out[3]).toBe(255);
  });

  it("rejects an empty palette", () => {
    expect(() => snapToPalette(new Uint8ClampedArray([0, 0, 0, 255]), [])).toThrow();
  });
});

describe("material-maps (PBR derivation)", () => {
  const base = flat(4, 4, [128, 128, 128]);

  it("height field is uniform for a flat colour", () => {
    const h = heightField(base);
    expect(h).toHaveLength(16);
    expect(h.every((v) => Math.abs(v - h[0]) < 1e-6)).toBe(true);
  });

  it("normal map of a flat image points straight up (z≈255, xy≈128)", () => {
    const n = normalMap(base);
    // center pixel
    const i = (1 * 4 + 1) * 4;
    expect(n[i]).toBeCloseTo(128, -1);
    expect(n[i + 1]).toBeCloseTo(128, -1);
    expect(n[i + 2]).toBe(255);
  });

  it("roughness is the inverse of luminance", () => {
    const bright = roughnessMap(flat(2, 2, [255, 255, 255]));
    const dark = roughnessMap(flat(2, 2, [0, 0, 0]));
    expect(bright[0]).toBeLessThan(dark[0]); // bright base → low roughness
  });

  it("derivePbr returns all maps at the right size", () => {
    const pbr = derivePbr(base);
    expect(pbr.normal).toHaveLength(64);
    expect(pbr.roughness).toHaveLength(64);
    expect(pbr.ao).toHaveLength(64);
  });
});
