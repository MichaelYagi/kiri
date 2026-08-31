> **AI-authored.** 100% of the code was written by Claude (Anthropic); I shaped the architecture, scope, and every decision, and did all the testing.

# Kiri

A dependency-free TypeScript library for interactive image cropping in the browser.

## Features

- **Drag, zoom, rotate, flip** — wheel/trackpad pinch zoom, an optional
  built-in zoom slider (`showZoomer`, placeable on any of the four sides),
  90° rotation, independent horizontal/vertical flip
- **Rectangle or circle frame** — circle is a real clip on export (transparent
  corners on PNG/WebP), not just a visual overlay
- **Zero-CSS sizing** — the stage auto-sizes itself to the frame's dimensions
- **Filters** — brightness/contrast/saturation/grayscale/sepia, applied
  identically to the live preview and the export
- **Automatic EXIF orientation correction** on load
- **Resizable frame**, drag-handle based
- **Export** to base64, Blob, or Canvas — JPEG/PNG/WebP, custom output size
- **Upload** — a built-in FormData/fetch helper, or plug in your own
- **Batch cropping** (`KiriBatch`) — one shared cropper stepped through a
  queue of images
- **React and Vue wrappers** (`kiri-react`, `kiri-vue`) — thin components, no
  duplicated logic
- Runtime-validated options (a typo'd setting warns and falls back rather
  than silently misbehaving), a clear error if the container element is
  missing, and a real, CSP-safe stylesheet instead of injected styles
- Ships as ESM for bundlers and UMD/CJS for a plain `<script>` tag —
  minified and unminified builds of both

## Documentation

**[michaelyagi.github.io/kiri](https://michaelyagi.github.io/kiri)** —
getting started, every method/event/setting, guides, real runnable examples,
an interactive playground, and the full API reference.

## Packages

| Package | Path | What it is |
|---|---|---|
| `kiri` | `packages/core` | The library itself — framework-agnostic |
| `kiri-react` | `packages/react` | `<KiriCropper>` React component |
| `kiri-vue` | `packages/vue` | `<KiriCropper>` Vue component |

## Status

**`0.1.0-alpha.1`** — first alpha release. Not yet published to npm (see
[CHANGELOG.md](./CHANGELOG.md) for what's in this release); install from this
repo (npm workspaces) until then. The public API is expected to be mostly
stable but may still change before a `0.1.0` (non-alpha) release.

## Development

```bash
npm install                # installs all workspace packages
npm run dev                 # core demo at http://localhost:5173
npm run build                # builds all three packages
npm test                      # runs all three packages' test suites
npm run docs:build             # rebuilds the docs/ site (library + API reference + asset sync)
```

See [design.md](./design.md) for the full design document.
