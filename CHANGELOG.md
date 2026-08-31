# Changelog

All notable changes to this project are documented here. Versions apply to
all three packages (`@michaelyagi/kiri`, `kiri-react`, `kiri-vue`) in lockstep.

## Unreleased

- Core is now published to npm as **`@michaelyagi/kiri`** (renamed from the
  unscoped `kiri`) — `kiri-react`/`kiri-vue` stay unpublished for now, and
  keep their unscoped internal names.
- Publishing is automated: `.github/workflows/publish.yml` builds, tests, and
  runs `npm publish` on any `v*` git tag push.

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
