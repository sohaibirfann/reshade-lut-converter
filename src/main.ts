import "./style.css";
import { detectLayout, type DetectionResult } from "./detect";
import { convertToCube, convertHaldToCube, toCubeFilename } from "./convert";
import { applyStrip, applyHald, blend } from "./preview";
import { downloadText } from "./download";
import { ImageTooLargeError, toImageData, getSample, putOnCanvas, downscale } from "./image";
import { initThemeToggle } from "./theme";

function el<T extends Element>(sel: string): T {
  const node = document.querySelector<T>(sel);
  if (!node) throw new Error(`missing element: ${sel}`);
  return node;
}

const lutDrop = el<HTMLDivElement>("#lut-drop");
const lutFile = el<HTMLInputElement>("#lut-file");
const lutBrowse = el<HTMLButtonElement>("#lut-browse");
const message = el<HTMLParagraphElement>("#message");
const fileRow = el<HTMLDivElement>("#file-row");
const fileName = el<HTMLSpanElement>("#file-name");
const fileMeta = el<HTMLSpanElement>("#file-meta");
const bandsWrap = el<HTMLDivElement>("#bands-wrap");
const bands = el<HTMLDivElement>("#bands");
const empty = el<HTMLDivElement>("#empty");
const view = el<HTMLDivElement>("#view");
const loading = el<HTMLDivElement>("#loading");
const canvas = el<HTMLCanvasElement>("#canvas");
const previewDrop = el<HTMLDivElement>("#preview-drop");
const previewFile = el<HTMLInputElement>("#preview-file");
const clearPreview = el<HTMLButtonElement>("#clear-preview");
const opacity = el<HTMLInputElement>("#opacity");
const opacityVal = el<HTMLOutputElement>("#opacity-val");
const downloadBtn = el<HTMLButtonElement>("#download");

interface State {
  lut: ImageData | null;
  layout: DetectionResult | null;
  sourceName: string;
  band: number;
  preview: ImageData | null;
  graded: ImageData | null;
  opacity: number;
}

const state: State = {
  lut: null,
  layout: null,
  sourceName: "",
  band: 0,
  preview: null,
  graded: null,
  opacity: 100,
};

const PREVIEW_MAX_SIDE = 1280;

function showMessage(text: string, kind: "error" | "warn"): void {
  message.textContent = text;
  message.className = `message ${kind}`;
  message.hidden = false;
}

function hideMessage(): void {
  message.hidden = true;
  message.textContent = "";
}

// Rebuilding a big atlas contact sheet blocks for a moment; show a spinner for it.
const HEAVY_BANDS = 8;
const nextFrame = (): Promise<void> =>
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

function isHeavy(): boolean {
  return state.layout?.kind === "atlas" && (state.layout.lutCount ?? 1) >= HEAVY_BANDS;
}

async function withLoading(work: () => void): Promise<void> {
  if (!isHeavy()) {
    work();
    return;
  }
  loading.hidden = false;
  await nextFrame(); // let the spinner paint before the blocking work
  try {
    work();
  } finally {
    loading.hidden = true;
  }
}

function applyLook(image: ImageData, band: number): ImageData {
  const { lut, layout } = state;
  const size = layout!.edgeSize!;
  if (layout!.kind === "hald") return applyHald(image, lut!.data, size);
  return applyStrip(image, lut!.data, lut!.width, size, band * size);
}

function cubeFor(band: number): { name: string; text: string } {
  const { lut, layout, sourceName } = state;
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
  const cube = `${l.edgeSize}³`;
  if (l.kind === "hald") return `HALD CLUT · ${cube}`;
  if (l.kind === "atlas") return `MultiLUT atlas · ${l.lutCount} × ${cube}`;
  return `ReShade strip · ${cube}`;
}

function drawCanvas(): void {
  putOnCanvas(canvas, blend(state.preview!, state.graded!, state.opacity / 100));
}

function downloadBand(band: number): void {
  const { name, text } = cubeFor(band);
  downloadText(name, text);
}

function selectBand(i: number): void {
  state.band = i;
  [...bands.children].forEach((card, idx) =>
    card.setAttribute("aria-selected", String(idx === i)),
  );
  state.graded = applyLook(state.preview!, i);
  drawCanvas();
}

function bandCard(i: number, thumb: ImageData): HTMLElement {
  const card = document.createElement("div");
  card.className = "band";
  card.setAttribute("role", "option");
  card.tabIndex = 0;
  card.setAttribute("aria-selected", String(i === state.band));
  card.setAttribute("aria-label", `LUT ${i + 1}`);

  const c = document.createElement("canvas");
  putOnCanvas(c, applyLook(thumb, i));

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = `LUT ${i + 1}`;

  card.append(c, badge);
  card.addEventListener("click", () => selectBand(i));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectBand(i);
    }
  });
  return card;
}

function renderBands(): void {
  bands.replaceChildren();
  const { layout, preview } = state;
  if (!layout || layout.kind !== "atlas") {
    bandsWrap.hidden = true;
    return;
  }
  bandsWrap.hidden = false;
  const thumb = downscale(preview!, 120);
  for (let i = 0; i < layout.lutCount!; i++) {
    bands.appendChild(bandCard(i, thumb));
  }
}

function render(): void {
  empty.hidden = true;
  view.hidden = false;
  fileRow.hidden = false;
  fileName.textContent = state.sourceName;
  fileMeta.textContent = describeLayout(state.layout!);

  if (state.layout!.warning) showMessage(state.layout!.warning, "warn");
  else hideMessage();

  state.band = 0;
  state.graded = applyLook(state.preview!, 0);
  renderBands();
  drawCanvas();
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
  } catch (err) {
    if (err instanceof ImageTooLargeError) {
      showMessage(`That image is too large to process in the browser (${err.message}).`, "error");
    } else {
      showMessage("Couldn't read that image — is the file corrupt?", "error");
    }
    return null;
  }
}

async function loadLut(file: File): Promise<void> {
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
  if (!state.preview) state.preview = await getSample();
  await withLoading(render);
}

function repaint(): void {
  if (!state.layout) return;
  state.graded = applyLook(state.preview!, state.band);
  renderBands();
  drawCanvas();
}

async function loadPreview(file: File): Promise<void> {
  try {
    state.preview = await toImageData(file, PREVIEW_MAX_SIDE);
  } catch (err) {
    const why = err instanceof ImageTooLargeError ? "it's too large" : "it couldn't be read";
    showMessage(`Test image skipped — ${why}. Keeping the current preview.`, "error");
    return;
  }
  clearPreview.hidden = false;
  await withLoading(repaint);
}

async function usesSample(): Promise<void> {
  state.preview = await getSample();
  clearPreview.hidden = true;
  await withLoading(repaint);
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

lutBrowse.addEventListener("click", (e) => {
  e.stopPropagation();
  lutFile.click();
});

clearPreview.addEventListener("click", usesSample);

opacity.addEventListener("input", () => {
  state.opacity = Number(opacity.value);
  opacityVal.textContent = `${state.opacity}%`;
  drawCanvas();
});

downloadBtn.addEventListener("click", () => {
  if (state.lut) downloadBand(state.band);
});

initThemeToggle(el<HTMLButtonElement>("#theme-toggle"));
