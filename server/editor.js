import express from "express";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { resolve, join, relative } from "node:path";
import { parse, stringify } from "yaml";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import { requireEditor } from "./auth.js";
import { albumRouter } from "./albums.js";
import { gameProfilesRouter } from "./game-profiles.js";

const fingerprint = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
const fail = (status, message) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};
function slug(value) {
  if (
    typeof value !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(value)
  )
    fail(400, "文章标识只能包含字母、数字、连字符和下划线。");
  return value;
}
function splitDocument(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) fail(422, "文章缺少 Markdown 元信息。");
  const metadata = parse(match[1]);
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    fail(422, "文章元信息格式无效。");
  return { metadata, body: match[2].replace(/^\r?\n/, "") };
}
function atomicWrite(path, value) {
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  writeFileSync(temporary, value);
  renameSync(temporary, path);
}
function strings(value, field) {
  if (
    !Array.isArray(value) ||
    value.length > 30 ||
    value.some((item) => typeof item !== "string" || item.length > 100)
  )
    fail(400, `${field}格式无效。`);
  return [...new Set(value.map((item) => item.trim()).filter(Boolean))];
}
function assetUrl(value) {
  if (!value) return undefined;
  if (typeof value !== "string" || value.length > 2000)
    fail(400, "封面地址无效。");
  if (value.startsWith("/assets/") && !value.includes("..")) return value;
  try {
    if (new URL(value).protocol === "https:") return value;
  } catch {}
  fail(400, "封面请使用本站图片或 HTTPS 地址。");
}
function safeRootPath(root, path) {
  const suffix = relative(root, path);
  if (!suffix || suffix.startsWith("..") || resolve(root, suffix) !== path)
    throw new Error("Invalid content path");
  return path;
}
export function activeRelease(blogRoot, initialPath) {
  if (!blogRoot || !initialPath) return initialPath;
  const marker = join(blogRoot, ".releases/current.json");
  if (!existsSync(marker)) return initialPath;
  try {
    const { release } = JSON.parse(readFileSync(marker, "utf8"));
    if (!/^\d{13}-[a-f0-9-]{36}$/.test(release)) return initialPath;
    const path = safeRootPath(
      join(blogRoot, ".releases"),
      resolve(blogRoot, ".releases", release),
    );
    return existsSync(join(path, "index.html")) ? path : initialPath;
  } catch {
    return initialPath;
  }
}
export function editorRouter({ blogRoot, portalPath, onRelease }) {
  const router = express.Router();
  const postsRoot = blogRoot && join(blogRoot, "source/_posts");
  const assetsRoot = blogRoot && join(blogRoot, "source/assets");
  let publication = {
    state: "idle",
    message: "",
    startedAt: null,
    finishedAt: null,
  };
  router.use(async (req, res, next) => {
    if (!(await requireEditor(req, res))) return;
    if (!postsRoot || !existsSync(postsRoot))
      return res
        .status(503)
        .json({ error: "博客内容库未配置。请先启动统一站点。" });
    res.set("Cache-Control", "no-store");
    if (publication.state === "building" && req.method === "PUT")
      return res
        .status(409)
        .json({
          error: "公开页面正在更新，请稍后保存。当前修改仍保留在本地。",
        });
    next();
  });
  router.use(albumRouter(blogRoot));
  if (blogRoot) router.use(gameProfilesRouter(blogRoot));
  const postPath = (id) =>
    safeRootPath(postsRoot, resolve(postsRoot, `${slug(id)}.md`));
  const readPost = (id) => {
    const path = postPath(id);
    if (!existsSync(path)) fail(404, "文章不存在。");
    const raw = readFileSync(path, "utf8");
    return { slug: id, ...splitDocument(raw), revision: fingerprint(raw) };
  };
  router.get("/posts", (_req, res) => {
    const posts = readdirSync(postsRoot)
      .filter((name) => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}\.md$/.test(name))
      .map((name) => {
        const post = readPost(name.slice(0, -3));
        return {
          slug: post.slug,
          title: post.metadata.title || post.slug,
          date: post.metadata.date,
          draft: post.metadata.draft === true,
        };
      });
    res.json({ posts });
  });
  router.get("/posts/:slug", (req, res) => res.json(readPost(req.params.slug)));
  router.put("/posts/:slug", (req, res) => {
    const path = postPath(req.params.slug);
    const previous = existsSync(path) ? readPost(req.params.slug) : null;
    if ((previous?.revision || null) !== req.body?.revision)
      return res
        .status(409)
        .json({ error: "文章已被其他编辑更新，请保存本地草稿并重新打开。" });
    const { title, body, date, draft, cover, tags, categories, template } =
      req.body || {};
    if (typeof title !== "string" || !title.trim() || title.length > 200)
      fail(400, "请填写文章标题，最多 200 个字符。");
    if (typeof body !== "string" || body.length > 250_000)
      fail(400, "正文最多 25 万个字符。");
    if (typeof draft !== "boolean") fail(400, "请选择文章状态。");
    if (
      typeof date !== "string" ||
      !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(date) ||
      !Number.isFinite(Date.parse(date))
    )
      fail(400, "发布时间需要包含时区。");
    const metadata = {
      ...previous?.metadata,
      title: title.trim(),
      date,
      updated: new Date().toISOString(),
      tags: strings(tags, "标签"),
      categories: strings(categories, "分类"),
      draft,
    };
    const image = assetUrl(cover);
    if (image) metadata.cover = image;
    else delete metadata.cover;
    if (template) {
      if (
        typeof template !== "string" ||
        !/^\/assets\/templates\/[a-f0-9-]{36}\.json$/.test(template)
      )
        fail(400, "配套模板地址无效。");
      metadata.template = template;
    } else delete metadata.template;
    atomicWrite(path, `---\n${stringify(metadata)}---\n\n${body}\n`);
    res.json({ success: true, ...readPost(req.params.slug) });
  });
  router.post("/preview", async (req, res) => {
    if (typeof req.body?.body !== "string" || req.body.body.length > 250_000)
      fail(400, "正文格式无效。");
    const rendered = await marked.parse(req.body.body);
    res.json({
      html: sanitizeHtml(rendered, {
        allowedTags: [
          ...sanitizeHtml.defaults.allowedTags,
          "img",
          "h1",
          "h2",
          "h3",
          "h4",
        ],
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          img: ["src", "alt", "title"],
          code: ["class"],
        },
        allowedSchemes: ["http", "https"],
        allowProtocolRelative: false,
      }),
    });
  });
  router.post("/import", (req, res) => {
    if (
      typeof req.body?.markdown !== "string" ||
      req.body.markdown.length > 250_000
    )
      fail(400, "Markdown 文件格式无效。");
    res.json(splitDocument(req.body.markdown));
  });
  router.post("/templates", (req, res) => {
    const profile = req.body?.profile;
    const validString = (value) =>
      typeof value === "string" && value.length <= 1000;
    if (
      !profile ||
      !validString(profile.id) ||
      !validString(profile.name) ||
      !Array.isArray(profile.parts) ||
      profile.parts.length > 100
    )
      fail(400, "请选择有效的副本模板 JSON。");
    for (const part of profile.parts) {
      if (
        !part ||
        !validString(part.id) ||
        !validString(part.name) ||
        !Array.isArray(part.mechanics) ||
        part.mechanics.length > 500
      )
        fail(400, "副本阶段格式无效。");
      for (const mechanic of part.mechanics) {
        if (
          !mechanic ||
          !validString(mechanic.id) ||
          !Array.isArray(mechanic.errorPoints)
        )
          fail(400, "副本机制格式无效。");
        for (const point of mechanic.errorPoints)
          if (!point || !validString(point.id) || !validString(point.name))
            fail(400, "错因格式无效。");
      }
    }
    const directory = join(assetsRoot, "templates");
    mkdirSync(directory, { recursive: true });
    const name = `${crypto.randomUUID()}.json`;
    writeFileSync(join(directory, name), JSON.stringify(profile, null, 2));
    res.status(201).json({ url: `/assets/templates/${name}` });
  });
  router.post("/images", (req, res) => {
    const encoded = req.body?.base64;
    if (
      typeof encoded !== "string" ||
      encoded.length > 6_000_000 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
    )
      fail(400, "请选择小于 4 MB 的图片。");
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length > 4_000_000) fail(400, "图片不能超过 4 MB。");
    let extension;
    if (
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      extension = "png";
    else if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
      extension = "jpg";
    else if (["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString()))
      extension = "gif";
    else if (
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WEBP"
    )
      extension = "webp";
    else fail(400, "支持 PNG、JPEG、GIF 和 WebP 图片。");
    const directory = join(assetsRoot, "uploads");
    mkdirSync(directory, { recursive: true });
    const name = `${crypto.randomUUID()}.${extension}`;
    writeFileSync(join(directory, name), bytes);
    res.status(201).json({ url: `/assets/uploads/${name}` });
  });
  router.get("/publication", (_req, res) =>
    res.json({ ...publication, available: Boolean(portalPath) }),
  );
  router.post("/publication", (_req, res) => {
    if (!portalPath)
      return res.status(503).json({ error: "请在统一站点中更新公开页面。" });
    if (publication.state === "building")
      return res.status(409).json({ error: "站点正在更新，请稍候。" });
    const release = `${Date.now()}-${crypto.randomUUID()}`;
    const releases = join(blogRoot, ".releases");
    const destination = safeRootPath(releases, resolve(releases, release));
    mkdirSync(releases, { recursive: true });
    publication = {
      state: "building",
      message: "正在生成新的站点版本",
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };
    const processHandle = spawn(
      process.execPath,
      [join(blogRoot, "tools/publish.mjs"), destination],
      {
        cwd: blogRoot,
        env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let diagnostics = "";
    const collect = (chunk) => {
      diagnostics = `${diagnostics}${chunk}`.slice(-8000);
    };
    processHandle.stdout.on("data", collect);
    processHandle.stderr.on("data", collect);
    processHandle.on("error", (error) => {
      console.error(error);
      publication = {
        ...publication,
        state: "failed",
        message: "更新未完成，公开页面保留原版本。",
        finishedAt: new Date().toISOString(),
      };
    });
    processHandle.on("exit", (code) => {
      try {
        if (
          code !== 0 ||
          !existsSync(join(destination, "index.html")) ||
          !existsSync(join(destination, "ff14/oopsie/index.html")) ||
          !existsSync(join(destination, "admin/index.html")) ||
          !existsSync(join(destination, "ff14/admin/index.html"))
        )
          throw new Error(diagnostics);
        atomicWrite(
          join(releases, "current.json"),
          JSON.stringify({ release }),
        );
        onRelease(destination);
        publication = {
          ...publication,
          state: "complete",
          message: "公开页面已更新，草稿仍保留在内容库。",
          finishedAt: new Date().toISOString(),
        };
      } catch (error) {
        console.error(error);
        publication = {
          ...publication,
          state: "failed",
          message: "更新未完成，公开页面保留原版本。",
          finishedAt: new Date().toISOString(),
        };
      }
    });
    res.status(202).json(publication);
  });
  // Unsaved uploads can be previewed by editors; public files are served from releases.
  router.get("/image/:name", (req, res) => {
    if (!/^[a-f0-9-]{36}(?:-thumb)?\.(png|jpg|gif|webp)$/.test(req.params.name))
      return res.status(404).end();
    res.sendFile(join(assetsRoot, "uploads", req.params.name));
  });
  return router;
}
