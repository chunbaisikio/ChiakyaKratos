import express from "express";
import crypto from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const fail = (status, message) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};
const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
function atomicWrite(path, value) {
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  writeFileSync(temporary, value);
  renameSync(temporary, path);
}
function text(value, label, maximum, required = false) {
  if (
    typeof value !== "string" ||
    value.length > maximum ||
    (required && !value.trim())
  )
    fail(400, `${label}格式无效，最多 ${maximum} 个字符。`);
  return value.trim();
}
function albumSlug(value) {
  if (
    typeof value !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(value)
  )
    fail(400, "相册标识只能包含字母、数字、连字符和下划线。");
  return value;
}

// This router is mounted after the content editor permission middleware.
export function albumRouter(blogRoot) {
  const router = express.Router();
  if (!blogRoot) return router;
  const albumsRoot = join(blogRoot, "source/_albums");
  const mediaRoot = join(blogRoot, "source/_media");
  const uploadsRoot = join(blogRoot, "source/assets/uploads");
  const readMedia = (id) => {
    if (!uuid.test(id)) fail(400, "照片标识无效。");
    const path = join(mediaRoot, `${id}.json`);
    if (!existsSync(path)) fail(400, "照片不在图片库中，请重新选择。");
    return JSON.parse(readFileSync(path, "utf8"));
  };
  const readAlbum = (id) => {
    const path = join(albumsRoot, `${albumSlug(id)}.json`);
    if (!existsSync(path)) fail(404, "相册不存在。");
    const raw = readFileSync(path, "utf8");
    return { slug: id, ...JSON.parse(raw), revision: digest(raw) };
  };
  router.get("/media", (req, res) => {
    const query = String(req.query.q || "")
      .slice(0, 200)
      .toLowerCase();
    const offset = Number(req.query.offset || 0);
    if (!Number.isInteger(offset) || offset < 0) fail(400, "图片页码无效。");
    const media = (existsSync(mediaRoot) ? readdirSync(mediaRoot) : [])
      .filter(
        (name) =>
          uuid.test(name.replace(/\.json$/, "")) && name.endsWith(".json"),
      )
      .map((name) => JSON.parse(readFileSync(join(mediaRoot, name), "utf8")))
      .filter((item) => !query || item.name.toLowerCase().includes(query))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({
      items: media.slice(offset, offset + 48),
      total: media.length,
      nextOffset: offset + 48 < media.length ? offset + 48 : null,
    });
  });
  router.post("/media", async (req, res) => {
    const encoded = req.body?.base64;
    if (
      typeof encoded !== "string" ||
      encoded.length > 28_000_000 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
    )
      fail(400, "请选择小于 20 MB 的照片。");
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length > 20_000_000) fail(400, "照片不能超过 20 MB。");
    const name = text(req.body?.name || "照片", "文件名", 200, true);
    let image;
    try {
      image = sharp(bytes, { limitInputPixels: 60_000_000, failOn: "warning" });
      const metadata = await image.metadata();
      if (
        !["jpeg", "png", "webp"].includes(metadata.format) ||
        (metadata.pages || 1) > 1
      )
        fail(400, "图片库支持静态 JPEG、PNG 和 WebP，请先转换其他格式。");
    } catch (error) {
      if (error.status) throw error;
      fail(400, "照片无法读取，请选择有效的 JPEG、PNG 或 WebP。");
    }
    const id = crypto.randomUUID();
    // Orientation is applied before conversion; EXIF/GPS metadata is not retained.
    let full, thumbnail;
    try {
      full = await image
        .clone()
        .autoOrient()
        .resize({
          width: 2200,
          height: 2200,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 86 })
        .toBuffer({ resolveWithObject: true });
      thumbnail = await image
        .clone()
        .autoOrient()
        .resize({
          width: 640,
          height: 640,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 78 })
        .toBuffer();
    } catch {
      fail(400, "照片处理失败，请重新选择。");
    }
    mkdirSync(uploadsRoot, { recursive: true });
    mkdirSync(mediaRoot, { recursive: true });
    writeFileSync(join(uploadsRoot, `${id}.webp`), full.data);
    writeFileSync(join(uploadsRoot, `${id}-thumb.webp`), thumbnail);
    const media = {
      id,
      name,
      url: `/assets/uploads/${id}.webp`,
      thumbnail: `/assets/uploads/${id}-thumb.webp`,
      width: full.info.width,
      height: full.info.height,
      bytes: full.data.length,
      createdAt: new Date().toISOString(),
    };
    atomicWrite(join(mediaRoot, `${id}.json`), JSON.stringify(media, null, 2));
    res.status(201).json(media);
  });
  router.get("/albums", (_req, res) => {
    const albums = (existsSync(albumsRoot) ? readdirSync(albumsRoot) : [])
      .filter((name) => /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}\.json$/.test(name))
      .map((name) => readAlbum(name.slice(0, -5)))
      .map(({ slug, title, date, kind, draft, photos }) => ({
        slug,
        title,
        date,
        kind,
        draft,
        photoCount: photos.length,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
    res.json({ albums });
  });
  router.get("/albums/:slug", (req, res) =>
    res.json(readAlbum(req.params.slug)),
  );
  router.put("/albums/:slug", (req, res) => {
    const id = albumSlug(req.params.slug);
    const path = join(albumsRoot, `${id}.json`);
    const previous = existsSync(path) ? readAlbum(id) : null;
    if ((previous?.revision || null) !== req.body?.revision)
      return res
        .status(409)
        .json({ error: "相册已被其他编辑更新，请下载本地副本后重新打开。" });
    const { date, kind, draft, photos, coverId, postSlug } = req.body || {};
    if (
      typeof date !== "string" ||
      !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(date) ||
      !Number.isFinite(Date.parse(date))
    )
      fail(400, "相册日期需要包含时区。");
    if (!["travel", "daily"].includes(kind) || typeof draft !== "boolean")
      fail(400, "相册分类或草稿状态无效。");
    if (!Array.isArray(photos) || photos.length > 200)
      fail(400, "每本相册最多 200 张照片。");
    const seen = new Set();
    const selected = photos.map((photo) => {
      if (!photo || typeof photo !== "object") fail(400, "照片信息无效。");
      const media = readMedia(photo.mediaId);
      if (seen.has(media.id)) fail(400, "同一张照片不能在相册中重复添加。");
      seen.add(media.id);
      const takenAt = text(photo.takenAt || "", "拍摄日期", 10);
      const takenDate = new Date(`${takenAt}T00:00:00Z`);
      if (
        takenAt &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(takenAt) ||
          !Number.isFinite(takenDate.getTime()) ||
          takenDate.toISOString().slice(0, 10) !== takenAt)
      )
        fail(400, "拍摄日期无效。");
      return {
        mediaId: media.id,
        url: media.url,
        thumbnail: media.thumbnail,
        width: media.width,
        height: media.height,
        alt: text(photo.alt || "", "照片描述", 300),
        caption: text(photo.caption || "", "照片随记", 3000),
        takenAt,
      };
    });
    if (coverId && !seen.has(coverId)) fail(400, "请从相册中选择封面。");
    if (
      postSlug &&
      !existsSync(join(blogRoot, "source/_posts", `${albumSlug(postSlug)}.md`))
    )
      fail(400, "关联文章不存在。");
    const album = {
      title: text(req.body.title, "相册标题", 200, true),
      date,
      kind,
      draft,
      location: text(req.body.location || "", "地点", 200),
      description: text(req.body.description || "", "简介", 500),
      note: text(req.body.note || "", "随记", 30_000),
      coverId: coverId || selected[0]?.mediaId || "",
      postSlug: postSlug || "",
      photos: selected,
      updated: new Date().toISOString(),
    };
    mkdirSync(albumsRoot, { recursive: true });
    atomicWrite(path, JSON.stringify(album, null, 2));
    res.json(readAlbum(id));
  });
  return router;
}
