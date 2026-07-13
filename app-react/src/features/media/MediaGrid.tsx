import type { MediaAsset } from "@/types/media";

type MediaGridProps = {
  assets: MediaAsset[];
  selectedIds?: string[];
  onToggle?(asset: MediaAsset): void;
};

export function MediaGrid({ assets, selectedIds = [], onToggle }: MediaGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {assets.map((asset) => {
        const selected = selectedIds.includes(asset.id);
        const url = asset.previewUrl || asset.mediaUrl || "";
        return (
          <button
            key={asset.id}
            type="button"
            className={`stellar-card overflow-hidden p-0 text-left ${selected ? "border-stellar-accent/60" : ""}`}
            onClick={() => onToggle?.(asset)}
          >
            <div className="aspect-square bg-black/20">
              {asset.mediaType === "image" && url ? (
                <img src={url} alt={asset.altText || asset.fileName || "Media asset"} className="h-full w-full object-cover" loading="lazy" decoding="async" />
              ) : asset.mediaType === "video" && url ? (
                <video src={url} className="h-full w-full object-cover" preload="none" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-stellar-muted">
                  {asset.mediaType}
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="truncate text-sm font-semibold text-stellar-text-strong">
                {asset.fileName || asset.storagePath}
              </div>
              <div className="mt-1 text-xs text-stellar-muted">{asset.mediaType}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
