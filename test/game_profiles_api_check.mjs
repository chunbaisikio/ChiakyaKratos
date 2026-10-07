import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
const directory = mkdtempSync(join(tmpdir(), "chiakya-games-"));
process.env.PORT = "0";
process.env.HOST = "127.0.0.1";
process.env.COOKIE_SECURE = "false";
process.env.DB_PATH = join(directory, "data.db");
process.env.BLOG_ROOT = join(directory, "blog");
delete process.env.AUTH_LOOKUP_SECRET;
delete process.env.PORTAL_DIST_PATH;
mkdirSync(join(process.env.BLOG_ROOT, "source/_posts"), { recursive: true });
const { server, db } = await import("../server/server.js");
if (!server.listening) await once(server, "listening");
const origin = `http://127.0.0.1:${server.address().port}`;
function client() {
  let cookie = "",
    csrf = "";
  return async (path, data, options = {}) => {
    const response = await fetch(origin + path, {
      method: options.method || (data ? "POST" : "GET"),
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf && !options.noCsrf ? { "X-CSRF-Token": csrf } : {}),
        ...options.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    const body = await response.json();
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    if (body.session) csrf = body.session.csrfToken;
    return { response, body };
  };
}
const admin = client(),
  captain = client(),
  guest = client();
const path = "/api/editor/game-profiles";
try {
  assert.equal((await guest(path)).response.status, 401);
  await admin("/api/auth/bootstrap", {
    workspaceName: "名片验收",
    displayName: "编辑者",
    passcode: "GAMES-ADMIN-001",
  });
  const invite = await admin("/api/admin/captain-invites", {});
  await captain("/api/invites/redeem", {
    inviteCode: invite.body.inviteCode,
    displayName: "队长",
    passcode: "GAMES-CAPTAIN-001",
  });
  assert.equal((await captain(path)).response.status, 403);
  const original = (await admin(path)).body;
  assert.equal(original.revision, null);
  const profile = {
    id: "custom",
    title: "未来想展示的游戏",
    identity: "角色",
    description: "随时可扩展",
    emblem: "G",
    accent: "#85b9e2",
    image: "",
    visible: false,
    details: [
      { label: "服务器", value: "自定义区服" },
      { label: "UID", value: "123456" },
    ],
    links: [
      { label: "图鉴", url: "https://example.com/chart?s=a%2Bb&key=c" },
      { label: "随记", url: "/photos/" },
    ],
  };
  const data = {
    ...original,
    profiles: [
      profile,
      { ...profile, id: "second", title: "第二个游戏", visible: true },
    ],
  };
  assert.equal(
    (await admin(path, data, { method: "PUT", noCsrf: true })).response.status,
    403,
  );
  assert.equal(
    (
      await admin(path, data, {
        method: "PUT",
        headers: { Origin: "https://other.example" },
      })
    ).response.status,
    403,
  );
  const saved = await admin(path, data, { method: "PUT" });
  assert.equal(saved.response.status, 200);
  assert.deepEqual(saved.body.profiles, data.profiles);
  assert.equal(
    (await admin(path, data, { method: "PUT" })).response.status,
    409,
  );
  const reordered = {
    ...saved.body,
    profiles: [...saved.body.profiles].reverse(),
  };
  const result = await admin(path, reordered, { method: "PUT" });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.profiles[0].id, "second");
  assert.equal(result.body.profiles[1].visible, false);
  for (const invalid of [
    { links: [{ label: "危险地址", url: "javascript:alert(1)" }] },
    { links: [{ label: "协议相对地址", url: "//other.example" }] },
    { image: "/assets/../private.json" },
    { accent: "red; color: red" },
    { details: [{ label: "UID", value: "" }] },
    { details: Array(13).fill({ label: "a", value: "b" }) },
  ])
    assert.equal(
      (
        await admin(
          path,
          { ...result.body, profiles: [{ ...profile, ...invalid }] },
          { method: "PUT" },
        )
      ).response.status,
      400,
    );
  assert.equal(
    (
      await admin(
        path,
        { ...result.body, profiles: [profile, profile] },
        { method: "PUT" },
      )
    ).response.status,
    400,
  );
  assert.equal(
    (await captain(path, result.body, { method: "PUT" })).response.status,
    403,
  );
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        join(process.env.BLOG_ROOT, "source/_data/games.json"),
        "utf8",
      ),
    ).profiles,
    result.body.profiles,
  );
  console.log(
    "[ok] extensible game fields/links, visibility/order, editor-only access, CSRF, revisions and invalid input rejection",
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => db.close(resolve));
  rmSync(directory, { recursive: true, force: true });
}
