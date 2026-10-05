import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { root } from "./paths.mjs";
await import(
  pathToFileURL(join(root, "node_modules/astro/bin/astro.mjs")).href
);
