import { describe, it, expect } from "vitest";
import { makeZip } from "../src/zip";

const enc = new TextEncoder();
const dec = new TextDecoder();

function u32(buf: Uint8Array, at: number): number {
  return new DataView(buf.buffer).getUint32(at, true);
}

describe("makeZip", () => {
  it("writes valid local-header and end-of-central-directory signatures", () => {
    const zip = makeZip([{ name: "a.cube", data: enc.encode("hello") }]);
    expect(u32(zip, 0)).toBe(0x04034b50); // local file header
    // EOCD is the last 22 bytes
    expect(u32(zip, zip.length - 22)).toBe(0x06054b50);
  });

  it("records the right entry count", () => {
    const zip = makeZip([
      { name: "a.cube", data: enc.encode("a") },
      { name: "b.cube", data: enc.encode("b") },
      { name: "c.cube", data: enc.encode("c") },
    ]);
    const eocd = zip.length - 22;
    const view = new DataView(zip.buffer);
    expect(view.getUint16(eocd + 8, true)).toBe(3); // entries this disk
    expect(view.getUint16(eocd + 10, true)).toBe(3); // total entries
  });

  it("stores data uncompressed (bytes appear verbatim)", () => {
    const text = "TITLE \"x\"\n0.500000 0.500000 0.500000\n";
    const zip = makeZip([{ name: "x.cube", data: enc.encode(text) }]);
    expect(dec.decode(zip).includes(text)).toBe(true);
    expect(dec.decode(zip).includes("x.cube")).toBe(true);
  });

  it("computes a correct CRC-32", () => {
    // CRC-32 of "hello" is 0x3610a686.
    const zip = makeZip([{ name: "f", data: enc.encode("hello") }]);
    expect(u32(zip, 14)).toBe(0x3610a686); // crc field in the local header
  });
});
