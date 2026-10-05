import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { devPorts } from "./tools/dev-config.mjs";

// Set SITE_URL to the real public domain before building a release.
export default defineConfig({
  site: process.env.SITE_URL || "http://localhost:3001",
  publicDir: "./static",
  cacheDir: "./.astro/cache/",
  trailingSlash: "always",
  integrations: [
    {
      name: "chiakya-development-routes",
      hooks: {
        "astro:config:setup": ({ command, updateConfig }) => {
          // API and Vite internal URLs are extensionless. Let their own servers
          // handle these paths before applying the production trailing-slash rule.
          if (command === "dev") updateConfig({ trailingSlash: "ignore" });
        },
      },
    },
    react(),
    sitemap({
      filter: (url) => !url.includes("/search/") && !url.includes("/editor/"),
    }),
  ],
  markdown: { shikiConfig: { theme: "github-dark" } },
  vite: {
    server: {
      strictPort: true,
      proxy: {
        "/api": `http://127.0.0.1:${devPorts.api}`,
        "/ff14/oopsie": {
          target: `http://127.0.0.1:${devPorts.workspace}`,
          ws: true,
        },
        "/admin": {
          target: `http://127.0.0.1:${devPorts.siteAdmin}`,
          ws: true,
        },
        "/ff14/admin": {
          target: `http://127.0.0.1:${devPorts.ff14Admin}`,
          ws: true,
        },
      },
    },
  },
});
