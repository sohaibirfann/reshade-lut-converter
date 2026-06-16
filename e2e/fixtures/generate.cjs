// fallow-ignore-file unused-file
// Generates the tiny fixture PNGs used by the e2e tests. Run: node generate.cjs
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (b) => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};
const writePng = (file, w, h, px) => {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(path.join(__dirname, file), png);
};
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

// strip: 256×16 neutral cube
{
  const N = 16;
  const w = N * N;
  const px = Buffer.alloc(w * N * 4);
  for (let b = 0; b < N; b++)
    for (let g = 0; g < N; g++)
      for (let r = 0; r < N; r++) {
        const i = (g * w + b * N + r) * 4;
        px[i] = clamp((r / (N - 1)) * 255);
        px[i + 1] = clamp((g / (N - 1)) * 255);
        px[i + 2] = clamp((b / (N - 1)) * 255);
        px[i + 3] = 255;
      }
  writePng("strip.png", w, N, px);
}

// atlas: 64×24 — three size-8 bands (neutral, red-boost, blue-boost)
{
  const N = 8;
  const grades = [
    (r, g, b) => [r, g, b],
    (r, g, b) => [r * 1.4, g, b * 0.6],
    (r, g, b) => [r * 0.6, g, b * 1.4],
  ];
  const w = N * N;
  const h = N * grades.length;
  const px = Buffer.alloc(w * h * 4);
  grades.forEach((grade, k) => {
    for (let g = 0; g < N; g++)
      for (let b = 0; b < N; b++)
        for (let r = 0; r < N; r++) {
          const [R, G, B] = grade((r / (N - 1)) * 255, (g / (N - 1)) * 255, (b / (N - 1)) * 255);
          const i = ((k * N + g) * w + b * N + r) * 4;
          px[i] = clamp(R);
          px[i + 1] = clamp(G);
          px[i + 2] = clamp(B);
          px[i + 3] = 255;
        }
  });
  writePng("atlas.png", w, h, px);
}

// hald: 64×64 neutral (size 16)
{
  const N = 16;
  const side = Math.round(Math.sqrt(N * N * N));
  const px = Buffer.alloc(side * side * 4);
  const count = N * N * N;
  for (let i = 0; i < count; i++) {
    const r = i % N;
    const g = Math.floor(i / N) % N;
    const b = Math.floor(i / (N * N)) % N;
    px[i * 4] = clamp((r / (N - 1)) * 255);
    px[i * 4 + 1] = clamp((g / (N - 1)) * 255);
    px[i * 4 + 2] = clamp((b / (N - 1)) * 255);
    px[i * 4 + 3] = 255;
  }
  writePng("hald.png", side, side, px);
}

// invalid: a plain 100×100 square that isn't a valid HALD size
{
  const s = 100;
  const px = Buffer.alloc(s * s * 4);
  for (let i = 0; i < s * s; i++) {
    px[i * 4] = 80;
    px[i * 4 + 1] = 120;
    px[i * 4 + 2] = 160;
    px[i * 4 + 3] = 255;
  }
  writePng("square.png", s, s, px);
}

console.log("fixtures written");
