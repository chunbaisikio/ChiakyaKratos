import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, renameSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { root, consoleRoot } from "./paths.mjs";
import "./prepare-assets.mjs";
function runNode(cwd, executable, args, env = {}) {
  const result = spawnSync(
    process.execPath,
    [join(root, executable), ...args],
    {
      cwd,
      env: { ...process.env, ...env },
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
if (!existsSync(join(root, "node_modules")))
  throw new Error("请先在项目根目录运行 npm ci");
runNode(root, "node_modules/typescript/bin/tsc", [
  "-b",
  "apps/console/tsconfig.json",
]);
for (const app of [
  {
    mode: "workspace",
    base: "/ff14/oopsie/",
    output: "dist",
    html: "index.html",
  },
  {
    mode: "site-admin",
    base: "/admin/",
    output: "dist-site-admin",
    html: "site-admin.html",
  },
  {
    mode: "ff14-admin",
    base: "/ff14/admin/",
    output: "dist-ff14-admin",
    html: "ff14-admin.html",
  },
]) {
  runNode(consoleRoot, "node_modules/vite/bin/vite.js", ["build"], {
    VITE_BASE_PATH: app.base,
    VITE_APP_MODE: app.mode,
    VITE_STORAGE_MODE: "api",
  });
  const destination = resolve(root, "static", app.base.slice(1));
  if (
    relative(root, destination).replaceAll("\\", "/") !==
    `static${app.base.slice(0, -1)}`
  )
    throw new Error("Invalid generated app path");
  rmSync(destination, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  cpSync(join(consoleRoot, app.output), destination, { recursive: true });
  if (app.html !== "index.html")
    renameSync(join(destination, app.html), join(destination, "index.html"));
}
runNode(root, "node_modules/astro/bin/astro.mjs", ["build"]);
