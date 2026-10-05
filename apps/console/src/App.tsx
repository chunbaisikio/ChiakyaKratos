import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import TelemetryProvider from "./utils/TelemetryProvider";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  clearWorkspaceSession,
  getWorkspaceSession,
  setWorkspaceSession,
  type WorkspaceSession,
} from "./utils/session";
import { fetchJson } from "./utils/http";
import { useAppStore } from "./store";
import SiteNavigation from "./components/SiteNavigation";
import SyncBanner from "./components/SyncBanner";

const Tracker = lazy(() => import("./pages/Tracker"));
const Teams = lazy(() => import("./pages/Teams"));
const Bosses = lazy(() => import("./pages/Bosses"));
const Setup = lazy(() => import("./pages/Setup"));
const Logs = lazy(() => import("./pages/Logs"));
const Settings = lazy(() => import("./pages/Settings"));
const Report = lazy(() => import("./pages/Report"));
const StandaloneAdmin = lazy(() => import("./admin/FF14AdminApp"));

function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const { session } = await fetchJson<{ session: WorkspaceSession }>(
          "/api/auth/session",
        );
        if (!active) return;
        setWorkspaceSession(session);
        if (session.role === "admin") {
          if (import.meta.env.BASE_URL !== "/") {
            const path =
              window.location.hash === "#/progress"
                ? "/progress"
                : window.location.hash === "#/settings"
                  ? "/captains"
                  : "/";
            window.location.replace(`/ff14/admin/#${path}`);
          }
          return;
        }
        await useAppStore.persist.rehydrate();
      } catch {
        if (active) clearWorkspaceSession();
      } finally {
        if (active) setReady(true);
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, []);
  if (
    ready &&
    getWorkspaceSession()?.role === "admin" &&
    import.meta.env.BASE_URL === "/"
  )
    return (
      <Suspense
        fallback={<p className="admin-loading">正在加载 FF14 管理后台…</p>}
      >
        <StandaloneAdmin />
      </Suspense>
    );
  return (
    <TelemetryProvider>
      <SiteNavigation />
      {ready ? (
        <>
          <SyncBanner />
          <HashRouter>
            <Suspense
              fallback={
                <div className="min-h-screen flex items-center justify-center text-slate-400">
                  正在加载工作区…
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<Tracker />} />
                  <Route path="teams" element={<Teams />} />
                  <Route path="bosses" element={<Bosses />} />
                  <Route path="logs" element={<Logs />} />
                  <Route
                    path="progress"
                    element={<Navigate to="/" replace />}
                  />
                  <Route path="report" element={<Report />} />
                  <Route
                    path="settings"
                    element={<Navigate to="/members" replace />}
                  />
                  <Route
                    path="members"
                    element={<Settings section="members" />}
                  />
                  <Route
                    path="backup"
                    element={<Settings section="backup" />}
                  />
                  <Route
                    path="preferences"
                    element={<Settings section="preferences" />}
                  />
                  <Route path="setup" element={<Setup />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </HashRouter>
        </>
      ) : (
        <div className="min-h-screen flex items-center justify-center text-slate-400">
          正在恢复登录状态…
        </div>
      )}
    </TelemetryProvider>
  );
}

export default App;
