import type { WorkspaceMembership } from "../../types/workspace";

export const ACTIVE_WORKSPACE_KEY = "STELLARSYNC_ACTIVE_WORKSPACE";

export function resolveWorkspaceMembershipBySlug(
  memberships: WorkspaceMembership[],
  workspaceSlug: string | undefined,
) {
  const normalizedSlug = String(workspaceSlug || "").trim().toLowerCase();
  if (!normalizedSlug) return null;
  return memberships.find((membership) => membership.slug.toLowerCase() === normalizedSlug) || null;
}

export function buildWorkspacePath(workspaceSlug: string, childPath = "calendar") {
  const normalizedChildPath = String(childPath || "calendar").replace(/^\/+/, "");
  return `/w/${encodeURIComponent(workspaceSlug)}/${normalizedChildPath}`;
}

export function getLegacyWorkspaceUrl(workspaceSlug: string, view?: string) {
  const params = new URLSearchParams({
    workspace: workspaceSlug,
  });
  if (view) {
    params.set("view", view);
  }
  return `/app/?${params.toString()}`;
}

export function getWorkspaceSwitchTarget(currentPathname: string, nextWorkspaceSlug: string) {
  const match = currentPathname.match(/^\/w\/[^/]+(?:\/(.*))?$/);
  const childPath = String(match?.[1] || "calendar").replace(/^\/+/, "");
  return buildWorkspacePath(nextWorkspaceSlug, childPath || "calendar");
}

export function isWorkspaceScopedQueryKey(queryKey: readonly unknown[], workspaceId: string) {
  return Array.isArray(queryKey) && queryKey.length > 1 && queryKey[1] === workspaceId;
}

export function createConnectedAccountsReturnUrl(origin: string, workspaceSlug: string) {
  return `${origin}${buildWorkspacePath(workspaceSlug, "settings/connected-accounts")}`;
}
