import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
try {
  require("sqlite3");
} catch (error) {
  if (process.platform !== "linux" || !/GLIBC_[\d.]+/.test(error.message))
    throw error;
  console.log("SQLite 预编译文件与本机 glibc 不兼容，改用本机编译。");
  const packagePath = require.resolve("sqlite3/package.json");
  const sqliteRequire = createRequire(packagePath);
  const nodeGyp = sqliteRequire.resolve("node-gyp/bin/node-gyp.js");
  const nodePrefix = resolve(dirname(process.execPath), "..");
  const args = [nodeGyp, "rebuild", "--directory", dirname(packagePath)];
  if (existsSync(join(nodePrefix, "include/node/node.h")))
    args.push(`--nodedir=${nodePrefix}`);
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  require("sqlite3");
  console.log("SQLite 本机编译与加载检查通过。");
}
