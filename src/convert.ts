export interface CubeOptions {
  title?: string;
  /** Row offset into the source — used to read a single band of a MultiLUT atlas. */
  yOffset?: number;
}

function header(title: string, size: number): string[] {
  return [
    `TITLE "${title}"`,
    `LUT_3D_SIZE ${size}`,
    "DOMAIN_MIN 0.0 0.0 0.0",
    "DOMAIN_MAX 1.0 1.0 1.0",
  ];
}

function rgbLine(data: Uint8ClampedArray, idx: number): string {
  const r = (data[idx] / 255).toFixed(6);
  const g = (data[idx + 1] / 255).toFixed(6);
  const b = (data[idx + 2] / 255).toFixed(6);
  return `${r} ${g} ${b}`;
}

// Red runs along x within a slice, green down y, blue picks the slice.
// Looping red-innermost gives the red-fastest order .cube expects.
export function convertToCube(
  data: Uint8ClampedArray,
  width: number,
  size: number,
  options: CubeOptions = {},
): string {
  const yOffset = options.yOffset ?? 0;
  const lines = header(options.title ?? "converted", size);

  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const px = b * size + r;
        const py = yOffset + g;
        lines.push(rgbLine(data, (py * width + px) * 4));
      }
    }
  }

  return lines.join("\n") + "\n";
}

// A HALD's pixels are already row-major in red-fastest order, so entry i == pixel i.
export function convertHaldToCube(
  data: Uint8ClampedArray,
  size: number,
  options: CubeOptions = {},
): string {
  const lines = header(options.title ?? "converted", size);
  const count = size * size * size;

  for (let i = 0; i < count; i++) {
    lines.push(rgbLine(data, i * 4));
  }

  return lines.join("\n") + "\n";
}

// Strip the trailing `.png` and append `.cube`. For atlas bands, tag the index.
export function toCubeFilename(pngName: string, band?: number): string {
  const base = pngName.replace(/\.png$/i, "");
  if (band === undefined) return `${base}.cube`;
  return `${base}-lut${String(band).padStart(2, "0")}.cube`;
}
