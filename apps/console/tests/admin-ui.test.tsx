import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { WorkspaceSession } from "../src/utils/session";
let actor: WorkspaceSession;
vi.mock("../src/utils/useAuthSession", () => ({
  useAuthSession: () => ({ ready: true, session: actor, error: "" }),
  signOut: vi.fn(),
}));
vi.mock("../src/utils/session", () => ({ getWorkspaceSession: () => actor }));
// Administration must not depend on the FF14 snapshot store, even for an empty team.
vi.mock("../src/store", () => {
  throw new Error("Administration imported the team snapshot store");
});
import SiteAdminApp from "../src/admin/SiteAdminApp";
import FF14AdminApp from "../src/admin/FF14AdminApp";
describe("independent administration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
    actor = {
      userId: "user",
      workspaceId: "workspace",
      workspaceName: "队伍",
      displayName: "测试者",
      csrfToken: "csrf",
      role: "admin",
      workspaceType: "admin",
      siteRoles: [],
    };
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            posts: [],
            albums: [],
            total: 0,
            profiles: [],
            workspaces: [],
            invites: [],
            rows: [],
            state: "idle",
            available: true,
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    );
  });
  it("requires a site role even for an FF14 administrator", () => {
    render(<SiteAdminApp />);
    expect(
      screen.getByRole("heading", { name: "当前账号没有站点编辑权限" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "站点后台导航" }),
    ).not.toBeInTheDocument();
  });
  it("opens site administration for a captain editor without loading a team", async () => {
    actor = {
      ...actor,
      role: "captain",
      workspaceType: "captain",
      siteRoles: ["editor"],
    };
    render(<SiteAdminApp />);
    expect(
      await screen.findByRole("heading", { name: "站点管理总览" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "站点后台导航" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "文章管理" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "队长与工作区" }),
    ).not.toBeInTheDocument();
    expect(
      vi
        .mocked(fetch)
        .mock.calls.every(([url]) => String(url).startsWith("/api/site/")),
    ).toBe(true);
  });
  it("shows only FF14 management features to module administrators", async () => {
    render(<FF14AdminApp />);
    expect(
      await screen.findByRole("heading", { name: "FF14 模块总览" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "跨队进度" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "文章管理" }),
    ).not.toBeInTheDocument();
    expect(
      vi
        .mocked(fetch)
        .mock.calls.every(([url]) =>
          String(url).startsWith("/api/ff14/admin/"),
        ),
    ).toBe(true);
  });
  it("does not grant module management to a site editor", () => {
    actor = {
      ...actor,
      role: "member",
      workspaceType: "captain",
      siteRoles: ["editor"],
    };
    render(<FF14AdminApp />);
    expect(
      screen.getByRole("heading", { name: "当前账号没有 FF14 模块管理权限" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "FF14 管理导航" }),
    ).not.toBeInTheDocument();
  });
});
