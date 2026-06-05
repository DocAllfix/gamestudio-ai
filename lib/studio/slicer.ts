/**
 * Slicer — split a sprite sheet into individual frames (Studio utility).
 *
 * Deterministic, zero-dependency geometry: given sheet dimensions and either a
 * grid (rows × cols) or a fixed frame size, it returns the pixel rect of each
 * frame in reading order. The browser (Studio UI) draws each rect to a canvas
 * to produce the frame PNGs; this module owns the math so it's unit-testable
 * without a canvas. Mirrors what Sorceress's Slicer does, but as pure logic.
 */

export interface FrameRect {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridSpec {
  sheetWidth: number;
  sheetHeight: number;
  rows: number;
  cols: number;
  /** Uniform gap between cells (e.g. padding the generator added). */
  margin?: number;
  /** Optional outer offset before the first cell. */
  offset?: number;
}

export interface FixedSizeSpec {
  sheetWidth: number;
  sheetHeight: number;
  frameWidth: number;
  frameHeight: number;
  margin?: number;
  offset?: number;
}

/** Slice by an explicit rows × cols grid. */
export function sliceByGrid(spec: GridSpec): FrameRect[] {
  const { sheetWidth, sheetHeight, rows, cols } = spec;
  const margin = spec.margin ?? 0;
  const offset = spec.offset ?? 0;
  if (rows < 1 || cols < 1) throw new Error("slicer: rows and cols must be >= 1");

  const usableW = sheetWidth - offset * 2 - margin * (cols - 1);
  const usableH = sheetHeight - offset * 2 - margin * (rows - 1);
  const frameW = Math.floor(usableW / cols);
  const frameH = Math.floor(usableH / rows);
  if (frameW <= 0 || frameH <= 0) throw new Error("slicer: computed frame size <= 0");

  const frames: FrameRect[] = [];
  let index = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      frames.push({
        index: index++,
        x: offset + c * (frameW + margin),
        y: offset + r * (frameH + margin),
        width: frameW,
        height: frameH,
      });
    }
  }
  return frames;
}

/** Slice by a fixed frame size, inferring the grid that fits the sheet. */
export function sliceByFixedSize(spec: FixedSizeSpec): FrameRect[] {
  const { sheetWidth, sheetHeight, frameWidth, frameHeight } = spec;
  const margin = spec.margin ?? 0;
  const offset = spec.offset ?? 0;
  if (frameWidth < 1 || frameHeight < 1) throw new Error("slicer: frame size must be >= 1");

  const cols = Math.max(1, Math.floor((sheetWidth - offset * 2 + margin) / (frameWidth + margin)));
  const rows = Math.max(1, Math.floor((sheetHeight - offset * 2 + margin) / (frameHeight + margin)));

  const frames: FrameRect[] = [];
  let index = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      frames.push({
        index: index++,
        x: offset + c * (frameWidth + margin),
        y: offset + r * (frameHeight + margin),
        width: frameWidth,
        height: frameHeight,
      });
    }
  }
  return frames;
}
