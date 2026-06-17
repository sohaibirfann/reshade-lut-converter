// Minimal store-only (uncompressed) ZIP writer — enough to bundle a few .cube
// files, with no dependency. Not ZIP64, so keep total size under 4 GB.

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function makeZip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const files = entries.map((e) => ({ name: enc.encode(e.name), data: e.data, crc: crc32(e.data) }));

  const LOCAL = 30; // local header size before name
  const CENTRAL = 46; // central header size before name
  let size = 22; // end-of-central-directory record
  for (const f of files) {
    size += LOCAL + f.name.length + f.data.length;
    size += CENTRAL + f.name.length;
  }

  const buf = new Uint8Array(size);
  const view = new DataView(buf.buffer);
  let offset = 0;
  const central: { offset: number; f: (typeof files)[number] }[] = [];

  for (const f of files) {
    central.push({ offset, f });
    view.setUint32(offset, 0x04034b50, true); // local file header signature
    view.setUint16(offset + 4, 20, true); // version needed
    view.setUint16(offset + 6, 0, true); // flags
    view.setUint16(offset + 8, 0, true); // method: store
    view.setUint16(offset + 10, 0, true); // mod time
    view.setUint16(offset + 12, 0, true); // mod date
    view.setUint32(offset + 14, f.crc, true);
    view.setUint32(offset + 18, f.data.length, true); // compressed size
    view.setUint32(offset + 22, f.data.length, true); // uncompressed size
    view.setUint16(offset + 26, f.name.length, true);
    view.setUint16(offset + 28, 0, true); // extra length
    buf.set(f.name, offset + LOCAL);
    buf.set(f.data, offset + LOCAL + f.name.length);
    offset += LOCAL + f.name.length + f.data.length;
  }

  const centralStart = offset;
  for (const { offset: localOffset, f } of central) {
    view.setUint32(offset, 0x02014b50, true); // central directory signature
    view.setUint16(offset + 4, 20, true); // version made by
    view.setUint16(offset + 6, 20, true); // version needed
    view.setUint16(offset + 8, 0, true); // flags
    view.setUint16(offset + 10, 0, true); // method
    view.setUint16(offset + 12, 0, true); // mod time
    view.setUint16(offset + 14, 0, true); // mod date
    view.setUint32(offset + 16, f.crc, true);
    view.setUint32(offset + 20, f.data.length, true);
    view.setUint32(offset + 24, f.data.length, true);
    view.setUint16(offset + 28, f.name.length, true);
    view.setUint16(offset + 30, 0, true); // extra length
    view.setUint16(offset + 32, 0, true); // comment length
    view.setUint16(offset + 34, 0, true); // disk number start
    view.setUint16(offset + 36, 0, true); // internal attrs
    view.setUint32(offset + 38, 0, true); // external attrs
    view.setUint32(offset + 42, localOffset, true);
    buf.set(f.name, offset + CENTRAL);
    offset += CENTRAL + f.name.length;
  }

  view.setUint32(offset, 0x06054b50, true); // end of central directory signature
  view.setUint16(offset + 4, 0, true); // disk number
  view.setUint16(offset + 6, 0, true); // central dir start disk
  view.setUint16(offset + 8, files.length, true); // entries this disk
  view.setUint16(offset + 10, files.length, true); // total entries
  view.setUint32(offset + 12, offset - centralStart, true); // central dir size
  view.setUint32(offset + 16, centralStart, true); // central dir offset
  view.setUint16(offset + 20, 0, true); // comment length

  return buf;
}
