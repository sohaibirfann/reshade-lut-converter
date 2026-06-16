export class ImageTooLargeError extends Error {}

// Generous ceiling — well above any real LUT, low enough to not blow up the tab.
const MAX_PIXELS = 64_000_000;

export async function toImageData(source: ImageBitmapSource, maxSide = Infinity): Promise<ImageData> {
  const bitmap = await createImageBitmap(source);
  if (bitmap.width * bitmap.height > MAX_PIXELS) {
    bitmap.close();
    throw new ImageTooLargeError(`${bitmap.width}×${bitmap.height}`);
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

export function putOnCanvas(target: HTMLCanvasElement, img: ImageData): void {
  target.width = img.width;
  target.height = img.height;
  target.getContext("2d")?.putImageData(img, 0, 0);
}

export function downscale(img: ImageData, maxSide: number): ImageData {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  if (scale === 1) return img;
  const src = document.createElement("canvas");
  putOnCanvas(src, img);
  const dst = document.createElement("canvas");
  dst.width = Math.max(1, Math.round(img.width * scale));
  dst.height = Math.max(1, Math.round(img.height * scale));
  const ctx = dst.getContext("2d", { willReadFrequently: true });
  if (!ctx) return img;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, dst.width, dst.height);
  return ctx.getImageData(0, 0, dst.width, dst.height);
}

// Drawn if the bundled sample can't be fetched (e.g. offline before it's cached).
function fallbackSample(): ImageData {
  const w = 256;
  const h = 160;
  const img = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      img.data[i] = (x / (w - 1)) * 255;
      img.data[i + 1] = (y / (h - 1)) * 255;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  return img;
}

let sampleCache: ImageData | null = null;

export async function getSample(): Promise<ImageData> {
  if (sampleCache) return sampleCache;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}sample.png`);
    if (!res.ok) throw new Error(`sample ${res.status}`);
    sampleCache = await toImageData(await res.blob());
  } catch {
    sampleCache = fallbackSample();
  }
  return sampleCache;
}
