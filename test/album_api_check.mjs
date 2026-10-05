import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import sharp from "sharp";
const directory = mkdtempSync(join(tmpdir(), "chiakya-albums-"));
process.env.PORT = "0"; process.env.HOST = "127.0.0.1"; process.env.COOKIE_SECURE = "false";
process.env.DB_PATH = join(directory, "data.db"); process.env.BLOG_ROOT = join(directory, "blog");
delete process.env.AUTH_LOOKUP_SECRET; delete process.env.PORTAL_DIST_PATH;
mkdirSync(join(process.env.BLOG_ROOT, "source/_posts"), { recursive: true });
const { server, db } = await import("../server/server.js");
if (!server.listening) await once(server, "listening");
const origin = `http://127.0.0.1:${server.address().port}`;
let cookie = "", csrf = "";
async function request(path, data, options = {}) {
  const response = await fetch(origin + path, { method: options.method || (data ? "POST" : "GET"), headers: { "Content-Type": "application/json", ...(cookie && !options.guest ? { Cookie: cookie } : {}), ...(csrf && !options.noCsrf ? { "X-CSRF-Token": csrf } : {}) }, body: data ? JSON.stringify(data) : undefined });
  const body = await response.json();
  if (response.headers.get("set-cookie")) cookie = response.headers.get("set-cookie").split(";")[0];
  if (body.session) csrf = body.session.csrfToken;
  return { response, body };
}
try {
  assert.equal((await request("/api/editor/media", null, { guest: true })).response.status, 401);
  await request("/api/auth/bootstrap", { workspaceName: "相册验收", displayName: "编辑者", passcode: "ALBUM-ADMIN-001" });
  const source = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#85a070" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  assert.equal((await request("/api/editor/media", { base64: source.toString("base64"), name: "旅行.jpg" }, { noCsrf: true })).response.status, 403);
  const upload = await request("/api/editor/media", { base64: source.toString("base64"), name: "旅行.jpg" });
  assert.equal(upload.response.status, 201);
  const media = upload.body;
  assert.equal(media.width, 20); assert.equal(media.height, 40);
  const file = join(process.env.BLOG_ROOT, "source", media.url.replace(/^\//, ""));
  const metadata = await sharp(readFileSync(file)).metadata();
  assert.equal(metadata.format, "webp"); assert.equal(metadata.exif, undefined); assert.equal(metadata.orientation, undefined);
  assert.equal((await request("/api/editor/media", { base64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>').toString("base64"), name: "wrong.svg" })).response.status, 400);
  assert.equal((await request("/api/editor/media", { base64: "fake", name: "wrong.png" })).response.status, 400);
  assert.equal((await request("/api/editor/media?q=旅行")).body.total, 1);
  assert.equal((await request("/api/editor/media?q=missing")).body.total, 0);
  const album = { revision: null, title: "旅途随记", date: "2026-10-01T00:00:00+08:00", kind: "travel", draft: true, location: "海边", note: "想记住的事情", photos: [{ mediaId: media.id, url: "https://wrong.example/photo.jpg", alt: "海边的照片", caption: "第一天", takenAt: "2026-10-01" }], coverId: media.id };
  const saved = await request("/api/editor/albums/trip", album, { method: "PUT" });
  assert.equal(saved.response.status, 200); assert.equal(saved.body.photos[0].url, media.url); assert.equal(saved.body.draft, true);
  assert.equal((await request("/api/editor/albums/trip", album, { method: "PUT" })).response.status, 409);
  assert.equal((await request("/api/editor/albums/duplicate", { ...album, photos: [album.photos[0], album.photos[0]] }, { method: "PUT" })).response.status, 400);
  assert.equal((await request("/api/editor/albums/invalid-date", { ...album, photos: [{ ...album.photos[0], takenAt: "2026-02-30" }] }, { method: "PUT" })).response.status, 400);
  assert.equal((await request("/api/editor/albums/invalid-date2", { ...album, photos: [{ ...album.photos[0], takenAt: "2026-99-99" }] }, { method: "PUT" })).response.status, 400);
  assert.equal((await request("/api/editor/albums/%2e%2e%2foutside", album, { method: "PUT" })).response.status, 400);
  assert.equal((await request("/api/editor/albums/note", { ...album, title: "一段随记", photos: [], coverId: "" }, { method: "PUT" })).response.status, 200);
  assert.equal((await request("/api/editor/albums")).body.albums.length, 2);
  assert.equal((await request("/api/editor/albums", null, { guest: true })).response.status, 401);
  console.log("[ok] image orientation/metadata, media reuse/search, album revisions, validation, drafts and notes without photos");
} finally {
  await new Promise(resolve => server.close(resolve)); await new Promise(resolve => db.close(resolve));
  rmSync(directory, { recursive: true, force: true });
}
