import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet, useParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import {
  ACTIVE_WORKSPACE_KEY,
  isWorkspaceScopedQueryKey,
  resolveWorkspaceMembershipBySlug,
} from "@/features/workspaces/routing";
import { useAuthStore } from "@/stores/authStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

export function WorkspaceRouteGate() {
  const queryClient = useQueryClient();
  const { workspaceSlug } = useParams();
  const authResolved = useAuthStore((state) => state.authResolved);
  const user = useAuthStore((state) => state.user);
  const memberships = useWorkspaceStore((state) => state.memberships);
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace);
  const clearActiveWorkspace = useWorkspaceStore((state) => state.clearActiveWorkspace);

  const resolvedWorkspace = useMemo(
    () => resolveWorkspaceMembershipBySlug(memberships, workspaceSlug),
    [memberships, workspaceSlug],
  );

  useEffect(() => {
    if (!workspaceSlug || !activeWorkspace || activeWorkspace.slug === workspaceSlug) return;
    queryClient.cancelQueries({
      predicate: (query) =>
        isWorkspaceScopedQueryKey(query.queryKey as readonly unknown[], activeWorkspace.workspaceId),
    });
    queryClient.removeQueries({
      predicate: (query) =>
        isWorkspaceScopedQueryKey(query.queryKey as readonly unknown[], activeWorkspace.workspaceId),
    });
    clearActiveWorkspace();
  }, [activeWorkspace, clearActiveWorkspace, queryClient, workspaceSlug]);

  useEffect(() => {
    if (!resolvedWorkspace) return;
    setActiveWorkspace(resolvedWorkspace);
    sessionStorage.setItem(
      ACTIVE_WORKSPACE_KEY,
      JSON.stringify({
        workspace_id: resolvedWorkspace.workspaceId,
        workspace_slug: resolvedWorkspace.slug,
      }),
    );
    performance.mark("workspace-resolved");
  }, [resolvedWorkspace, setActiveWorkspace]);

  if (!authResolved || !user) {
    return <LoadingState label="Restoring session" />;
  }
  if (!workspaceSlug) {
    return <EmptyState title="Workspace missing" body="The requested workspace route did not include a slug." />;
  }
  if (!memberships.length) {
    return <LoadingState label="Loading workspaces" />;
  }
  if (!resolvedWorkspace) {
    return (
      <EmptyState
        title="Workspace access denied"
        body={`You do not have access to the workspace "${workspaceSlug}".`}
      />
    );
  }

  return <Outlet />;
}
