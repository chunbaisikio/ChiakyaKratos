/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
const mode = process.env.VITE_APP_MODE || "workspace";
const entry =
  mode === "site-admin"
    ? "site-admin.html"
    : mode === "ff14-admin"
      ? "ff14-admin.html"
      : "index.html";
const base = process.env.VITE_BASE_PATH || "/";

// https://vite.dev/config/
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  cacheDir: fileURLToPath(
    new URL(`../../.cache/vite/${mode}`, import.meta.url),
  ),
  base,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "administration-entry",
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (entry !== "index.html" && req.url?.split("?")[0] === base)
            req.url = `${base}${entry}`;
          next();
        });
      },
    },
  ],
  build: {
    outDir: mode === "workspace" ? "dist" : `dist-${mode}`,
    rolldownOptions: { input: fileURLToPath(new URL(entry, import.meta.url)) },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: fileURLToPath(new URL("./tests/setup.ts", import.meta.url)),
  },
  server: {
    proxy: {
      "/api": `http://127.0.0.1:${process.env.PORT || "3001"}`,
    },
  },
});
