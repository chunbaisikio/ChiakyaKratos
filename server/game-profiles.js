import express from "express";
import crypto from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
const fail = (message) => {
  const error = new Error(message);
  error.status = 400;
  throw error;
};
const digest = (raw) => crypto.createHash("sha256").update(raw).digest("hex");
function text(value, label, max, required = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    fail(`${label}格式无效，最多 ${max} 个字符。`);
  return value.trim();
}
function link(value) {
  const url = text(value, "链接", 2000, true);
  if (/^\/(?!\/)[a-zA-Z0-9/_?&#=.%+-]*$/.test(url) && !url.includes(".."))
    return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" && !parsed.username && !parsed.password)
      return url;
  } catch {}
  fail("链接请使用 HTTPS 地址或本站路径。");
}
function image(value) {
  const url = text(value ?? "", "图片地址", 2000);
  if (!url) return "";
  if (
    url.startsWith("/assets/") &&
    /^\/assets\/[a-zA-Z0-9_./-]+$/.test(url) &&
    !url.includes("..")
  )
    return url;
  if (!url.startsWith("https://")) fail("图片请使用图片库或 HTTPS 地址。");
  return link(url);
}
export function gameProfilesRouter(blogRoot) {
  const router = express.Router();
  const file = join(blogRoot, "source/_data/games.json");
  function read() {
    if (!existsSync(file)) return { version: 1, profiles: [], revision: null };
    const raw = readFileSync(file, "utf8");
    return { ...JSON.parse(raw), revision: digest(raw) };
  }
  router.get("/game-profiles", (_req, res) => res.json(read()));
  router.put("/game-profiles", (req, res) => {
    if (req.body?.revision !== read().revision)
      return res
        .status(409)
        .json({ error: "名片已被其他编辑更新。请下载本地副本，再重新读取。" });
    if (
      req.body?.version !== 1 ||
      !Array.isArray(req.body?.profiles) ||
      req.body.profiles.length > 40
    )
      fail("最多可保存 40 张游戏名片。");
    const seen = new Set();
    const profiles = req.body.profiles.map((item) => {
      if (!item || typeof item !== "object") fail("名片格式无效。");
      const id = text(item.id, "名片标识", 80, true);
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id) || seen.has(id))
        fail("名片标识无效或重复。");
      seen.add(id);
      if (
        typeof item.visible !== "boolean" ||
        !Array.isArray(item.details) ||
        item.details.length > 12 ||
        !Array.isArray(item.links) ||
        item.links.length > 4
      )
        fail("每张名片最多 12 项信息和 4 个链接。");
      const accent = text(item.accent, "强调色", 7, true);
      if (!/^#[a-fA-F0-9]{6}$/.test(accent)) fail("请选择有效的颜色。");
      return {
        id,
        title: text(item.title, "游戏名称", 100, true),
        identity: text(item.identity ?? "", "昵称或角色", 120),
        description: text(item.description ?? "", "名片简介", 500),
        emblem: text(item.emblem ?? "", "名片标记", 8),
        accent,
        image: image(item.image),
        visible: item.visible,
        details: item.details.map((field) => ({
          label: text(field?.label, "信息名称", 40, true),
          value: text(field?.value, "信息内容", 300, true),
        })),
        links: item.links.map((entry) => ({
          label: text(entry?.label, "链接名称", 60, true),
          url: link(entry?.url),
        })),
      };
    });
    const raw =
      JSON.stringify(
        { version: 1, profiles, updated: new Date().toISOString() },
        null,
        2,
      ) + "\n";
    mkdirSync(join(blogRoot, "source/_data"), { recursive: true });
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    writeFileSync(temporary, raw);
    renameSync(temporary, file);
    res.json({ ...JSON.parse(raw), revision: digest(raw) });
  });
  return router;
}
