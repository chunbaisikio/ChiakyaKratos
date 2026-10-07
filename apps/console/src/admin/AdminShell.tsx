import { Link, Outlet, useLocation } from "react-router-dom";
import { ArrowUpRight, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkspaceSession } from "../utils/session";
import { signOut } from "../utils/useAuthSession";
export type AdminGroup = {
  title: string;
  items: { path: string; label: string; icon: ReactNode }[];
};
export default function AdminShell({
  area,
  session,
  groups,
}: {
  area: "site" | "ff14";
  session: WorkspaceSession;
  groups: AdminGroup[];
}) {
  const location = useLocation();
  const site = area === "site";
  const title = site ? "站点管理" : "FF14 模块管理";
  const current =
    groups
      .flatMap((group) => group.items)
      .find((item) => item.path === location.pathname)?.label || "管理总览";
  return (
    <div className="admin-shell" data-admin-area={area}>
      <div className="admin-globalbar">
        <a href="/">
          ✿ Chiakya <small>的小窝</small>
        </a>
        <span>{title}</span>
      </div>
      <aside className="admin-sidebar">
        <div className="admin-profile">
          <div className="admin-avatar">
            {import.meta.env.BASE_URL !== "/" ? (
              <img src="/assets/Joan.webp" alt="" />
            ) : (
              session.displayName.slice(0, 1)
            )}
          </div>
          <strong>{session.displayName}</strong>
        </div>
        <div className="admin-area-label">{title}</div>
        <p className="admin-scope">
          {site
            ? "整理文章、照片和兴趣，管理你的个人站点。"
            : "管理队长工作区与跨队进度，维护 FF14 复盘模块。"}
        </p>
        <nav
          aria-label={site ? "站点后台导航" : "FF14 管理导航"}
          className="admin-nav"
        >
          {groups.map((group) => (
            <div key={group.title} className="admin-nav-group">
              <p>{group.title}</p>
              {group.items.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={
                    location.pathname === item.path ? "page" : undefined
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="admin-context-links">
          <span>切换管理范围</span>
          {site && session.role === "admin" && (
            <a href="/ff14/admin/">
              FF14 模块管理 <ArrowUpRight size={15} />
            </a>
          )}
          {!site && session.siteRoles?.includes("editor") && (
            <a href="/admin/">
              站点管理 <ArrowUpRight size={15} />
            </a>
          )}
          {session.role !== "admin" && (
            <a href="/ff14/oopsie/">
              FF14 复盘工作区 <ArrowUpRight size={15} />
            </a>
          )}
          <a href="/">
            查看个人站点 <ArrowUpRight size={15} />
          </a>
        </div>
      </aside>
      <div className="admin-body">
        <header className="admin-topbar">
          <div>
            <span>{title}</span>
            <span aria-hidden="true"> / </span>
            <strong>{current}</strong>
          </div>
          <div className="admin-identity">
            <span>
              {session.displayName}
              <small>{site ? "内容编辑者" : "FF14 管理员"}</small>
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="退出登录"
            >
              <LogOut size={17} />
              <span>退出</span>
            </button>
          </div>
        </header>
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AccessDenied({
  area,
  session,
}: {
  area: "site" | "ff14";
  session: WorkspaceSession;
}) {
  return (
    <div className="admin-denied">
      <h1>
        {area === "site"
          ? "当前账号没有站点编辑权限"
          : "当前账号没有 FF14 模块管理权限"}
      </h1>
      <p>
        已登录为 {session.displayName}。
        {area === "site"
          ? "文章、相册、名片和发布需要独立的内容编辑权限。"
          : "队长工作区总览与队长邀请需要 FF14 管理员权限。"}
      </p>
      <div>
        <a href={session.role === "admin" ? "/ff14/admin/" : "/ff14/oopsie/"}>
          回到 FF14 {session.role === "admin" ? "模块管理" : "复盘工作区"} →
        </a>
        {area === "ff14" && session.siteRoles?.includes("editor") && (
          <a href="/admin/">进入站点后台 →</a>
        )}
        <button type="button" onClick={() => void signOut()}>
          退出并切换账号
        </button>
      </div>
    </div>
  );
}
