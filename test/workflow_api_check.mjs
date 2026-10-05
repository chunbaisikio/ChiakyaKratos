import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';

const directory = mkdtempSync(join(tmpdir(), 'chiakya-api-'));
process.env.PORT = '0'; process.env.HOST = '127.0.0.1';
process.env.DB_PATH = join(directory, 'workflow.db'); process.env.BLOG_ROOT = join(directory, 'blog');
delete process.env.PORTAL_DIST_PATH;
mkdirSync(join(process.env.BLOG_ROOT, 'source/_posts'), { recursive: true });
writeFileSync(join(process.env.BLOG_ROOT, 'source/_posts/seed.md'), '---\ntitle: 测试文章\ndate: "2026-03-01T16:00:00+08:00"\ncomments: true\n---\n\n原始正文\n');
const { server, db } = await import('../server/server.js');
if (!server.listening) await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
function client() {
  let cookie = ''; let csrf = '';
  return {
    async raw(path, options = {}) {
      const headers = { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(csrf && !options.omitCsrf ? { 'X-CSRF-Token': csrf } : {}), ...options.headers };
      const response = await fetch(origin + path, { method: options.method || 'GET', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
      const data = await response.json();
      if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      if (data.session) csrf = data.session.csrfToken;
      return { response, data };
    },
    async ok(path, options) { const result = await this.raw(path, options); assert.ok(result.response.ok, `${path}: ${result.response.status} ${JSON.stringify(result.data)}`); return result.data; }
  };
}
const guest = client(); const admin = client(); const captain = client(); const member = client(); const other = client();
const query = workspaceId => `/api/store?workspaceId=${workspaceId}&key=${encodeURIComponent(`ff14oopsie-v2-storage:${workspaceId}`)}`;
const databaseGet = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (error, result) => error ? reject(error) : resolve(result)));
const log = label => console.log(`[ok] ${label}`);
try {
  assert.equal((await guest.ok('/api/auth/status')).hasAdmin, false);
  const boot = await admin.raw('/api/auth/bootstrap', { method: 'POST', body: { workspaceName: '测试站点', displayName: 'Admin', passcode: 'ADMIN-001' } });
  assert.equal(boot.response.status, 201); assert.equal(boot.data.session.role, 'admin'); assert.ok(boot.data.session.siteRoles.includes('editor'));
  assert.ok(!('passcode' in boot.data.session)); assert.ok(!('token' in boot.data.session));
  assert.match(boot.response.headers.get('set-cookie'), /HttpOnly/); assert.match(boot.response.headers.get('set-cookie'), /SameSite=Strict/);
  assert.match((await databaseGet('SELECT passcode FROM users WHERE id=?', [boot.data.session.userId])).passcode, /^scrypt\$/);
  log('cookie sessions, separate editor role and hashed credentials');
  assert.equal((await guest.raw('/api/admin/captains?actorPasscode=ADMIN-001')).response.status, 401);
  assert.equal((await admin.raw('/api/admin/captain-invites', { method: 'POST', body: {}, omitCsrf: true })).response.status, 403);
  assert.equal((await admin.raw('/api/admin/captain-invites', { method: 'POST', body: {}, headers: { Origin: 'https://other.example' } })).response.status, 403);
  log('password query parameters cannot authenticate; CSRF and origin checks');
  const invite = await admin.ok('/api/admin/captain-invites', { method: 'POST', body: {} });
  const redeemed = await captain.ok('/api/invites/redeem', { method: 'POST', body: { inviteCode: invite.inviteCode, displayName: 'Captain', passcode: 'CAPTAIN-001' } });
  const workspaceId = redeemed.session.workspaceId;
  assert.equal(redeemed.session.role, 'captain'); assert.deepEqual(redeemed.session.siteRoles, []);
  const memberInvite = await captain.ok(`/api/workspaces/${workspaceId}/invites`, { method: 'POST', body: { role: 'member' } });
  const joined = await member.ok('/api/invites/redeem', { method: 'POST', body: { inviteCode: memberInvite.inviteCode, displayName: 'Member', passcode: 'MEMBER-001' } });
  assert.equal(joined.session.workspaceId, workspaceId);
  await member.ok(`/api/workspaces/${workspaceId}/invites`, { method: 'POST', body: { role: 'member' } });
  assert.equal((await member.raw(`/api/workspaces/${workspaceId}/invites`, { method: 'POST', body: { role: 'captain' } })).response.status, 400);
  const users = await member.ok(`/api/workspaces/${workspaceId}/users`);
  assert.equal(users.users.length, 2); assert.ok(users.users.every(user => !('passcode' in user)));
  const workspaces = await admin.ok('/api/admin/captains'); assert.equal(workspaces.workspaces.length, 1); assert.ok(!('captainPasscode' in workspaces.workspaces[0]));
  assert.equal((await member.raw('/api/admin/captains')).response.status, 403);
  assert.equal((await captain.raw('/api/editor/posts')).response.status, 403);
  log('admin → captain → member workflow and role boundaries');
  const otherInvite = await admin.ok('/api/admin/captain-invites', { method: 'POST', body: {} });
  const otherSession = await other.ok('/api/invites/redeem', { method: 'POST', body: { inviteCode: otherInvite.inviteCode, displayName: 'Other', passcode: 'OTHER-CAPTAIN' } });
  assert.equal((await other.raw(query(workspaceId))).response.status, 403);
  assert.equal((await guest.raw(query(workspaceId))).response.status, 401);
  assert.equal((await member.raw(query(otherSession.session.workspaceId))).response.status, 403);
  const reusable = client();
  await reusable.ok('/api/invites/redeem', { method: 'POST', body: { inviteCode: redeemed.session.inviteCode, displayName: 'Reusable', passcode: 'REUSABLE-001' } });
  assert.equal((await guest.raw('/api/invites/redeem', { method: 'POST', body: { inviteCode: memberInvite.inviteCode, displayName: 'Duplicate', passcode: 'DUPLICATE-001' } })).response.status, 409);
  log('workspace isolation, reusable workspace codes and single-use invites');
  const payload = { workspaceId, key: `ff14oopsie-v2-storage:${workspaceId}`, value: { state: { bossProfiles: [{ id: 'b', name: '测试', parts: [] }], teams: [{ id: 't', name: '一队', bossId: 'b', players: [] }], mistakes: [], progress: [], activeTeamId: 't', telemetryConsent: true } }, baseRevision: 0 };
  assert.equal((await member.ok(query(workspaceId))).revision, 0);
  assert.equal((await member.raw('/api/store', { method: 'POST', body: { ...payload, baseRevision: undefined } })).response.status, 428);
  assert.equal((await member.ok('/api/store', { method: 'POST', body: payload })).revision, 1);
  const loaded = await member.ok(query(workspaceId)); assert.equal(loaded.revision, 1); assert.ok(!('activeTeamId' in loaded.value.state)); assert.ok(!('telemetryConsent' in loaded.value.state));
  const concurrent = await Promise.all([captain.raw('/api/store', { method: 'POST', body: { ...payload, baseRevision: 1 } }), member.raw('/api/store', { method: 'POST', body: { ...payload, baseRevision: 1, value: { ...payload.value, state: { ...payload.value.state, mistakes: [{ id: 'r', teamId: 't' }] } } } })]);
  assert.deepEqual(concurrent.map(result => result.response.status).sort(), [200, 409]); assert.equal((await member.ok(query(workspaceId))).revision, 2);
  assert.equal((await other.raw('/api/store', { method: 'POST', body: payload })).response.status, 403);
  log('optimistic concurrency rejects stale writes and excludes personal preferences');
  const post = await admin.ok('/api/editor/posts/seed'); assert.equal(post.metadata.comments, true);
  const saveBody = { revision: post.revision, title: '测试文章更新', date: '2026-03-01T16:00:00+08:00', body: '新的正文', tags: ['FF14'], categories: ['游戏随笔'], draft: true, cover: '' };
  const saved = await admin.ok('/api/editor/posts/seed', { method: 'PUT', body: saveBody }); assert.equal(saved.metadata.comments, true); assert.equal(saved.metadata.draft, true);
  assert.equal((await admin.raw('/api/editor/posts/seed', { method: 'PUT', body: saveBody })).response.status, 409);
  assert.equal((await guest.raw('/api/editor/posts')).response.status, 401);
  const preview = await admin.ok('/api/editor/preview', { method: 'POST', body: { body: '<script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">bad</a>\n\n## 正文' } });
  assert.ok(!preview.html.includes('<script')); assert.ok(!preview.html.includes('onerror')); assert.ok(!preview.html.includes('javascript:')); assert.ok(preview.html.includes('正文'));
  assert.match(readFileSync(join(process.env.BLOG_ROOT, 'source/_posts/seed.md'), 'utf8'), /新的正文/);
  assert.equal((await admin.raw('/api/editor/posts/%2E%2E%2Foutside', { method: 'PUT', body: saveBody })).response.status, 400);
  log('editor saves preserve metadata, detect conflicts and sanitize previews');
  await member.ok('/api/auth/logout', { method: 'POST' }); assert.equal((await member.raw('/api/auth/session')).response.status, 401);
  await member.ok('/api/auth/login', { method: 'POST', body: { passcode: 'MEMBER-001' } }); assert.equal((await member.ok('/api/auth/session')).session.role, 'member');
  assert.equal((await guest.raw('/api/unknown')).response.status, 404);
  assert.match((await guest.raw('/api/unknown')).response.headers.get('content-type'), /application\/json/);
  log('logout revokes session; existing passwords still sign in; unknown APIs return JSON');
  console.log('Workflow API check passed.');
} finally {
  await new Promise(resolve => server.close(resolve));
  await new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
  rmSync(directory, { recursive: true, force: true });
}
