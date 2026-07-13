import { useParams } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function WorkspaceDiagnosticsPanel() {
  const { workspaceSlug } = useParams();
  const userId = useAuthStore((state) => state.user?.id || "");
  const workspace = useWorkspaceStore((state) => state.activeWorkspace);

  if (!import.meta.env.DEV || !workspace) return null;

  return (
    <aside className="rounded-2xl border border-amber-300/25 bg-amber-400/8 p-3 text-xs text-amber-100">
      <div className="font-semibold uppercase tracking-[0.12em]">Workspace diagnostic</div>
      <div className="mt-2 grid gap-1">
        <div>Route slug: {workspaceSlug || "missing"}</div>
        <div>Workspace ID: {workspace.workspaceId}</div>
        <div>Workspace name: {workspace.name}</div>
        <div>User ID: {userId || "missing"}</div>
        <div>Role: {workspace.role}</div>
        <div>Sheets enabled: {workspace.features.sheetsEnabled ? "true" : "false"}</div>
        <div>Monday enabled: {workspace.features.mondayEnabled ? "true" : "false"}</div>
      </div>
    </aside>
  );
}
