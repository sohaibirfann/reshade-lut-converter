# ReShade LUT Converter

A small web app that turns ReShade `.png` LUTs into Photoshop-compatible `.cube` 3D LUTs. Drag a file in, preview the look, download the `.cube`. Everything runs in the browser — **nothing is uploaded**.

## Why

ReShade color grades live in PNG LUTs. Photoshop's **Color Lookup** adjustment layer wants `.cube` files. There's no built-in way to go from one to the other, so graders end up hunting for a converter — usually a CLI they have to install. This is the no-install version: open a page, drop the PNG, get the `.cube`.

## Supported inputs

| Layout | Shape | Example dimensions |
|---|---|---|
| ReShade strip | wide & short, one row of square slices | 256×16, 1024×32 |
| MultiLUT atlas | several strips stacked vertically | 4096×3200, 1089×330 |
| HALD CLUT | square | 512×512 |

Output is always a `.cube` (UTF-8 text, `LUT_3D_SIZE` = detected cube edge, red-fastest ordering). For a MultiLUT atlas you pick which band to export.

## Using it

1. Drag a ReShade `.png` onto the drop zone (or click to browse).
2. The layout and cube size are detected automatically.
3. For an atlas, click a thumbnail to choose the look.
4. Preview it on the built-in sample or upload your own image. The strength slider blends the grade against the original (it doesn't change the exported `.cube`).
5. Download the `.cube` and load it in Photoshop via **Adjustments → Color Lookup → Load 3D LUT**.

## Client-side by design

There is no backend. Decoding, conversion, and download all happen in the browser with the Canvas API — so your LUT (often your own creative work) never leaves your machine, and the tool keeps working offline once loaded. That's a deliberate choice, not a limitation: the conversion math is light enough to run locally, and keeping it client-side is the whole privacy story.

## Prior art

[`lut-utility`](https://github.com/Skyfish1/lut-utility) is a Rust CLI that generates, converts, and applies LUTs across ReShade and HALD formats, with batch processing and cube resizing — a broader, more capable toolkit and the right tool for power users.

The two tools take different paths to the same `.cube`, and on a straight native-size conversion they produce equivalent output: both transcribe each LUT pixel directly into the corresponding cube entry, so neither resamples or alters the data. Where they diverge is reach — `lut-utility` adds resizing, LUT-baking, and batch; this app adds automatic format detection (including MultiLUT atlases) and a no-install visual workflow.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # unit tests (Vitest)
npm run e2e      # browser tests (Playwright)
npm run build    # static production build to dist/
```

The conversion and detection logic (`src/detect.ts`, `src/convert.ts`) is pure — plain arrays in, text out, no DOM — which is what makes it unit-testable without a browser. The UI (`src/main.ts`) is vanilla TypeScript with no framework and no runtime dependencies.

The test suite includes a **correctness cross-check**: a known graded cube is encoded independently as both a strip and a HALD, and both must reproduce the same reference `.cube` byte-for-byte — confirming the channel ordering, index math, and normalization across formats.

## Deploy

`npm run build` emits static files in `dist/` — host them anywhere with no server (Netlify, Cloudflare Pages, GitHub Pages).

A GitHub Pages workflow is included (`.github/workflows/deploy.yml`): it tests, builds, and deploys on every push to `main`. To enable it, set **Settings → Pages → Source → GitHub Actions**. For Pages' `/<repo>/` subpath the workflow passes `BASE_PATH`; root hosts (Netlify/Cloudflare) need no config.

## License

MIT — see [LICENSE](LICENSE).
