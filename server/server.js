import express from "express";
import crypto from "node:crypto";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { db, get, all, run, transaction } from "./database.js";
import {
  authMiddleware,
  createSession,
  credentialLookup,
  findUser,
  hashPasscode,
  limitAuth,
  logout,
  publicSession,
  requireActor,
  requireAdmin,
  requireLogin,
} from "./auth.js";
import { buildTeamProgressRows } from "./progress.js";
import { activeRelease, editorRouter } from "./editor.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", "loopback");
app.use(
  ["/api/editor/media", "/api/site/media"],
  express.json({ limit: "28mb" }),
);
app.use(express.json({ limit: "10mb" }));
app.use("/api", authMiddleware);
const genId = () => crypto.randomUUID();
const fail = (status, message) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};
const text = (value, label, maximum = 120) => {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > maximum
  )
    fail(400, `${label}不能为空，且最多 ${maximum} 个字符。`);
  return value.trim();
};
function newCredential(value) {
  const passcode = text(value, "登录口令", 128);
  if (passcode.length < 8) fail(400, "登录口令至少需要 8 个字符。");
  return passcode;
}
async function unusedCredential(passcode) {
  if (
    await get("SELECT id FROM users WHERE passcode_lookup=?", [
      credentialLookup(passcode),
    ])
  )
    fail(409, "该口令已被占用，请更换一个。");
}
async function newCode() {
  let code;
  do {
    code = crypto.randomBytes(6).toString("hex").toUpperCase();
  } while (
    await get(
      "SELECT invite_code FROM workspaces WHERE invite_code=? UNION SELECT invite_code FROM workspace_invites WHERE invite_code=? UNION SELECT invite_code FROM captain_invites WHERE invite_code=?",
      [code, code, code],
    )
  );
  return code;
}
async function insertUser(id, displayName, passcode, hashed) {
  await run(
    "INSERT INTO users(id,display_name,passcode,passcode_lookup,created_at) VALUES (?,?,?,?,datetime('now'))",
    [id, displayName, hashed, credentialLookup(passcode)],
  );
}
app.get("/api/health", (_req, res) =>
  res.json({ ok: true, service: "chiakya-oopsie-server" }),
);
app.get("/api/auth/status", async (_req, res) =>
  res.json({
    hasAdmin: Boolean(
      await get(
        "SELECT id FROM workspace_memberships WHERE role='admin' LIMIT 1",
      ),
    ),
  }),
);
app.get("/api/auth/session", async (req, res) => {
  if (!requireLogin(req, res)) return;
  const session = await publicSession(req.auth.userId, req.auth.csrfToken);
  if (!session)
    return res.status(401).json({ error: "当前账号已失效，请重新登录。" });
  res.set("Cache-Control", "no-store").json({ session });
});
app.post("/api/auth/bootstrap", limitAuth, async (req, res) => {
  const name = text(req.body?.workspaceName, "站点名称");
  const displayName = text(req.body?.displayName, "显示名");
  const passcode = newCredential(req.body?.passcode);
  const hashed = await hashPasscode(passcode);
  const userId = genId();
  await transaction(async () => {
    if (
      await get(
        "SELECT id FROM workspace_memberships WHERE role='admin' LIMIT 1",
      )
    )
      fail(409, "管理员已存在，请直接登录。");
    await unusedCredential(passcode);
    const workspaceId = genId();
    await insertUser(userId, displayName, passcode, hashed);
    await run(
      "INSERT INTO workspaces(id,name,invite_code,created_by,workspace_type,owner_user_id,created_at) VALUES (?,?,?,?,'admin',?,datetime('now'))",
      [workspaceId, name, await newCode(), displayName, userId],
    );
    await run(
      "INSERT INTO workspace_memberships(id,workspace_id,user_id,role,joined_at) VALUES (?,?,?,'admin',datetime('now'))",
      [genId(), workspaceId, userId],
    );
    await run("INSERT INTO site_roles(user_id,role) VALUES (?,'editor')", [
      userId,
    ]);
  });
  res.status(201).json({ session: await createSession(res, userId) });
});
app.post("/api/auth/login", limitAuth, async (req, res) => {
  const user = await findUser(text(req.body?.passcode, "登录口令", 128));
  if (!user) return res.status(401).json({ error: "口令无效，请检查后重试。" });
  res
    .set("Cache-Control", "no-store")
    .json({ session: await createSession(res, user.id) });
});
app.post("/api/auth/logout", async (req, res) => {
  await logout(req, res);
  res.json({ success: true });
});
app.get(
  ["/api/ff14/admin/captains", "/api/admin/captains"],
  async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    res.json({
      workspaces:
        await all(`SELECT w.id AS workspaceId,w.name AS workspaceName,w.invite_code AS inviteCode,
    w.created_at AS createdAt,u.display_name AS captainName,COUNT(DISTINCT wm.user_id) AS memberCount
    FROM workspaces w JOIN users u ON u.id=w.owner_user_id LEFT JOIN workspace_memberships wm ON wm.workspace_id=w.id
    WHERE w.workspace_type='captain' GROUP BY w.id ORDER BY w.created_at DESC`),
    });
  },
);
app.get(
  ["/api/ff14/admin/captain-invites", "/api/admin/captain-invites"],
  async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    res.json({
      invites: await all(
        `SELECT ci.id,ci.invite_code AS inviteCode,ci.created_at AS createdAt,ci.consumed_at AS consumedAt,u.display_name AS createdBy FROM captain_invites ci JOIN users u ON u.id=ci.created_by_user_id ORDER BY ci.created_at DESC`,
      ),
    });
  },
);
app.post(
  ["/api/ff14/admin/captain-invites", "/api/admin/captain-invites"],
  async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const inviteCode = await transaction(async () => {
      const code = await newCode();
      await run(
        "INSERT INTO captain_invites(id,invite_code,created_by_user_id,created_at) VALUES (?,?,?,datetime('now'))",
        [genId(), code, admin.userId],
      );
      return code;
    });
    res.status(201).json({ inviteCode, role: "captain" });
  },
);
app.get(
  ["/api/ff14/admin/progress", "/api/admin/progress"],
  async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const workspaces = await all(
      "SELECT w.id AS workspaceId,w.name AS workspaceName,u.display_name AS captainName FROM workspaces w JOIN users u ON u.id=w.owner_user_id WHERE w.workspace_type='captain' ORDER BY w.created_at DESC",
    );
    const rows = [];
    for (const workspace of workspaces) {
      const snapshot = await get(
        "SELECT value FROM workspace_store WHERE workspace_id=? AND key=?",
        [
          workspace.workspaceId,
          `ff14oopsie-v2-storage:${workspace.workspaceId}`,
        ],
      );
      if (snapshot?.value)
        rows.push(
          ...buildTeamProgressRows(JSON.parse(snapshot.value), workspace),
        );
    }
    res.json({ rows });
  },
);
app.get("/api/workspaces/:id/users", async (req, res) => {
  if (!(await requireActor(req, res, req.params.id))) return;
  res.json({
    users: await all(
      `SELECT u.id,u.display_name AS displayName,wm.role,wm.joined_at AS joinedAt FROM workspace_memberships wm JOIN users u ON u.id=wm.user_id WHERE wm.workspace_id=? ORDER BY CASE wm.role WHEN 'captain' THEN 0 ELSE 1 END,wm.joined_at`,
      [req.params.id],
    ),
  });
});
app.get("/api/workspaces/:id/invites", async (req, res) => {
  if (!(await requireActor(req, res, req.params.id))) return;
  res.json({
    invites: await all(
      `SELECT wi.id,wi.invite_code AS inviteCode,wi.role,wi.created_at AS createdAt,wi.consumed_at AS consumedAt,u.display_name AS createdBy FROM workspace_invites wi JOIN users u ON u.id=wi.created_by_user_id WHERE wi.workspace_id=? ORDER BY wi.created_at DESC`,
      [req.params.id],
    ),
  });
});
app.post("/api/workspaces/:id/invites", async (req, res) => {
  if (req.body?.role !== "member")
    return res.status(400).json({ error: "工作空间内只支持邀请 member。" });
  const actor = await requireActor(req, res, req.params.id, [
    "captain",
    "member",
  ]);
  if (!actor) return;
  const inviteCode = await transaction(async () => {
    const code = await newCode();
    await run(
      "INSERT INTO workspace_invites(id,workspace_id,invite_code,role,created_by_user_id,created_at) VALUES (?,?,?,'member',?,datetime('now'))",
      [genId(), req.params.id, code, actor.userId],
    );
    return code;
  });
  res.status(201).json({ inviteCode, role: "member" });
});
app.post("/api/invites/redeem", limitAuth, async (req, res) => {
  const code = text(req.body?.inviteCode, "邀请码", 32).toUpperCase();
  const displayName = text(req.body?.displayName, "显示名");
  const passcode = newCredential(req.body?.passcode);
  const hashed = await hashPasscode(passcode);
  const userId = genId();
  await transaction(async () => {
    await unusedCredential(passcode);
    const captainInvite = await get(
      "SELECT id,consumed_by_user_id AS consumed FROM captain_invites WHERE invite_code=?",
      [code],
    );
    if (captainInvite) {
      if (captainInvite.consumed) fail(409, "该邀请码已被使用。");
      const workspaceId = genId();
      await insertUser(userId, displayName, passcode, hashed);
      await run(
        "INSERT INTO workspaces(id,name,invite_code,created_by,workspace_type,owner_user_id,created_at) VALUES (?,?,?,?,'captain',?,datetime('now'))",
        [
          workspaceId,
          `${displayName} 的工作空间`,
          await newCode(),
          displayName,
          userId,
        ],
      );
      await run(
        "INSERT INTO workspace_memberships(id,workspace_id,user_id,role,joined_at) VALUES (?,?,?,'captain',datetime('now'))",
        [genId(), workspaceId, userId],
      );
      await run(
        "UPDATE captain_invites SET consumed_by_user_id=?,consumed_at=datetime('now') WHERE id=?",
        [userId, captainInvite.id],
      );
      return;
    }
    const invite = await get(
      "SELECT id,workspace_id AS workspaceId,role,consumed_by_user_id AS consumed FROM workspace_invites WHERE invite_code=?",
      [code],
    );
    if (invite?.consumed) fail(409, "该邀请码已被使用。");
    const workspace =
      invite ||
      (await get(
        "SELECT id AS workspaceId,workspace_type AS workspaceType FROM workspaces WHERE invite_code=?",
        [code],
      ));
    if (!workspace) fail(404, "邀请码不存在。");
    if (!invite && workspace.workspaceType !== "captain")
      fail(403, "管理员控制台不支持通过通用邀请码加入。");
    await insertUser(userId, displayName, passcode, hashed);
    await run(
      "INSERT INTO workspace_memberships(id,workspace_id,user_id,role,joined_at) VALUES (?,?,?,?,datetime('now'))",
      [genId(), workspace.workspaceId, userId, invite?.role || "member"],
    );
    if (invite)
      await run(
        "UPDATE workspace_invites SET consumed_by_user_id=?,consumed_at=datetime('now') WHERE id=?",
        [userId, invite.id],
      );
  });
  res.status(201).json({ session: await createSession(res, userId) });
});
function storeKey(workspaceId, key) {
  if (key !== `ff14oopsie-v2-storage:${workspaceId}`)
    fail(400, "无效的工作区数据标识。");
  return key;
}
function sharedSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(400, "工作区数据格式无效。");
  const state = value.state || value;
  const shared = {};
  for (const key of ["bossProfiles", "teams", "mistakes", "progress"]) {
    if (state[key] !== undefined && !Array.isArray(state[key]))
      fail(400, `工作区 ${key} 必须是数组。`);
    shared[key] = state[key] || [];
  }
  return {
    state: shared,
    version: Number.isInteger(value.version) ? value.version : 0,
  };
}
app.get("/api/store", async (req, res) => {
  const workspaceId = text(req.query.workspaceId, "工作区");
  if (!(await requireActor(req, res, workspaceId))) return;
  const key = storeKey(workspaceId, req.query.key);
  const row = await get(
    "SELECT value,revision FROM workspace_store WHERE workspace_id=? AND key=?",
    [workspaceId, key],
  );
  res.set("Cache-Control", "no-store").json({
    value: row?.value ? sharedSnapshot(JSON.parse(row.value)) : null,
    revision: row?.revision || 0,
  });
});
app.post("/api/store", async (req, res) => {
  const workspaceId = text(req.body?.workspaceId, "工作区");
  const actor = await requireActor(req, res, workspaceId);
  if (!actor) return;
  const key = storeKey(workspaceId, req.body?.key);
  const baseRevision = req.body?.baseRevision;
  if (!Number.isInteger(baseRevision) || baseRevision < 0)
    return res.status(428).json({ error: "请先同步最新数据，再提交修改。" });
  const snapshot = sharedSnapshot(req.body?.value);
  const revision = await transaction(async () => {
    const current = await get(
      "SELECT revision FROM workspace_store WHERE workspace_id=? AND key=?",
      [workspaceId, key],
    );
    if ((current?.revision || 0) !== baseRevision) return null;
    const next = baseRevision + 1;
    await run(
      `INSERT INTO workspace_store(workspace_id,key,value,updated_by,updated_at,revision) VALUES (?,?,?,?,datetime('now'),?)
      ON CONFLICT(workspace_id,key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at,revision=excluded.revision`,
      [workspaceId, key, JSON.stringify(snapshot), actor.userId, next],
    );
    return next;
  });
  if (revision === null)
    return res.status(409).json({
      error:
        "另一位成员已更新工作区。你的修改已保留在本地，请导出备份并同步最新数据。",
    });
  res.json({ success: true, revision });
});
const distPath = fileURLToPath(new URL("../dist", import.meta.url));
const portalPath = process.env.PORTAL_DIST_PATH
  ? resolve(process.env.PORTAL_DIST_PATH)
  : null;
const blogRoot = process.env.BLOG_ROOT ? resolve(process.env.BLOG_ROOT) : null;
let currentPortal = activeRelease(blogRoot, portalPath);
app.use(
  ["/api/site", "/api/editor"],
  editorRouter({
    blogRoot,
    portalPath,
    onRelease: (path) => {
      currentPortal = path;
    },
  }),
);
app.use("/api", (_req, res) => res.status(404).json({ error: "接口不存在。" }));
if (portalPath) {
  for (const path of ["/admin", "/ff14/admin", "/ff14/oopsie"]) {
    app.get(path, (req, res, next) =>
      req.path.endsWith("/") ? next() : res.redirect(308, `${path}/`),
    );
  }
  // App code follows the deployed version; article releases only select public content.
  app.use("/ff14/oopsie", express.static(join(portalPath, "ff14/oopsie")));
  app.use("/admin", express.static(join(portalPath, "admin")));
  app.use("/ff14/admin", express.static(join(portalPath, "ff14/admin")));
  app.use((req, res, next) => express.static(currentPortal)(req, res, next));
  // Retain previously public files and legacy URLs during a static-blog migration.
  if (process.env.LEGACY_BLOG_DIST_PATH)
    app.use(express.static(resolve(process.env.LEGACY_BLOG_DIST_PATH)));
  app.use((_req, res) => {
    const file = join(currentPortal, "404.html");
    existsSync(file)
      ? res.status(404).sendFile(file)
      : res.status(404).send("页面不存在");
  });
} else {
  app.use(express.static(distPath));
  app.use((_req, res) =>
    existsSync(join(distPath, "index.html"))
      ? res.sendFile(join(distPath, "index.html"))
      : res.status(404).send("先运行 npm run build。"),
  );
}
app.use((error, _req, res, _next) => {
  const status =
    error.status || (error.type === "entity.parse.failed" ? 400 : 500);
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: status >= 500 ? "服务器处理失败，请稍后重试。" : error.message,
  });
});
export const server = app.listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || "127.0.0.1",
);
server.on("listening", () =>
  console.log(
    `Chiakya server: http://${process.env.HOST || "127.0.0.1"}:${server.address().port}`,
  ),
);
export { app, db };
