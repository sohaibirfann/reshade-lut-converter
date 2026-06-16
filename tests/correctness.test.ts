import { describe, it, expect } from "vitest";
import { convertToCube, convertHaldToCube } from "../src/convert";
import { stripFromCells, haldFromCells, dataLines, type Cell } from "./helpers";

// Stand-in for an external reference (lut-utility isn't runnable here): a known
// graded cube computed independently of the converter, used as ground truth.
const norm = (byte: number): string => (byte / 255).toFixed(6);

describe("conversion matches an independent reference cube", () => {
  const size = 16;

  // Non-trivial grade: warmer reds, cooler blues — exercises all channels.
  const cell: Cell = (r, g, b) => [
    Math.min(255, Math.round((r / (size - 1)) * 255 * 1.15)),
    Math.round((g / (size - 1)) * 255),
    Math.min(255, Math.round((b / (size - 1)) * 255 * 0.85)),
  ];

  // Reference cube text in .cube order (red fastest, then green, then blue).
  const expected: string[] = [];
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const [R, G, B] = cell(r, g, b);
        expected.push(`${norm(R)} ${norm(G)} ${norm(B)}`);
      }
    }
  }

  it("strip conversion reproduces the reference exactly", () => {
    const { data, width } = stripFromCells(size, cell);
    expect(dataLines(convertToCube(data, width, size))).toEqual(expected);
  });

  it("HALD conversion reproduces the reference exactly", () => {
    expect(dataLines(convertHaldToCube(haldFromCells(size, cell), size))).toEqual(expected);
  });

  it("strip and HALD produce byte-identical output for the same cube", () => {
    const { data, width } = stripFromCells(size, cell);
    expect(convertToCube(data, width, size)).toBe(convertHaldToCube(haldFromCells(size, cell), size));
  });
});
