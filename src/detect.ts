export type LayoutKind = "strip" | "atlas" | "hald" | "unknown";

export interface DetectionResult {
  kind: LayoutKind;
  edgeSize?: number;
  sliceCount?: number;
  lutCount?: number;
  error?: string;
  warning?: string;
}

export const UNKNOWN_MESSAGE =
  "Unrecognized image layout. Expected a ReShade strip (width = size², height = size), a MultiLUT atlas (height = size × N), or a square HALD CLUT.";

export const SQUARE_MESSAGE =
  "This is a square image but not a valid HALD CLUT — the side must equal size^1.5 (e.g. 64, 512, 1000).";

export const TOO_FEW_SLICES_MESSAGE =
  "This strip has fewer slices than its cube edge, so it doesn't contain a full LUT. Expected at least width = height² (e.g. 256×16).";

const MIN_EDGE = 2;
const MAX_EDGE = 128;

function inRange(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_EDGE && n <= MAX_EDGE;
}

// A HALD side is size^1.5, so size = ∛(side²). Returns null if it doesn't fit.
function haldEdge(side: number): number | null {
  const size = Math.round(Math.cbrt(side * side));
  return size * size * size === side * side ? size : null;
}

function detectHald(side: number): DetectionResult {
  const size = haldEdge(side);
  if (size !== null && inRange(size)) return { kind: "hald", edgeSize: size };
  return { kind: "unknown", error: SQUARE_MESSAGE };
}

// Horizontal strip; returns null when the shape isn't a strip at all.
function detectStrip(width: number, height: number): DetectionResult | null {
  if (width <= height || width % height !== 0) return null;
  const edgeSize = height;
  if (!inRange(edgeSize)) return { kind: "unknown", error: UNKNOWN_MESSAGE };

  const sliceCount = width / height;
  if (sliceCount < edgeSize) return { kind: "unknown", error: TOO_FEW_SLICES_MESSAGE };

  const result: DetectionResult = { kind: "strip", edgeSize, sliceCount, lutCount: 1 };
  if (sliceCount > edgeSize) {
    result.warning = `This strip has more slices (${sliceCount}) than the cube edge (${edgeSize}); only the first ${edgeSize} are used.`;
  }
  return result;
}

// Vertical stack of strips: width is a perfect square, height a multiple of √width.
function detectAtlas(width: number, height: number): DetectionResult | null {
  const s = Math.round(Math.sqrt(width));
  if (s * s !== width || !inRange(s) || height % s !== 0) return null;
  return { kind: "atlas", edgeSize: s, lutCount: height / s };
}

export function detectLayout(width: number, height: number): DetectionResult {
  if (width <= 0 || height <= 0) return { kind: "unknown", error: UNKNOWN_MESSAGE };
  if (width === height) return detectHald(width);
  return (
    detectStrip(width, height) ??
    detectAtlas(width, height) ?? { kind: "unknown", error: UNKNOWN_MESSAGE }
  );
}
