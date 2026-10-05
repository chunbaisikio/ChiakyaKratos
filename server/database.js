import sqlite3 from "sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const dbPath = resolve(
  process.env.DB_PATH || fileURLToPath(new URL("./data.db", import.meta.url)),
);
mkdirSync(dirname(dbPath), { recursive: true });
export const db = await new Promise((resolve, reject) => {
  const connection = new sqlite3.Database(dbPath, (error) =>
    error ? reject(error) : resolve(connection),
  );
});
db.configure("busyTimeout", 5000);
export const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      error
        ? reject(error)
        : resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
export const get = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (error, row) => (error ? reject(error) : resolve(row))),
  );
export const all = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (error, rows) =>
      error ? reject(error) : resolve(rows),
    ),
  );

// The single connection uses a shared write queue to prevent overlapping transactions.
let writeQueue = Promise.resolve();
export function transaction(operation) {
  const result = writeQueue.then(async () => {
    await run("BEGIN IMMEDIATE");
    try {
      const value = await operation();
      await run("COMMIT");
      return value;
    } catch (error) {
      await run("ROLLBACK");
      throw error;
    }
  });
  writeQueue = result.catch(() => {});
  return result;
}
await run("PRAGMA journal_mode = WAL");
await run(
  `CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY,name TEXT NOT NULL,invite_code TEXT NOT NULL UNIQUE,created_by TEXT NOT NULL,workspace_type TEXT NOT NULL DEFAULT 'captain',owner_user_id TEXT,created_at TEXT NOT NULL)`,
);
await run(
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,display_name TEXT NOT NULL,passcode TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL)`,
);
await run(
  `CREATE TABLE IF NOT EXISTS workspace_memberships (id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,user_id TEXT NOT NULL,role TEXT NOT NULL,joined_at TEXT NOT NULL,UNIQUE(workspace_id,user_id))`,
);
await run(
  `CREATE TABLE IF NOT EXISTS workspace_invites (id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,invite_code TEXT NOT NULL UNIQUE,role TEXT NOT NULL,created_by_user_id TEXT NOT NULL,consumed_by_user_id TEXT,consumed_at TEXT,created_at TEXT NOT NULL)`,
);
await run(
  `CREATE TABLE IF NOT EXISTS captain_invites (id TEXT PRIMARY KEY,invite_code TEXT NOT NULL UNIQUE,created_by_user_id TEXT NOT NULL,consumed_by_user_id TEXT,consumed_at TEXT,created_at TEXT NOT NULL)`,
);
await run(
  `CREATE TABLE IF NOT EXISTS workspace_store (workspace_id TEXT NOT NULL,key TEXT NOT NULL,value TEXT,updated_by TEXT,updated_at TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(workspace_id,key))`,
);
async function addColumn(table, name, type) {
  if (
    !(await all(`PRAGMA table_info(${table})`)).some(
      (column) => column.name === name,
    )
  )
    await run(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
}
await addColumn(
  "workspaces",
  "workspace_type",
  "TEXT NOT NULL DEFAULT 'captain'",
);
await addColumn("workspaces", "owner_user_id", "TEXT");
await addColumn("users", "passcode_lookup", "TEXT");
await addColumn("workspace_store", "revision", "INTEGER NOT NULL DEFAULT 0");
await run(
  "CREATE UNIQUE INDEX IF NOT EXISTS users_passcode_lookup ON users(passcode_lookup)",
);
await run(
  "CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,csrf_token TEXT NOT NULL,expires_at INTEGER NOT NULL)",
);
await run(
  "CREATE TABLE IF NOT EXISTS site_roles (user_id TEXT NOT NULL,role TEXT NOT NULL,PRIMARY KEY(user_id,role))",
);
await run(
  "CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL)",
);
await run(
  "UPDATE workspaces SET workspace_type='admin' WHERE id IN (SELECT workspace_id FROM workspace_memberships WHERE role='admin')",
);
await run(
  "UPDATE workspaces SET workspace_type='captain' WHERE workspace_type IS NULL OR workspace_type NOT IN ('admin','captain')",
);
await run(
  "UPDATE workspaces SET owner_user_id=(SELECT user_id FROM workspace_memberships WHERE workspace_id=workspaces.id AND role='captain' LIMIT 1) WHERE workspace_type='captain' AND owner_user_id IS NULL",
);
// Preserve legacy administrator access once; subsequent role changes survive restarts.
await transaction(async () => {
  const key = "migration.site-editor-roles.v1";
  if (await get("SELECT value FROM app_settings WHERE key=?", [key])) return;
  await run(
    "INSERT OR IGNORE INTO site_roles(user_id,role) SELECT user_id,'editor' FROM workspace_memberships WHERE role='admin'",
  );
  await run("INSERT INTO app_settings(key,value) VALUES (?,?)", [
    key,
    new Date().toISOString(),
  ]);
});
