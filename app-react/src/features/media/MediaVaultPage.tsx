import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/Card/Card";
import { MediaGrid } from "@/features/media/MediaGrid";
import { mediaKeys } from "@/services/media/keys";
import { fetchMediaAssets } from "@/services/media/queries";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const PAGE_SIZE = 24;

export default function MediaVaultPage() {
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspace?.workspaceId || "");
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");

  const mediaQuery = useQuery({
    queryKey: mediaKeys.list(workspaceId, { limit: PAGE_SIZE, offset, search }),
    queryFn: () => fetchMediaAssets(workspaceId, { limit: PAGE_SIZE, offset, search }),
    enabled: Boolean(workspaceId),
  });

  const total = mediaQuery.data?.total || 0;
  const items = mediaQuery.data?.items || [];

  return (
    <section className="grid gap-4">
      <Card as="section" className="space-y-3">
        <div className="stellar-eyebrow">Media vault</div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="m-0 text-2xl font-semibold text-stellar-text-strong">Workspace media</h2>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setOffset(0);
            }}
            placeholder="Search filename"
            className="w-full max-w-sm rounded-2xl border border-stellar-border bg-black/10 px-4 py-3 text-sm text-stellar-text-strong"
          />
        </div>
        <p className="m-0 text-sm text-stellar-muted">
          Media Vault is lazy-loaded and paginated. Public assets use permanent public URLs;
          private assets only sign on demand.
        </p>
      </Card>

      {mediaQuery.data ? <MediaGrid assets={items} /> : <Card>Loading media...</Card>}

      <div className="flex items-center justify-between">
        <div className="text-sm text-stellar-muted">
          Showing {items.length ? offset + 1 : 0}-{offset + items.length} of {total}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="stellar-nav-link"
            disabled={offset === 0}
            onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
          >
            Previous
          </button>
          <button
            type="button"
            className="stellar-nav-link"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset((current) => current + PAGE_SIZE)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
