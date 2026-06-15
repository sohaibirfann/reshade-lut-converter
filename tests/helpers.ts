// neutral strip: red along x, green down y, blue per slice. `invertRed` grades it.
export function neutralStrip(size: number, invertRed = false) {
  const width = size * size;
  const data = new Uint8ClampedArray(width * size * 4);
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const idx = (g * width + b * size + r) * 4;
        const red = invertRed ? size - 1 - r : r;
        data[idx] = Math.round((red / (size - 1)) * 255);
        data[idx + 1] = Math.round((g / (size - 1)) * 255);
        data[idx + 2] = Math.round((b / (size - 1)) * 255);
        data[idx + 3] = 255;
      }
    }
  }
  return { data, width };
}

// neutral HALD: pixel i encodes (r,g,b) in red-fastest order.
export function neutralHald(size: number): Uint8ClampedArray {
  const count = size * size * size;
  const data = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    const r = i % size;
    const g = Math.floor(i / size) % size;
    const b = Math.floor(i / (size * size)) % size;
    data[i * 4] = Math.round((r / (size - 1)) * 255);
    data[i * 4 + 1] = Math.round((g / (size - 1)) * 255);
    data[i * 4 + 2] = Math.round((b / (size - 1)) * 255);
    data[i * 4 + 3] = 255;
  }
  return data;
}
