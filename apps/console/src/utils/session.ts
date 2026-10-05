export type WorkspaceRole = 'admin' | 'captain' | 'member';

export interface WorkspaceSession {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  displayName: string;
  csrfToken: string;
  siteRoles?: string[];
  role: WorkspaceRole;
  workspaceType: 'admin' | 'captain';
  inviteCode?: string;
}

const SESSION_STORAGE_KEY = 'ff14oopsie-team-session';

export function getWorkspaceSession(): WorkspaceSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as WorkspaceSession;
    // Legacy sessions contain the password. Re-authenticate and replace them.
    if (!session.csrfToken || !session.userId || !session.workspaceId) return null;
    return session;
  } catch (error) {
    console.error('Failed to read workspace session:', error);
    return null;
  }
}

export function setWorkspaceSession(session: WorkspaceSession): void {
  const { userId, workspaceId, workspaceName, displayName, csrfToken, role, workspaceType, inviteCode, siteRoles } = session;
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ userId, workspaceId, workspaceName, displayName, csrfToken, role, workspaceType, inviteCode, siteRoles }));
}

export function clearWorkspaceSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function getWorkspaceScopedStorageKey(baseKey: string): string {
  const session = getWorkspaceSession();
  return session ? `${baseKey}:${session.workspaceId}` : baseKey;
}
