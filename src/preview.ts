// Maps integer cube coordinates to the byte offset of that cell in the LUT.
type CellFn = (ri: number, gi: number, bi: number) => number;

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// Trilinear interpolation: blend the 8 surrounding cube cells so gradients in
// the preview stay smooth instead of banding to the nearest grid point.
function sampleThrough(
  image: ImageData,
  lut: Uint8ClampedArray,
  size: number,
  cell: CellFn,
): ImageData {
  const out = new ImageData(image.width, image.height);
  const d = image.data;
  const max = size - 1;

  for (let i = 0; i < d.length; i += 4) {
    const fr = (d[i] / 255) * max;
    const fg = (d[i + 1] / 255) * max;
    const fb = (d[i + 2] / 255) * max;
    const r0 = Math.floor(fr);
    const g0 = Math.floor(fg);
    const b0 = Math.floor(fb);
    const r1 = Math.min(r0 + 1, max);
    const g1 = Math.min(g0 + 1, max);
    const b1 = Math.min(b0 + 1, max);
    const dr = fr - r0;
    const dg = fg - g0;
    const db = fb - b0;

    const c000 = cell(r0, g0, b0);
    const c100 = cell(r1, g0, b0);
    const c010 = cell(r0, g1, b0);
    const c110 = cell(r1, g1, b0);
    const c001 = cell(r0, g0, b1);
    const c101 = cell(r1, g0, b1);
    const c011 = cell(r0, g1, b1);
    const c111 = cell(r1, g1, b1);

    for (let c = 0; c < 3; c++) {
      const x00 = lerp(lut[c000 + c], lut[c100 + c], dr);
      const x10 = lerp(lut[c010 + c], lut[c110 + c], dr);
      const x01 = lerp(lut[c001 + c], lut[c101 + c], dr);
      const x11 = lerp(lut[c011 + c], lut[c111 + c], dr);
      out.data[i + c] = lerp(lerp(x00, x10, dg), lerp(x01, x11, dg), db);
    }
    out.data[i + 3] = d[i + 3];
  }
  return out;
}

export function applyStrip(
  image: ImageData,
  lut: Uint8ClampedArray,
  lutWidth: number,
  size: number,
  yOffset = 0,
): ImageData {
  return sampleThrough(image, lut, size, (ri, gi, bi) =>
    ((yOffset + gi) * lutWidth + bi * size + ri) * 4,
  );
}

export function applyHald(image: ImageData, lut: Uint8ClampedArray, size: number): ImageData {
  return sampleThrough(image, lut, size, (ri, gi, bi) => (ri + gi * size + bi * size * size) * 4);
}

// Mix graded toward the original by `t` (0 = original, 1 = full grade). Preview only.
export function blend(original: ImageData, graded: ImageData, t: number): ImageData {
  const out = new ImageData(original.width, original.height);
  for (let i = 0; i < original.data.length; i++) {
    out.data[i] = original.data[i] + (graded.data[i] - original.data[i]) * t;
  }
  return out;
}
