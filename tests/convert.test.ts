import { describe, it, expect } from "vitest";
import { convertToCube, convertHaldToCube, toCubeFilename } from "../src/convert";
import { neutralStrip, neutralHald, dataLines } from "./helpers";

describe("convertToCube — strip", () => {
  it.each([16, 32])("converts a neutral size-%i strip to an identity cube", (size) => {
    const { data, width } = neutralStrip(size);
    const lines = dataLines(convertToCube(data, width, size));
    expect(lines).toHaveLength(size ** 3);
    expect(lines[0]).toBe("0.000000 0.000000 0.000000");
    expect(lines[lines.length - 1]).toBe("1.000000 1.000000 1.000000");
  });

  it("orders output red-fastest, then green, then blue", () => {
    const size = 16;
    const { data, width } = neutralStrip(size);
    const lines = dataLines(convertToCube(data, width, size));
    expect(lines[1]).toBe("0.066667 0.000000 0.000000");
    expect(lines[size]).toBe("0.000000 0.066667 0.000000");
    expect(lines[size * size]).toBe("0.000000 0.000000 0.066667");
  });

  it("writes the title header", () => {
    const { data, width } = neutralStrip(2);
    expect(convertToCube(data, width, 2, { title: "cinematic" }).startsWith('TITLE "cinematic"\nLUT_3D_SIZE 2')).toBe(true);
  });
});

describe("convertToCube — atlas band via yOffset", () => {
  it("reads the band selected by yOffset", () => {
    const size = 4;
    const band0 = neutralStrip(size); // identity
    const band1 = neutralStrip(size, true); // inverted red
    const width = band0.width;
    // stack the two bands vertically
    const atlas = new Uint8ClampedArray(width * size * 2 * 4);
    atlas.set(band0.data, 0);
    atlas.set(band1.data, band0.data.length);

    const top = dataLines(convertToCube(atlas, width, size, { yOffset: 0 }));
    const bottom = dataLines(convertToCube(atlas, width, size, { yOffset: size }));

    expect(top[0]).toBe("0.000000 0.000000 0.000000"); // identity
    expect(bottom[0]).toBe("1.000000 0.000000 0.000000"); // red inverted
  });
});

describe("convertHaldToCube", () => {
  it("converts a neutral HALD to an identity cube", () => {
    const size = 4; // 255/(size-1) = 85, exact bytes
    const lines = dataLines(convertHaldToCube(neutralHald(size), size));
    expect(lines).toHaveLength(size ** 3);
    expect(lines[0]).toBe("0.000000 0.000000 0.000000");
    expect(lines[lines.length - 1]).toBe("1.000000 1.000000 1.000000");
    expect(lines[1]).toBe("0.333333 0.000000 0.000000"); // one red step
  });
});

describe("toCubeFilename", () => {
  it("swaps a trailing .png for .cube", () => {
    expect(toCubeFilename("grade.png")).toBe("grade.cube");
  });

  it("strips only the final .png from multi-dot names", () => {
    expect(toCubeFilename("cinematic.v2.png")).toBe("cinematic.v2.cube");
  });

  it("tags atlas bands with a zero-padded index", () => {
    expect(toCubeFilename("pack.png", 3)).toBe("pack-lut03.cube");
  });
});
