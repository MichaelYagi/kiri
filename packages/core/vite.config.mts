import { defineConfig, type Plugin } from "vite";
import { resolve } from "node:path";
import dts from "vite-plugin-dts";

// The UMD bundle exports both `Kiri` and `KiriBatch` as named exports, so
// Rollup's UMD wrapper sets `window.Kiri` to a namespace object
// ({ Kiri, KiriBatch }) rather than the class itself. This flattens it after
// the wrapper runs, so plain <script>-tag consumers get `Kiri` and
// `KiriBatch` as two separate globals (`new Kiri(...)` works directly). It's
// a no-op for require()/bundler consumers, who never hit the globalThis
// branch of the UMD wrapper in the first place.
function flattenUmdGlobal(): Plugin {
  return {
    name: "flatten-umd-global",
    generateBundle(options, bundle) {
      if (options.format !== "umd") return;
      for (const file of Object.values(bundle)) {
        if (file.type === "chunk" && file.isEntry) {
          file.code += `\n(function(){
  if (typeof globalThis !== "undefined" && globalThis.Kiri && globalThis.Kiri.Kiri) {
    var __KiriBatch = globalThis.Kiri.KiriBatch;
    globalThis.Kiri = globalThis.Kiri.Kiri;
    globalThis.KiriBatch = __KiriBatch;
  }
})();
`;
        }
      }
    },
  };
}

// Vite's `build.minify` applies to the whole build, so producing both the
// minified and unminified UMD build takes two invocations: the default
// (minified) pass writes kiri.min.js + kiri.mjs + the .d.ts files. A second
// pass (`KIRI_MINIFY=false npm run build`, chained in the build script)
// writes the unminified kiri.js on top without clearing dist/ or redoing the
// other work. Both are equally production-grade, plain <script>-tag-ready
// UMD/CJS builds — kiri.js just isn't minified.
const MINIFY = process.env.KIRI_MINIFY !== "false";

export default defineConfig({
  root: "demo",
  plugins: [
    ...(MINIFY
      ? [
          dts({
            root: resolve(__dirname),
            entryRoot: "src",
            include: ["src"],
            outDir: resolve(__dirname, "dist"),
            insertTypesEntry: true,
          }),
        ]
      : []),
    flattenUmdGlobal(),
  ],
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: MINIFY,
    sourcemap: true,
    minify: MINIFY,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "Kiri",
      // "kiri.min.js" (minified) and "kiri.js" (unminified) are both
      // production-grade, plain <script>-tag-ready UMD/CJS builds — same
      // content, kiri.js just isn't minified. The ESM build uses the
      // unambiguous .mjs extension — the package has no top-level "type":
      // "module", so a plain .js file defaults to CommonJS, and .mjs is
      // always ESM regardless of that setting, avoiding any dual-package
      // hazard.
      fileName: (format) => (format === "umd" ? (MINIFY ? "kiri.min.js" : "kiri.js") : "kiri.mjs"),
      formats: MINIFY ? ["es", "umd"] : ["umd"],
    },
  },
  test: {
    root: resolve(__dirname),
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
  },
});
