import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import {
  Camera,
  FileText,
  Gamepad2,
  Images,
  LayoutDashboard,
  Send,
} from "lucide-react";
import WorkspaceGate from "../components/WorkspaceGate";
import { useAuthSession } from "../utils/useAuthSession";
import AdminShell, { AccessDenied, type AdminGroup } from "./AdminShell";
const Overview = lazy(() => import("./SiteOverview"));
const Editor = lazy(() => import("../pages/Editor"));
const Albums = lazy(() => import("../pages/Albums"));
const Games = lazy(() => import("../pages/GameProfiles"));
const MediaLibrary = lazy(() => import("./MediaLibrary"));
const groups: AdminGroup[] = [
  {
    title: "站点",
    items: [
      { path: "/", label: "管理总览", icon: <LayoutDashboard size={18} /> },
    ],
  },
  {
    title: "内容管理",
    items: [
      { path: "/posts", label: "文章管理", icon: <FileText size={18} /> },
      { path: "/albums", label: "相册与随记", icon: <Camera size={18} /> },
      { path: "/media", label: "图片库", icon: <Images size={18} /> },
      { path: "/games", label: "游戏名片", icon: <Gamepad2 size={18} /> },
    ],
  },
  {
    title: "公开站点",
    items: [
      { path: "/publication", label: "发布管理", icon: <Send size={18} /> },
    ],
  },
];
export default function SiteAdminApp() {
  const { ready, session, error } = useAuthSession();
  if (!ready) return <p className="admin-loading">正在恢复站点登录…</p>;
  if (!session)
    return (
      <>
        {error && (
          <p role="alert" className="p-4 text-amber-300">
            {error}
          </p>
        )}
        <WorkspaceGate area="site" />
      </>
    );
  if (!session.siteRoles?.includes("editor"))
    return <AccessDenied area="site" session={session} />;
  return (
    <HashRouter>
      <Suspense fallback={<p className="admin-loading">正在加载站点后台…</p>}>
        <Routes>
          <Route
            element={
              <AdminShell area="site" session={session} groups={groups} />
            }
          >
            <Route index element={<Overview />} />
            <Route path="posts" element={<Editor />} />
            <Route path="albums" element={<Albums />} />
            <Route path="games" element={<Games />} />
            <Route path="media" element={<MediaLibrary />} />
            <Route path="publication" element={<Overview publicationPage />} />
            <Route path="editor" element={<Navigate to="/posts" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
  );
}
