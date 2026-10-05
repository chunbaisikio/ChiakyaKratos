import { useEffect, useState } from "react";
import { fetchJson } from "../utils/http";
type Invite = {
  id: string;
  inviteCode: string;
  createdAt: string;
  consumedAt?: string;
  createdBy: string;
};
type Workspace = {
  workspaceId: string;
  workspaceName: string;
  inviteCode: string;
  captainName: string;
  memberCount: number;
};
export default function CaptainAdmin() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([
      fetchJson<{ invites: Invite[] }>("/api/ff14/admin/captain-invites"),
      fetchJson<{ workspaces: Workspace[] }>("/api/ff14/admin/captains"),
    ])
      .then(([codes, spaces]) => {
        if (active) {
          setInvites(codes.invites);
          setWorkspaces(spaces.workspaces);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(error.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function createInvite() {
    setBusy(true);
    try {
      const created = await fetchJson<{ inviteCode: string }>(
        "/api/ff14/admin/captain-invites",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      setInvites(
        (
          await fetchJson<{ invites: Invite[] }>(
            "/api/ff14/admin/captain-invites",
          )
        ).invites,
      );
      setMessage(`已创建队长邀请码：${created.inviteCode}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "邀请码创建失败。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-overview">
      <p className="admin-eyebrow">WORKSPACE MANAGEMENT</p>
      <h1>队长与工作区</h1>
      <p className="admin-description">
        生成一次性队长邀请码；队长兑换后拥有独立的副本、队伍、成员和复盘记录。
      </p>
      {loading && <p>正在读取队长工作区…</p>}
      <p role="status" className="text-sm text-amber-300 whitespace-pre-wrap">
        {message}
      </p>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>队长邀请码</h2>
          <div className="admin-actions">
            <button
              type="button"
              disabled={loading || busy}
              onClick={() => void createInvite()}
            >
              生成队长邀请码
            </button>
          </div>
        </div>
        {!loading && !invites.length && (
          <p className="text-slate-400 text-sm">当前还没有生成过队长邀请码。</p>
        )}
        <div className="space-y-3">
          {invites.map((invite) => (
            <div key={invite.id} className="admin-invite">
              <strong>{invite.inviteCode}</strong>
              <span>
                {invite.consumedAt ? `已使用 ${invite.consumedAt}` : "待使用"}
              </span>
              <small>创建者 {invite.createdBy}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="admin-panel">
        <h2>队长工作区名单</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {workspaces.map((workspace) => (
            <article
              key={workspace.workspaceId}
              className="rounded-xl border border-slate-700 bg-slate-950/50 p-4"
            >
              <h3 className="font-semibold">{workspace.workspaceName}</h3>
              <dl className="admin-workspace-details">
                <div>
                  <dt>队长</dt>
                  <dd>{workspace.captainName}</dd>
                </div>
                <div>
                  <dt>成员</dt>
                  <dd>{workspace.memberCount} 人</dd>
                </div>
                <div>
                  <dt>成员通用入场码</dt>
                  <dd className="font-mono">{workspace.inviteCode}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
        {!loading && !workspaces.length && (
          <p className="text-slate-400 text-sm">当前还没有队长工作区。</p>
        )}
      </section>
    </section>
  );
}
