import { describe, it, expect } from "vitest";
import { detectLayout, UNKNOWN_MESSAGE, SQUARE_MESSAGE } from "../src/detect";

describe("detectLayout — strips", () => {
  it("detects a standard 256×16 strip", () => {
    const r = detectLayout(256, 16);
    expect(r).toMatchObject({ kind: "strip", edgeSize: 16, sliceCount: 16, lutCount: 1 });
    expect(r.warning).toBeUndefined();
  });

  it("detects a standard 1024×32 strip", () => {
    expect(detectLayout(1024, 32)).toMatchObject({ kind: "strip", edgeSize: 32 });
  });

  it("accepts a non-cubic strip and warns", () => {
    const r = detectLayout(1024, 16);
    expect(r).toMatchObject({ kind: "strip", edgeSize: 16, sliceCount: 64 });
    expect(r.warning).toBeDefined();
  });
});

describe("detectLayout — atlases", () => {
  it.each([
    [4096, 3200, 64, 50],
    [4096, 1984, 64, 31],
    [1089, 330, 33, 10],
  ])("detects a %i×%i MultiLUT atlas", (w, h, edge, count) => {
    expect(detectLayout(w, h)).toMatchObject({ kind: "atlas", edgeSize: edge, lutCount: count });
  });
});

describe("detectLayout — HALD", () => {
  it.each([
    [64, 16],
    [512, 64],
  ])("detects a %i× square HALD as edge %i", (side, edge) => {
    expect(detectLayout(side, side)).toMatchObject({ kind: "hald", edgeSize: edge });
  });

  it("rejects a square image that isn't a valid HALD size", () => {
    const r = detectLayout(500, 500);
    expect(r.kind).toBe("unknown");
    expect(r.error).toBe(SQUARE_MESSAGE);
  });

  it("rejects an oversized HALD", () => {
    // side 1728 → edge 144, beyond the limit
    expect(detectLayout(1728, 1728).kind).toBe("unknown");
  });
});

describe("detectLayout — rejections", () => {
  it("hard-errors on non-divisible dimensions", () => {
    const r = detectLayout(1920, 1080);
    expect(r.kind).toBe("unknown");
    expect(r.error).toBe(UNKNOWN_MESSAGE);
  });

  it("rejects degenerate sizes", () => {
    expect(detectLayout(0, 0).kind).toBe("unknown");
    expect(detectLayout(2, 1).kind).toBe("unknown"); // edge < 2
  });

  it("rejects an oversized edge that would exhaust memory", () => {
    expect(detectLayout(4096, 1024).kind).toBe("unknown");
  });
});
