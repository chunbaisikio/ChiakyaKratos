import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join, resolve, relative } from "node:path";
import { parse } from "yaml";
import { root } from "./paths.mjs";
const source = join(root, "source/assets");
const target = resolve(root, "static/assets");
if (relative(root, target) !== join("static", "assets"))
  throw new Error("Invalid generated asset path");
// This directory is generated; draft uploads are only served through the editor API.
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
mkdirSync(join(root, "source/_albums"), { recursive: true });
cpSync(source, target, {
  recursive: true,
  filter: (path) =>
    !["uploads", "templates"].includes(
      relative(source, path).split(/[\\/]/)[0],
    ),
});
const referenced = new Set();
for (const filename of readdirSync(join(root, "source/_posts")).filter((name) =>
  name.endsWith(".md"),
)) {
  const raw = readFileSync(join(root, "source/_posts", filename), "utf8");
  const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) continue;
  const metadata = parse(frontmatter[1]);
  if (metadata?.draft === true || new Date(metadata?.date) > new Date())
    continue;
  for (const match of raw.matchAll(
    /\/assets\/(uploads\/[a-f0-9-]{36}(?:-thumb)?\.(?:png|jpg|gif|webp)|templates\/[a-f0-9-]{36}\.json)/g,
  ))
    referenced.add(match[1]);
}
for (const filename of readdirSync(join(root, "source/_albums")).filter(
  (name) => name.endsWith(".json"),
)) {
  const album = JSON.parse(
    readFileSync(join(root, "source/_albums", filename), "utf8"),
  );
  if (album.draft || new Date(album.date) > new Date()) continue;
  for (const photo of album.photos || []) {
    for (const url of [photo.url, photo.thumbnail]) {
      if (
        typeof url === "string" &&
        /^\/assets\/uploads\/[a-f0-9-]{36}(?:-thumb)?\.webp$/.test(url)
      )
        referenced.add(url.replace("/assets/", ""));
    }
  }
}
const gamesFile = join(root, "source/_data/games.json");
if (existsSync(gamesFile)) {
  const catalog = JSON.parse(readFileSync(gamesFile, "utf8"));
  for (const profile of catalog.profiles || []) {
    if (profile.visible !== true || typeof profile.image !== "string") continue;
    if (
      /^\/assets\/uploads\/[a-f0-9-]{36}(?:-thumb)?\.(?:png|jpg|gif|webp)$/.test(
        profile.image,
      )
    )
      referenced.add(profile.image.replace("/assets/", ""));
  }
}
for (const filename of referenced) {
  if (!existsSync(join(source, filename))) continue;
  mkdirSync(join(target, filename.split("/")[0]), { recursive: true });
  cpSync(join(source, filename), join(target, filename));
}
