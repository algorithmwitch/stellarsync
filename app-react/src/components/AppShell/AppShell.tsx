import type { PropsWithChildren } from "react";
import { NavLink } from "react-router-dom";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function AppShell({ children }: PropsWithChildren) {
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="eyebrow">StellarSync React</div>
          <h1>{workspace?.name || workspace?.slug || "Workspace"}</h1>
        </div>
        <nav className="nav-list" aria-label="Primary">
          <NavLink to="/">Calendar</NavLink>
          <NavLink to="/settings/connected-accounts">Connected Accounts</NavLink>
          <a href="/app/legacy/">Legacy App</a>
        </nav>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

