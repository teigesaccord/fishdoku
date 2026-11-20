import { defineConfig } from "vite";
export default defineConfig({
    root: ".",
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
