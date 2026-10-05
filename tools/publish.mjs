import { spawnSync } from "node:child_process";
import { join, resolve, relative } from "node:path";
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { root } from "./paths.mjs";
import "./prepare-assets.mjs";
const destination = resolve(process.argv[2] || "");
const suffix = relative(join(root, ".releases"), destination);
if (!/^\d{13}-[a-f0-9-]{36}$/.test(suffix))
  throw new Error("Invalid release destination");
// Prerender inside the project so Node can resolve dependencies even when
// .releases points to a persistent directory outside the deployed code.
const staging = resolve(root, ".astro/publication-builds", suffix);
if (existsSync(destination) || existsSync(staging))
  throw new Error("Release destination already exists");
mkdirSync(join(root, ".astro/publication-builds"), { recursive: true });
const result = spawnSync(
  process.execPath,
  [
    join(root, "node_modules/astro/bin/astro.mjs"),
    "build",
    "--force",
    "--outDir",
    staging,
  ],
  { cwd: root, env: process.env, stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) {
  process.exitCode = result.status || 1;
} else {
  try {
    renameSync(staging, destination);
  } catch (error) {
    if (error.code !== "EXDEV") throw error;
    cpSync(staging, destination, {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
    rmSync(staging, { recursive: true });
  }
}
