# Changelog

All notable changes to this project are documented here. Versions apply to
all three packages (`@michaelyagi/kiri`, `kiri-react`, `kiri-vue`) in lockstep.

## 0.1.0-alpha.6

- **Breaking:** Removed the `KiriBatch` class. It was a thin wrapper around
  a plain array (queue) + index + a shared `Kiri` instance, adding no real
  logic of its own — that bookkeeping is now a documented recipe instead
  (see the [Batch cropping section](https://michaelyagi.github.io/kiri/guides/methods.html#batch-cropping) of the Methods guide),
  built entirely on public `Kiri` methods (`load()`, `export()`). If you were
  using `KiriBatch`, replace it with the recipe: a plain array of
  `{ source, loadOptions? }` items, an index variable, and `next()`/
  `previous()`/`capture()` functions built around `cropper.load()`/
  `cropper.export()` — see the guide for the full pattern. The UMD build's
  browser global changes accordingly: `window.KiriBatch` no longer exists
  (`window.Kiri` is unaffected).

## 0.1.0-alpha.5

- Fixed a memory leak: `load()` created an object URL (via
  `URL.createObjectURL`) for `File`/`Blob` sources but only revoked it on a
  successful decode. A failed load (corrupt file, unsupported format) left
  the object URL — and the underlying blob — alive for the rest of the
  page's lifetime. Now revoked on both the success and error paths.
- New `crop-region.html` example, plus a "Center" button (`setOffset()`) in
  the playground and a "Reset" button in the basic-crop example — closing
  the last few methods that had no live demonstration anywhere in the docs.
- The batch-cropping example's queue now uses two distinct sample photos
  instead of loading the same image twice, and gained a "Previous image"
  button (`KiriBatch.previous()` was added in `0.1.0-alpha.3` but the
  example was never updated for it).

## 0.1.0-alpha.4

- Fixed inverted arrow-key pan direction (introduced in `0.1.0-alpha.3`):
  pressing Right/Down was moving the image itself in that direction, which
  actually revealed *less* of that side. Arrow keys now follow the standard
  pan/scroll convention — pressing Right reveals more of the image's right
  side, Down reveals more of the bottom — matching how arrow-key panning
  works in map/photo-viewer apps generally.

## 0.1.0-alpha.3

### Core (`@michaelyagi/kiri`)

- `setOffset(offset)`: sets pan to an absolute value (clamped, same as
  drag), for programmatic centering/positioning without simulating a drag.
- `reset()`: reverts zoom/offset/rotation/flip/filters to whatever they
  were right after `load()` resolved. No-op before anything's loaded.
- `getCropRegion()`: returns the current crop selection as `{ x, y, width,
  height, rotation, flip }` in the *original, unrotated, unflipped* source
  image's own pixel coordinates — for sending to a server that crops the
  full-resolution original itself instead of uploading a client-re-encoded
  image.
- `resizableFrame` now adds a drag handle at all **four** frame corners
  (previously bottom-right only), each independently resizing the frame
  from that corner.
- New `lockAspectRatio` option: when `resizableFrame` is on, dragging a
  corner handle preserves the frame's current aspect ratio instead of
  resizing width/height independently.
- `KiriBatch.previous()`: mirrors `next()` — steps the shared cropper back
  one item; `false` (no-op) at the first item or before anything's loaded.
- Keyboard accessibility: the stage is now a focusable, labeled element
  (`tabindex="0"`, `role="application"`, `aria-label`). Arrow keys pan,
  `+`/`-` zoom, `0` resets — all through the same public methods a caller
  would use, so the same clamping applies.

### `kiri-react` / `kiri-vue`

- `<KiriCropper>` now reacts to prop changes after mount instead of only
  capturing them once at construction: `filters` is applied live via
  `setFilters()` (no rebuild); every other option (`frame`, `minZoom`,
  `resizableFrame`, `lockAspectRatio`, etc.) rebuilds the underlying `Kiri`
  instance and automatically reloads whatever source was last passed to
  `load()`.
- New `lockAspectRatio` prop.
- The imperative handle / exposed methods gained `setOffset`, `reset`, and
  `getCropRegion`, matching core.

## 0.1.0-alpha.2

- Core is now published to npm as **`@michaelyagi/kiri`** (renamed from the
  unscoped `kiri`) — `kiri-react`/`kiri-vue` stay unpublished for now, and
  keep their unscoped internal names.
- Publishing is automated: `.github/workflows/publish.yml` builds, tests, and
  runs `npm publish --provenance` on any `v*` git tag push, authenticated via
  an `NPM_TOKEN` repo secret.
- Added a full documentation site at
  [michaelyagi.github.io/kiri](https://michaelyagi.github.io/kiri): guides
  (getting started, methods, events, settings, filters, batch cropping,
  architecture), seven real runnable examples, an interactive playground
  covering every option, and a TypeDoc-generated API reference.
- The Settings guide's option tables now explain what each option actually
  *does* (a Description column), not just its type/valid-values/default —
  e.g. what happens when you set `rotatable: false`, not just that it's a
  boolean.

## 0.1.0-alpha.1

First alpha release. Not yet published to npm.

### Core (`kiri`)

- Interactive cropping: drag to pan, zoom via wheel/trackpad pinch/an
  optional built-in slider, rotate in 90° increments, flip horizontal/
  vertical (independent of rotation), optional resizable frame (drag
  handle).
- Rectangle or circle frame shape — circle is a real clip on export, not
  just a visual overlay (PNG/WebP get a transparent circular cutout; a
  JPEG export of a circle frame warns, since JPEG has no alpha channel).
- The stage auto-sizes itself to the frame's dimensions by default — no
  CSS required for a correctly-sized widget (`autoSizeStage: false` opts
  back into container-driven CSS sizing).
- Built-in zoom slider (`showZoomer`/`zoomerPosition`), bidirectionally
  synced with wheel/pinch/`setZoom()`.
- Automatic EXIF orientation correction on load (rotation + horizontal
  flip, including the mirrored orientations).
- Filters: brightness/contrast/saturation/grayscale/sepia, applied
  identically to the live preview and the export via the same CSS filter
  string.
- Export to base64 (data URL) / Blob / Canvas, JPEG/PNG/WebP, custom
  output dimensions.
- `upload()`: a default FormData/fetch helper, or a pluggable custom
  uploader (per-instance or per-call).
- `KiriBatch`: steps one shared `Kiri` instance through a queue of
  images for multi-image cropping.
- Runtime validation on every string-enum option (`frame.shape`,
  `mouseWheelZoom`, `zoomerPosition`, export `type`/`format`) — an
  invalid value warns and falls back to the default instead of silently
  misbehaving.
- A clear, actionable error when the container element is missing from
  the DOM, instead of a cryptic native `TypeError`.
- Ships a real, separate stylesheet (`kiri.css`/`kiri.min.css`) rather
  than injecting styles at runtime.
- Built as ESM (`kiri.mjs`) for bundlers and UMD/CJS (`kiri.js`/
  `kiri.min.js`) for `<script>` tags or `require()` — `Kiri` and
  `KiriBatch` land as two separate globals in the browser build.

### `kiri-react` / `kiri-vue`

- Thin `<KiriCropper>` wrapper components — no cropping logic
  duplicated, they own the container ref/mount lifecycle and forward to
  a `Kiri` instance. Same prop/method surface in both.

### Project

- Restructured as an npm-workspaces monorepo (`packages/core`,
  `packages/react`, `packages/vue`).
