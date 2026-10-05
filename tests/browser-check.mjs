import assert from "node:assert/strict";
import { chromium } from "playwright";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { once } from "node:events";
import { root, serverRoot } from "../tools/paths.mjs";

const directory = mkdtempSync(join(tmpdir(), "chiakya-browser-"));
const blog = join(directory, "blog");
mkdirSync(blog);
for (const path of [
  "src",
  "source",
  "tools",
  "static",
  "astro.config.mjs",
  "package.json",
  "tsconfig.json",
])
  cpSync(join(root, path), join(blog, path), { recursive: true });
symlinkSync(
  join(root, "node_modules"),
  join(blog, "node_modules"),
  process.platform === "win32" ? "junction" : "dir",
);
const persistentPublications = join(directory, "publications");
mkdirSync(persistentPublications);
symlinkSync(
  persistentPublications,
  join(blog, ".releases"),
  process.platform === "win32" ? "junction" : "dir",
);
process.env.PORT = "0";
process.env.HOST = "127.0.0.1";
process.env.COOKIE_SECURE = "false";
process.env.DB_PATH = join(directory, "browser.db");
process.env.BLOG_ROOT = blog;
process.env.PORTAL_DIST_PATH = join(root, "dist");
delete process.env.AUTH_LOOKUP_SECRET;
const { server, db } = await import(
  pathToFileURL(join(serverRoot, "server.js")).href
);
if (!server.listening) await once(server, "listening");
const origin = `http://127.0.0.1:${server.address().port}`;
const artifacts = join(root, ".qa");
mkdirSync(artifacts, { recursive: true });
const candidates = [
  process.env.BROWSER_EXECUTABLE,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].filter(Boolean);
const executablePath = candidates.find(existsSync);
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const log = (label) => console.log(`[ok] ${label}`);
async function noOverflow() {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `Horizontal overflow at ${page.url()}`,
  );
}
try {
  await page.goto(origin, { waitUntil: "networkidle" });
  assert.match(await page.title(), /Chiakya/);
  assert.equal(await page.getByRole("heading", { level: 1 }).count(), 1);
  await noOverflow();
  await page.screenshot({
    path: join(artifacts, "home-desktop.png"),
    fullPage: true,
  });
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await page.getByRole("button", { name: "切换明暗主题" }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.reload();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.getByRole("button", { name: "切换明暗主题" }).click();
  log("desktop homepage, images and persistent theme switching");
  await page.goto(`${origin}/search/?q=FF14`);
  await page.getByText("找到 2 篇相关记录").waitFor();
  await page.getByRole("searchbox", { name: "搜索文章" }).fill("不存在的词条");
  await page.getByText("找到 0 篇相关记录").waitFor();
  await page.goto(`${origin}/posts/ff14-ultimate-ucob-journey/`);
  await page
    .getByRole("heading", {
      name: "绝妖星乱舞通关记：低山臭水，也遇知音",
      exact: true,
    })
    .waitFor();
  assert.ok((await page.locator(".toc a").count()) > 0);
  await page.screenshot({
    path: join(artifacts, "article-desktop.png"),
    fullPage: true,
  });
  await page.goto(`${origin}/anime-calendar/`);
  await page.waitForFunction(
    () =>
      document.querySelector("astro-island") &&
      !document.querySelector("astro-island").hasAttribute("ssr"),
  );
  const previous = await page.locator(".calendar-controls h2").innerText();
  await page.getByRole("button", { name: "下个月", exact: true }).click();
  await page.waitForFunction(
    (value) =>
      document.querySelector(".calendar-controls h2").textContent !== value,
    previous,
  );
  await page.getByRole("button", { name: "上个月", exact: true }).click();
  await page.waitForFunction(
    (value) =>
      document.querySelector(".calendar-controls h2").textContent === value,
    previous,
  );
  await page.getByLabel("剧集类型").selectOption("korean");
  const event = page.locator(".calendar-event").first();
  await event.click();
  await page.getByRole("region", { name: "灿烂的一天详情" }).waitFor();
  await page.getByRole("button", { name: "收起 ×" }).click();
  await page.screenshot({
    path: join(artifacts, "calendar-desktop.png"),
    fullPage: true,
  });
  log("search, existing article URLs and calendar navigation/filter/detail");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "/",
    "/blog/",
    "/ff14/",
    "/games/",
    "/posts/ff14-ultimate-ucob-journey/",
    "/anime-calendar/",
  ]) {
    await page.goto(origin + route, { waitUntil: "networkidle" });
    await noOverflow();
    if (route === "/")
      await page.screenshot({
        path: join(artifacts, "home-mobile.png"),
        fullPage: true,
      });
    if (route === "/") {
      const navigation = page.getByRole("navigation", {
        name: "主导航",
        exact: true,
      });
      assert.equal(await navigation.isVisible(), false);
      await page.getByRole("button", { name: "打开导航", exact: true }).click();
      assert.equal(await navigation.isVisible(), true);
      assert.equal(
        await page.locator("#nav-toggle").getAttribute("aria-expanded"),
        "true",
      );
      await page.keyboard.press("Escape");
      assert.equal(await navigation.isVisible(), false);
      await page.getByRole("button", { name: "打开导航", exact: true }).click();
      await page
        .getByRole("button", { name: "关闭导航", exact: true })
        .click({ position: { x: 300, y: 100 } });
      assert.equal(await navigation.isVisible(), false);
    }
  }
  log("mobile pages have no horizontal overflow");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}/ff14/oopsie/#/editor`);
  await page.getByLabel("站点名称").fill("浏览器验收站点");
  await page.getByLabel("管理员显示名").fill("QA");
  await page.getByLabel("管理员口令").fill("BROWSER-ADMIN-001");
  await page
    .getByRole("button", { name: "创建管理员并进入", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "内容工作台", exact: true })
    .waitFor();
  assert.ok(page.url().includes("/admin/#/posts"));
  assert.equal(await page.locator('[data-admin-area="site"]').count(), 1);
  assert.equal(await page.locator(".portal-navigation").count(), 0);
  assert.equal(
    await page
      .getByRole("navigation", { name: "站点后台导航" })
      .getByRole("link", { name: "队伍管理", exact: true })
      .count(),
    0,
  );
  await page.getByLabel("文章标题", { exact: true }).fill("浏览器草稿验收");
  await page.getByLabel("文章标识", { exact: false }).fill("qa-review");
  await page
    .getByLabel("正文（Markdown）", { exact: true })
    .fill("## 复盘发现\n\n这是一篇尚未发布的验收草稿。");
  await page.getByRole("button", { name: "保存文章", exact: true }).click();
  await page.getByText("草稿已保存，仅编辑者可见。", { exact: true }).waitFor();
  assert.equal(
    (await page.request.get(`${origin}/posts/qa-review/`)).status(),
    404,
  );
  await page
    .locator('input[type=file][accept^="image/"]')
    .setInputFiles(join(root, "source/assets/favicon.png"));
  await page.getByText("封面已上传，保存文章后会与文章一起更新。").waitFor();
  const upload = await page
    .getByLabel("封面地址", { exact: true })
    .inputValue();
  const template = join(directory, "template.json");
  writeFileSync(
    template,
    JSON.stringify({ id: "qa-boss", name: "验收副本", parts: [] }),
  );
  await page
    .locator('input[type=file][accept^=".json"]')
    .setInputFiles(template);
  await page.getByText("副本模板已关联，文章公开后读者可以下载。").waitFor();
  await page.getByRole("button", { name: "保存文章", exact: true }).click();
  await page.getByText("草稿已保存，仅编辑者可见。", { exact: true }).waitFor();
  await page.getByRole("button", { name: "更新公开页面", exact: true }).click();
  await page
    .getByText("公开页面已更新，草稿仍保留在内容库。", { exact: true })
    .waitFor({ timeout: 30_000 });
  assert.equal(
    (await page.request.get(`${origin}/posts/qa-review/`)).status(),
    404,
  );
  assert.equal((await page.request.get(origin + upload)).status(), 404);
  const search = await (
    await page.request.get(origin + "/search-index.json")
  ).json();
  assert.ok(!search.some((entry) => entry.title === "浏览器草稿验收"));
  log(
    "private draft, cover and template remain unpublished after a site rebuild",
  );
  await page.getByLabel("保留为草稿").uncheck();
  await page.getByRole("button", { name: "保存文章", exact: true }).click();
  await page
    .getByText("文章已保存。更新公开页面后，读者会看到这一版。")
    .waitFor();
  await page.getByRole("button", { name: "更新公开页面", exact: true }).click();
  await page.getByText("正在生成新的站点版本", { exact: true }).waitFor();
  await page
    .getByText("公开页面已更新，草稿仍保留在内容库。", { exact: true })
    .waitFor({ timeout: 30_000 });
  assert.equal((await page.request.get(origin + upload)).status(), 200);
  const article = await browser.newPage();
  await article.goto(`${origin}/posts/qa-review/`);
  await article
    .getByRole("heading", { name: "浏览器草稿验收", exact: true })
    .waitFor();
  assert.equal(
    await article.getByRole("link", { name: "下载配套副本模板 ↗" }).count(),
    1,
  );
  await article.close();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: join(artifacts, "editor-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await page.screenshot({
    path: join(artifacts, "editor-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  log(
    "editor save → local release → public article, image and companion template",
  );
  const marker = JSON.parse(
    readFileSync(join(blog, ".releases/current.json"), "utf8"),
  );
  for (const route of ["ff14/oopsie", "admin", "ff14/admin"]) {
    writeFileSync(
      join(blog, ".releases", marker.release, route, "index.html"),
      "stale frontend from a prior article release",
    );
    assert.ok(
      !(await (await page.request.get(origin + `/${route}/`)).text()).includes(
        "stale frontend",
      ),
    );
  }
  log("article releases do not pin the FF14 app to an old deployed version");
  await page.getByRole("button", { name: "新建文章" }).click();
  await page.getByLabel("文章标题", { exact: true }).fill("需要恢复的本地草稿");
  await page.reload();
  await page.getByLabel("文章标题", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("文章标题", { exact: true }).inputValue(),
    "需要恢复的本地草稿",
  );
  const markdown = join(directory, "review.md");
  writeFileSync(
    markdown,
    "---\ntitle: 复盘导入验收\ntags: [FF14]\ndraft: true\n---\n\n## 复盘正文\n",
  );
  await page.locator('input[type=file][accept^=".md"]').setInputFiles(markdown);
  await page.getByText("Markdown 已导入为新草稿，请检查内容并保存。").waitFor();
  assert.equal(
    await page.getByLabel("文章标题", { exact: true }).inputValue(),
    "复盘导入验收",
  );
  log("unsaved drafts recover after reload and review Markdown imports");
  // Verify that the existing tracker feeds the new review workflow with a real session.
  const adminSession = (
    await (await page.request.get(origin + "/api/auth/session")).json()
  ).session;
  const inviteResponse = await page.request.post(
    origin + "/api/admin/captain-invites",
    { headers: { "X-CSRF-Token": adminSession.csrfToken }, data: {} },
  );
  assert.equal(inviteResponse.status(), 201);
  const captainSetup = await browser.newContext();
  const captainResponse = await captainSetup.request.post(
    origin + "/api/invites/redeem",
    {
      data: {
        inviteCode: (await inviteResponse.json()).inviteCode,
        displayName: "验收队长",
        passcode: "BROWSER-CAPTAIN-001",
      },
    },
  );
  assert.equal(captainResponse.status(), 201);
  const captainSession = (await captainResponse.json()).session;
  const key = `ff14oopsie-v2-storage:${captainSession.workspaceId}`;
  const fixture = {
    state: {
      bossProfiles: [
        {
          id: "qa-boss",
          name: "浏览器验收副本",
          parts: [
            {
              id: "qa-part",
              name: "验收 P1",
              maxDuration: "03:00",
              mechanics: [
                {
                  id: "qa-mechanic",
                  shortName: "验收机制",
                  officialName: "",
                  startTime: "00:10",
                  endTime: "00:20",
                  notes: "",
                  errorPoints: [
                    { id: "qa-point", name: "验收错因", isDeleted: false },
                  ],
                },
              ],
            },
          ],
        },
      ],
      teams: [
        {
          id: "qa-team",
          name: "验收固定队",
          bossId: "qa-boss",
          players: [
            {
              id: "qa-player",
              name: "验收队员",
              role: "MT",
              job: "DRK",
              status: "on_field",
            },
          ],
          errorLevels: ["团灭"],
        },
      ],
      mistakes: [],
      progress: [],
    },
    version: 0,
  };
  assert.equal(
    (
      await captainSetup.request.post(origin + "/api/store", {
        headers: { "X-CSRF-Token": captainSession.csrfToken },
        data: {
          workspaceId: captainSession.workspaceId,
          key,
          baseRevision: 0,
          value: fixture,
        },
      })
    ).status(),
    200,
  );
  await captainSetup.close();
  const captainContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const captain = await captainContext.newPage();
  captain.on("pageerror", (error) => errors.push(error.message));
  await captain.goto(origin + "/ff14/oopsie/");
  assert.equal(
    await captain.getByLabel("登录口令").getAttribute("type"),
    "password",
  );
  await captain.getByLabel("登录口令").fill("BROWSER-CAPTAIN-001");
  await captain
    .getByRole("button", { name: "进入工作空间", exact: true })
    .click();
  await captain
    .getByRole("heading", { name: "浏览器验收副本", exact: true })
    .waitFor();
  await captain.getByRole("button", { name: "验收 P1", exact: true }).click();
  await captain.getByRole("button", { name: "验收机制", exact: true }).click();
  await captain.getByRole("button", { name: "验收错因", exact: true }).click();
  await captain.getByRole("button", { name: /验收队员/ }).click();
  await captain.getByPlaceholder("额外说明...").fill("不应公开的原始备注");
  const savedRecord = captain.waitForResponse(
    (response) =>
      response.url() === origin + "/api/store" &&
      response.request().method() === "POST" &&
      response.status() === 200,
  );
  await captain.getByRole("button", { name: "记录 团灭", exact: true }).click();
  await savedRecord;
  const records = await (
    await captain.request.get(
      origin +
        "/api/store?" +
        new URLSearchParams({ key, workspaceId: captainSession.workspaceId }),
    )
  ).json();
  assert.equal(records.value.state.mistakes.length, 1);
  await captain.getByRole("link", { name: "复盘手记", exact: true }).click();
  await captain
    .getByRole("heading", { name: "复盘手记", exact: true })
    .waitFor();
  const reviewText = await captain.locator("pre").innerText();
  assert.match(reviewText, /浏览器验收副本/);
  assert.ok(!reviewText.includes("验收队员"));
  assert.ok(!reviewText.includes("不应公开的原始备注"));
  await captain.getByLabel("在草稿中包含队员姓名统计").check();
  assert.match(await captain.locator("pre").innerText(), /验收队员/);
  await captain.getByLabel("在草稿中包含队员姓名统计").uncheck();
  const downloadReady = captain.waitForEvent("download");
  await captain
    .getByRole("button", { name: "下载 Markdown 草稿", exact: true })
    .click();
  const reviewFile = join(directory, "captain-review.md");
  await (await downloadReady).saveAs(reviewFile);
  assert.equal(
    (await captain.request.get(origin + "/api/editor/posts")).status(),
    403,
  );
  await captain.screenshot({
    path: join(artifacts, "review-desktop.png"),
    fullPage: true,
  });
  await captain.setViewportSize({ width: 390, height: 844 });
  await captain.screenshot({
    path: join(artifacts, "review-mobile.png"),
    fullPage: true,
  });
  assert.ok(
    await captain.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Mobile work area overflow",
  );
  await captainContext.close();
  await page
    .locator('input[type=file][accept^=".md"]')
    .setInputFiles(reviewFile);
  await page.waitForFunction(() => {
    const label = [...document.querySelectorAll("label")].find(
      (element) => element.textContent.trim() === "文章标题",
    );
    return label?.querySelector("input")?.value.includes("浏览器验收副本");
  });
  await page.getByText("Markdown 已导入为新草稿，请检查内容并保存。").waitFor();
  assert.match(
    await page.getByLabel("文章标题", { exact: true }).inputValue(),
    /浏览器验收副本/,
  );
  log(
    "captain login → tracker save → private review export → editor import; mobile work area and role isolation",
  );
  async function rebuild() {
    await page
      .getByRole("button", { name: "更新公开页面", exact: true })
      .click();
    await page.getByText("正在生成新的站点版本", { exact: true }).waitFor();
    await page
      .getByText("公开页面已更新，草稿仍保留在内容库。", { exact: true })
      .waitFor({ timeout: 30_000 });
  }
  await page.goto(origin + "/ff14/oopsie/#/albums");
  await page
    .getByRole("heading", { name: "相册与随记", exact: true })
    .waitFor();
  await page.getByLabel("相册标题", { exact: true }).fill("海边验收随记");
  await page.getByLabel("相册标识", { exact: false }).fill("qa-trip");
  await page.getByLabel("记录日期", { exact: true }).fill("2026-10-01");
  await page.getByLabel("相册分类", { exact: true }).selectOption("travel");
  await page.getByLabel("地点", { exact: true }).fill("舟山");
  await page
    .getByLabel("相册简介", { exact: true })
    .fill("两张照片与一段旅行随记。");
  await page
    .getByLabel("这次的随记", { exact: true })
    .fill("风吹过海边。\n把这一天慢慢记下来。");
  await page
    .getByRole("button", { name: "添加照片 / 图片库", exact: true })
    .click();
  const picker = page.getByRole("dialog", { name: "图片库", exact: true });
  await picker
    .getByLabel("上传图片库照片")
    .setInputFiles([
      join(root, "source/assets/favicon.png"),
      join(root, "source/assets/Lolita.webp"),
    ]);
  await picker
    .getByText("已上传 2 张照片，请确认选择。", { exact: true })
    .waitFor({ timeout: 30_000 });
  await picker
    .getByRole("button", { name: "使用所选照片", exact: true })
    .click();
  await page.getByLabel("照片描述 1", { exact: true }).fill("海边的第一张照片");
  await page
    .getByLabel("照片随记 1", { exact: true })
    .fill("想记住这一阵海风。");
  await page.getByLabel("照片描述 2", { exact: true }).fill("一起出行的伙伴");
  await page
    .getByRole("button", { name: "向前移动照片 2", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("照片描述 1", { exact: true }).inputValue(),
    "一起出行的伙伴",
  );
  await page.getByRole("button", { name: "设为封面", exact: true }).click();
  await page.getByRole("button", { name: "保存相册", exact: true }).click();
  await page
    .getByText("相册草稿已保存，照片与随记仅编辑者可见。", { exact: true })
    .waitFor();
  const draftAlbum = await (
    await page.request.get(origin + "/api/editor/albums/qa-trip")
  ).json();
  await rebuild();
  assert.equal(
    (await page.request.get(origin + "/photos/qa-trip/")).status(),
    404,
  );
  for (const photo of draftAlbum.photos) {
    assert.equal((await page.request.get(origin + photo.url)).status(), 404);
    assert.equal(
      (await page.request.get(origin + photo.thumbnail)).status(),
      404,
    );
  }
  log(
    "album batch upload, captions, ordering and covers; draft photos stay private",
  );
  await page.getByLabel("相册保留为草稿").uncheck();
  await page
    .getByLabel("关联博客文章", { exact: true })
    .selectOption("qa-review");
  await page.getByRole("button", { name: "保存相册", exact: true }).click();
  await page
    .getByText("相册已保存，更新公开页面后就会展示。", { exact: true })
    .waitFor();
  await rebuild();
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await page.screenshot({
    path: join(artifacts, "album-editor-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const gallery = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  gallery.on("pageerror", (error) => errors.push(error.message));
  await gallery.goto(origin + "/photos/");
  assert.ok(
    (await gallery.locator('link[rel="stylesheet"]').count()) > 0,
    "Album stylesheet was not emitted",
  );
  for (const href of await gallery
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.href))) {
    const css = await gallery.request.get(href);
    assert.equal(css.status(), 200, `Album CSS missing: ${href}`);
    assert.match(
      css.headers()["content-type"],
      /text\/css/,
      `Album CSS is not a stylesheet: ${href}`,
    );
  }
  await gallery.getByRole("link", { name: /海边验收随记/ }).waitFor();
  await gallery.getByRole("button", { name: "日常随记", exact: true }).click();
  await gallery
    .getByText("这个分类还没有公开的相册。", { exact: true })
    .waitFor();
  await gallery.getByRole("button", { name: "旅行", exact: true }).click();
  await gallery.getByRole("link", { name: /海边验收随记/ }).click();
  await gallery
    .getByRole("heading", { name: "海边验收随记", exact: true })
    .waitFor();
  await gallery.waitForFunction(
    () =>
      document.querySelector("astro-island") &&
      !document.querySelector("astro-island").hasAttribute("ssr"),
  );
  assert.equal(
    await gallery
      .locator("main")
      .getByRole("link", { name: /浏览器草稿验收/ })
      .count(),
    1,
  );
  assert.equal(await gallery.locator(".photo-image img").count(), 2);
  for (const photo of draftAlbum.photos) {
    assert.equal((await gallery.request.get(origin + photo.url)).status(), 200);
    assert.equal(
      (await gallery.request.get(origin + photo.thumbnail)).status(),
      200,
    );
  }
  await gallery.locator(".photo-grid").scrollIntoViewIfNeeded();
  await gallery.screenshot({
    path: join(artifacts, "album-loading.png"),
    fullPage: true,
  });
  await gallery.waitForFunction(() =>
    [...document.querySelectorAll(".photo-image img")].every(
      (image) => image.complete && image.naturalWidth > 0,
    ),
  );
  assert.ok(
    await gallery
      .locator(".photo-image img")
      .evaluateAll((images) =>
        images.every((image) => image.complete && image.naturalWidth > 0),
      ),
  );
  await gallery.screenshot({
    path: join(artifacts, "album-desktop.png"),
    fullPage: true,
  });
  await gallery
    .getByRole("link", { name: "查看照片 1：一起出行的伙伴", exact: true })
    .click();
  const lightbox = gallery.getByRole("dialog");
  await lightbox.waitFor();
  await lightbox
    .getByRole("button", { name: "下一张照片", exact: true })
    .click();
  await lightbox
    .getByRole("heading", { name: "海边的第一张照片", exact: true })
    .waitFor();
  await gallery.keyboard.press("ArrowLeft");
  await lightbox
    .getByRole("heading", { name: "一起出行的伙伴", exact: true })
    .waitFor();
  await gallery.keyboard.press("Escape");
  await lightbox.waitFor({ state: "hidden" });
  await gallery.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await gallery.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await gallery.screenshot({
    path: join(artifacts, "album-mobile.png"),
    fullPage: true,
  });
  await gallery.close();
  log(
    "public album categories, travel notes, lazy images, keyboard lightbox and mobile layouts",
  );
  await page.goto(origin + "/ff14/oopsie/#/editor");
  await page.getByRole("button", { name: "新建文章", exact: true }).click();
  await page.getByLabel("文章标题", { exact: true }).fill("图文随记验收");
  await page.getByLabel("文章标识", { exact: false }).fill("qa-photo-story");
  await page
    .getByLabel("正文（Markdown）", { exact: true })
    .fill("这一段旅途，也写进博客。");
  await page
    .getByRole("button", { name: "正文插图 / 图片库", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "图片库", exact: true })
    .getByRole("button", { name: "选择照片 Lolita.webp", exact: true })
    .click();
  await page.getByRole("button", { name: "使用所选照片", exact: true }).click();
  assert.match(
    await page.getByLabel("正文（Markdown）", { exact: true }).inputValue(),
    /!\[Lolita\]\(\/assets\/uploads\//,
  );
  await page
    .getByRole("button", { name: "从图片库选封面", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "图片库", exact: true })
    .getByRole("button", { name: "选择照片 favicon.png", exact: true })
    .click();
  await page.getByRole("button", { name: "使用所选照片", exact: true }).click();
  await page.getByRole("button", { name: "预览正文", exact: true }).click();
  assert.equal(await page.locator(".editor-preview img").count(), 1);
  await page.getByLabel("保留为草稿").uncheck();
  await page.getByRole("button", { name: "保存文章", exact: true }).click();
  await page
    .getByText("文章已保存。更新公开页面后，读者会看到这一版。", {
      exact: true,
    })
    .waitFor();
  await rebuild();
  const story = await browser.newPage();
  await story.goto(origin + "/posts/qa-photo-story/");
  assert.equal(await story.locator(".prose img").count(), 1);
  assert.equal(await story.locator(".article-cover img").count(), 1);
  await story.close();
  log("album photos reuse in blog body, preview and cover without reuploading");
  await page.goto(origin + "/ff14/oopsie/#/games");
  await page.getByRole("heading", { name: "游戏名片", exact: true }).waitFor();
  await page.getByRole("button", { name: "添加游戏名片", exact: true }).click();
  const custom = page.locator("[data-profile-editor]").last();
  await custom.getByLabel("游戏名称", { exact: true }).fill("可扩展游戏验收");
  await custom.getByLabel("昵称或角色", { exact: true }).fill("验收角色");
  await custom.getByRole("button", { name: "添加信息", exact: true }).click();
  await custom.getByLabel("信息名称", { exact: true }).fill("UID");
  await custom.getByLabel("信息内容", { exact: true }).fill("PRIVATE-GAME-ID");
  await custom.getByRole("button", { name: "添加链接", exact: true }).click();
  await custom.getByLabel("链接名称", { exact: true }).fill("我的图鉴");
  await custom
    .getByLabel("链接地址", { exact: true })
    .fill("https://example.com/chart?s=a%2Bb&key=c");
  await page.reload();
  await page.getByText("已恢复尚未保存的名片。", { exact: true }).waitFor();
  assert.equal(
    await page
      .locator("[data-profile-editor]")
      .last()
      .getByLabel("游戏名称", { exact: true })
      .inputValue(),
    "可扩展游戏验收",
  );
  const recovered = page.locator("[data-profile-editor]").last();
  await recovered
    .getByRole("button", { name: "选择或上传头像", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "图片库", exact: true })
    .getByLabel("上传图片库照片")
    .setInputFiles(join(root, "source/assets/favicon.png"));
  await page
    .getByText("已上传 1 张照片，请确认选择。", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "使用所选照片", exact: true }).click();
  const privateAvatar = await recovered
    .getByLabel("头像地址", { exact: true })
    .inputValue();
  await page.getByRole("button", { name: "保存名片", exact: true }).click();
  await page
    .getByText("名片已保存，更新公开页面后生效。", { exact: true })
    .waitFor();
  await rebuild();
  const publicGames = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await publicGames.goto(origin + "/games/");
  assert.equal(await publicGames.locator("[data-game-card]").count(), 3);
  assert.ok(!(await publicGames.content()).includes("PRIVATE-GAME-ID"));
  assert.equal(
    (await publicGames.request.get(origin + privateAvatar)).status(),
    404,
  );
  await recovered.getByLabel("公开展示这张名片", { exact: true }).check();
  await page
    .getByRole("button", { name: "上移可扩展游戏验收", exact: true })
    .click();
  await page
    .getByRole("button", { name: "上移可扩展游戏验收", exact: true })
    .click();
  await page
    .getByRole("button", { name: "上移可扩展游戏验收", exact: true })
    .click();
  await page.getByRole("button", { name: "保存名片", exact: true }).click();
  await page
    .getByText("名片已保存，更新公开页面后生效。", { exact: true })
    .waitFor();
  await rebuild();
  await publicGames.reload();
  assert.equal(await publicGames.locator("[data-game-card]").count(), 4);
  assert.equal(
    await publicGames
      .locator("[data-game-card]")
      .first()
      .getByRole("heading")
      .innerText(),
    "验收角色⧉",
  );
  assert.equal(
    await publicGames
      .getByRole("link", { name: /我的图鉴/ })
      .getAttribute("href"),
    "https://example.com/chart?s=a%2Bb&key=c",
  );
  assert.equal(
    (await publicGames.request.get(origin + privateAvatar)).status(),
    200,
  );
  await publicGames
    .getByRole("button", { name: "复制可扩展游戏验收的UID", exact: true })
    .click();
  await publicGames
    .getByRole("status")
    .getByText("已复制，可以去游戏里找我了。", { exact: true })
    .waitFor();
  await publicGames.screenshot({
    path: join(artifacts, "games-desktop.png"),
    fullPage: true,
  });
  await publicGames.goto(origin);
  assert.equal(
    await publicGames.locator(".home-games [data-game-card]").count(),
    3,
  );
  assert.equal(
    await publicGames
      .locator(".home-games [data-game-card]")
      .first()
      .getByRole("heading")
      .innerText(),
    "验收角色⧉",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await page.screenshot({
    path: join(artifacts, "games-editor-mobile.png"),
    fullPage: true,
  });
  await publicGames.setViewportSize({ width: 390, height: 844 });
  await publicGames.goto(origin + "/games/");
  assert.ok(
    await publicGames.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await publicGames.screenshot({
    path: join(artifacts, "games-mobile.png"),
    fullPage: true,
  });
  await publicGames.close();
  log(
    "game cards: arbitrary fields/links, draft recovery, avatar reuse/privacy, visibility/order, publication, copy and mobile layouts",
  );
  // A malformed content source must never replace the last successful release.
  const administrationRequests = [];
  const inspectAdminRequests = (request) => {
    if (request.url().includes("/api/"))
      administrationRequests.push(new URL(request.url()).pathname);
  };
  page.on("request", inspectAdminRequests);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + "/admin/");
  await page
    .getByRole("heading", { name: "站点管理总览", exact: true })
    .waitFor();
  await page
    .getByRole("navigation", { name: "站点后台导航" })
    .getByRole("link", { name: "图片库", exact: true })
    .waitFor();
  assert.ok(
    administrationRequests.every(
      (path) => path.startsWith("/api/site/") || path.startsWith("/api/auth/"),
    ),
    JSON.stringify(administrationRequests),
  );
  await page.screenshot({
    path: join(artifacts, "site-admin-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await page.screenshot({
    path: join(artifacts, "site-admin-mobile.png"),
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "站点后台导航" })
    .getByRole("link", { name: "图片库", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "站点图片库", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "选择照片 Lolita.webp", exact: true })
    .click();
  await page.getByRole("button", { name: "查看引用地址", exact: true }).click();
  assert.match(
    await page.getByLabel("Markdown 引用", { exact: true }).inputValue(),
    /\/assets\/uploads\//,
  );
  await noOverflow();
  await page.goto(origin + "/admin/#/publication");
  await page.getByRole("heading", { name: "发布管理", exact: true }).waitFor();
  await page
    .getByRole("button", { name: "更新公开页面", exact: true })
    .waitFor();
  page.off("request", inspectAdminRequests);
  administrationRequests.length = 0;
  page.on("request", inspectAdminRequests);
  await page.goto(origin + "/ff14/admin/");
  await page
    .getByRole("heading", { name: "FF14 模块总览", exact: true })
    .waitFor();
  assert.ok(
    administrationRequests.every(
      (path) =>
        path.startsWith("/api/ff14/admin/") || path.startsWith("/api/auth/"),
    ),
    JSON.stringify(administrationRequests),
  );
  assert.equal(
    await page
      .getByRole("navigation", { name: "FF14 管理导航" })
      .getByRole("link", { name: "文章管理", exact: true })
      .count(),
    0,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: join(artifacts, "ff14-admin-desktop.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "队长与工作区", exact: true }).click();
  await page
    .getByRole("heading", { name: "队长与工作区", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "生成队长邀请码", exact: true })
    .click();
  await page.getByText(/已创建队长邀请码/).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow();
  await page.screenshot({
    path: join(artifacts, "ff14-admin-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "跨队进度", exact: true }).click();
  await page
    .getByRole("heading", { name: "队长空间进度总览", exact: true })
    .waitFor();
  await noOverflow();
  page.off("request", inspectAdminRequests);
  const deniedContext = await browser.newContext();
  await deniedContext.request.post(origin + "/api/auth/login", {
    data: { passcode: "BROWSER-CAPTAIN-001" },
  });
  const denied = await deniedContext.newPage();
  await denied.goto(origin + "/admin/");
  await denied
    .getByRole("heading", { name: "当前账号没有站点编辑权限", exact: true })
    .waitFor();
  await denied.goto(origin + "/ff14/admin/");
  await denied
    .getByRole("heading", {
      name: "当前账号没有 FF14 模块管理权限",
      exact: true,
    })
    .waitFor();
  await denied.goto(origin + "/ff14/oopsie/#/members");
  await denied
    .getByRole("heading", { name: "成员与邀请", exact: true })
    .waitFor();
  await denied.goto(origin + "/ff14/oopsie/#/backup");
  await denied
    .getByRole("heading", { name: "数据备份与恢复", exact: true })
    .waitFor();
  const storeUrl =
    origin +
    "/api/store?" +
    new URLSearchParams({ key, workspaceId: captainSession.workspaceId });
  const beforeCacheReset = (await (await denied.request.get(storeUrl)).json())
    .value;
  const resetting = denied.waitForEvent(
    "framenavigated",
    (frame) => frame === denied.mainFrame(),
  );
  denied.once("dialog", (dialog) => dialog.accept());
  await denied.getByRole("button", { name: /清除本机缓存并重新同步/ }).click();
  await resetting;
  await denied
    .getByRole("heading", { name: "数据备份与恢复", exact: true })
    .waitFor();
  assert.deepEqual(
    (await (await denied.request.get(storeUrl)).json()).value,
    beforeCacheReset,
  );
  await denied.goto(origin + "/ff14/oopsie/#/preferences");
  await denied
    .getByRole("heading", { name: "个人偏好", exact: true })
    .waitFor();
  await deniedContext.close();
  log(
    "independent site/FF14 consoles, separate APIs without team hydration, library/publication pages, module management, split team settings and permission denials",
  );
  // A malformed content source must never replace the last successful release.
  writeFileSync(
    join(blog, "source/_posts/invalid.md"),
    "---\ntitle: [broken\n---\nBad",
  );
  const response = await page.request.post(`${origin}/api/editor/publication`, {
    headers: {
      "X-CSRF-Token": (
        await (await page.request.get(origin + "/api/auth/session")).json()
      ).session.csrfToken,
    },
  });
  assert.equal(response.status(), 202);
  let result;
  for (let attempt = 0; attempt < 60; attempt++) {
    result = await (
      await page.request.get(origin + "/api/editor/publication")
    ).json();
    if (result.state !== "building") break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  assert.equal(result.state, "failed");
  assert.equal(
    (await page.request.get(`${origin}/posts/qa-review/`)).status(),
    200,
  );
  log("a failed build preserves the current public release");
  assert.deepEqual(errors, []);
  console.log("Browser check passed. Screenshots: .qa/");
} catch (error) {
  await page.screenshot({
    path: join(artifacts, "browser-failure.png"),
    fullPage: true,
  });
  if (existsSync(join(blog, ".releases/current.json"))) {
    const { release } = JSON.parse(
      readFileSync(join(blog, ".releases/current.json"), "utf8"),
    );
    cpSync(
      join(blog, ".releases", release),
      join(artifacts, "failed-publication"),
      { recursive: true },
    );
  }
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => db.close(resolve));
  // Unlink the temporary dependency junction before removing the test workspace.
  rmSync(join(blog, "node_modules"), {
    recursive: process.platform !== "win32",
    force: true,
  });
  rmSync(join(blog, ".releases"), {
    recursive: process.platform !== "win32",
    force: true,
  });
  rmSync(directory, { recursive: true, force: true });
}
