import { describe, it, expect } from "vitest";
import { applyStrip, applyHald, blend } from "../src/preview";
import { neutralStrip, neutralHald } from "./helpers";

class FakeImageData {
  data: Uint8ClampedArray;
  constructor(public width: number, public height: number) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

(globalThis as unknown as { ImageData: unknown }).ImageData ??= FakeImageData;

function pixel(rgb: [number, number, number]): ImageData {
  const img = new ImageData(1, 1);
  img.data.set([...rgb, 255]);
  return img;
}

describe("applyStrip", () => {
  it("passes colour through an identity LUT", () => {
    const { data, width } = neutralStrip(4);
    const out = applyStrip(pixel([255, 0, 0]), data, width, 4);
    expect([out.data[0], out.data[1], out.data[2]]).toEqual([255, 0, 0]);
  });

  it("applies the grade — inverted red turns red to black", () => {
    const { data, width } = neutralStrip(4, true);
    const out = applyStrip(pixel([255, 0, 0]), data, width, 4);
    expect([out.data[0], out.data[1], out.data[2]]).toEqual([0, 0, 0]);
  });

  it("reads the band selected by yOffset", () => {
    const a = neutralStrip(4);
    const b = neutralStrip(4, true);
    const atlas = new Uint8ClampedArray(a.data.length * 2);
    atlas.set(a.data, 0);
    atlas.set(b.data, a.data.length);
    const out = applyStrip(pixel([255, 0, 0]), atlas, a.width, 4, 4);
    expect(out.data[0]).toBe(0); // band 1 inverts red
  });
});

describe("applyHald", () => {
  it("passes colour through an identity HALD", () => {
    const out = applyHald(pixel([255, 255, 255]), neutralHald(4), 4);
    expect([out.data[0], out.data[1], out.data[2]]).toEqual([255, 255, 255]);
  });
});

describe("blend", () => {
  const black = pixel([0, 0, 0]);
  const white = pixel([255, 255, 255]);

  it("returns the original at t=0 and the grade at t=1", () => {
    expect(blend(black, white, 0).data[0]).toBe(0);
    expect(blend(black, white, 1).data[0]).toBe(255);
  });

  it("mixes halfway at t=0.5", () => {
    expect(blend(black, white, 0.5).data[0]).toBe(128); // 127.5 ties-to-even in Uint8Clamped
  });
});
