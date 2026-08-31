import { defineConfig } from "vite";
import { resolve } from "node:path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      root: resolve(__dirname),
      entryRoot: "src",
      include: ["src"],
      outDir: resolve(__dirname, "dist"),
      insertTypesEntry: true,
    }),
  ],
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "KiriVue",
      fileName: "kiri-vue",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["vue", "@michaelyagi/kiri"],
    },
  },
  test: {
    root: resolve(__dirname),
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
  },
});
