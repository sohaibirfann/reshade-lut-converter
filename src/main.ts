import "./style.css";
import { detectLayout, type DetectionResult } from "./detect";
import { convertToCube, convertHaldToCube, toCubeFilename } from "./convert";
import { applyStrip, applyHald } from "./preview";
import { downloadText } from "./download";

function el<T extends Element>(sel: string): T {
  const node = document.querySelector<T>(sel);
  if (!node) throw new Error(`missing element: ${sel}`);
  return node;
}

const lutDrop = el<HTMLDivElement>("#lut-drop");
const lutFile = el<HTMLInputElement>("#lut-file");
const message = el<HTMLParagraphElement>("#message");
const result = el<HTMLElement>("#result");
const detected = el<HTMLParagraphElement>("#detected");
const bandsWrap = el<HTMLDivElement>("#bands-wrap");
const bands = el<HTMLDivElement>("#bands");
const before = el<HTMLCanvasElement>("#before");
const after = el<HTMLCanvasElement>("#after");
const afterLabel = el<HTMLElement>("#after-label");
const previewDrop = el<HTMLDivElement>("#preview-drop");
const previewFile = el<HTMLInputElement>("#preview-file");
const previewReset = el<HTMLButtonElement>("#preview-reset");
const downloadBtn = el<HTMLButtonElement>("#download");
const resetBtn = el<HTMLButtonElement>("#reset");

interface State {
  lut: ImageData | null;
  layout: DetectionResult | null;
  sourceName: string;
  band: number;
  preview: ImageData | null;
}

const state: State = { lut: null, layout: null, sourceName: "", band: 0, preview: null };
let sampleCache: ImageData | null = null;

function showMessage(text: string, kind: "error" | "warn"): void {
  message.textContent = text;
  message.className = `message ${kind}`;
  message.hidden = false;
}

function hideMessage(): void {
  message.hidden = true;
  message.textContent = "";
}

async function toImageData(source: ImageBitmapSource, maxSide = Infinity): Promise<ImageData> {
  const bitmap = await createImageBitmap(source);
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

async function getSample(): Promise<ImageData> {
  if (!sampleCache) sampleCache = await toImageData(await (await fetch("/sample.png")).blob());
  return sampleCache;
}

function putOnCanvas(canvas: HTMLCanvasElement, img: ImageData): void {
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext("2d")?.putImageData(img, 0, 0);
}

function downscale(img: ImageData, maxSide: number): ImageData {
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

// Apply the active LUT (selected atlas band, or the whole strip/HALD) to an image.
function applyActive(image: ImageData): ImageData {
  const { lut, layout, band } = state;
  const size = layout!.edgeSize!;
  if (layout!.kind === "hald") return applyHald(image, lut!.data, size);
  return applyStrip(image, lut!.data, lut!.width, size, band * size);
}

function cubeForActive(): { name: string; text: string } {
  const { lut, layout, band, sourceName } = state;
  const size = layout!.edgeSize!;
  const title = sourceName.replace(/\.png$/i, "");
  if (layout!.kind === "hald") {
    return { name: toCubeFilename(sourceName), text: convertHaldToCube(lut!.data, size, { title }) };
  }
  if (layout!.kind === "atlas") {
    return {
      name: toCubeFilename(sourceName, band + 1),
      text: convertToCube(lut!.data, lut!.width, size, { title, yOffset: band * size }),
    };
  }
  return { name: toCubeFilename(sourceName), text: convertToCube(lut!.data, lut!.width, size, { title }) };
}

function describeLayout(l: DetectionResult): string {
  const dim = `${l.edgeSize}×${l.edgeSize}×${l.edgeSize}`;
  if (l.kind === "hald") return `Detected: HALD CLUT, ${dim}`;
  if (l.kind === "atlas") return `Detected: MultiLUT atlas, ${l.lutCount} LUTs of ${dim}`;
  return `Detected: ReShade strip LUT, ${dim}`;
}

function selectBand(i: number): void {
  state.band = i;
  [...bands.children].forEach((btn, idx) =>
    btn.setAttribute("aria-selected", String(idx === i)),
  );
  afterLabel.textContent = `After — LUT ${i + 1}`;
  putOnCanvas(after, applyActive(state.preview!));
}

function renderBands(): void {
  const { layout, lut, preview } = state;
  bands.replaceChildren();
  if (!layout || layout.kind !== "atlas") {
    bandsWrap.hidden = true;
    return;
  }
  bandsWrap.hidden = false;
  const thumb = downscale(preview!, 120);
  for (let i = 0; i < layout.lutCount!; i++) {
    const btn = document.createElement("button");
    btn.className = "band";
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", String(i === state.band));
    const canvas = document.createElement("canvas");
    putOnCanvas(canvas, applyStrip(thumb, lut!.data, lut!.width, layout.edgeSize!, i * layout.edgeSize!));
    const span = document.createElement("span");
    span.textContent = `LUT ${i + 1}`;
    btn.append(canvas, span);
    btn.addEventListener("click", () => selectBand(i));
    bands.appendChild(btn);
  }
}

function renderCompare(): void {
  putOnCanvas(before, state.preview!);
  putOnCanvas(after, applyActive(state.preview!));
}

function render(): void {
  detected.textContent = describeLayout(state.layout!);
  afterLabel.textContent = state.layout!.kind === "atlas" ? `After — LUT ${state.band + 1}` : "After";
  if (state.layout!.warning) showMessage(state.layout!.warning, "warn");
  else hideMessage();
  renderBands();
  renderCompare();
  result.hidden = false;
}

function isPng(file: File): boolean {
  return file.type === "image/png" || /\.png$/i.test(file.name);
}

async function decodeLut(file: File): Promise<ImageData | null> {
  if (!isPng(file)) {
    showMessage("That's not a PNG. Export your ReShade LUT as a .png and try again.", "error");
    return null;
  }
  try {
    return await toImageData(file);
  } catch {
    showMessage("Couldn't read that image — is the file corrupt?", "error");
    return null;
  }
}

async function loadLut(file: File): Promise<void> {
  result.hidden = true;
  hideMessage();
  const img = await decodeLut(file);
  if (!img) return;

  const layout = detectLayout(img.width, img.height);
  if (layout.kind === "unknown") {
    showMessage(`${layout.error} (your image is ${img.width}×${img.height})`, "error");
    return;
  }

  state.lut = img;
  state.layout = layout;
  state.sourceName = file.name;
  state.band = 0;
  if (!state.preview) state.preview = await getSample();
  render();
}

async function loadPreview(file: File): Promise<void> {
  try {
    state.preview = await toImageData(file, 512);
  } catch {
    showMessage("Couldn't read that image — keeping the current preview.", "error");
    return;
  }
  previewReset.hidden = false;
  if (state.layout) {
    renderBands();
    renderCompare();
  }
}

async function usesSample(): Promise<void> {
  state.preview = await getSample();
  previewReset.hidden = true;
  if (state.layout) {
    renderBands();
    renderCompare();
  }
}

function wireDropZone(zone: HTMLElement, input: HTMLInputElement, onFile: (f: File) => void): void {
  zone.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).tagName !== "BUTTON") input.click();
  });
  zone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragging");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragging"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragging");
    const f = e.dataTransfer?.files?.[0];
    if (f) onFile(f);
  });
  input.addEventListener("change", () => {
    const f = input.files?.[0];
    if (f) onFile(f);
  });
}

wireDropZone(lutDrop, lutFile, loadLut);
wireDropZone(previewDrop, previewFile, loadPreview);

previewReset.addEventListener("click", (e) => {
  e.stopPropagation();
  usesSample();
});

downloadBtn.addEventListener("click", () => {
  if (!state.lut) return;
  const { name, text } = cubeForActive();
  downloadText(name, text);
});

resetBtn.addEventListener("click", () => {
  state.lut = null;
  state.layout = null;
  state.band = 0;
  lutFile.value = "";
  result.hidden = true;
  hideMessage();
});
