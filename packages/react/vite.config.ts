import { defineConfig } from "vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    react(),
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
      name: "KiriReact",
      fileName: "kiri-react",
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime", "kiri"],
    },
  },
  test: {
    root: resolve(__dirname),
    environment: "jsdom",
    include: ["test/**/*.test.tsx"],
  },
});
