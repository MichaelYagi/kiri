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
import "kiri/kiri.min.css";

const cropper = new Kiri(document.getElementById("cropper"), {
  frame: { shape: "circle", width: 200, height: 200 },
});
// No CSS needed on #cropper — the stage auto-sizes itself to the frame's
// dimensions. Pass `autoSizeStage: false` to size it via your own CSS instead.

await cropper.load(file); // File, Blob, or URL string
cropper.rotate(90);
cropper.flipHorizontal();
cropper.setFilters({ brightness: 1.2, grayscale: true });

const blob = await cropper.export({ type: "blob", format: "image/png" });
await cropper.upload("https://example.com/upload"); // or pass a custom `uploader`
```

#### Plain `<script>` tag (no bundler)

```html
<link rel="stylesheet" href="node_modules/kiri/dist/kiri.min.css" />
<script src="node_modules/kiri/dist/kiri.min.js"></script>
<script>
  const cropper = new Kiri(document.getElementById("cropper"), {
    frame: { shape: "circle", width: 200, height: 200 },
  });
  const batch = new KiriBatch(container); // also a global, if you need batching
</script>
```

`dist/` ships both minified (`kiri.min.js`/`kiri.min.css`) and unminified
(`kiri.js`/`kiri.css`) versions of the UMD/CJS build and stylesheet — use the
unminified pair for debugging directly in devtools.

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
import "kiri/kiri.min.css";
import { useRef } from "react";

const ref = useRef<KiriCropperHandle>(null);

<KiriCropper ref={ref} frame={{ shape: "circle", width: 200, height: 200 }} onChange={console.log} />;

await ref.current?.load(file);
```

### Vue

```ts
import { KiriCropper } from "kiri-vue";
import "kiri/kiri.min.css";
```

```html
<KiriCropper ref="cropper" :frame="{ shape: 'circle', width: 200, height: 200 }" @change="onChange" />
```

```ts
await cropper.value.load(file);
```
