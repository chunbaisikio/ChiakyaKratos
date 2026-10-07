import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchJson } from "../utils/http";
export default function FF14Overview() {
  const [summary, setSummary] = useState<{
    workspaces: number;
    members: number;
    invites: number;
    teams: number;
  } | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      fetchJson<{ workspaces: { memberCount: number }[] }>(
        "/api/ff14/admin/captains",
      ),
      fetchJson<{ invites: { consumedAt?: string }[] }>(
        "/api/ff14/admin/captain-invites",
      ),
      fetchJson<{ rows: unknown[] }>("/api/ff14/admin/progress"),
    ])
      .then(([workspaces, invites, progress]) => {
        if (active)
          setSummary({
            workspaces: workspaces.workspaces.length,
            members: workspaces.workspaces.reduce(
              (total, workspace) => total + workspace.memberCount,
              0,
            ),
            invites: invites.invites.filter((invite) => !invite.consumedAt)
              .length,
            teams: progress.rows.length,
          });
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="admin-overview">
      <p className="admin-eyebrow">FF14 OOPSIE LOG</p>
      <h1>FF14 模块总览</h1>
      <p className="admin-description">
        管理固定队工作区的建立与攻略进度。队长和成员在各自的复盘工作区完成日常记录。
      </p>
      {message && (
        <p role="alert" className="text-amber-300">
          {message}
        </p>
      )}
      {summary && (
        <div className="admin-stats">
          {[
            {
              label: "队长工作区",
              value: summary.workspaces,
              path: "/captains",
            },
            { label: "工作区成员", value: summary.members, path: "/captains" },
            {
              label: "待使用队长邀请码",
              value: summary.invites,
              path: "/captains",
            },
            {
              label: "参与进度对比的队伍",
              value: summary.teams,
              path: "/progress",
            },
          ].map((item) => (
            <Link key={item.label} className="admin-stat" to={item.path}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>查看详情 →</small>
            </Link>
          ))}
        </div>
      )}
      <div className="admin-panel">
        <h2>模块管理范围</h2>
        <div className="admin-shortcuts">
          <Link to="/captains">队长邀请与工作区名单 →</Link>
          <Link to="/progress">查看跨队副本进度 →</Link>
        </div>
        <p className="admin-description mt-5">
          复盘手记由队伍导出为 Markdown，再交给站点编辑者审核、发布到博客。
        </p>
      </div>
    </section>
  );
}
