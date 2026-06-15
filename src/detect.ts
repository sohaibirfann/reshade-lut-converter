export type LayoutKind = "strip" | "hald" | "unknown";

export interface DetectionResult {
  kind: LayoutKind;
  edgeSize?: number;
  sliceCount?: number;
  error?: string;
  warning?: string;
}

export const HALD_MESSAGE =
  "This looks like a HALD CLUT, not a ReShade strip LUT — HALD support is planned but not yet available.";

export const UNKNOWN_MESSAGE =
  "Unrecognized image layout. Expected a horizontal strip LUT where width = size² and height = size (e.g. 256×16 or 1024×32).";

const MIN_EDGE = 2;

export function detectLayout(width: number, height: number): DetectionResult {
  if (width <= 0 || height <= 0) {
    return { kind: "unknown", error: UNKNOWN_MESSAGE };
  }

  if (width === height) {
    return { kind: "hald", error: HALD_MESSAGE };
  }

  if (width > height && width % height === 0) {
    const edgeSize = height;
    const sliceCount = width / height;

    if (edgeSize < MIN_EDGE) {
      return { kind: "unknown", error: UNKNOWN_MESSAGE };
    }

    const result: DetectionResult = { kind: "strip", edgeSize, sliceCount };

    // A normal cube has one slice per blue level, so slices should match the edge.
    if (sliceCount !== edgeSize) {
      result.warning = `Detected a ${edgeSize}×${edgeSize}×${edgeSize} strip, but the slice count (${sliceCount}) differs from the cube edge (${edgeSize}). This is unusual — proceed only if it's intentional.`;
    }

    return result;
  }

  return { kind: "unknown", error: UNKNOWN_MESSAGE };
}
