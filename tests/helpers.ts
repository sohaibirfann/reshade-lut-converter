// Extract just the "R G B" data lines from a .cube string (drops the header).
export function dataLines(cube: string): string[] {
  return cube.trimEnd().split("\n").filter((l) => /^[\d.]+ [\d.]+ [\d.]+$/.test(l));
}

// Returns the [R,G,B] bytes for a cube cell at integer coords (r,g,b).
export type Cell = (r: number, g: number, b: number) => [number, number, number];

// Write a cube into the ReShade strip layout: red along x, green down y, blue per slice.
export function stripFromCells(size: number, cell: Cell): { data: Uint8ClampedArray; width: number } {
  const width = size * size;
  const data = new Uint8ClampedArray(width * size * 4);
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const [R, G, B] = cell(r, g, b);
        const idx = (g * width + b * size + r) * 4;
        data[idx] = R;
        data[idx + 1] = G;
        data[idx + 2] = B;
        data[idx + 3] = 255;
      }
    }
  }
  return { data, width };
}

// Write the same cube into the HALD layout: pixels row-major in red-fastest order.
export function haldFromCells(size: number, cell: Cell): Uint8ClampedArray {
  const data = new Uint8ClampedArray(size * size * size * 4);
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const i = r + g * size + b * size * size;
        const [R, G, B] = cell(r, g, b);
        data[i * 4] = R;
        data[i * 4 + 1] = G;
        data[i * 4 + 2] = B;
        data[i * 4 + 3] = 255;
      }
    }
  }
  return data;
}

const channel = (i: number, size: number): number => Math.round((i / (size - 1)) * 255);

export function neutralStrip(size: number, invertRed = false): { data: Uint8ClampedArray; width: number } {
  return stripFromCells(size, (r, g, b) => [
    channel(invertRed ? size - 1 - r : r, size),
    channel(g, size),
    channel(b, size),
  ]);
}

export function neutralHald(size: number): Uint8ClampedArray {
  return haldFromCells(size, (r, g, b) => [channel(r, size), channel(g, size), channel(b, size)]);
}
