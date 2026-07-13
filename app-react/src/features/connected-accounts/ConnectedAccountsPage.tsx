import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { fetchConnectedAccounts, startOAuthConnection, disconnectConnectedAccount } from "@/services/connectedAccounts/api";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { ConnectedAccount } from "@/types/connectedAccounts";

function findAccount(accounts: ConnectedAccount[], provider: string, accountType: string) {
  return accounts.find((account) => account.provider === provider && account.accountType === accountType) || null;
}

export default function ConnectedAccountsPage() {
  const queryClient = useQueryClient();
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const [params, setParams] = useSearchParams();
  const workspaceId = activeWorkspace?.workspaceId || "";

  const accountsQuery = useQuery({
    queryKey: ["connected-accounts", workspaceId],
    queryFn: () => fetchConnectedAccounts(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const result = await startOAuthConnection(workspaceId, "linkedin", "personal");
      window.location.assign(result.authorization_url);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => disconnectConnectedAccount(workspaceId, "linkedin", "personal"),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["connected-accounts", workspaceId] });
    },
  });

  useEffect(() => {
    if (!workspaceId) return;
    const oauth = params.get("oauth");
    const provider = params.get("provider");
    const accountType = params.get("account_type");
    if (oauth !== "success" || provider !== "linkedin" || accountType !== "personal") return;

    let cancelled = false;
    const retrySchedule = [0, 500, 1500, 3000];

    (async () => {
      for (const delay of retrySchedule) {
        if (cancelled) return;
        if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
        const result = await queryClient.invalidateQueries({ queryKey: ["connected-accounts", workspaceId] });
        await result;
        const refreshed = await queryClient.fetchQuery({
          queryKey: ["connected-accounts", workspaceId],
          queryFn: () => fetchConnectedAccounts(workspaceId),
        });
        const linkedInPersonal = findAccount(refreshed, "linkedin", "personal");
        if (linkedInPersonal?.status === "connected") {
          const next = new URLSearchParams(params);
          next.delete("oauth");
          next.delete("provider");
          next.delete("account_type");
          setParams(next, { replace: true });
          return;
        }
      }
    })().catch((error) => {
      console.error("[connected-accounts] callback refetch failed", error);
    });

    return () => {
      cancelled = true;
    };
  }, [params, queryClient, setParams, workspaceId]);

  const linkedInPersonal = useMemo(
    () => findAccount(accountsQuery.data || [], "linkedin", "personal"),
    [accountsQuery.data],
  );

  if (!workspaceId) return <LoadingState label="Resolving workspace" />;
  if (accountsQuery.isLoading) return <LoadingState label="Loading connected accounts" />;
  if (accountsQuery.isError) {
    return <EmptyState title="Connected Accounts unavailable" body={accountsQuery.error instanceof Error ? accountsQuery.error.message : "Request failed"} />;
  }

  return (
    <section className="stack">
      <div className="panel">
        <div className="eyebrow">Architecture report</div>
        <h2>Connected Accounts</h2>
        <p>The React route uses persisted server state from `social-connection-status`. OAuth query parameters only trigger refetch; they are not treated as the source of truth.</p>
      </div>

      <div className="panel">
        <div className="eyebrow">LinkedIn Personal Profile</div>
        <h3>{linkedInPersonal?.displayName || "Not connected"}</h3>
        <p>Status: {linkedInPersonal?.status || "disconnected"}</p>
        <p>Capabilities: personal={String(linkedInPersonal?.capabilities.canPublishPersonal || false)} organization={String(linkedInPersonal?.capabilities.canPublishOrganization || false)}</p>
        <div className="button-row">
          <button type="button" onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
            {connectMutation.isPending ? "Connecting..." : linkedInPersonal ? "Reconnect LinkedIn Personal" : "Connect LinkedIn Personal"}
          </button>
          {linkedInPersonal ? (
            <button type="button" className="secondary" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
              {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="panel">
        <div className="eyebrow">LinkedIn Organization Page</div>
        <p>Organization publishing stays separate from personal-profile auth and is not required for personal connected state.</p>
      </div>
    </section>
  );
}

