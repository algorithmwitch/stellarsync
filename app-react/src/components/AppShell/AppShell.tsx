import type { PropsWithChildren } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  buildWorkspacePath,
  getLegacyWorkspaceUrl,
  getWorkspaceSwitchTarget,
} from "@/features/workspaces/routing";
import { WorkspaceDiagnosticsPanel } from "@/features/workspaces/WorkspaceDiagnosticsPanel";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);
  const memberships = useWorkspaceStore((state) => state.memberships);
  const workspaceSlug = workspace?.slug || "";

  const navLinks = workspaceSlug
    ? [
        { to: buildWorkspacePath(workspaceSlug, "calendar"), label: "Calendar" },
        { to: buildWorkspacePath(workspaceSlug, "queue"), label: "Queue" },
        { to: buildWorkspacePath(workspaceSlug, "media"), label: "Media" },
        {
          to: buildWorkspacePath(workspaceSlug, "settings/connected-accounts"),
          label: "Connected Accounts",
        },
      ]
    : [];

  return (
    <div className="stellar-shell">
      <aside className="stellar-sidebar">
        <div className="space-y-2">
          <div className="stellar-eyebrow">StellarSync React</div>
          <h1 className="m-0 text-2xl font-semibold text-stellar-text-strong">
            {workspace?.name || workspace?.slug || "Workspace"}
          </h1>
          {memberships.length > 1 ? (
            <label className="grid gap-2 text-sm text-stellar-muted">
              <span>Workspace</span>
              <select
                className="rounded-2xl border border-stellar-border bg-black/10 px-3 py-2 text-sm text-stellar-text-strong"
                value={workspaceSlug}
                onChange={(event) => {
                  const nextSlug = event.target.value;
                  if (!nextSlug || nextSlug === workspaceSlug) return;
                  navigate(getWorkspaceSwitchTarget(location.pathname, nextSlug));
                }}
              >
                {memberships.map((membership) => (
                  <option key={membership.workspaceId} value={membership.slug}>
                    {membership.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <nav className="mt-6 grid gap-3" aria-label="Primary">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                ["stellar-nav-link", isActive ? "stellar-nav-link-active" : ""].filter(Boolean).join(" ")
              }
            >
              {link.label}
            </NavLink>
          ))}
          <a className="stellar-nav-link" href={workspaceSlug ? getLegacyWorkspaceUrl(workspaceSlug) : "/app/"}>
            Legacy App
          </a>
          {memberships.length > 1 ? (
            <NavLink
              to="/workspaces"
              className={({ isActive }) =>
                ["stellar-nav-link", isActive ? "stellar-nav-link-active" : ""].filter(Boolean).join(" ")
              }
            >
              Switch Workspace
            </NavLink>
          ) : null}
        </nav>
        <div className="mt-6">
          <WorkspaceDiagnosticsPanel />
        </div>
      </aside>
      <main className="stellar-content">{children}</main>
    </div>
  );
}
