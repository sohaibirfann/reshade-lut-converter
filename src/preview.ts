type IndexFn = (ri: number, gi: number, bi: number) => number;

// Walk the image, map each pixel to a nearest-neighbour cube cell, copy it out.
function sampleThrough(
  image: ImageData,
  lut: Uint8ClampedArray,
  size: number,
  toIndex: IndexFn,
): ImageData {
  const out = new ImageData(image.width, image.height);
  const max = size - 1;
  for (let i = 0; i < image.data.length; i += 4) {
    const ri = Math.round((image.data[i] / 255) * max);
    const gi = Math.round((image.data[i + 1] / 255) * max);
    const bi = Math.round((image.data[i + 2] / 255) * max);
    const idx = toIndex(ri, gi, bi);
    out.data[i] = lut[idx];
    out.data[i + 1] = lut[idx + 1];
    out.data[i + 2] = lut[idx + 2];
    out.data[i + 3] = image.data[i + 3];
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
