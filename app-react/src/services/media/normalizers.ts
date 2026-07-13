import { getRenderableMediaUrl, resolveSupabasePublicMediaUrl } from "@/services/media/helpers";
import type { MediaAsset, PostMediaRelationship } from "@/types/media";
import type { MediaAssetRow, PostMediaRow } from "@/services/media/model";

function normalizeMediaType(value: string | null | undefined): MediaAsset["mediaType"] {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "image" || normalized === "video" || normalized === "document") return normalized;
  return "unknown";
}

export function normalizeMediaAsset(row: MediaAssetRow): MediaAsset {
  const metadata = row.metadata || {};
  const normalized: MediaAsset = {
    id: row.id,
    assetId: row.asset_id || null,
    workspaceId: row.workspace_id,
    bucket: String(row.bucket || "media").trim() || "media",
    storagePath: String(row.storage_path || "").trim(),
    mediaUrl: row.media_url || null,
    previewUrl: row.thumbnail_url || null,
    fileName: row.filename || null,
    mimeType: row.mime_type || null,
    mediaType: normalizeMediaType(row.media_type || row.mime_type),
    altText: row.alt_text || null,
    width: row.width ?? null,
    height: row.height ?? null,
    duration: row.duration_seconds ?? null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    isPrivate:
      metadata.is_private === true ||
      metadata.isPrivate === true ||
      String(metadata.access || "").toLowerCase() === "private" ||
      String(metadata.bucket_visibility || "").toLowerCase() === "private",
    linkedPostId: row.linked_post_id || null,
    linkedNoteId: row.linked_note_id || null,
    linkedInspoId: row.linked_inspo_id || null,
    metadata,
  };
  const canonicalUrl = getRenderableMediaUrl(normalized) || resolveSupabasePublicMediaUrl(normalized) || "";
  return {
    ...normalized,
    mediaUrl: normalized.mediaUrl || canonicalUrl || null,
    previewUrl: normalized.previewUrl || canonicalUrl || null,
  };
}

export function normalizePostMediaRelationship(row: PostMediaRow): PostMediaRelationship {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    postId: row.post_id,
    mediaAssetId: row.media_asset_id,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}
