import crypto from "node:crypto";
import { promisify } from "node:util";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { all, dbPath, get, run, transaction } from "./database.js";

const scrypt = promisify(crypto.scrypt);
const cookieName = "ff14oopsie-session";
const ttl = 7 * 24 * 60 * 60;
const keyPath = `${dbPath}.auth-key`;
let lookupSecret = process.env.AUTH_LOOKUP_SECRET;
if (!lookupSecret) {
  if (!existsSync(keyPath)) {
    if (
      await get(
        "SELECT id FROM users WHERE passcode_lookup IS NOT NULL LIMIT 1",
      )
    )
      throw new Error(
        "登录密钥缺失。请恢复数据库对应的 .auth-key 文件，或配置原 AUTH_LOOKUP_SECRET。",
      );
    try {
      writeFileSync(keyPath, crypto.randomBytes(32).toString("hex"), {
        flag: "wx",
        mode: 0o600,
      });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }
  lookupSecret = readFileSync(keyPath, "utf8").trim();
}
if (lookupSecret.length < 32)
  throw new Error("AUTH_LOOKUP_SECRET 至少需要 32 个字符。");
const keyFingerprint = crypto
  .createHash("sha256")
  .update(lookupSecret)
  .digest("hex");
const previousKey = await get(
  "SELECT value FROM app_settings WHERE key='auth_lookup_key'",
);
if (previousKey && previousKey.value !== keyFingerprint)
  throw new Error(
    "登录密钥与数据库不匹配，请恢复原 AUTH_LOOKUP_SECRET / .auth-key。",
  );
await run(
  "INSERT OR IGNORE INTO app_settings(key,value) VALUES ('auth_lookup_key',?)",
  [keyFingerprint],
);
export const credentialLookup = (passcode) =>
  crypto.createHmac("sha256", lookupSecret).update(passcode).digest("hex");
export async function hashPasscode(passcode) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = await scrypt(passcode, salt, 64);
  return `scrypt$${salt}$${hash.toString("hex")}`;
}
async function verifyPasscode(passcode, encoded) {
  const [, salt, expected] = encoded.split("$");
  if (!salt || !expected) return false;
  const actual = await scrypt(passcode, salt, 64);
  const stored = Buffer.from(expected, "hex");
  return (
    stored.length === actual.length && crypto.timingSafeEqual(stored, actual)
  );
}
// Existing user IDs, memberships and records survive the credential migration.
for (const user of await all(
  "SELECT id,passcode FROM users WHERE passcode_lookup IS NULL",
)) {
  if (user.passcode.startsWith("scrypt$"))
    throw new Error("旧哈希缺少登录索引，请从完整备份恢复数据库和登录密钥。");
  const passcode = user.passcode.trim();
  const hashed = await hashPasscode(passcode);
  await transaction(async () => {
    await run("UPDATE users SET passcode=?,passcode_lookup=? WHERE id=?", [
      hashed,
      credentialLookup(passcode),
      user.id,
    ]);
    await run("UPDATE workspace_store SET updated_by=? WHERE updated_by=?", [
      user.id,
      user.passcode,
    ]);
  });
}
await run("DELETE FROM auth_sessions WHERE expires_at<?", [Date.now()]);
export async function findUser(passcode) {
  const user = await get(
    "SELECT id,display_name AS displayName,passcode FROM users WHERE passcode_lookup=?",
    [credentialLookup(passcode)],
  );
  return user && (await verifyPasscode(passcode, user.passcode)) ? user : null;
}
export async function publicSession(userId, csrfToken) {
  const row = await get(
    `SELECT u.id AS userId,u.display_name AS displayName,wm.workspace_id AS workspaceId,
    wm.role,w.name AS workspaceName,w.workspace_type AS workspaceType,w.invite_code AS inviteCode
    FROM users u JOIN workspace_memberships wm ON wm.user_id=u.id JOIN workspaces w ON w.id=wm.workspace_id
    WHERE u.id=? ORDER BY CASE wm.role WHEN 'admin' THEN 0 WHEN 'captain' THEN 1 ELSE 2 END,wm.joined_at LIMIT 1`,
    [userId],
  );
  if (!row) return null;
  if (row.workspaceType === "admin") delete row.inviteCode;
  return {
    ...row,
    csrfToken,
    siteRoles: (
      await all("SELECT role FROM site_roles WHERE user_id=?", [userId])
    ).map((item) => item.role),
  };
}
const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
export async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const csrfToken = crypto.randomBytes(24).toString("hex");
  await transaction(() =>
    run(
      "INSERT INTO auth_sessions(token_hash,user_id,csrf_token,expires_at) VALUES (?,?,?,?)",
      [digest(token), userId, csrfToken, Date.now() + ttl * 1000],
    ),
  );
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/api",
    maxAge: ttl * 1000,
  });
  return publicSession(userId, csrfToken);
}
function cookieToken(req) {
  return (req.headers.cookie || "")
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
}
export async function authMiddleware(req, res, next) {
  try {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin
    ) {
      let origin;
      try {
        origin = new URL(req.headers.origin);
      } catch {
        return res.status(403).json({ error: "无效的请求来源。" });
      }
      if (
        !["http:", "https:"].includes(origin.protocol) ||
        origin.host !== req.get("host")
      )
        return res.status(403).json({ error: "请从本站页面提交操作。" });
    }
    const token = cookieToken(req);
    if (token)
      req.auth = await get(
        "SELECT token_hash AS tokenHash,user_id AS userId,csrf_token AS csrfToken FROM auth_sessions WHERE token_hash=? AND expires_at>?",
        [digest(token), Date.now()],
      );
    if (
      req.auth &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !["/auth/login", "/auth/bootstrap", "/invites/redeem"].includes(
        req.path,
      ) &&
      req.get("X-CSRF-Token") !== req.auth.csrfToken
    )
      return res
        .status(403)
        .json({ error: "登录验证已更新，请刷新页面后重试。" });
    next();
  } catch (error) {
    next(error);
  }
}
export function requireLogin(req, res) {
  if (req.auth) return req.auth;
  res.status(401).json({ error: "登录已过期，请重新登录。" });
  return null;
}
export async function requireActor(req, res, workspaceId, roles) {
  const auth = requireLogin(req, res);
  if (!auth) return null;
  const actor = await get(
    "SELECT user_id AS userId,role FROM workspace_memberships WHERE user_id=? AND workspace_id=?",
    [auth.userId, workspaceId],
  );
  if (!actor || (roles && !roles.includes(actor.role))) {
    res.status(403).json({ error: "你没有当前工作空间的操作权限。" });
    return null;
  }
  return actor;
}
export async function requireAdmin(req, res) {
  const auth = requireLogin(req, res);
  if (!auth) return null;
  const admin = await get(
    "SELECT user_id AS userId FROM workspace_memberships WHERE user_id=? AND role='admin'",
    [auth.userId],
  );
  if (!admin) {
    res.status(403).json({ error: "仅站点管理员可执行此操作。" });
    return null;
  }
  return admin;
}
export async function requireEditor(req, res) {
  const auth = requireLogin(req, res);
  if (!auth) return null;
  const editor = await get(
    "SELECT user_id AS userId FROM site_roles WHERE user_id=? AND role='editor'",
    [auth.userId],
  );
  if (!editor) {
    res.status(403).json({ error: "你没有博客编辑权限。" });
    return null;
  }
  return editor;
}
export async function logout(req, res) {
  if (req.auth)
    await transaction(() =>
      run("DELETE FROM auth_sessions WHERE token_hash=?", [req.auth.tokenHash]),
    );
  res.clearCookie(cookieName, {
    path: "/api",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.COOKIE_SECURE === "true",
  });
}
const attempts = new Map();
export function limitAuth(req, res, next) {
  const now = Date.now();
  const key = req.ip;
  const previous = attempts.get(key);
  const value =
    previous && previous.until > now
      ? previous
      : { count: 0, until: now + 10 * 60 * 1000 };
  value.count++;
  attempts.set(key, value);
  if (attempts.size > 1000)
    for (const [ip, entry] of attempts)
      if (entry.until <= now) attempts.delete(ip);
  if (value.count > 30) {
    res.set("Retry-After", String(Math.ceil((value.until - now) / 1000)));
    return res.status(429).json({ error: "尝试次数较多，请稍后再试。" });
  }
  next();
}
