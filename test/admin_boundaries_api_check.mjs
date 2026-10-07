import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { spawnSync } from "node:child_process";
const directory = mkdtempSync(join(tmpdir(), "chiakya-admin-boundaries-"));
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
const run = (sql, params) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, (error) => (error ? reject(error) : resolve())),
  );
function client() {
  let cookie = "",
    csrf = "";
  return async (path, data, noCsrf = false) => {
    const response = await fetch(origin + path, {
      method: data ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
        ...(csrf && !noCsrf ? { "X-CSRF-Token": csrf } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    const body = await response.json();
    if (response.headers.get("set-cookie"))
      cookie = response.headers.get("set-cookie").split(";")[0];
    if (body.session) csrf = body.session.csrfToken;
    return { status: response.status, body };
  };
}
const admin = client(),
  captain = client(),
  guest = client();
try {
  for (const path of ["/api/site/posts", "/api/ff14/admin/captains"])
    assert.equal((await guest(path)).status, 401);
  const boot = await admin("/api/auth/bootstrap", {
    workspaceName: "独立后台验收",
    displayName: "管理员",
    passcode: "ADMIN-BOUNDARY-001",
  });
  assert.equal((await admin("/api/site/posts")).status, 200);
  assert.equal(
    (await admin("/api/ff14/admin/captain-invites", {}, true)).status,
    403,
  );
  const invite = await admin("/api/ff14/admin/captain-invites", {});
  const joined = await captain("/api/invites/redeem", {
    inviteCode: invite.body.inviteCode,
    displayName: "队长",
    passcode: "CAPTAIN-BOUNDARY-001",
  });
  for (const path of [
    "/api/site/posts",
    "/api/site/media",
    "/api/ff14/admin/captains",
    "/api/ff14/admin/progress",
  ])
    assert.equal((await captain(path)).status, 403);
  await run("INSERT INTO site_roles(user_id,role) VALUES (?, 'editor')", [
    joined.body.session.userId,
  ]);
  assert.equal((await captain("/api/site/posts")).status, 200);
  assert.equal((await captain("/api/site/media")).status, 200);
  assert.equal((await captain("/api/ff14/admin/captains")).status, 403);
  await run("DELETE FROM site_roles WHERE user_id=?", [
    boot.body.session.userId,
  ]);
  assert.equal((await admin("/api/site/posts")).status, 403);
  assert.equal((await admin("/api/editor/posts")).status, 403);
  assert.equal((await admin("/api/ff14/admin/captains")).status, 200);
  assert.equal((await admin("/api/admin/captains")).status, 200);
  assert.equal((await captain("/api/editor/posts")).status, 200);
  const reopened = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `const { db, get } = await import(${JSON.stringify(new URL("../server/database.js", import.meta.url).href)}); const row = await get("SELECT COUNT(*) AS count FROM site_roles WHERE user_id=?", [${JSON.stringify(boot.body.session.userId)}]); if (row.count !== 0) throw new Error("Revoked site role was regranted on restart"); await new Promise(resolve => db.close(resolve));`,
    ],
    { env: process.env, encoding: "utf8" },
  );
  assert.equal(reopened.status, 0, reopened.stderr);
  console.log(
    "[ok] independent site editor and FF14 administrator permissions, canonical APIs, legacy aliases and CSRF",
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
  await new Promise((resolve) => db.close(resolve));
  rmSync(directory, { recursive: true, force: true });
}
