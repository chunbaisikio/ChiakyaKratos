import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { BarChart2, LayoutDashboard, Users } from "lucide-react";
import WorkspaceGate from "../components/WorkspaceGate";
import { useAuthSession } from "../utils/useAuthSession";
import AdminShell, { AccessDenied, type AdminGroup } from "./AdminShell";
const Overview = lazy(() => import("./FF14Overview"));
const Captains = lazy(() => import("./CaptainAdmin"));
const Progress = lazy(() => import("../pages/ProgressBoard"));
const groups: AdminGroup[] = [
  {
    title: "模块",
    items: [
      { path: "/", label: "模块总览", icon: <LayoutDashboard size={18} /> },
    ],
  },
  {
    title: "工作区管理",
    items: [
      { path: "/captains", label: "队长与工作区", icon: <Users size={18} /> },
    ],
  },
  {
    title: "攻略进度",
    items: [
      { path: "/progress", label: "跨队进度", icon: <BarChart2 size={18} /> },
    ],
  },
];
export default function FF14AdminApp() {
  const { ready, session, error } = useAuthSession();
  if (!ready) return <p className="admin-loading">正在恢复 FF14 管理登录…</p>;
  if (!session)
    return (
      <>
        {error && (
          <p role="alert" className="p-4 text-amber-300">
            {error}
          </p>
        )}
        <WorkspaceGate area="ff14-admin" />
      </>
    );
  if (session.role !== "admin")
    return <AccessDenied area="ff14" session={session} />;
  return (
    <HashRouter>
      <Suspense
        fallback={<p className="admin-loading">正在加载 FF14 管理后台…</p>}
      >
        <Routes>
          <Route
            element={
              <AdminShell area="ff14" session={session} groups={groups} />
            }
          >
            <Route index element={<Overview />} />
            <Route path="captains" element={<Captains />} />
            <Route path="progress" element={<Progress />} />
            <Route
              path="settings"
              element={<Navigate to="/captains" replace />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
