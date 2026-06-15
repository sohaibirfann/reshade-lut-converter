export interface CubeOptions {
  title?: string;
}

// Red runs along x within a slice, green down y, blue picks the slice.
// Looping red-innermost gives the red-fastest order .cube expects.
export function convertToCube(
  data: Uint8ClampedArray,
  width: number,
  size: number,
  options: CubeOptions = {},
): string {
  const title = options.title ?? "converted";
  const lines: string[] = [
    `TITLE "${title}"`,
    `LUT_3D_SIZE ${size}`,
    "DOMAIN_MIN 0.0 0.0 0.0",
    "DOMAIN_MAX 1.0 1.0 1.0",
  ];

  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const px = b * size + r;
        const py = g;
        const idx = (py * width + px) * 4;
        const R = data[idx] / 255;
        const G = data[idx + 1] / 255;
        const B = data[idx + 2] / 255;
        lines.push(`${R.toFixed(6)} ${G.toFixed(6)} ${B.toFixed(6)}`);
      }
    }
  }

  return lines.join("\n") + "\n";
}

export function toCubeFilename(pngName: string): string {
  const base = pngName.replace(/\.png$/i, "");
  return `${base}.cube`;
}
