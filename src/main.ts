import "./style.css";
import { detectLayout } from "./detect";
import { convertToCube, toCubeFilename } from "./convert";
import { applyLut } from "./preview";
import { downloadText } from "./download";

function el<T extends Element>(sel: string): T {
  const node = document.querySelector<T>(sel);
  if (!node) throw new Error(`missing element: ${sel}`);
  return node;
}

const drop = el<HTMLDivElement>("#drop");
const fileInput = el<HTMLInputElement>("#file");
const message = el<HTMLParagraphElement>("#message");
const result = el<HTMLElement>("#result");
const detected = el<HTMLParagraphElement>("#detected");
const lutThumb = el<HTMLCanvasElement>("#lut-thumb");
const before = el<HTMLCanvasElement>("#before");
const after = el<HTMLCanvasElement>("#after");
const downloadBtn = el<HTMLButtonElement>("#download");
const resetBtn = el<HTMLButtonElement>("#reset");

let cubeText = "";
let outName = "lut.cube";
let sample: ImageData | null = null;

function showMessage(text: string, kind: "error" | "warn"): void {
  message.textContent = text;
  message.className = `message ${kind}`;
  message.hidden = false;
}

function hideMessage(): void {
  message.hidden = true;
  message.textContent = "";
}

async function toImageData(source: ImageBitmapSource): Promise<ImageData> {
  const bitmap = await createImageBitmap(source);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
}

async function getSample(): Promise<ImageData> {
  if (!sample) {
    const res = await fetch("/sample.png");
    sample = await toImageData(await res.blob());
  }
  return sample;
}

function putOnCanvas(canvas: HTMLCanvasElement, img: ImageData): void {
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext("2d")?.putImageData(img, 0, 0);
}

function drawLutThumb(canvas: HTMLCanvasElement, img: ImageData): void {
  const tmp = document.createElement("canvas");
  putOnCanvas(tmp, img);
  canvas.width = 256;
  canvas.height = 48;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
}

function isPng(file: File): boolean {
  return file.type === "image/png" || /\.png$/i.test(file.name);
}

async function decodeFile(file: File): Promise<ImageData | null> {
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

async function renderPreviews(img: ImageData, size: number): Promise<void> {
  drawLutThumb(lutThumb, img);
  const sampleData = await getSample();
  putOnCanvas(before, sampleData);
  putOnCanvas(after, applyLut(sampleData, img.data, img.width, size));
}

async function handleFile(file: File): Promise<void> {
  result.hidden = true;
  hideMessage();

  const img = await decodeFile(file);
  if (!img) return;

  const layout = detectLayout(img.width, img.height);
  if (layout.kind !== "strip") {
    showMessage(layout.error!, "error");
    return;
  }

  const size = layout.edgeSize!;
  outName = toCubeFilename(file.name);
  cubeText = convertToCube(img.data, img.width, size, {
    title: file.name.replace(/\.png$/i, ""),
  });

  detected.textContent = `Detected: ReShade strip LUT, ${size}×${size}×${size}`;
  if (layout.warning) showMessage(layout.warning, "warn");

  await renderPreviews(img, size);
  result.hidden = false;
}

drop.addEventListener("click", () => fileInput.click());
drop.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) handleFile(file);
});

drop.addEventListener("dragover", (e) => {
  e.preventDefault();
  drop.classList.add("dragging");
});
drop.addEventListener("dragleave", () => drop.classList.remove("dragging"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("dragging");
  const file = e.dataTransfer?.files?.[0];
  if (file) handleFile(file);
});

downloadBtn.addEventListener("click", () => {
  if (cubeText) downloadText(outName, cubeText);
});

resetBtn.addEventListener("click", () => {
  cubeText = "";
  fileInput.value = "";
  result.hidden = true;
  hideMessage();
});
