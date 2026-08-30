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
cropper.setFilters({ brightness: 1.2, contrast: 1, saturation: 1, grayscale: false, sepia: false });

// Export
const blob = await cropper.export({
  type: "blob", // "base64" | "blob" | "canvas"
  format: "image/png", // "image/jpeg" | "image/webp"
  quality: 0.9,
  width: 400, // output pixel size; defaults to frame size
  height: 400,
});

// Upload (generic FormData/fetch helper, or a custom uploader — see Extended
// features below)
const response = await cropper.upload("https://example.com/upload");

// Events
cropper.on("change", (state) => { /* fires on drag/zoom/rotate/flip/filters */ });

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

## Styling

Kiri ships a real, separate stylesheet (`kiri.css`) rather than injecting a
`<style>` tag at runtime — standard, CSP-safe, and easy for a consumer to
override or theme. Consumers import it explicitly: `import "kiri/kiri.css"`
(bundler) or a `<link>` to `node_modules/kiri/dist/kiri.css` directly.

## Extended features

These were originally listed as v1 non-goals; all four are now implemented.

### Filters

`Filters = { brightness, contrast, saturation: number; grayscale, sepia: boolean }`
(defaults `1, 1, 1, false, false`). Set via `KiriOptions.filters` (initial) or
`cropper.setFilters(partial)` (merges, clamps numeric values to `>= 0`).

Both the live preview and the canvas export apply the *same* CSS `filter`
string (`brightness() contrast() saturate() grayscale() sepia()`) — the
preview via `img.style.filter`, the export via `canvasCtx.filter` before
`drawImage`. Reusing the browser's own filter implementation for both means
they're guaranteed to match pixel-for-pixel, with no hand-rolled
brightness/contrast/saturation pixel math to get subtly wrong.

### Upload

```ts
cropper.upload(url, options?); // exports the crop, then uploads it
```

Default behavior: exports as a blob, builds a `FormData` (configurable
`fieldName`/`fileName`/`extraFields`), POSTs via `fetch` (configurable
`fetchOptions`). For a custom protocol (presigned URLs, GraphQL, etc.), pass
`uploader` either per-instance (`KiriOptions.uploader`) or per-call
(`UploadOptions.uploader`) — callers keep calling the same `cropper.upload(url,
options)` regardless of backend.

### Batch cropping

`KiriBatch` steps a single shared `Kiri` instance through a queue of images —
one DOM/stage instance reused across images, not one instance per image, so
every existing interaction (drag/zoom/rotate/flip/filters) needs no changes:

```ts
const batch = new KiriBatch(container, options, [{ source: fileA }, { source: fileB }]);
while (await batch.next()) {
  // batch.cropper is now showing batch.current().source — let the user adjust it
  await batch.capture(); // export + store this item's crop
}
batch.results(); // all captures, in item order
```

### Framework wrappers

Thin pass-through components — no cropping logic duplicated, they just own
the container ref/mount lifecycle and forward to a `Kiri` instance:

- `kiri-react`: `<KiriCropper ref={...} onChange={...} {...KiriOptions} />`,
  imperative methods (`load/getState/setZoom/rotate/flipHorizontal/
  flipVertical/setFrameSize/setFilters/export/upload`) exposed via
  `useImperativeHandle`.
- `kiri-vue`: same prop/method surface, exposed via Vue's `expose()`, a plain
  render-function component (`defineComponent` + `h()`) rather than an SFC —
  no `.vue` compiler plugin needed in the build.

Both capture constructor options once on mount; changing them later goes
through the exposed imperative methods, not through re-rendering with new
props (matches the core's own model — options are constructor-time, state
mutations are explicit method calls).

## Project structure (monorepo)

```
kiri/
├── package.json           # root: private, npm workspaces ["packages/*"]
├── design.md, CLAUDE.md, README.md
└── packages/
    ├── core/                # published as "kiri"
    │   ├── src/
    │   │   ├── index.ts       # public entry: re-exports Kiri, KiriBatch, types
    │   │   ├── kiri.ts        # public Kiri class
    │   │   ├── batch.ts       # KiriBatch
    │   │   ├── stage.ts       # stage/frame DOM + layout
    │   │   ├── gestures.ts     # drag/wheel/pinch handling + clamping math
    │   │   ├── exif.ts          # EXIF orientation parsing
    │   │   ├── export.ts        # canvas export logic
    │   │   ├── filters.ts       # CSS-filter-string building/merging
    │   │   ├── upload.ts        # default FormData/fetch uploader
    │   │   ├── kiri.css        # real stylesheet, not JS-injected
    │   │   └── types.ts
    │   ├── demo/
    │   ├── test/
    │   ├── package.json, tsconfig.json, vite.config.ts
    ├── react/               # published as "kiri-react"
    │   ├── src/KiriCropper.tsx, src/index.ts
    │   ├── test/
    │   └── package.json, tsconfig.json, vite.config.ts
    └── vue/                  # published as "kiri-vue"
        ├── src/KiriCropper.ts, src/index.ts
        ├── test/
        └── package.json, tsconfig.json, vite.config.ts
```

## Tooling

- **Build**: Vite in library mode per package, producing ESM + a CJS/UMD
  build, with `vite-plugin-dts` generating `.d.ts` declarations —
  npm-publishable output in each package's `dist/`. `kiri-react` uses
  `@vitejs/plugin-react`; `kiri-vue` needs no SFC plugin (render-function
  component, not `.vue` files).
- **Demo**: `packages/core/demo`, served via `vite dev`, imports the library
  source (`src/index.ts`, `src/kiri.css`) directly — no build step needed
  during development.
- **Package manager**: npm, with npm workspaces (`workspaces: ["packages/*"]`
  in the root `package.json`) — one lockfile at the root, `kiri-react`/
  `kiri-vue`'s `"kiri"` dependency resolves to the local `packages/core` via
  the workspace.
- **Tests**: Vitest per package. `kiri-react` mounts via `react-dom/client`
  `createRoot` + `act` from `react`; `kiri-vue` mounts via Vue's own
  `createApp().mount()` — neither wrapper's test suite needs an extra testing
  library beyond the framework itself.

## Open questions / future work

- Touch/pinch gesture precision on mobile — needs real-device testing.
- `KiriBatch` currently has no built-in gallery/thumbnail UI — it's a queue
  manager only; a consumer builds their own UI around `next()`/`current()`.
- Publishing to npm hasn't happened yet — package names (`kiri`, `kiri-react`,
  `kiri-vue`) are reserved by convention here, not yet claimed on the registry.
