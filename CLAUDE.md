# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Kiri — a dependency-free TypeScript library for interactive image cropping in the
browser (drag/zoom/rotate/flip an image inside a fixed frame, apply filters,
export/upload the crop). A monorepo: the core library (`packages/core`, published
as `kiri`) plus thin React/Vue wrapper components (`packages/react` → `kiri-react`,
`packages/vue` → `kiri-vue`) that reuse the core's logic rather than duplicating
it. See `design.md` for the full design doc, public API shape, and rationale.

This is an original implementation. Do not reference, name-check, or copy naming
conventions from any other cropping library, in code, comments, docs, or commit
messages.

## Status

v1 (full parity) plus the extended feature set is implemented: filters
(brightness/contrast/saturation/grayscale/sepia), `upload()`, `KiriBatch`
(multi-image queue), and the React/Vue wrapper packages. See `design.md`'s
"Extended features" section for each API. Treat `design.md` as the source of
truth for the intended API; update it alongside any design decisions that change.

## Stack & tooling

- TypeScript, zero runtime dependencies in core, framework-agnostic (attaches to
  a plain DOM element); the wrapper packages depend only on their own framework
  as a peer dependency plus `kiri` itself.
- npm workspaces (`workspaces: ["packages/*"]` at the root) — one lockfile,
  `kiri-react`/`kiri-vue`'s `"kiri"` dependency resolves to `packages/core` via
  the workspace, not the npm registry.
- Build: Vite in library mode per package, `vite-plugin-dts` for type
  declarations. Core's config is `vite.config.mts` (not `.ts`) — the package
  intentionally has no top-level `"type": "module"` (see below), and `.mts`
  forces Vite to load its own config as ESM regardless of that. Wrappers
  output ESM + CJS with `react`/`react-dom`/`vue`/`kiri` externalized (peer
  deps, not bundled). Source maps are on (`build.sourcemap: true`).
- Core's dist filenames are explicit, not Vite's defaults: **`kiri.min.js`**
  (UMD/CJS, minified, the `<script>`-tag-ready build — `main`/`require`),
  **`kiri.js`** (same UMD/CJS build, unminified, for devtools debugging), and
  **`kiri.mjs`** (ESM — `module`/`import`). No `"type": "module"` in
  `package.json`, so a bare `.js` defaults to CommonJS (matching both UMD
  files' content) while `.mjs` is always ESM — avoids the dual-package hazard
  a plain `.js` UMD file would hit under `"type":"module"`. The UMD build's
  Rollup output is a namespace object (`window.Kiri = { Kiri, KiriBatch }`,
  since the entry has two named exports) — a small `generateBundle` plugin
  hook in `vite.config.mts` (`flattenUmdGlobal`) appends a footer that
  flattens it to two separate globals (`window.Kiri`, `window.KiriBatch`) for
  `<script>`-tag consumers; it's a no-op for `require()`/bundler consumers.
  Because `build.minify` is whole-build in Vite, `kiri.js` comes from a
  second build pass (`KIRI_MINIFY=false`, chained in the `build` npm script)
  that switches `formats` to UMD-only, skips the `dts` plugin, and sets
  `emptyOutDir: false` so it doesn't wipe out the first pass's output — both
  reading `process.env.KIRI_MINIFY` in `vite.config.mts`.
- Styling: `packages/core/src/kiri.css` is the readable source, a real
  stylesheet (not JS-injected). The build script copies it verbatim to
  `dist/kiri.css` and minifies it to `dist/kiri.min.css` via esbuild's CSS
  transform (no separate CSS build tool). Consumers `import
  "kiri/kiri.min.css"` (or the unminified `kiri/kiri.css` for debugging). The
  demo imports
  the *source* `kiri.css` from `main.ts` (not a `<link>` tag — Vite's dev
  root is `demo/`, so a relative `<link href="../src/kiri.css">` 404s; a JS
  `import` resolves correctly against the filesystem regardless of dev root).
- Demo page: `packages/core/demo/index.html`, run via `vite dev`, imports
  library source directly.
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
filters, batch, wrappers) has all been implemented. Still explicitly out of
scope unless asked: a `KiriBatch` gallery/thumbnail UI (it's a queue manager
only), and actually publishing the packages to npm.
