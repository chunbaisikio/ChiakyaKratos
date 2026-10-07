import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./session', () => ({ getWorkspaceSession: () => ({ userId: 'user', workspaceId: 'workspace', csrfToken: 'csrf' }), getWorkspaceScopedStorageKey: (name: string) => `${name}:workspace` }));
const key = 'ff14oopsie-v2-storage:workspace';
const snapshot = (teams: unknown[] = []) => ({ state: { bossProfiles: [], teams, mistakes: [], progress: [] }, version: 0 });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
describe('workspace synchronization', () => {
  beforeEach(() => { vi.resetModules(); vi.restoreAllMocks(); localStorage.clear(); });
  it('keeps preferences local and skips writes that only change preferences', async () => {
    localStorage.setItem(key, JSON.stringify({ ...snapshot(), state: { ...snapshot().state, activeTeamId: 'my-team', telemetryConsent: true } }));
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response({ value: snapshot(), revision: 3 }));
    const { apiStorage } = await import('./workspaceStorage');
    const restored = JSON.parse((await apiStorage.getItem('ff14oopsie-v2-storage'))!);
    expect(restored.state.activeTeamId).toBe('my-team'); expect(restored.state.telemetryConsent).toBe(true);
    await apiStorage.setItem('ff14oopsie-v2-storage', JSON.stringify({ ...restored, state: { ...restored.state, telemetryConsent: false } }));
    expect(fetch).toHaveBeenCalledTimes(1); expect(String(fetch.mock.calls[0][0])).not.toContain('actorPasscode');
  });
  it('serializes writes and uses the new revision for the next update', async () => {
    const sent: Record<string, unknown>[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => { if (!init?.method) return response({ value: snapshot(), revision: 0 }); const body = JSON.parse(String(init.body)); sent.push(body); return response({ revision: sent.length }); });
    const { apiStorage } = await import('./workspaceStorage'); await apiStorage.getItem('ff14oopsie-v2-storage');
    await Promise.all([apiStorage.setItem('ff14oopsie-v2-storage', JSON.stringify(snapshot([{ id: 'first' }]))), apiStorage.setItem('ff14oopsie-v2-storage', JSON.stringify(snapshot([{ id: 'first' }, { id: 'second' }])))]);
    expect(sent.map(value => value.baseRevision)).toEqual([0, 1]); expect(sent[1]).not.toHaveProperty('actorPasscode');
  });
  it('retains the latest local backup and stops uploads after a conflict', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response({ value: snapshot(), revision: 1 })).mockResolvedValue(response({ error: '另一位成员已更新' }, 409));
    const { apiStorage, getSyncState } = await import('./workspaceStorage'); await apiStorage.getItem('ff14oopsie-v2-storage');
    await apiStorage.setItem('ff14oopsie-v2-storage', JSON.stringify(snapshot([{ id: 'first' }])));
    await apiStorage.setItem('ff14oopsie-v2-storage', JSON.stringify(snapshot([{ id: 'latest' }])));
    expect(getSyncState().kind).toBe('conflict'); expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem(`${key}:pending-backup`)!).state.teams[0].id).toBe('latest');
  });
});
