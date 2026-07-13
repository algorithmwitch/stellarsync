import { callEdgeFunction } from "@/services/supabase/edge";
import { createConnectedAccountsReturnUrl } from "@/features/workspaces/routing";
import { normalizeConnectedAccount } from "@/services/connectedAccounts/model";
import type { ConnectedAccount } from "@/types/connectedAccounts";

type StatusResponse = {
  ok: boolean;
  workspace_id: string;
  connections: Record<string, unknown>[];
};

export async function fetchConnectedAccounts(workspaceId: string): Promise<ConnectedAccount[]> {
  const response = await callEdgeFunction<StatusResponse>("social-connection-status", {
    workspace_id: workspaceId,
  });
  return (response.connections || []).map(normalizeConnectedAccount);
}

export async function startOAuthConnection(
  workspaceId: string,
  workspaceSlug: string,
  provider: string,
  accountType: string,
) {
  return callEdgeFunction<{
    ok: boolean;
    authorization_url: string;
  }>("social-auth-start", {
    workspace_id: workspaceId,
    provider,
    account_type: accountType,
    return_url: createConnectedAccountsReturnUrl(window.location.origin, workspaceSlug),
  });
}

export async function disconnectConnectedAccount(workspaceId: string, provider: string, accountType: string) {
  return callEdgeFunction("social-connection-status", {
    action: "disconnect",
    workspace_id: workspaceId,
    provider,
    account_type: accountType,
  });
}
