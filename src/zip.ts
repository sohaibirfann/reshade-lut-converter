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

// Sequential writer that advances its own offset, so no manual byte math.
function makeWriter(view: DataView, buf: Uint8Array) {
  let p = 0;
  return {
    u16: (v: number) => void view.setUint16((p += 2) - 2, v, true),
    u32: (v: number) => void view.setUint32((p += 4) - 4, v, true),
    bytes: (b: Uint8Array) => {
      buf.set(b, p);
      p += b.length;
    },
    pos: () => p,
  };
}

const LOCAL_HEADER = 30; // bytes before the name
const CENTRAL_HEADER = 46;
const EOCD = 22;

export function makeZip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const files = entries.map((e) => ({ name: enc.encode(e.name), data: e.data, crc: crc32(e.data) }));

  let size = EOCD;
  for (const f of files) {
    size += LOCAL_HEADER + f.name.length + f.data.length;
    size += CENTRAL_HEADER + f.name.length;
  }

  const buf = new Uint8Array(size);
  const w = makeWriter(new DataView(buf.buffer), buf);
  const localOffsets: number[] = [];

  for (const f of files) {
    localOffsets.push(w.pos());
    w.u32(0x04034b50); // local file header signature
    w.u16(20); // version needed
    w.u16(0); // flags
    w.u16(0); // method: store
    w.u16(0); // mod time
    w.u16(0); // mod date
    w.u32(f.crc);
    w.u32(f.data.length); // compressed size
    w.u32(f.data.length); // uncompressed size
    w.u16(f.name.length);
    w.u16(0); // extra length
    w.bytes(f.name);
    w.bytes(f.data);
  }

  const centralStart = w.pos();
  files.forEach((f, i) => {
    w.u32(0x02014b50); // central directory signature
    w.u16(20); // version made by
    w.u16(20); // version needed
    w.u16(0); // flags
    w.u16(0); // method
    w.u16(0); // mod time
    w.u16(0); // mod date
    w.u32(f.crc);
    w.u32(f.data.length);
    w.u32(f.data.length);
    w.u16(f.name.length);
    w.u16(0); // extra length
    w.u16(0); // comment length
    w.u16(0); // disk number start
    w.u16(0); // internal attrs
    w.u32(0); // external attrs
    w.u32(localOffsets[i]);
    w.bytes(f.name);
  });

  const centralSize = w.pos() - centralStart;
  w.u32(0x06054b50); // end of central directory signature
  w.u16(0); // disk number
  w.u16(0); // central dir start disk
  w.u16(files.length); // entries this disk
  w.u16(files.length); // total entries
  w.u32(centralSize); // central dir size
  w.u32(centralStart); // central dir offset
  w.u16(0); // comment length

  return buf;
}
