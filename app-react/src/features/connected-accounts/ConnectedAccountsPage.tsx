import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/Badge/Badge";
import { Button } from "@/components/Button/Button";
import { Card } from "@/components/Card/Card";
import { EmptyState } from "@/components/EmptyState/EmptyState";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { fetchConnectedAccounts, startOAuthConnection, disconnectConnectedAccount } from "@/services/connectedAccounts/api";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { ConnectedAccount } from "@/types/connectedAccounts";

function findAccount(accounts: ConnectedAccount[], provider: string, accountType: string) {
  return accounts.find((account) => account.provider === provider && account.accountType === accountType) || null;
}

const statusBadgeTone = {
  connected: "connected",
  pending: "pending",
  expired: "pending",
  disconnected: "neutral",
  revoked: "error",
  error: "error",
} as const;

const statusLabels = {
  connected: "Connected",
  pending: "Connecting",
  expired: "Action needed",
  disconnected: "Not connected",
  revoked: "Connection error",
  error: "Connection error",
} as const;

export default function ConnectedAccountsPage() {
  const queryClient = useQueryClient();
  const activeWorkspace = useWorkspaceStore((state) => state.activeWorkspace);
  const [params, setParams] = useSearchParams();
  const workspaceId = activeWorkspace?.workspaceId || "";
  const workspaceSlug = activeWorkspace?.slug || "";

  const accountsQuery = useQuery({
    queryKey: ["connected-accounts", workspaceId],
    queryFn: () => fetchConnectedAccounts(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const result = await startOAuthConnection(workspaceId, workspaceSlug, "linkedin", "personal");
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

  if (!workspaceId || !workspaceSlug) return <LoadingState label="Resolving workspace" />;
  if (accountsQuery.isLoading) return <LoadingState label="Loading connected accounts" />;
  if (accountsQuery.isError) {
    return <EmptyState title="Connected Accounts unavailable" body={accountsQuery.error instanceof Error ? accountsQuery.error.message : "Request failed"} />;
  }

  return (
    <section className="grid gap-4">
      <Card as="section" className="space-y-3">
        <div className="stellar-eyebrow">Architecture report</div>
        <h2 className="m-0 text-2xl font-semibold text-stellar-text-strong">Connected Accounts</h2>
        <p className="m-0 max-w-3xl text-sm leading-6 text-stellar-muted">
          The React route uses persisted server state from <code>social-connection-status</code>.
          OAuth query parameters only trigger refetch; they are not treated as the source of truth.
        </p>
      </Card>

      <Card as="section" tone="raised" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="stellar-eyebrow">LinkedIn Personal Profile</div>
            <h3 className="m-0 text-xl font-semibold text-stellar-text-strong">
              {linkedInPersonal?.displayName || "Not connected"}
            </h3>
            <p className="m-0 text-sm text-stellar-muted">
              {linkedInPersonal?.lastVerifiedAt
                ? `Last verified ${new Date(linkedInPersonal.lastVerifiedAt).toLocaleString()}`
                : "Personal-profile auth is tracked independently from organization-page setup."}
            </p>
          </div>
          <Badge tone={statusBadgeTone[linkedInPersonal?.status || "disconnected"]}>
            {statusLabels[linkedInPersonal?.status || "disconnected"]}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-stellar-muted-strong">
              Personal publishing
            </div>
            <div className="mt-2 text-sm text-stellar-muted">
              {linkedInPersonal?.capabilities.canPublishPersonal ? "Available" : "Not granted"}
            </div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-stellar-muted-strong">
              Organization publishing
            </div>
            <div className="mt-2 text-sm text-stellar-muted">
              {linkedInPersonal?.capabilities.canPublishOrganization ? "Available" : "Not configured"}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => connectMutation.mutate()} disabled={connectMutation.isPending}>
            {connectMutation.isPending
              ? "Connecting..."
              : linkedInPersonal
                ? "Reconnect LinkedIn Personal"
                : "Connect LinkedIn Personal"}
          </Button>
          {linkedInPersonal ? (
            <Button
              variant="secondary"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
            </Button>
          ) : null}
        </div>
      </Card>

      <Card as="section" className="space-y-2">
        <div className="stellar-eyebrow">LinkedIn Organization Page</div>
        <p className="m-0 text-sm leading-6 text-stellar-muted">
          Organization publishing stays separate from personal-profile auth and is not
          required for personal connected state.
        </p>
      </Card>
    </section>
  );
}
