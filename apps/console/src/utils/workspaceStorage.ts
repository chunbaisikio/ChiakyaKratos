import type { StateStorage } from "zustand/middleware";
import { fetchJson, HttpError } from "./http";
import { getWorkspaceSession, getWorkspaceScopedStorageKey } from "./session";

export type SyncState = {
  kind: "idle" | "saving" | "synced" | "offline" | "conflict";
  message: string;
};
let state: SyncState = { kind: "idle", message: "" };
const listeners = new Set<() => void>();
export const subscribeSync = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getSyncState = () => state;
function notify(kind: SyncState["kind"], message: string) {
  state = { kind, message };
  listeners.forEach((listener) => listener());
}
const revisions = new Map<string, number>();
const lastShared = new Map<string, string>();
const blocked = new Set<string>();
let writes = Promise.resolve();
const sharedKeys = ["bossProfiles", "teams", "mistakes", "progress"];
const preferenceKeys = ["activeTeamId", "hasSeenGuidance", "telemetryConsent"];
type Persisted = { state: Record<string, unknown>; version?: number };
function shared(value: Persisted): Persisted {
  return {
    state: Object.fromEntries(
      sharedKeys.map((key) => [key, value.state[key] ?? []]),
    ),
    version: value.version ?? 0,
  };
}
function preserveBackup(key: string) {
  const cached = localStorage.getItem(key);
  if (cached) localStorage.setItem(`${key}:pending-backup`, cached);
}
export function downloadPendingBackup() {
  const key = getWorkspaceScopedStorageKey("ff14oopsie-v2-storage");
  const value =
    localStorage.getItem(`${key}:pending-backup`) || localStorage.getItem(key);
  if (!value) return;
  const payload = JSON.parse(value) as Persisted;
  const blob = new Blob([JSON.stringify(payload.state ?? payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ff14-local-backup-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
export async function beforeResync() {
  await writes;
  const key = getWorkspaceScopedStorageKey("ff14oopsie-v2-storage");
  if (blocked.has(key)) preserveBackup(key);
}

export const apiStorage: StateStorage = {
  getItem: async (name) => {
    const session = getWorkspaceSession();
    const key = getWorkspaceScopedStorageKey(name);
    const fallback = localStorage.getItem(key);
    if (!session) return fallback;
    try {
      const params = new URLSearchParams({
        key,
        workspaceId: session.workspaceId,
      });
      const response = await fetchJson<{
        value: Persisted | null;
        revision: number;
      }>(`/api/store?${params}`);
      revisions.set(key, response.revision);
      blocked.delete(key);
      const local = fallback ? (JSON.parse(fallback) as Persisted) : null;
      const remote = response.value;
      lastShared.set(
        key,
        JSON.stringify(remote ? shared(remote) : shared({ state: {} })),
      );
      notify("synced", "工作区已同步");
      if (!remote) return fallback;
      const preferences = Object.fromEntries(
        preferenceKeys
          .filter((key) => local?.state?.[key] !== undefined)
          .map((key) => [key, local!.state[key]]),
      );
      const value = JSON.stringify({
        ...remote,
        state: { ...remote.state, ...preferences },
      });
      localStorage.setItem(key, value);
      return value;
    } catch (error) {
      blocked.add(key);
      preserveBackup(key);
      notify(
        "offline",
        error instanceof Error ? error.message : "连接中断，当前修改保留在本地",
      );
      return fallback;
    }
  },
  setItem: (name, value) => {
    const session = getWorkspaceSession();
    const key = getWorkspaceScopedStorageKey(name);
    localStorage.setItem(key, value);
    if (!session) return;
    const payload = shared(JSON.parse(value) as Persisted);
    const encoded = JSON.stringify(payload);
    if (lastShared.get(key) === encoded) return;
    if (blocked.has(key)) {
      preserveBackup(key);
      return;
    }
    notify("saving", "正在保存");
    writes = writes.then(async () => {
      if (blocked.has(key)) {
        preserveBackup(key);
        return;
      }
      if (lastShared.get(key) === encoded) return;
      const baseRevision = revisions.get(key);
      if (baseRevision === undefined) {
        blocked.add(key);
        preserveBackup(key);
        notify("offline", "请先同步工作区，再提交修改");
        return;
      }
      try {
        const result = await fetchJson<{ revision: number }>("/api/store", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceId: session.workspaceId,
            key,
            value: payload,
            baseRevision,
          }),
        });
        revisions.set(key, result.revision);
        lastShared.set(key, encoded);
        notify("synced", "修改已保存");
      } catch (error) {
        blocked.add(key);
        preserveBackup(key);
        notify(
          error instanceof HttpError && error.status === 409
            ? "conflict"
            : "offline",
          error instanceof Error
            ? error.message
            : "保存失败，当前修改保留在本地",
        );
      }
    });
    return writes;
  },
  removeItem: (name) => {
    localStorage.removeItem(getWorkspaceScopedStorageKey(name));
  },
};
