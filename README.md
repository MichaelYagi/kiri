> **AI-authored.** 100% of the code was written by Claude (Anthropic); I shaped the architecture, scope, and every decision, and did all the testing.

# Kiri

Kiri is a dependency-free TypeScript library for interactive image cropping in
the browser. Drag, zoom, rotate, and flip an image inside a fixed frame, apply
brightness/contrast/saturation/grayscale/sepia filters, then export the crop
(base64, blob, or canvas) or upload it directly.

A monorepo: the core library plus thin React/Vue wrapper components that reuse
its logic rather than duplicating it.

| Package | Path | What it is |
|---|---|---|
| `kiri` | `packages/core` | The library itself — framework-agnostic |
| `kiri-react` | `packages/react` | `<KiriCropper>` React component |
| `kiri-vue` | `packages/vue` | `<KiriCropper>` Vue component |

See [design.md](./design.md) for the full design document and public API.

## Status

v1 (drag/zoom/rotate/flip/resizable-frame/EXIF/export) plus filters, `upload()`,
multi-image batching (`KiriBatch`), and the React/Vue wrappers are all
implemented and covered by each package's Vitest suite.

## Usage

```bash
npm install                # installs all workspace packages
npm run dev                 # core demo at http://localhost:5173
npm run build                # builds all three packages
npm test                      # runs all three packages' test suites
```

### Core

```ts
import { Kiri } from "kiri";
import "kiri/kiri.css";

const cropper = new Kiri(document.getElementById("cropper"), {
  frame: { shape: "circle", width: 200, height: 200 },
});

await cropper.load(file); // File, Blob, or URL string
cropper.rotate(90);
cropper.flipHorizontal();
cropper.setFilters({ brightness: 1.2, grayscale: true });

const blob = await cropper.export({ type: "blob", format: "image/png" });
await cropper.upload("https://example.com/upload"); // or pass a custom `uploader`
```

### Batch cropping

```ts
import { KiriBatch } from "kiri";

const batch = new KiriBatch(container, options, [{ source: fileA }, { source: fileB }]);
while (await batch.next()) {
  // batch.cropper shows batch.current().source — let the user adjust it, then:
  await batch.capture();
}
batch.results(); // all crops, in order
```

### React

```tsx
import { KiriCropper, type KiriCropperHandle } from "kiri-react";
import "kiri/kiri.css";
import { useRef } from "react";

const ref = useRef<KiriCropperHandle>(null);

<KiriCropper ref={ref} frame={{ shape: "circle", width: 200, height: 200 }} onChange={console.log} />;

await ref.current?.load(file);
```

### Vue

```ts
import { KiriCropper } from "kiri-vue";
import "kiri/kiri.css";
```

```html
<KiriCropper ref="cropper" :frame="{ shape: 'circle', width: 200, height: 200 }" @change="onChange" />
```

```ts
await cropper.value.load(file);
```
