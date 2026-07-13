import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/Card/Card";
import { LoadingState } from "@/components/LoadingState/LoadingState";
import { queueKeys } from "@/services/queue/keys";
import { cancelQueueItem, publishNow, retryQueueItem } from "@/services/queue/mutations";
import { fetchQueueItems } from "@/services/queue/queries";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { QueueItem, QueueItemStatus } from "@/types/social";

const STATUS_ORDER: QueueItemStatus[] = ["scheduled", "publishing", "published", "failed", "cancelled"];

export default function QueuePage() {
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspace?.workspaceId || "");
  const queryClient = useQueryClient();

  const queueQuery = useQuery({
    queryKey: queueKeys.list(workspaceId),
    queryFn: () => fetchQueueItems(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const publishMutation = useMutation({
    mutationFn: async (postId: string) => publishNow(workspaceId, postId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queueKeys.list(workspaceId) });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (queueId: string) => retryQueueItem(workspaceId, queueId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queueKeys.list(workspaceId) });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (queueId: string) => cancelQueueItem(workspaceId, queueId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queueKeys.list(workspaceId) });
    },
  });

  if (!workspaceId) return <LoadingState label="Resolving workspace" />;
  if (queueQuery.isLoading) return <LoadingState label="Loading social queue" />;

  const items = queueQuery.data || [];

  return (
    <section className="grid gap-4">
      <Card as="section" className="space-y-2">
        <div className="stellar-eyebrow">Queue</div>
        <h2 className="m-0 text-2xl font-semibold text-stellar-text-strong">Publishing queue</h2>
        <p className="m-0 text-sm text-stellar-muted">
          Queue state is read from canonical scheduled social tables rather than a client-only queue.
        </p>
      </Card>

      {STATUS_ORDER.map((status) => {
        const bucket = items.filter((item) => item.status === status);
        return (
          <Card key={status} as="section" className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="m-0 text-lg font-semibold capitalize text-stellar-text-strong">{status}</h3>
              <span className="text-sm text-stellar-muted">{bucket.length}</span>
            </div>
            {bucket.length ? (
              <div className="grid gap-3">
                {bucket.map((item) => (
                  <QueueRow
                    key={item.id}
                    item={item}
                    onPublish={() => item.postId && publishMutation.mutate(item.postId)}
                    onRetry={() => retryMutation.mutate(item.id)}
                    onCancel={() => cancelMutation.mutate(item.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-sm text-stellar-muted">No items.</div>
            )}
          </Card>
        );
      })}
    </section>
  );
}

function QueueRow({
  item,
  onPublish,
  onRetry,
  onCancel,
}: {
  item: QueueItem;
  onPublish(): void;
  onRetry(): void;
  onCancel(): void;
}) {
  return (
    <div className="rounded-2xl border border-stellar-border bg-black/10 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-sm font-semibold text-stellar-text-strong">
            {item.platform || item.provider || "Unassigned channel"}
          </div>
          <div className="mt-1 text-xs text-stellar-muted">
            {item.scheduledAt
              ? `Scheduled ${new Date(item.scheduledAt).toLocaleString()}`
              : "No scheduled time"}
          </div>
          {item.errorMessage ? (
            <div className="mt-2 text-xs text-rose-300">{item.errorMessage}</div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {item.postId ? (
            <button type="button" className="stellar-nav-link px-3 py-2" onClick={onPublish}>
              Publish now
            </button>
          ) : null}
          {item.status === "failed" ? (
            <button type="button" className="stellar-nav-link px-3 py-2" onClick={onRetry}>
              Retry
            </button>
          ) : null}
          {item.status === "scheduled" ? (
            <button type="button" className="stellar-nav-link px-3 py-2" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
