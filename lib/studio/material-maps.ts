/**
 * Material maps — derive a PBR set from a single base-colour image (Studio).
 *
 * Like Sorceress's Material Forge: AI (or the user) provides only the base
 * colour; the other maps are DERIVED deterministically here (no AI, no cost):
 *   - height   : luminance of the base colour
 *   - normal   : from the height gradient (Sobel), tangent-space RGB
 *   - roughness: inverse luminance, contrast-adjustable
 *   - ao       : local darkening from the height field
 * Operates on RGBA buffers + width/height so it's testable without a canvas;
 * the Studio UI decodes/encodes around it.
 */

interface Buf {
  data: Uint8ClampedArray | number[];
  width: number;
  height: number;
}

function lum(data: Uint8ClampedArray | number[], i: number): number {
  // Rec. 601 luma, 0..1
  return (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
}

/** Single-channel height field (0..1) from base-colour luminance. */
export function heightField(base: Buf): Float32Array {
  const { data, width, height } = base;
  const h = new Float32Array(width * height);
  for (let p = 0; p < width * height; p++) h[p] = lum(data, p * 4);
  return h;
}

function sample(h: Float32Array, x: number, y: number, w: number, hgt: number): number {
  const cx = Math.max(0, Math.min(w - 1, x));
  const cy = Math.max(0, Math.min(hgt - 1, y));
  return h[cy * w + cx];
}

/** Tangent-space normal map (RGBA) from the height field, via Sobel gradient. */
export function normalMap(base: Buf, strength = 2): Uint8ClampedArray {
  const { width: w, height: hgt } = base;
  const h = heightField(base);
  const out = new Uint8ClampedArray(w * hgt * 4);
  for (let y = 0; y < hgt; y++) {
    for (let x = 0; x < w; x++) {
      const gx =
        sample(h, x - 1, y - 1, w, hgt) + 2 * sample(h, x - 1, y, w, hgt) + sample(h, x - 1, y + 1, w, hgt) -
        (sample(h, x + 1, y - 1, w, hgt) + 2 * sample(h, x + 1, y, w, hgt) + sample(h, x + 1, y + 1, w, hgt));
      const gy =
        sample(h, x - 1, y - 1, w, hgt) + 2 * sample(h, x, y - 1, w, hgt) + sample(h, x + 1, y - 1, w, hgt) -
        (sample(h, x - 1, y + 1, w, hgt) + 2 * sample(h, x, y + 1, w, hgt) + sample(h, x + 1, y + 1, w, hgt));
      // Normal = normalize(-gx*s, -gy*s, 1) → mapped to 0..255
      const nx = -gx * strength;
      const ny = -gy * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      const i = (y * w + x) * 4;
      out[i] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255);
      out[i + 3] = 255;
    }
  }
  return out;
}

/** Roughness map (grayscale RGBA): inverse luminance with contrast. */
export function roughnessMap(base: Buf, contrast = 1): Uint8ClampedArray {
  const { data, width: w, height: hgt } = base;
  const out = new Uint8ClampedArray(w * hgt * 4);
  for (let p = 0; p < w * hgt; p++) {
    const l = lum(data, p * 4);
    let r = 1 - l;
    r = Math.max(0, Math.min(1, (r - 0.5) * contrast + 0.5));
    const v = Math.round(r * 255);
    const i = p * 4;
    out[i] = out[i + 1] = out[i + 2] = v;
    out[i + 3] = 255;
  }
  return out;
}

/** Ambient occlusion (grayscale RGBA): local darkening vs neighbourhood mean. */
export function aoMap(base: Buf, intensity = 1): Uint8ClampedArray {
  const { width: w, height: hgt } = base;
  const h = heightField(base);
  const out = new Uint8ClampedArray(w * hgt * 4);
  for (let y = 0; y < hgt; y++) {
    for (let x = 0; x < w; x++) {
      const center = sample(h, x, y, w, hgt);
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          sum += sample(h, x + dx, y + dy, w, hgt);
          n++;
        }
      const mean = sum / n;
      // Below-average height = occluded.
      const occ = Math.max(0, mean - center) * intensity;
      const v = Math.round((1 - Math.min(1, occ)) * 255);
      const i = (y * w + x) * 4;
      out[i] = out[i + 1] = out[i + 2] = v;
      out[i + 3] = 255;
    }
  }
  return out;
}

export interface PbrSet {
  normal: Uint8ClampedArray;
  roughness: Uint8ClampedArray;
  ao: Uint8ClampedArray;
}

/** Derive the full PBR set from a base-colour buffer. */
export function derivePbr(base: Buf, opts?: { normalStrength?: number; roughnessContrast?: number; aoIntensity?: number }): PbrSet {
  return {
    normal: normalMap(base, opts?.normalStrength ?? 2),
    roughness: roughnessMap(base, opts?.roughnessContrast ?? 1),
    ao: aoMap(base, opts?.aoIntensity ?? 1),
  };
}
