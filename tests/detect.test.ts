import { describe, it, expect } from "vitest";
import {
  detectLayout,
  HALD_MESSAGE,
  UNKNOWN_MESSAGE,
} from "../src/detect";

describe("detectLayout", () => {
  it("detects a standard 256×16 strip", () => {
    const r = detectLayout(256, 16);
    expect(r.kind).toBe("strip");
    expect(r.edgeSize).toBe(16);
    expect(r.sliceCount).toBe(16);
    expect(r.warning).toBeUndefined();
  });

  it("detects a standard 1024×32 strip", () => {
    const r = detectLayout(1024, 32);
    expect(r.kind).toBe("strip");
    expect(r.edgeSize).toBe(32);
    expect(r.sliceCount).toBe(32);
  });

  it("rejects a square image as HALD", () => {
    const r = detectLayout(256, 256);
    expect(r.kind).toBe("hald");
    expect(r.error).toBe(HALD_MESSAGE);
  });

  it("hard-errors on non-divisible dimensions", () => {
    const r = detectLayout(1920, 1080);
    expect(r.kind).toBe("unknown");
    expect(r.error).toBe(UNKNOWN_MESSAGE);
  });

  it("accepts a non-cubic strip and uses height as the cube edge", () => {
    // 1024×16: tile count (64) ≠ tile size (16), but still a clean strip.
    const r = detectLayout(1024, 16);
    expect(r.kind).toBe("strip");
    expect(r.edgeSize).toBe(16);
    expect(r.sliceCount).toBe(64);
    expect(r.warning).toBeDefined();
  });

  it("rejects degenerate sizes", () => {
    expect(detectLayout(0, 0).kind).toBe("unknown");
    expect(detectLayout(2, 1).kind).toBe("unknown"); // edge < 2
  });
});
