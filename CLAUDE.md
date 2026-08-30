# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Kiri — a dependency-free TypeScript library for interactive image cropping in the
browser (drag/zoom/rotate an image inside a fixed frame, export the crop as an
image). See `design.md` for the full design doc, public API shape, and rationale.

This is an original implementation. Do not reference, name-check, or copy naming
conventions from any other cropping library, in code, comments, docs, or commit
messages.

## Status

Early scaffolding stage — implementation has not started yet. Treat `design.md` as
the source of truth for intended structure/API until code exists; update it
alongside any design decisions that change during implementation.

## Stack & tooling

- TypeScript, zero runtime dependencies, framework-agnostic (attaches to a plain
  DOM element).
- Build: Vite in library mode (`vite.config.ts`) with `vite-plugin-dts` for type
  declarations. Output: ESM + UMD/IIFE, npm-publishable from `dist/`.
- Demo page: `demo/index.html`, run via `vite dev`, imports library source directly.
- Tests: Vitest.
- Package manager: npm.

## Commands (once scaffolded)

- `npm run dev` — Vite dev server serving `demo/index.html`
- `npm run build` — library build to `dist/` (ESM + UMD + `.d.ts`)
- `npm test` — Vitest

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
keep the two in sync if you deviate.

## Non-goals (v1)

Do not add: server/upload integration, image filters/effects, multi-image/batch
cropping, or framework-specific wrapper components (React/Vue). See `design.md`
for full scope.
