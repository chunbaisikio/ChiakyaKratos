import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { root, consoleRoot } from "./paths.mjs";

if (process.argv[2] !== "test")
  throw new Error("Usage: node tools/console.mjs test [vitest arguments]");
const result = spawnSync(
  process.execPath,
  [
    join(root, "node_modules/vitest/vitest.mjs"),
    "run",
    ...process.argv.slice(3),
  ],
  { cwd: consoleRoot, env: process.env, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
