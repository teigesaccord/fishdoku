import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  // Served from GitHub Pages at teige.dev/fishdoku/.
  base: "/fishdoku/",
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    globals: true,
    setupFiles: [],
    reporters: ["default"],
  },
});
