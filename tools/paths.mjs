import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(resolve(root, ".env")))
  process.loadEnvFile(resolve(root, ".env"));
process.env.ASTRO_TELEMETRY_DISABLED ||= "1";
export const consoleRoot = resolve(root, "apps/console");
export const serverRoot = resolve(root, "server");
