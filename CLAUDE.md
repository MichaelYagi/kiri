# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Kiri — a dependency-free TypeScript library for interactive image cropping in the
browser (drag/zoom/rotate/flip an image inside a fixed frame, apply filters,
export/upload the crop). A monorepo: the core library (`packages/core`, published
to npm as `@michaelyagi/kiri`) plus thin React/Vue wrapper components
(`packages/react` → `kiri-react`, `packages/vue` → `kiri-vue`, both unpublished
internal names for now) that reuse the core's logic rather than duplicating
it. See `design.md` for the full design doc, public API shape, and rationale.

This is an original implementation. Do not reference, name-check, or copy naming
conventions from any other cropping library, in code, comments, docs, or commit
messages.

## Status

Released as `0.1.0-alpha.10` (all three packages, in lockstep). Core publishes
to npm as `@michaelyagi/kiri` automatically on `v*` git tags (see
`design.md`'s "Publishing" section and `.github/workflows/publish.yml`);
`kiri-react`/`kiri-vue` stay unpublished for now. See `CHANGELOG.md` for
what's in this release. v1 (full
parity) plus the extended feature set is implemented: filters
(brightness/contrast/saturation/sharpness/grayscale/sepia), `upload()`, batch cropping
(a documented recipe, not a shipped class — see below), a built-in zoom
slider, a `movableFrame` mode (drag/resize the frame over a fixed image
instead of panning/zooming the image), and the React/Vue wrapper packages.
See `design.md`'s "Extended features" section for each API. Treat
`design.md` as the source of truth for the intended API; update it alongside
any design decisions that change, and add a `CHANGELOG.md` entry for the next
version whenever a release-worthy change lands.

## Stack & tooling

- TypeScript, zero runtime dependencies in core, framework-agnostic (attaches to
  a plain DOM element); the wrapper packages depend only on their own framework
  as a peer dependency plus `@michaelyagi/kiri` itself.
- npm workspaces (`workspaces: ["packages/*"]` at the root) — one lockfile,
  `kiri-react`/`kiri-vue`'s `"@michaelyagi/kiri"` dependency resolves to
  `packages/core` via the workspace, not the npm registry.
- Build: Vite in library mode per package, `vite-plugin-dts` for type
  declarations. Core's config is `vite.config.mts` (not `.ts`) — the package
  intentionally has no top-level `"type": "module"` (see below), and `.mts`
  forces Vite to load its own config as ESM regardless of that. Wrappers
  output ESM + CJS with `react`/`react-dom`/`vue`/`@michaelyagi/kiri`
  externalized (peer deps, not bundled) — **the `rollupOptions.external` entry
  in each wrapper's `vite.config.ts` must say `"@michaelyagi/kiri"`, not
  `"kiri"`, or Vite silently bundles the entire core library into the wrapper's
  output instead of externalizing it** (a ~10x dist size jump is the tell).
  Source maps are on (`build.sourcemap: true`).
- Core's dist filenames are explicit, not Vite's defaults: **`kiri.min.js`**
  (UMD/CJS, minified, the `<script>`-tag-ready build — `main`/`require`),
  **`kiri.js`** (same UMD/CJS build, unminified, for devtools debugging), and
  **`kiri.mjs`** (ESM — `module`/`import`). No `"type": "module"` in
  `package.json`, so a bare `.js` defaults to CommonJS (matching both UMD
  files' content) while `.mjs` is always ESM — avoids the dual-package hazard
  a plain `.js` UMD file would hit under `"type":"module"`. The UMD build's
  Rollup output is a namespace object (`window.Kiri = { Kiri: ... }`, since
  the entry re-exports `Kiri` as a named rather than default export) — a
  small `generateBundle` plugin hook in `vite.config.mts`
  (`flattenUmdGlobal`) appends a footer that flattens it to a plain
  `window.Kiri` global for `<script>`-tag consumers; it's a no-op for
  `require()`/bundler consumers.
  Because `build.minify` is whole-build in Vite, `kiri.js` comes from a
  second build pass (`KIRI_MINIFY=false`, chained in the `build` npm script)
  that switches `formats` to UMD-only, skips the `dts` plugin, and sets
  `emptyOutDir: false` so it doesn't wipe out the first pass's output — both
  reading `process.env.KIRI_MINIFY` in `vite.config.mts`.
- Styling: `packages/core/src/kiri.css` is the readable source, a real
  stylesheet (not JS-injected). The build script copies it verbatim to
  `dist/kiri.css` and minifies it to `dist/kiri.min.css` via esbuild's CSS
  transform (no separate CSS build tool). Consumers `import
  "@michaelyagi/kiri/kiri.min.css"` (or the unminified
  `@michaelyagi/kiri/kiri.css` for debugging). The demo imports
  the *source* `kiri.css` from `main.ts` (not a `<link>` tag — Vite's dev
  root is `demo/`, so a relative `<link href="../src/kiri.css">` 404s; a JS
  `import` resolves correctly against the filesystem regardless of dev root).
- Demo page: `packages/core/demo/index.html`, run via `vite dev`, imports
  library source directly.
- Stage sizing: by default (`autoSizeStage: true`, the default) the stage is
  given an inline `width`/`height` (in `Kiri`'s constructor and
  `setFrameSize()`, via `stage.ts`'s `setStageSize`) equal to the frame's
  dimensions plus `STAGE_AUTO_SIZE_PADDING` (20px) on each axis — so it
  renders correctly with zero consumer CSS, and the resize handle (which
  protrudes 5px past the frame edge) stays within the stage's
  `overflow: hidden` clipping bounds. `autoSizeStage: false` skips that
  inline sizing, falling back to `kiri.css`'s `.kiri-stage { width: 100%;
  height: 100% }` rule — for a consumer who wants to size the stage via
  their own container CSS instead.
- Zoom slider (`showZoomer`/`zoomerPosition`, default off/`"bottom"`): when
  enabled, `stage.ts`'s `createStage()` wraps `stageEl` and a new `<input
  type="range" class="kiri-zoomer">` in a `.kiri-root.kiri-root--<position>`
  flex container (CSS `order`/`flex-direction` per position handle layout —
  see `kiri.css`) rather than appending `stageEl` to the container directly.
  `left`/`right` render the slider vertically via `writing-mode:
  vertical-lr; direction: rtl` (verified in a real browser that this puts
  max zoom at the top, matching a natural vertical-slider direction).
  `Kiri.enableZoomer()` wires the slider's `"input"` event to `setZoom()`;
  `commitState()` writes `zoomerEl.value` on every state change so it stays
  in sync regardless of what triggered the zoom (wheel/pinch/drag-clamping/
  `setZoom()` itself) — setting `.value` programmatically doesn't re-fire
  `"input"`, so there's no feedback loop. All positions are purely a CSS
  placement choice — identical zoom behavior in every position.
- Option validation: any option with a fixed set of valid string values
  (`frame.shape`, `mouseWheelZoom`, `zoomerPosition`, `export()`/`upload()`'s
  `type`/`format`) is validated at *runtime*, not just via TypeScript types —
  a JS consumer (or a typo bypassing the type checker, e.g.
  `zoomerPosition: "bttom"`) gets a `console.warn` and a fallback to the
  default rather than silently producing an unstyled `.kiri-root--bttom`
  class with no matching CSS rule. `resolveEnumOption()` in `validate.ts` is
  the single shared implementation — reach for it (not an ad-hoc `??`) for
  any new string-enum option. `frame.shape`'s values are `"rectangle"` /
  `"circle"` / `"rounded-rectangle"` — spelled out in full, no abbreviations
  in the public API; multi-word values are kebab-case (`"rounded-rectangle"`,
  not `"roundedRectangle"`), matching CSS-value-style conventions used
  elsewhere in the option surface.
- Circle export: `frame.shape: "circle"` used to be purely a `stage.ts`
  visual overlay (`.kiri-frame--circle`'s `border-radius: 50%` on the frame
  border/dimming) — `export()`/`upload()` always produced a plain rectangle
  regardless of shape, since `exportCrop()`/`renderCropToCanvas()` in
  `export.ts` never received the shape at all. Fixed by threading
  `frame.shape` through both (from `Kiri.export()`'s `this.opts.frame.shape`)
  and clipping the output canvas to an ellipse (`ctx.ellipse()` +
  `ctx.clip()`, inscribed in the output width/height) before the final
  `drawImage`. `format: "image/jpeg"` has no alpha channel, so a circle
  export as JPEG renders solid black outside the circle instead of
  transparent — `exportCrop()` `console.warn`s on that specific combination.
  Verified in a real browser via pixel-level `getImageData` (corner alpha 0,
  center alpha 255) — this can't be tested in jsdom, which has no real 2D
  canvas context.
- Rounded-rectangle frame (`frame.shape: "rounded-rectangle"`,
  `frame.cornerRadius`, default `20`px): built the same way circle's export
  clip works, so it didn't repeat circle's original bug — `frame.shape` and
  `frame.cornerRadius` are threaded through `exportCrop()`/
  `renderCropToCanvas()` from the start, clipping via `ctx.roundRect()` +
  `ctx.clip()`. The radius is a per-instance pixel value (unlike circle's
  fixed 50%), so `stage.ts` sets it as an inline `border-radius` on the frame
  element rather than a static CSS rule; the export clip scales it by
  `outputWidth / frame.width` so a custom `export()` output size still looks
  proportionally the same. Same JPEG-alpha `console.warn` as circle. Verified
  in a real browser via pixel-level `getImageData`, including the scaled-radius
  case (custom output size).
- `filters.sharpness` (default `1`, matching the other numeric filters'
  "1 = unchanged" convention; values above `1` sharpen): CSS has no
  `sharpen()` filter, so unlike brightness/contrast/saturation it can't be a
  plain filter-string keyword. `stage.ts`'s `createSharpenFilter()` builds a
  hidden 0×0 `<svg>` per `Kiri` instance containing a `feConvolveMatrix`
  (a 3×3 unsharp-mask kernel — see `filters.ts`'s `sharpenKernelMatrix()`),
  with a unique `id` (`kiri-sharpen-<n>`, module-level counter) so multiple
  instances on one page don't collide; `buildFilterString()` **prepends**
  `url(#id)` — before brightness/contrast/saturate, not after — when
  `sharpness > 1`. That ordering is load-bearing, not stylistic: a real
  Chromium bug/quirk makes `url(#id)` placed *after* native CSS filter
  functions in the same chain render fully blank, confirmed by direct
  browser testing (isolating the exact chain order that broke vs. worked)
  after `filters.sharpness` first shipped with the reversed order and
  silently produced transparent exports. Don't reorder `buildFilterString()`
  without re-verifying pixel output in a real browser. Both
  `img.style.filter` and a canvas 2D context's `ctx.filter` resolve
  `url(#id)` identically — confirmed in a real browser that this holds even
  when the canvas is never attached to the document (`export.ts`'s offscreen
  `sourceCanvas`), so preview/export parity holds the same way it does for
  the native CSS filters. `applyFilters()` rewrites just the kernel's
  `kernelMatrix` attribute on every `setFilters()` call rather than
  rebuilding the filter, so adjusting the value live stays cheap.
  `edgeMode="duplicate"` avoids dark edge fringing;
  `color-interpolation-filters="sRGB"` on the `<filter>` avoids a
  brightness/contrast shift from SVG's `linearRGB` default relative to the
  sRGB-space CSS filters earlier in the chain; `preserveAlpha="true"` on the
  `feConvolveMatrix` matters too — without it, the alpha channel gets
  convolved along with color, and the kernel's negative neighbor weights can
  drive alpha toward 0 right at a sharp edge, turning an opaque photo
  semi-transparent exactly where sharpening is strongest (caught the same
  way as the ordering bug — real-browser pixel testing, not by inspection).
- Flip/rotation composition order: `flipHorizontal()`/`flipVertical()`
  always mirror what's currently *displayed* (screen-space) — e.g.
  "horizontal" flip always reads as horizontal, regardless of the current
  rotation — not the image's own pre-rotation axes. Originally shipped the
  other way (flip applied before rotation, i.e. intrinsic-space), which a
  user caught by reporting that `rotate(180)` then `flipHorizontal()`
  produced a vertical-looking mirror instead of feeling like a horizontal
  one — mathematically correct under the old model (reflections + 180°
  rotation compose into the other axis) but not the expected/intuitive
  behavior. Fixed by swapping which operation is outermost: `stage.ts`'s
  `applyTransform()` now lists `scale(flip) rotate(deg)` (rotate rightmost →
  applied first); `export.ts`'s `renderCropToCanvas()` now calls
  `sctx.scale(...)` before `sctx.rotate(...)` (canvas 2D transform calls
  compose in call order, last-called applied first — same rule, opposite
  surface syntax from CSS's list order, easy to get backwards — verified
  the actual composition rule empirically with a real asymmetric-marker
  canvas test before trusting it, not from memory alone).
  **This flowed into `exif.ts`'s `orientationToTransform()` table too**:
  orientations 5 and 7 (the ones that combine both rotation and flip) had
  their rotation values tuned for the old order and are now wrong under the
  new one — reflections invert the effective rotation direction
  (`flip · rotate(θ) = rotate(-θ) · flip`), so orientation 5 changed from
  `{rotation: 90, flipHorizontal: true}` to `{rotation: 270, flipHorizontal:
  true}`, and 7 from `270`→`90`. Orientations 2/3/4/6/8 are unaffected (2
  and 4 have no rotation-order ambiguity since 0°/180° are their own
  negation mod 360; 3/6/8 have no flip at all). Verified by direct pixel
  comparison: new-order `rotate(270)+flip` reproduces the exact same output
  old-order `rotate(90)+flip` did, and vice versa — not re-derived from the
  EXIF spec from scratch. `exif.test.ts`'s assertions for cases 5/7 are
  updated to match.
- `movableFrame` (default `false`): inverts which element is interactive —
  the image is fixed at load (no pan/zoom; `setZoom()`/`setOffset()` become
  no-ops) and dragging/arrow-keys move the *frame* over it instead, via a new
  `setFramePosition()` method and `state.framePosition` field. Combined with
  `resizableFrame`, its corner handles resize the frame too, capped at the
  image's own bounds in `setFrameSize()` (`kiri.ts`) since there's no
  auto-zoom left to grow into. Reuses the existing offset/frame-clamp
  geometry rather than duplicating it: `computeCropRegion()`/
  `renderCropToCanvas()` (used by `export()`/`getCropRegion()`) are driven
  through unmodified by substituting `offset = -framePosition` (a moved frame
  and an oppositely-moved image describe identical relative geometry) and a
  `zoom` value that algebraically cancels `computeCoverScale()`'s dependency
  on the *current* frame size back out to the size frozen at load
  (`fixedImageSize`, recomputed on `rotate()`); `clampOffset()`'s already-
  symmetric range needed no sign flip to double as frame-position clamping.
  **The live-preview render (`commitState()`) needed the identical
  frozen-scale substitution independently** — it was initially left deriving
  the image's on-screen scale from `computeCoverScale(natural, currentFrame,
  rotation) * zoom` (current frame size) rather than `fixedImageSize`, which
  only visibly breaks once a frame resize crosses over which axis is
  covering-scale's limiting dimension — a first round of manual/scripted
  testing happened to only resize along the already-limiting axis and missed
  it entirely. Caught live in the browser (shrinking/growing across that
  crossover point and watching the static image visibly zoom when it
  shouldn't), not by code review — a reminder that the export path and the
  live-render path each independently apply this substitution rather than
  sharing one "effective state" helper, so both need checking whenever this
  area changes.
- Tests: Vitest per package. `kiri-react`'s suite mounts via `react-dom/client`
  + `act` from `react` (not `react-dom/test-utils`, which is deprecated); set
  `globalThis.IS_REACT_ACT_ENVIRONMENT = true` to avoid act() warnings.
  `kiri-vue`'s suite mounts via Vue's own `createApp().mount()` — neither
  needs an extra testing-library dependency.
- Package manager: npm.

## Commands

- `npm run dev` (root) — Vite dev server for the core demo
- `npm run build` (root) — builds all three packages (`--workspaces --if-present`)
- `npm test` (root) — runs all three packages' Vitest suites
- Per-package: `npm run <script> --workspace=kiri` (or `kiri-react`/`kiri-vue`)

## API conventions

Kiri's API is deliberately simpler/more literal than prior art in this space:

- One method per action, no overloaded call signatures — options are passed as a
  single named-options object, not positional args or variant types.
- Verb-first method names in plain English (`load()`, `export()`, `getState()`),
  not domain jargon.
- "Stage" (outer container) and "frame" (crop selection window) are the naming
  used throughout — see the naming rationale table in `design.md` before
  introducing new terms for these concepts.
- All mutable state (zoom, offset, rotation) is exposed through a single
  `getState()`, not scattered getters.

When implementing new public API surface, check `design.md`'s API section first —
keep the two in sync if you deviate. The React/Vue wrappers are thin
pass-throughs — new core methods should be added to their prop/imperative-method
surface too (`packages/react/src/KiriCropper.tsx`,
`packages/vue/src/KiriCropper.ts`), not reimplemented there.

## Non-goals

No remaining deliberate non-goals — the original v1 non-goals list (upload,
filters, batch, wrappers) has all been implemented, and core now publishes to
npm automatically. `KiriBatch` was a shipped class through `0.1.0-alpha.5`;
it was removed in `0.1.0-alpha.6` in favor of a documented recipe (see
`design.md`'s "Batch cropping" section) since it added no real logic beyond
index/array bookkeeping a consumer can trivially own. Still explicitly out
of scope unless asked: a batch-cropping gallery/thumbnail UI, and publishing
`kiri-react`/`kiri-vue` to npm.
