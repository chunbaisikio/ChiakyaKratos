import { useEffect, useState } from "react";
import {
  clearWorkspaceSession,
  setWorkspaceSession,
  type WorkspaceSession,
} from "./session";
import { fetchJson } from "./http";

// Site and module administration restore identity without loading a team snapshot.
export function useAuthSession() {
  const [state, setState] = useState<{
    ready: boolean;
    session: WorkspaceSession | null;
    error: string;
  }>({ ready: false, session: null, error: "" });
  useEffect(() => {
    let active = true;
    fetchJson<{ session: WorkspaceSession }>("/api/auth/session")
      .then(({ session }) => {
        if (!active) return;
        setWorkspaceSession(session);
        setState({ ready: true, session, error: "" });
      })
      .catch((error) => {
        if (!active) return;
        clearWorkspaceSession();
        setState({
          ready: true,
          session: null,
          error: error?.status === 401 ? "" : error.message,
        });
      });
    return () => {
      active = false;
    };
  }, []);
  return state;
}

export async function signOut() {
  try {
    await fetchJson("/api/auth/logout", { method: "POST" });
    clearWorkspaceSession();
    window.location.reload();
  } catch (error) {
    window.alert(
      error instanceof Error ? error.message : "退出失败，请稍后重试。",
    );
  }
}
