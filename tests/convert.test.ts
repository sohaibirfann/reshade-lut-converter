import { describe, it, expect } from "vitest";
import { convertToCube, toCubeFilename } from "../src/convert";

// Build a neutral (ungraded) ReShade strip: red along x, green down y, blue per slice.
function neutralStrip(size: number): { data: Uint8ClampedArray; width: number } {
  const width = size * size;
  const height = size;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const px = b * size + r;
        const idx = (g * width + px) * 4;
        data[idx] = Math.round((r / (size - 1)) * 255);
        data[idx + 1] = Math.round((g / (size - 1)) * 255);
        data[idx + 2] = Math.round((b / (size - 1)) * 255);
        data[idx + 3] = 255;
      }
    }
  }
  return { data, width };
}

function dataLines(cube: string): string[] {
  return cube
    .trimEnd()
    .split("\n")
    .filter((l) => /^[\d.]+ [\d.]+ [\d.]+$/.test(l));
}

describe("convertToCube", () => {
  it.each([16, 32])("converts a neutral size-%i strip to an identity cube", (size) => {
    const { data, width } = neutralStrip(size);
    const lines = dataLines(convertToCube(data, width, size));

    expect(lines).toHaveLength(size ** 3);
    expect(lines[0]).toBe("0.000000 0.000000 0.000000");
    expect(lines[lines.length - 1]).toBe("1.000000 1.000000 1.000000");
  });

  it("emits exactly size³ data lines", () => {
    const size = 8;
    const { data, width } = neutralStrip(size);
    const lines = dataLines(convertToCube(data, width, size));
    expect(lines).toHaveLength(512);
  });

  it("ramps the red axis cleanly with no color shift", () => {
    const size = 16;
    const { data, width } = neutralStrip(size);
    const lines = dataLines(convertToCube(data, width, size));

    // First slice/row: green and blue stay 0 while red climbs 0 → 1.
    for (let r = 0; r < size; r++) {
      const [R, G, B] = lines[r].split(" ").map(Number);
      expect(G).toBe(0);
      expect(B).toBe(0);
      if (r > 0) {
        const prev = Number(lines[r - 1].split(" ")[0]);
        expect(R).toBeGreaterThan(prev);
      }
    }
  });

  it("orders output red-fastest, then green, then blue", () => {
    const size = 16;
    const { data, width } = neutralStrip(size);
    const lines = dataLines(convertToCube(data, width, size));

    // index 1 → red advanced one step
    expect(lines[1]).toBe("0.066667 0.000000 0.000000");
    // index size → red reset, green advanced one step
    expect(lines[size]).toBe("0.000000 0.066667 0.000000");
    // index size² → red & green reset, blue advanced one step
    expect(lines[size * size]).toBe("0.000000 0.000000 0.066667");
  });

  it("writes the title header", () => {
    const { data, width } = neutralStrip(2);
    const cube = convertToCube(data, width, 2, { title: "cinematic" });
    expect(cube.startsWith('TITLE "cinematic"\nLUT_3D_SIZE 2')).toBe(true);
  });
});

describe("toCubeFilename", () => {
  it("swaps a trailing .png for .cube", () => {
    expect(toCubeFilename("grade.png")).toBe("grade.cube");
  });

  it("strips only the final .png from multi-dot names", () => {
    expect(toCubeFilename("cinematic.v2.png")).toBe("cinematic.v2.cube");
  });

  it("is case-insensitive on the extension", () => {
    expect(toCubeFilename("Grade.PNG")).toBe("Grade.cube");
  });
});
