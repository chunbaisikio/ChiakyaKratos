import { Link, Outlet, useLocation, Navigate } from "react-router-dom";
import {
  PenSquare,
  Users,
  Swords,
  FileText,
  LogOut,
  Save,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { useAppStore } from "../store";
import WorkspaceGate from "./WorkspaceGate";
import { getWorkspaceSession } from "../utils/session";
import { signOut } from "../utils/useAuthSession";
const groups = [
  {
    title: "日常记录",
    items: [{ path: "/", name: "犯错记录", icon: <PenSquare size={17} /> }],
  },
  {
    title: "复盘分析",
    items: [
      { path: "/logs", name: "记录明细", icon: <FileText size={17} /> },
      { path: "/report", name: "复盘手记", icon: <FileText size={17} /> },
    ],
  },
  {
    title: "本队管理",
    items: [
      { path: "/teams", name: "队伍管理", icon: <Users size={17} /> },
      { path: "/bosses", name: "副本管理", icon: <Swords size={17} /> },
      { path: "/members", name: "成员与邀请", icon: <UserRound size={17} /> },
      { path: "/backup", name: "数据备份", icon: <Save size={17} /> },
      {
        path: "/preferences",
        name: "个人偏好",
        icon: <SlidersHorizontal size={17} />,
      },
    ],
  },
];
export default function Layout() {
  const location = useLocation();
  const { bossProfiles, teams, isHydrated } = useAppStore();
  const session = getWorkspaceSession();
  if (!session) return <WorkspaceGate />;
  if (session.role === "admin")
    return (
      <div className="admin-denied">
        <h1>FF14 管理员入口已独立</h1>
        <p>队长工作区和跨队进度在 FF14 模块管理后台维护。</p>
        <a href="/ff14/admin/">进入 FF14 模块管理 →</a>
      </div>
    );
  if (!isHydrated)
    return (
      <p className="admin-loading">
        正在同步 {session.workspaceName} 的复盘数据…
      </p>
    );
  if (location.pathname === "/progress") return <Navigate to="/" replace />;
  if (location.pathname === "/settings")
    return <Navigate to="/members" replace />;
  if (
    (bossProfiles.length === 0 || teams.length === 0) &&
    location.pathname !== "/setup"
  )
    return <Navigate to="/setup" replace />;
  if (location.pathname === "/setup")
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-slate-900">
        <Outlet />
      </main>
    );
  const current =
    groups
      .flatMap((group) => group.items)
      .find((item) => item.path === location.pathname)?.name || "复盘工作区";
  return (
    <div className="workspace-shell" data-workspace-area="ff14">
      <aside className="workspace-sidebar">
        <div className="workspace-title">
          <strong>FF14 复盘工作区</strong>
          <span>{session.workspaceName}</span>
        </div>
        <nav className="workspace-groups" aria-label="FF14 复盘导航">
          {groups.map((group) => (
            <div key={group.title}>
              <span>{group.title}</span>
              <div>
                {group.items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={
                      location.pathname === item.path ? "page" : undefined
                    }
                  >
                    {item.icon}
                    {item.name}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="workspace-context">
          {session.siteRoles?.includes("editor") && (
            <a href="/admin/">切换到站点后台 ↗</a>
          )}
          <a href="/ff14/">FF14 专区 ↗</a>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="退出登录"
          >
            <LogOut size={15} />
            退出
          </button>
        </div>
      </aside>
      <div className="workspace-body">
        <header className="workspace-heading">
          <span>
            FF14 复盘工作区 / <strong>{current}</strong>
          </span>
          <small>
            {session.displayName} ·{" "}
            {session.role === "captain" ? "队长" : "成员"}
          </small>
        </header>
        <main className="workspace-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
