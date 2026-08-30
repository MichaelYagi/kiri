import { defineConfig } from "vite";
import { resolve } from "node:path";
import dts from "vite-plugin-dts";

export default defineConfig({
  root: "demo",
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
    lib: {
      entry: resolve(__dirname, "src/kiri.ts"),
      name: "Kiri",
      fileName: "kiri",
      formats: ["es", "umd"],
    },
  },
  test: {
    root: resolve(__dirname),
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
  },
});
