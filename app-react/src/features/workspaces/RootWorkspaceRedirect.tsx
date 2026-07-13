import { Navigate } from "react-router-dom";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { buildWorkspacePath } from "@/features/workspaces/routing";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function RootWorkspaceRedirect() {
  const memberships = useWorkspaceStore((state) => state.memberships);

  if (!memberships.length) {
    return <LoadingState label="Loading workspaces" />;
  }
  if (memberships.length === 1) {
    return <Navigate to={buildWorkspacePath(memberships[0].slug)} replace />;
  }
  return <Navigate to="/workspaces" replace />;
}
