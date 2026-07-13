import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/Modal/Modal";
import { MediaGrid } from "@/features/media/MediaGrid";
import { mediaKeys } from "@/services/media/keys";
import { fetchMediaAssets } from "@/services/media/queries";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import type { MediaAsset } from "@/types/media";

type MediaPickerDialogProps = {
  open: boolean;
  selectedAssets: MediaAsset[];
  onClose(): void;
  onSave(assets: MediaAsset[]): void;
};

export function MediaPickerDialog({ open, selectedAssets, onClose, onSave }: MediaPickerDialogProps) {
  const workspaceId = useWorkspaceStore((state) => state.activeWorkspace?.workspaceId || "");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedAssets.map((asset) => asset.id));

  const mediaQuery = useQuery({
    queryKey: mediaKeys.list(workspaceId, { limit: 24, offset: 0, search }),
    queryFn: () => fetchMediaAssets(workspaceId, { limit: 24, offset: 0, search }),
    enabled: open && Boolean(workspaceId),
  });

  const selectedAssetMap = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    selectedAssets.forEach((asset) => map.set(asset.id, asset));
    mediaQuery.data?.items.forEach((asset) => map.set(asset.id, asset));
    return map;
  }, [mediaQuery.data?.items, selectedAssets]);

  function toggle(asset: MediaAsset) {
    setSelectedIds((current) =>
      current.includes(asset.id) ? current.filter((id) => id !== asset.id) : [...current, asset.id],
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Select media" widthClassName="max-w-6xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search filename"
          className="w-full rounded-2xl border border-stellar-border bg-black/10 px-4 py-3 text-sm text-stellar-text-strong"
        />
        <button
          type="button"
          className="stellar-button-base stellar-button-primary"
          onClick={() => onSave(selectedIds.map((id) => selectedAssetMap.get(id)).filter((asset): asset is MediaAsset => Boolean(asset)))}
        >
          Attach selected
        </button>
      </div>
      {mediaQuery.data ? (
        <MediaGrid assets={mediaQuery.data.items} selectedIds={selectedIds} onToggle={toggle} />
      ) : (
        <div className="text-sm text-stellar-muted">Loading media...</div>
      )}
    </Modal>
  );
}
