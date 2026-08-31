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

- **Stage** — the outer bounding box the user sees. By default it auto-sizes
  itself to the frame's dimensions plus a small margin (so it looks right
  with zero CSS); `autoSizeStage: false` reverts to sizing via the
  container's own CSS instead (100% width/height), for embedding in a
  layout where the consumer wants to control the stage's size directly.
- **Frame** — the fixed selection window inside the stage (the region that gets
  exported). Shape: `"rectangle"` or `"circle"`. `"circle"` isn't just a
  visual overlay in the browser — `export()`/`upload()` actually clip the
  output to match (transparent corners on PNG/WebP; JPEG has no alpha
  channel, so circle + JPEG warns and renders solid black corners instead).
  If `frame.width !== frame.height`, `"circle"` renders as an ellipse
  (matching `border-radius: 50%` on a non-square box) rather than a true
  circle, and the export follows exactly — inscribed in the same
  width/height. Use equal `width`/`height` for a true circle.
- **Image layer** — the source image, freely draggable and zoomable behind the frame.

(These names replace the original library's "boundary"/"viewport" terminology,
chosen to be more literal/intuitive.)

## Public API (draft)

```ts
import { Kiri } from "@michaelyagi/kiri";

const cropper = new Kiri(containerElement, {
  frame: { shape: "circle", width: 200, height: 200 },
  minZoom: 1,
  maxZoom: 4,
  rotatable: true,
  resizableFrame: false,
  mouseWheelZoom: true, // or "ctrl" to require Ctrl+wheel
  useExifOrientation: true,
  autoSizeStage: true, // default; false = size the stage via container CSS instead
  showZoomer: false, // default; true renders a built-in zoom slider
  zoomerPosition: "bottom", // "top" | "bottom" | "left" | "right"
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

### Methods reference

| Method | Returns | Description |
|---|---|---|
| `load(source, options?)` | `Promise<void>` | Loads a `File`, `Blob`, or URL string. See the `load()` options table below. |
| `getState()` | `KiriState` | Current `{ zoom, offset, rotation, flip, filters }` snapshot (a copy — mutating it has no effect). |
| `setZoom(zoom)` | `void` | Absolute zoom, clamped to `[minZoom, maxZoom]`. |
| `setOffset(offset)` | `void` | Absolute pan (`{ x, y }`), clamped so the frame stays covered by the rendered image — same clamping as a drag. |
| `reset()` | `void` | Reverts zoom/offset/rotation/flip/filters to whatever they were right after `load()` resolved. No-op before anything's loaded. |
| `rotate(deltaDeg)` | `void` | Relative rotation, snapped to the nearest 90°. No-op if `rotatable: false`. |
| `flipHorizontal()` / `flipVertical()` | `void` | Toggles. No-op if `flippable: false`. |
| `setFrameSize(width, height)` | `void` | Resizes the frame (and the stage too, if `autoSizeStage`). Clamped to a 20px minimum per axis. |
| `setFilters(partial)` | `void` | Merges into the current filters; numeric values clamped to `>= 0`. |
| `export(options?)` | `Promise<ExportResult>` | Renders the current crop. See the `export()` options table below. |
| `getCropRegion()` | `CropRegion` | `{ x, y, width, height, rotation, flip }` — the crop selection in the *original, unrotated, unflipped* source image's own pixel coordinates, for a server to crop the full-resolution original itself. |
| `upload(url, options?)` | `Promise<unknown>` | Exports as a blob, then uploads it (default: FormData/fetch; or a custom `uploader`). |
| `on("change", cb)` / `off("change", cb)` | `void` | Subscribe/unsubscribe to state-change events (fires on drag/zoom/rotate/flip/filter changes). |
| `destroy()` | `void` | Tears the instance down: removes all pointer/wheel event listeners (drag/zoom gestures), the resize-handle listener (if `resizableFrame`), and the zoom-slider listener (if `showZoomer`); clears the container's `innerHTML` (removing the stage/frame/image/zoomer markup entirely, leaving an empty container element); and clears all `"change"` listeners. Call this when you're done with an instance (e.g. unmounting) to avoid leaking listeners. `KiriBatch.destroy()` does the same for its underlying shared `Kiri` instance. |

### Options reference

Every constructor option, its type, valid values, and default.

| Option | Type | Valid values | Default |
|---|---|---|---|
| `frame.shape` | string | `"rectangle"`, `"circle"` | `"rectangle"` |
| `frame.width` | number | any positive pixel size | `200` |
| `frame.height` | number | any positive pixel size | `200` |
| `minZoom` | number | any positive number ≤ `maxZoom` | `1` |
| `maxZoom` | number | any positive number ≥ `minZoom` | `4` |
| `rotatable` | boolean | `true`, `false` | `true` |
| `flippable` | boolean | `true`, `false` | `true` |
| `resizableFrame` | boolean | `true`, `false` | `false` |
| `lockAspectRatio` | boolean | `true`, `false` | `false` |
| `mouseWheelZoom` | boolean \| string | `true`, `false`, `"ctrl"` (require Ctrl+wheel) | `true` |
| `useExifOrientation` | boolean | `true`, `false` | `true` |
| `autoSizeStage` | boolean | `true`, `false` | `true` |
| `showZoomer` | boolean | `true`, `false` | `false` |
| `zoomerPosition` | string | `"top"`, `"bottom"`, `"left"`, `"right"` | `"bottom"` |
| `filters.brightness` | number | `>= 0` (`1` = unchanged) | `1` |
| `filters.contrast` | number | `>= 0` (`1` = unchanged) | `1` |
| `filters.saturation` | number | `>= 0` (`1` = unchanged) | `1` |
| `filters.grayscale` | boolean | `true`, `false` | `false` |
| `filters.sepia` | boolean | `true`, `false` | `false` |
| `uploader` | function | `(blob, options & {url}) => Promise<unknown>` | none — falls back to the built-in FormData/fetch uploader |

Any option with a fixed set of valid string values (`frame.shape`,
`mouseWheelZoom`, `zoomerPosition`, and `export()`/`upload()`'s `type`/
`format` below) validates at runtime, not just via TypeScript types — an
invalid value logs `console.warn("Kiri: invalid <option> \"<value>\" —
defaulting to \"<default>\". Valid values: ...")` and falls back to the
default rather than silently misbehaving. `resolveEnumOption()` in
`validate.ts` implements this once, shared across every such option.

`load(source, options)` — `options`:

| Option | Type | Valid values | Default |
|---|---|---|---|
| `zoom` | number | clamped to `[minZoom, maxZoom]` | `minZoom` |
| `offset.x` / `offset.y` | number | clamped so the frame stays covered | `0` |
| `rotation` | number (degrees) | snapped to the nearest 90° | `0` |
| `flip.horizontal` / `flip.vertical` | boolean | `true`, `false` | `false` |

`export(options)` / `upload(url, options)` — `options` (upload extends export's):

| Option | Type | Valid values | Default |
|---|---|---|---|
| `type` | string | `"base64"`, `"blob"`, `"canvas"` | `"base64"` |
| `format` | string | `"image/jpeg"`, `"image/png"`, `"image/webp"` | `"image/png"` |
| `quality` | number | `0`–`1` (only meaningful for jpeg/webp) | browser default |
| `width` | number | any positive pixel size | frame width |
| `height` | number | any positive pixel size | frame height |
| `fieldName` *(upload only)* | string | any | `"file"` |
| `fileName` *(upload only)* | string | any | `"crop.<ext>"`, ext from `format` |
| `extraFields` *(upload only)* | `Record<string,string>` | any | `{}` |
| `fetchOptions` *(upload only)* | `RequestInit` | any valid fetch init | `{}` |

> `frame.shape: "circle"` + `format: "image/jpeg"` logs a `console.warn` —
> JPEG has no alpha channel, so the area outside the circle renders solid
> black instead of transparent. Use `"image/png"` or `"image/webp"` for a
> circle crop with a transparent background.
| `uploader` *(upload only)* | function | same shape as the constructor option | the constructor's `uploader`, or the built-in one |

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
- Zoom via wheel, trackpad pinch, and an optional built-in slider
  (`showZoomer: true`, `zoomerPosition: "top" | "bottom" | "left" | "right"`,
  default `"bottom"` — purely a placement choice, identical behavior in every
  position, bidirectionally synced with wheel/pinch/`setZoom()`)
- Rotate in 90° increments
- Flip horizontally/vertically (independent of rotation)
- Optional resizable frame (drag handles)
- The stage auto-sizes to the frame's dimensions by default — no CSS
  required for a correctly-sized widget (`autoSizeStage: false` opts back
  into container-driven CSS sizing)
- Automatic EXIF orientation correction on load (rotation + horizontal flip)
- Zoom is clamped so the image can never be smaller than the frame
  (`enforceBoundary`-equivalent behavior, always on)
- Export to base64 / Blob / Canvas, JPEG / PNG / WebP, custom output dimensions

## Styling

Kiri ships a real, separate stylesheet (`kiri.css`) rather than injecting a
`<style>` tag at runtime — standard, CSP-safe, and easy for a consumer to
override or theme. Consumers import it explicitly: `import "@michaelyagi/kiri/kiri.min.css"`
(bundler) or a `<link>` to `node_modules/@michaelyagi/kiri/dist/kiri.min.css` directly.

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
// batch.previous() mirrors next() — steps back one item, false at the first item
```

### Framework wrappers

Thin pass-through components — no cropping logic duplicated, they just own
the container ref/mount lifecycle and forward to a `Kiri` instance:

- `kiri-react`: `<KiriCropper ref={...} onChange={...} {...KiriOptions} />`,
  imperative methods (`load/getState/setZoom/setOffset/reset/rotate/
  flipHorizontal/flipVertical/setFrameSize/setFilters/getCropRegion/export/
  upload`) exposed via `useImperativeHandle`.
- `kiri-vue`: same prop/method surface, exposed via Vue's `expose()`, a plain
  render-function component (`defineComponent` + `h()`) rather than an SFC —
  no `.vue` compiler plugin needed in the build.

Both react to prop changes after mount: `filters` is applied live via
`setFilters()` (no rebuild); every other option (`frame`, `minZoom`,
`resizableFrame`, `lockAspectRatio`, etc.) has no live setter in core, so
changing one destroys and reconstructs the underlying `Kiri` instance and
automatically re-`load()`s whatever source was last passed to it — a
consumer re-rendering with new props doesn't have to manually reload the
image itself.

## Project structure (monorepo)

```
kiri/
├── package.json           # root: private, npm workspaces ["packages/*"]
├── design.md, CLAUDE.md, README.md
└── packages/
    ├── core/                # published as "@michaelyagi/kiri"
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
    │   ├── package.json, tsconfig.json, vite.config.mts
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

- **Build**: Vite in library mode per package, with `vite-plugin-dts`
  generating `.d.ts` declarations — npm-publishable output in each package's
  `dist/`. `kiri-react` uses `@vitejs/plugin-react`; `kiri-vue` needs no SFC
  plugin (render-function component, not `.vue` files).
  - Core's dist filenames are deliberately explicit rather than Vite's
    defaults: **`kiri.min.js`** (UMD/CJS, minified — `main`/`require`,
    `<script>`-tag-ready, `new Kiri(...)`/`new KiriBatch(...)` as two flat
    globals, flattened from Rollup's namespace-object UMD output by a small
    build-time footer), **`kiri.js`** (the same UMD/CJS build, unminified,
    for devtools debugging), and **`kiri.mjs`** (ESM, for bundlers —
    `module`/`import`). The package has no top-level `"type": "module"` — a
    bare `.js` defaults to CommonJS (matching both UMD files' content),
    `.mjs` is always ESM regardless, avoiding the dual-package hazard a plain
    `.js` UMD file would otherwise hit. `vite.config.mts` (not `.ts`) so Vite
    loads its own config as ESM regardless of that package-type default.
  - Since Vite's `build.minify` is a single whole-build setting, the two UMD
    variants come from two build passes: the default (minified) pass also
    emits `kiri.mjs` and the `.d.ts` files; a second pass
    (`KIRI_MINIFY=false`, read via `process.env` in `vite.config.mts`, which
    also switches `formats` to `["umd"]` only and skips the `dts` plugin)
    emits just the unminified `kiri.js`, without clearing `dist/`
    (`emptyOutDir` is tied to the same env check). Both are chained in the
    `build` npm script. CSS ships as both `kiri.css` (verbatim copy of the
    source) and `kiri.min.css` (minified via esbuild's CSS transform),
    written by that same script.
- **Demo**: `packages/core/demo`, served via `vite dev`, imports the library
  source (`src/index.ts`, `src/kiri.css`) directly — no build step needed
  during development.
- **Package manager**: npm, with npm workspaces (`workspaces: ["packages/*"]`
  in the root `package.json`) — one lockfile at the root, `kiri-react`/
  `kiri-vue`'s `"@michaelyagi/kiri"` dependency resolves to the local
  `packages/core` via the workspace, not the registry.
- **Tests**: Vitest per package. `kiri-react` mounts via `react-dom/client`
  `createRoot` + `act` from `react`; `kiri-vue` mounts via Vue's own
  `createApp().mount()` — neither wrapper's test suite needs an extra testing
  library beyond the framework itself.

## Publishing

Core (`@michaelyagi/kiri`, `packages/core`) publishes to npm automatically —
`.github/workflows/publish.yml` triggers on any `v*` git tag push, then
type-checks, tests, builds, and runs `npm publish --workspace=@michaelyagi/kiri
--provenance` (provenance cryptographically links the published package to the
exact GitHub Actions run that built it — a supply-chain trust signal shown on
the npm package page). Authenticates via an `NPM_TOKEN` repo secret (an npm
"Automation" token); `packages/core/package.json`'s `"publishConfig": {
"access": "public" }` is what makes a scoped package publish as public rather
than the npm default (private) for scoped packages.

The workflow publishes whatever version is currently in
`packages/core/package.json` — **bump that version and commit it before
tagging**, so the tag and the published version match. `kiri-react`/
`kiri-vue` are not part of this workflow and stay unpublished (workspace-
internal names only) until that's revisited.

## Open questions / future work

- Touch/pinch gesture precision on mobile — needs real-device testing.
- `KiriBatch` currently has no built-in gallery/thumbnail UI — it's a queue
  manager only; a consumer builds their own UI around `next()`/`current()`.
- `@michaelyagi/kiri` (core) publishes to npm automatically on version tags —
  see the "Publishing" section below. `kiri-react`/`kiri-vue` stay unpublished
  for now, workspace-internal names only.
