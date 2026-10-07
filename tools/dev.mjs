import { spawn } from "node:child_process";
import { join } from "node:path";
import { root, consoleRoot } from "./paths.mjs";
import { devPorts } from "./dev-config.mjs";
import "./prepare-assets.mjs";
if (new Set(Object.values(devPorts)).size !== 5)
  throw new Error("API、公开站和三个后台需要使用不同的开发端口");
if (devPorts.api === 0)
  throw new Error("开发模式需要显式设置 API 端口，PORT 不能为 0");
const children = [];
function start(cwd, path, args, env = {}) {
  const child = spawn(process.execPath, [join(root, path), ...args], {
    cwd,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(error);
    shutdown(1);
  });
  child.on("exit", (code) => {
    if (!stopping) shutdown(code || 0);
  });
}
let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
start(root, "server/server.js", [], {
  HOST: "127.0.0.1",
  PORT: String(devPorts.api),
  BLOG_ROOT: root,
});
start(
  consoleRoot,
  "node_modules/vite/bin/vite.js",
  ["--host", "127.0.0.1", "--port", String(devPorts.workspace), "--strictPort"],
  { VITE_BASE_PATH: "/ff14/oopsie/", VITE_STORAGE_MODE: "api" },
);
for (const app of [
  { mode: "site-admin", base: "/admin/", port: String(devPorts.siteAdmin) },
  {
    mode: "ff14-admin",
    base: "/ff14/admin/",
    port: String(devPorts.ff14Admin),
  },
]) {
  start(
    consoleRoot,
    "node_modules/vite/bin/vite.js",
    ["--host", "127.0.0.1", "--port", app.port, "--strictPort"],
    {
      VITE_BASE_PATH: app.base,
      VITE_APP_MODE: app.mode,
      VITE_STORAGE_MODE: "api",
    },
  );
}
start(
  root,
  "node_modules/astro/bin/astro.mjs",
  ["dev", "--host", "127.0.0.1", "--port", String(devPorts.site)],
  {},
);
