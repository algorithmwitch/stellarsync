import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
var rootDir = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
    base: "/app-react/",
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(rootDir, "./src"),
        },
    },
    build: {
        outDir: "dist",
        sourcemap: true,
    },
});
