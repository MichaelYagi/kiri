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
- **Resizable frame**, four independent corner handles, with an optional
  `lockAspectRatio` to keep a fixed ratio while resizing
- **`setOffset()`/`reset()`** for programmatic panning and reverting to the
  post-`load()` state
- **`getCropRegion()`** — the crop mapped back to the original image's own
  pixel coordinates, for server-side cropping of the full-resolution source
- **Keyboard-accessible** — the stage is focusable; arrow keys pan, `+`/`-`
  zoom, `0` resets
- **Export** to base64, Blob, or Canvas — JPEG/PNG/WebP, custom output size
- **Upload** — a built-in FormData/fetch helper, or plug in your own
- **Batch cropping** — a documented recipe for stepping one shared cropper
  through a queue of images, no separate class needed
- **React and Vue wrappers** (`kiri-react`, `kiri-vue`) — thin components, no
  duplicated logic, reactive to prop changes after mount
- Runtime-validated options (a typo'd setting warns and falls back rather
  than silently misbehaving), a clear error if the container element is
  missing, and a real, CSP-safe stylesheet instead of injected styles
- Ships as ESM for bundlers and UMD/CJS for a plain `<script>` tag —
  minified and unminified builds of both

## Install

```bash
npm install @michaelyagi/kiri
```

[npmjs.com/package/@michaelyagi/kiri](https://www.npmjs.com/package/@michaelyagi/kiri)

## Zero-config quickstart

```html
<link rel="stylesheet" href="node_modules/@michaelyagi/kiri/dist/kiri.min.css" />
<script src="node_modules/@michaelyagi/kiri/dist/kiri.min.js"></script>
<div id="cropper"></div>
<script>
  const cropper = new Kiri(document.getElementById("cropper"), {
    frame: { shape: "circle", width: 200, height: 200 },
  });
  await cropper.load("photo.jpg");
  const blob = await cropper.export({ type: "blob" });
</script>
```

No CSS sizing needed on the container — the stage auto-sizes itself to the
frame's dimensions. See [Getting started](https://michaelyagi.github.io/kiri/guides/getting-started.html)
for npm/ESM installation too.

## Documentation

**[michaelyagi.github.io/kiri](https://michaelyagi.github.io/kiri)** —
getting started, every method/event/setting, guides, real runnable examples,
an interactive playground, and the full API reference.

## Packages

| Package | Path | What it is |
|---|---|---|
| `@michaelyagi/kiri` | `packages/core` | The library itself — framework-agnostic |
| `kiri-react` | `packages/react` | `<KiriCropper>` React component (unpublished) |
| `kiri-vue` | `packages/vue` | `<KiriCropper>` Vue component (unpublished) |

## Status

**`0.1.0-alpha.6`** — see [CHANGELOG.md](./CHANGELOG.md)
for what's in it. Core publishes to npm automatically on version tags via
GitHub Actions; `kiri-react`/`kiri-vue` aren't published yet. The public API
is expected to be mostly stable but may still change before a `0.1.0`
(non-alpha) release.

## Development

```bash
npm install                # installs all workspace packages
npm run dev                 # core demo at http://localhost:5173
npm run build                # builds all three packages
npm test                      # runs all three packages' test suites
npm run docs:build             # rebuilds the docs/ site (library + API reference + asset sync)
```

See [design.md](./design.md) for the full design document.
