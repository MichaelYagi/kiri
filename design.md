# Kiri — Design Document

## What is Kiri?

Kiri is a dependency-free TypeScript library for interactive image cropping in the
browser. A user drags, zooms, and rotates an image inside a fixed viewport, and the
library produces the cropped result as an image (base64, blob, or canvas).

Kiri is written from scratch. It is not a wrapper, fork, or port of any existing
library — no code, naming, or documentation from any other project is reused.

## Design goals

1. **Simple, guessable API.** Method and option names should be self-explanatory
   without consulting docs. Avoid overloaded methods that behave differently based
   on argument shape; prefer one method per action with named-option objects.
2. **Zero runtime dependencies.** Vanilla TypeScript/DOM APIs only.
3. **Framework-agnostic.** Works by attaching to a plain DOM element; usable from
   React/Vue/Svelte/etc. via a ref, or directly in vanilla JS.
4. **Small and tree-shakeable.** Ship as ESM primarily; a UMD/IIFE build is provided
   for plain `<script>` tag usage.
5. **Predictable state.** All mutable state (crop position, zoom, rotation) is
   readable at any time via a single `getState()` call, and restorable via `load()`.

## Core concepts

- **Stage** — the outer bounding box the user sees; sized by CSS/parent element.
- **Frame** — the fixed selection window inside the stage (the region that gets
  exported). Shape: `"rect"` or `"circle"`.
- **Image layer** — the source image, freely draggable and zoomable behind the frame.

(These names replace the original library's "boundary"/"viewport" terminology,
chosen to be more literal/intuitive.)

## Public API (draft)

```ts
import { Kiri } from "kiri";

const cropper = new Kiri(containerElement, {
  frame: { shape: "circle", width: 200, height: 200 },
  minZoom: 1,
  maxZoom: 4,
  rotatable: true,
  resizableFrame: false,
  mouseWheelZoom: true, // or "ctrl" to require Ctrl+wheel
  useExifOrientation: true,
});

// Load an image (File, Blob, or URL string)
await cropper.load(file, { zoom: 1, offset: { x: 0, y: 0 }, rotation: 0 });

// Read current state
cropper.getState(); // { zoom, offset: {x,y}, rotation }

// Mutate programmatically
cropper.setZoom(2);
cropper.rotate(90); // relative, degrees, snapped to 90° steps
cropper.flipHorizontal(); // toggles
cropper.flipVertical(); // toggles
cropper.setFrameSize(300, 300); // if resizableFrame is true

// Export
const blob = await cropper.export({
  type: "blob", // "base64" | "blob" | "canvas"
  format: "image/png", // "image/jpeg" | "image/webp"
  quality: 0.9,
  width: 400, // output pixel size; defaults to frame size
  height: 400,
});

// Events
cropper.on("change", (state) => { /* fires on drag/zoom/rotate */ });

cropper.destroy();
```

### API naming rationale (vs. the API this project intentionally departs from)

| Concept | Old-style naming | Kiri naming | Why |
|---|---|---|---|
| get crop data | `get()` | `getState()` | explicit about what it returns |
| load image | `bind()` | `load()` | plain English verb |
| export result | `result(type)` overloaded string/object arg | `export(options)` single options object | one call shape, no overloads |
| outer container | `boundary` | `stage` | conventional canvas/editor term |
| inner crop window | `viewport` | `frame` | avoids collision with CSS "viewport" |
| change callback | custom `update` event string | typed `.on("change", cb)` | discoverable, typed |

## Feature scope (v1 — full parity)

- Drag to reposition image within the frame
- Zoom via wheel, trackpad pinch, and an optional slider UI
- Rotate in 90° increments
- Flip horizontally/vertically (independent of rotation)
- Optional resizable frame (drag handles)
- Automatic EXIF orientation correction on load (rotation + horizontal flip)
- Zoom is clamped so the image can never be smaller than the frame
  (`enforceBoundary`-equivalent behavior, always on)
- Export to base64 / Blob / Canvas, JPEG / PNG / WebP, custom output dimensions

## Non-goals (v1)

- Built-in upload/server integration
- Filters/effects (brightness, contrast, etc.)
- Multi-image / batch cropping
- Framework-specific wrapper packages (React/Vue components) — may come later as
  separate packages built on the core

## Project structure

```
kiri/
├── src/
│   ├── kiri.ts          # public Kiri class
│   ├── stage.ts         # stage/frame DOM + layout
│   ├── gestures.ts       # drag/wheel/pinch handling
│   ├── exif.ts            # EXIF orientation parsing
│   ├── export.ts          # canvas export logic
│   └── types.ts
├── demo/
│   ├── index.html
│   └── main.ts
├── test/
├── design.md
├── CLAUDE.md
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Tooling

- **Build**: Vite in library mode, producing ESM + a UMD/IIFE browser build, with
  `vite-plugin-dts` generating `.d.ts` declarations — npm-publishable output in
  `dist/`.
- **Demo**: served via `vite dev` against `demo/index.html`, importing the library
  source directly (no separate build step needed during development).
- **Package manager**: npm.
- **Tests**: Vitest.

## Open questions / future work

- Touch/pinch gesture precision on mobile — needs real-device testing.
- Whether to ship a default minimal CSS theme or leave all styling to the consumer.
- Possible React wrapper package once the core API stabilizes.
