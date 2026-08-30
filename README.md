> **AI-authored.** 100% of the code was written by Claude (Anthropic); I shaped the architecture, scope, and every decision, and did all the testing.

# Kiri

Kiri is a dependency-free TypeScript library for interactive image cropping in
the browser. Drag, zoom, and rotate an image inside a fixed frame, then export
the crop as an image (base64, blob, or canvas).

See [design.md](./design.md) for the full design document and public API.

## Status

v1 feature-complete: drag, zoom (wheel/pinch/slider), 90° rotation, resizable
frame, EXIF orientation correction, and export to base64/Blob/canvas are all
implemented and covered by the Vitest suite.

## Usage

```bash
npm install
npm run dev     # demo page at http://localhost:5173
npm run build   # library build to dist/ (ESM + UMD + .d.ts)
npm test        # Vitest suite
```

```ts
import { Kiri } from "kiri";

const cropper = new Kiri(document.getElementById("cropper"), {
  frame: { shape: "circle", width: 200, height: 200 },
});

await cropper.load(file); // File, Blob, or URL string
const blob = await cropper.export({ type: "blob", format: "image/png" });
```
