// Nearest-neighbour lookup into the source strip — good enough for a preview.
export function applyLut(
  sample: ImageData,
  lut: Uint8ClampedArray,
  lutWidth: number,
  size: number,
): ImageData {
  const out = new ImageData(sample.width, sample.height);
  const max = size - 1;

  for (let i = 0; i < sample.data.length; i += 4) {
    const ri = Math.round((sample.data[i] / 255) * max);
    const gi = Math.round((sample.data[i + 1] / 255) * max);
    const bi = Math.round((sample.data[i + 2] / 255) * max);

    const idx = (gi * lutWidth + bi * size + ri) * 4;
    out.data[i] = lut[idx];
    out.data[i + 1] = lut[idx + 1];
    out.data[i + 2] = lut[idx + 2];
    out.data[i + 3] = sample.data[i + 3];
  }

  return out;
}
